import { supabase } from '../lib/supabase';
import type {
  Contract,
  ContractSignatureRequest,
  ContractSignature,
  ContractAuditEvent,
  ContractSignatureStatus,
} from '../types';
import { generateContractHTML } from './contractPdfExport';
import { getBrandKits } from './brandboard';

export async function computeDocumentHash(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

function generateSecureToken(): { raw: string; hash: Promise<string> } {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const raw = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  return { raw, hash: computeDocumentHash(raw) };
}

export async function freezeContract(
  contractId: string
): Promise<{ htmlSnapshot: string; jsonSnapshot: Record<string, unknown>; documentHash: string }> {
  const { data: contract, error } = await supabase
    .from('contracts')
    .select(`
      *,
      contact:contacts(*),
      sections:contract_sections(*)
    `)
    .eq('id', contractId)
    .single();

  if (error || !contract) throw new Error('Contract not found');

  let brandKit = null;
  try {
    const kits = await getBrandKits(contract.org_id, { active: true });
    if (kits.length > 0) brandKit = kits[0];
  } catch {
    // continue without brand kit
  }

  const htmlSnapshot = generateContractHTML(contract as Contract, brandKit);

  const jsonSnapshot = {
    title: contract.title,
    contract_type: contract.contract_type,
    total_value: contract.total_value,
    currency: contract.currency,
    effective_date: contract.effective_date,
    governing_law_state: contract.governing_law_state,
    party_a_name: contract.party_a_name,
    party_a_email: contract.party_a_email,
    party_b_name: contract.party_b_name,
    party_b_email: contract.party_b_email,
    contact: contract.contact
      ? {
          first_name: contract.contact.first_name,
          last_name: contract.contact.last_name,
          email: contract.contact.email,
          company: contract.contact.company,
        }
      : null,
    sections: (contract.sections || []).map((s: Record<string, unknown>) => ({
      title: s.title,
      content: s.content,
      section_type: s.section_type,
      sort_order: s.sort_order,
      annotation: s.annotation,
    })),
  };

  const documentHash = await computeDocumentHash(htmlSnapshot);

  const { error: updateError } = await supabase
    .from('contracts')
    .update({
      frozen_html_snapshot: htmlSnapshot,
      frozen_json_snapshot: jsonSnapshot,
      frozen_document_hash: documentHash,
    })
    .eq('id', contractId);

  if (updateError) throw updateError;
  return { htmlSnapshot, jsonSnapshot, documentHash };
}

export async function createContractSignatureRequest(
  contractId: string,
  contactId: string | null,
  signerName: string,
  signerEmail: string,
  expiresInDays: number,
  createdByUserId: string,
  orgId: string
): Promise<{ request: ContractSignatureRequest; rawToken: string; signingUrl: string }> {
  const token = generateSecureToken();
  const tokenHash = await token.hash;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  const { data: request, error } = await supabase
    .from('contract_signature_requests')
    .insert({
      org_id: orgId,
      contract_id: contractId,
      contact_id: contactId,
      signer_name: signerName,
      signer_email: signerEmail,
      access_token_hash: tokenHash,
      status: 'pending',
      expires_at: expiresAt.toISOString(),
      created_by_user_id: createdByUserId,
    })
    .select()
    .single();

  if (error) throw error;

  const { error: contractError } = await supabase
    .from('contracts')
    .update({
      signature_status: 'pending_signature' as ContractSignatureStatus,
      expires_at: expiresAt.toISOString(),
      signature_request_id: request.id,
      signer_name: signerName,
      signer_email: signerEmail,
    })
    .eq('id', contractId);

  if (contractError) throw contractError;

  await createContractAuditEvent({
    contractId,
    orgId,
    eventType: 'sent_for_signature',
    actorType: 'user',
    actorId: createdByUserId,
    metadata: { signer_name: signerName, signer_email: signerEmail, expires_at: expiresAt.toISOString() },
  });

  const signingUrl = `${window.location.origin}/sign/contract/${request.id}?token=${token.raw}`;
  return { request, rawToken: token.raw, signingUrl };
}

export async function verifyContractSigningToken(
  requestId: string,
  rawToken: string
): Promise<ContractSignatureRequest | null> {
  const tokenHash = await computeDocumentHash(rawToken);

  const { data, error } = await supabase
    .from('contract_signature_requests')
    .select('*')
    .eq('id', requestId)
    .eq('access_token_hash', tokenHash)
    .maybeSingle();

  if (error || !data) return null;
  return data;
}

export async function markContractRequestViewed(requestId: string, contractId: string, orgId: string): Promise<void> {
  const { data: request } = await supabase
    .from('contract_signature_requests')
    .select('viewed_at')
    .eq('id', requestId)
    .single();

  if (!request?.viewed_at) {
    await supabase
      .from('contract_signature_requests')
      .update({ viewed_at: new Date().toISOString(), status: 'viewed' })
      .eq('id', requestId);

    await supabase
      .from('contracts')
      .update({ signature_status: 'viewed' as ContractSignatureStatus })
      .eq('id', contractId)
      .in('signature_status', ['pending_signature']);

    await createContractAuditEvent({
      contractId,
      orgId,
      eventType: 'viewed',
      actorType: 'signer',
      metadata: { request_id: requestId },
    });
  }
}

export async function submitContractSignature(params: {
  requestId: string;
  contractId: string;
  orgId: string;
  signatureType: 'typed' | 'drawn';
  signatureText?: string;
  signatureImageUrl?: string;
  signerName: string;
  signerEmail: string;
  ipAddress?: string;
  userAgent?: string;
  consentText: string;
  documentHash: string;
}): Promise<ContractSignature> {
  const { data: signature, error } = await supabase
    .from('contract_signatures')
    .insert({
      org_id: params.orgId,
      contract_id: params.contractId,
      signature_request_id: params.requestId,
      signature_type: params.signatureType,
      signature_text: params.signatureText || null,
      signature_image_url: params.signatureImageUrl || null,
      signer_name: params.signerName,
      signer_email: params.signerEmail,
      ip_address: params.ipAddress || null,
      user_agent: params.userAgent || null,
      consent_text: params.consentText,
      document_hash: params.documentHash,
    })
    .select()
    .single();

  if (error) throw error;

  const now = new Date().toISOString();

  await supabase
    .from('contract_signature_requests')
    .update({ status: 'signed', signed_at: now })
    .eq('id', params.requestId);

  await supabase
    .from('contracts')
    .update({
      signature_status: 'signed' as ContractSignatureStatus,
      status: 'signed',
      signed_at: now,
      signer_name: params.signerName,
      signer_email: params.signerEmail,
    })
    .eq('id', params.contractId);

  await createContractAuditEvent({
    contractId: params.contractId,
    orgId: params.orgId,
    eventType: 'signed',
    actorType: 'signer',
    metadata: {
      request_id: params.requestId,
      signature_id: signature.id,
      signer_name: params.signerName,
      signer_email: params.signerEmail,
      ip_address: params.ipAddress,
      user_agent: params.userAgent,
      document_hash: params.documentHash,
    },
  });

  return signature;
}

export async function declineContractSignature(
  requestId: string,
  contractId: string,
  orgId: string,
  reason?: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  const now = new Date().toISOString();

  await supabase
    .from('contract_signature_requests')
    .update({ status: 'declined', declined_at: now, decline_reason: reason || null })
    .eq('id', requestId);

  await supabase
    .from('contracts')
    .update({ signature_status: 'declined' as ContractSignatureStatus, declined_at: now, status: 'declined' })
    .eq('id', contractId);

  await createContractAuditEvent({
    contractId,
    orgId,
    eventType: 'declined',
    actorType: 'signer',
    metadata: { request_id: requestId, reason: reason || null, ip_address: ipAddress, user_agent: userAgent },
  });
}

export async function voidContractSignatureRequest(
  requestId: string,
  contractId: string,
  orgId: string,
  actorUserId: string
): Promise<void> {
  await supabase
    .from('contract_signature_requests')
    .update({ status: 'voided' })
    .eq('id', requestId);

  await supabase
    .from('contracts')
    .update({ signature_status: 'voided' as ContractSignatureStatus })
    .eq('id', contractId);

  await createContractAuditEvent({
    contractId,
    orgId,
    eventType: 'voided',
    actorType: 'user',
    actorId: actorUserId,
    metadata: { request_id: requestId },
  });
}

export async function resendContractSignatureRequest(
  requestId: string,
  contractId: string,
  orgId: string,
  actorUserId: string
): Promise<{ rawToken: string; signingUrl: string }> {
  const token = generateSecureToken();
  const tokenHash = await token.hash;

  await supabase
    .from('contract_signature_requests')
    .update({ access_token_hash: tokenHash, viewed_at: null, status: 'pending' })
    .eq('id', requestId);

  await supabase
    .from('contracts')
    .update({ signature_status: 'pending_signature' as ContractSignatureStatus })
    .eq('id', contractId);

  await createContractAuditEvent({
    contractId,
    orgId,
    eventType: 'resent',
    actorType: 'user',
    actorId: actorUserId,
    metadata: { request_id: requestId },
  });

  const signingUrl = `${window.location.origin}/sign/contract/${requestId}?token=${token.raw}`;
  return { rawToken: token.raw, signingUrl };
}

export async function getContractSignatureRequest(
  contractId: string
): Promise<ContractSignatureRequest | null> {
  const { data, error } = await supabase
    .from('contract_signature_requests')
    .select('*')
    .eq('contract_id', contractId)
    .neq('status', 'voided')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return null;
  return data;
}

export async function getContractAuditEvents(contractId: string): Promise<ContractAuditEvent[]> {
  const { data, error } = await supabase
    .from('contract_audit_events')
    .select('*')
    .eq('contract_id', contractId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createContractAuditEvent(params: {
  contractId: string;
  orgId: string;
  eventType: string;
  actorType: 'system' | 'user' | 'signer';
  actorId?: string;
  metadata?: Record<string, unknown>;
}): Promise<ContractAuditEvent> {
  const { data, error } = await supabase
    .from('contract_audit_events')
    .insert({
      org_id: params.orgId,
      contract_id: params.contractId,
      event_type: params.eventType,
      actor_type: params.actorType,
      actor_id: params.actorId || null,
      metadata: params.metadata || {},
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getContractForSigning(contractId: string): Promise<Contract | null> {
  const { data, error } = await supabase
    .from('contracts')
    .select(`
      *,
      contact:contacts(first_name, last_name, email, company, phone),
      sections:contract_sections(title, content, section_type, sort_order, annotation)
    `)
    .eq('id', contractId)
    .maybeSingle();

  if (error) return null;
  return data;
}

export async function uploadContractSignatureImage(
  orgId: string,
  requestId: string,
  imageDataUrl: string
): Promise<string | null> {
  try {
    const base64Data = imageDataUrl.split(',')[1];
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'image/png' });

    const path = `${orgId}/${requestId}/signature.png`;
    const { error: uploadError } = await supabase.storage
      .from('contract-signatures')
      .upload(path, blob, { contentType: 'image/png', upsert: true });

    if (uploadError) return null;

    const { data: urlData } = supabase.storage
      .from('contract-signatures')
      .getPublicUrl(path);

    return urlData.publicUrl;
  } catch {
    return null;
  }
}
