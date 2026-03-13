import { supabase } from '../lib/supabase';
import type {
  Proposal,
  ProposalSignatureRequest,
  ProposalSignature,
  ProposalAuditEvent,
  ProposalSignatureStatus,
} from '../types';
import { generateProposalHTML } from './proposalPdfExport';
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
  const raw = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return { raw, hash: computeDocumentHash(raw) };
}

export async function freezeProposal(
  proposalId: string
): Promise<{ htmlSnapshot: string; jsonSnapshot: Record<string, unknown>; documentHash: string }> {
  const { data: proposal, error } = await supabase
    .from('proposals')
    .select(`
      *,
      contact:contacts(*),
      opportunity:opportunities(*),
      line_items:proposal_line_items(*, product:products(*)),
      sections:proposal_sections(*)
    `)
    .eq('id', proposalId)
    .single();

  if (error || !proposal) throw new Error('Proposal not found');

  let brandKit = null;
  try {
    const kits = await getBrandKits(proposal.org_id, { active: true });
    if (kits.length > 0) brandKit = kits[0];
  } catch {
    // continue without brand kit
  }

  const htmlSnapshot = generateProposalHTML(proposal as Proposal, brandKit);

  const jsonSnapshot = {
    title: proposal.title,
    total_value: proposal.total_value,
    currency: proposal.currency,
    summary: proposal.summary,
    contact: proposal.contact
      ? {
          first_name: proposal.contact.first_name,
          last_name: proposal.contact.last_name,
          email: proposal.contact.email,
          company: proposal.contact.company,
        }
      : null,
    sections: (proposal.sections || []).map((s: Record<string, unknown>) => ({
      title: s.title,
      content: s.content,
      section_type: s.section_type,
      sort_order: s.sort_order,
    })),
    line_items: (proposal.line_items || []).map((li: Record<string, unknown>) => ({
      name: li.name,
      description: li.description,
      quantity: li.quantity,
      unit_price: li.unit_price,
      discount_percent: li.discount_percent,
    })),
  };

  const documentHash = await computeDocumentHash(htmlSnapshot);

  const { error: updateError } = await supabase
    .from('proposals')
    .update({
      frozen_html_snapshot: htmlSnapshot,
      frozen_json_snapshot: jsonSnapshot,
      frozen_document_hash: documentHash,
    })
    .eq('id', proposalId);

  if (updateError) throw updateError;

  return { htmlSnapshot, jsonSnapshot, documentHash };
}

export async function createSignatureRequest(
  proposalId: string,
  contactId: string | null,
  signerName: string,
  signerEmail: string,
  expiresInDays: number,
  createdByUserId: string,
  orgId: string
): Promise<{ request: ProposalSignatureRequest; rawToken: string; signingUrl: string }> {
  const token = generateSecureToken();
  const tokenHash = await token.hash;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  const { data: request, error } = await supabase
    .from('proposal_signature_requests')
    .insert({
      org_id: orgId,
      proposal_id: proposalId,
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

  const { error: proposalError } = await supabase
    .from('proposals')
    .update({
      signature_status: 'pending_signature' as ProposalSignatureStatus,
      expires_at: expiresAt.toISOString(),
      signature_request_id: request.id,
      signer_name: signerName,
      signer_email: signerEmail,
    })
    .eq('id', proposalId);

  if (proposalError) throw proposalError;

  await createAuditEvent({
    proposalId,
    orgId,
    eventType: 'sent_for_signature',
    actorType: 'user',
    actorId: createdByUserId,
    metadata: {
      signer_name: signerName,
      signer_email: signerEmail,
      expires_at: expiresAt.toISOString(),
    },
  });

  const signingUrl = `${window.location.origin}/sign/proposal/${request.id}?token=${token.raw}`;

  return { request, rawToken: token.raw, signingUrl };
}

export async function verifySigningToken(
  requestId: string,
  rawToken: string
): Promise<ProposalSignatureRequest | null> {
  const tokenHash = await computeDocumentHash(rawToken);

  const { data, error } = await supabase
    .from('proposal_signature_requests')
    .select('*')
    .eq('id', requestId)
    .eq('access_token_hash', tokenHash)
    .maybeSingle();

  if (error || !data) return null;
  return data;
}

export async function markRequestViewed(requestId: string, proposalId: string, orgId: string): Promise<void> {
  const { data: request } = await supabase
    .from('proposal_signature_requests')
    .select('viewed_at')
    .eq('id', requestId)
    .single();

  if (!request?.viewed_at) {
    await supabase
      .from('proposal_signature_requests')
      .update({ viewed_at: new Date().toISOString(), status: 'viewed' })
      .eq('id', requestId);

    await supabase
      .from('proposals')
      .update({ signature_status: 'viewed' as ProposalSignatureStatus })
      .eq('id', proposalId)
      .in('signature_status', ['pending_signature']);

    await createAuditEvent({
      proposalId,
      orgId,
      eventType: 'viewed',
      actorType: 'signer',
      metadata: { request_id: requestId },
    });
  }
}

export async function submitSignature(params: {
  requestId: string;
  proposalId: string;
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
}): Promise<ProposalSignature> {
  const { data: signature, error } = await supabase
    .from('proposal_signatures')
    .insert({
      org_id: params.orgId,
      proposal_id: params.proposalId,
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
    .from('proposal_signature_requests')
    .update({ status: 'signed', signed_at: now })
    .eq('id', params.requestId);

  await supabase
    .from('proposals')
    .update({
      signature_status: 'signed' as ProposalSignatureStatus,
      signed_at: now,
      signer_name: params.signerName,
      signer_email: params.signerEmail,
    })
    .eq('id', params.proposalId);

  await createAuditEvent({
    proposalId: params.proposalId,
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

export async function declineSignature(
  requestId: string,
  proposalId: string,
  orgId: string,
  reason?: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  const now = new Date().toISOString();

  await supabase
    .from('proposal_signature_requests')
    .update({
      status: 'declined',
      declined_at: now,
      decline_reason: reason || null,
    })
    .eq('id', requestId);

  await supabase
    .from('proposals')
    .update({
      signature_status: 'declined' as ProposalSignatureStatus,
      declined_at: now,
    })
    .eq('id', proposalId);

  await createAuditEvent({
    proposalId,
    orgId,
    eventType: 'declined',
    actorType: 'signer',
    metadata: {
      request_id: requestId,
      reason: reason || null,
      ip_address: ipAddress,
      user_agent: userAgent,
    },
  });
}

export async function voidSignatureRequest(
  requestId: string,
  proposalId: string,
  orgId: string,
  actorUserId: string
): Promise<void> {
  await supabase
    .from('proposal_signature_requests')
    .update({ status: 'voided' })
    .eq('id', requestId);

  await supabase
    .from('proposals')
    .update({ signature_status: 'voided' as ProposalSignatureStatus })
    .eq('id', proposalId);

  await createAuditEvent({
    proposalId,
    orgId,
    eventType: 'voided',
    actorType: 'user',
    actorId: actorUserId,
    metadata: { request_id: requestId },
  });
}

export async function resendSignatureRequest(
  requestId: string,
  proposalId: string,
  orgId: string,
  actorUserId: string
): Promise<{ rawToken: string; signingUrl: string }> {
  const token = generateSecureToken();
  const tokenHash = await token.hash;

  await supabase
    .from('proposal_signature_requests')
    .update({
      access_token_hash: tokenHash,
      viewed_at: null,
      status: 'pending',
    })
    .eq('id', requestId);

  await supabase
    .from('proposals')
    .update({ signature_status: 'pending_signature' as ProposalSignatureStatus })
    .eq('id', proposalId);

  await createAuditEvent({
    proposalId,
    orgId,
    eventType: 'resent',
    actorType: 'user',
    actorId: actorUserId,
    metadata: { request_id: requestId },
  });

  const signingUrl = `${window.location.origin}/sign/proposal/${requestId}?token=${token.raw}`;

  return { rawToken: token.raw, signingUrl };
}

export async function getSignatureRequestByProposal(
  proposalId: string
): Promise<ProposalSignatureRequest | null> {
  const { data, error } = await supabase
    .from('proposal_signature_requests')
    .select('*')
    .eq('proposal_id', proposalId)
    .neq('status', 'voided')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return null;
  return data;
}

export async function getAuditEvents(proposalId: string): Promise<ProposalAuditEvent[]> {
  const { data, error } = await supabase
    .from('proposal_audit_events')
    .select('*')
    .eq('proposal_id', proposalId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createAuditEvent(params: {
  proposalId: string;
  orgId: string;
  eventType: string;
  actorType: 'system' | 'user' | 'signer';
  actorId?: string;
  metadata?: Record<string, unknown>;
}): Promise<ProposalAuditEvent> {
  const { data, error } = await supabase
    .from('proposal_audit_events')
    .insert({
      org_id: params.orgId,
      proposal_id: params.proposalId,
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

export async function getProposalForSigning(
  proposalId: string
): Promise<Proposal | null> {
  const { data, error } = await supabase
    .from('proposals')
    .select(`
      *,
      contact:contacts(first_name, last_name, email, company, phone),
      line_items:proposal_line_items(name, description, quantity, unit_price, discount_percent, sort_order),
      sections:proposal_sections(title, content, section_type, sort_order)
    `)
    .eq('id', proposalId)
    .maybeSingle();

  if (error) return null;
  return data;
}

export async function uploadSignatureImage(
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
      .from('proposal-signatures')
      .upload(path, blob, { contentType: 'image/png', upsert: true });

    if (uploadError) return null;

    const { data: urlData } = supabase.storage
      .from('proposal-signatures')
      .getPublicUrl(path);

    return urlData.publicUrl;
  } catch {
    return null;
  }
}
