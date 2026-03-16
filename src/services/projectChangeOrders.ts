import { supabase } from '../lib/supabase';
import type { ProjectChangeOrder, ProjectChangeRequest } from '../types';
import { createAuditEvent } from './projectChangeRequests';
import { logProjectActivity } from './projectActivityLog';
import { updateChangeRequest } from './projectChangeRequests';

async function computeHash(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

function generateSecureToken(): { raw: string; hashPromise: Promise<string> } {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const raw = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  return { raw, hashPromise: computeHash(raw) };
}

export function generateChangeOrderHTML(
  changeOrder: ProjectChangeOrder,
  changeRequest: ProjectChangeRequest
): string {
  const formatCurrency = (amount: number, currency: string) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

  const today = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Change Order – ${changeOrder.title}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a202c; background: #fff; padding: 48px; max-width: 800px; margin: 0 auto; }
  h1 { font-size: 28px; font-weight: 700; color: #0f172a; margin-bottom: 4px; }
  .subtitle { font-size: 14px; color: #64748b; margin-bottom: 32px; }
  .section { margin-bottom: 24px; }
  .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; margin-bottom: 8px; }
  .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; }
  .row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #e2e8f0; }
  .row:last-child { border-bottom: none; }
  .label { font-size: 13px; color: #64748b; }
  .value { font-size: 13px; font-weight: 600; color: #0f172a; }
  .highlight { background: #0ea5e9; color: #fff; border-radius: 8px; padding: 16px; margin: 16px 0; }
  .highlight .amount { font-size: 24px; font-weight: 700; }
  .description { font-size: 14px; line-height: 1.6; color: #374151; white-space: pre-wrap; }
  .terms { font-size: 12px; line-height: 1.6; color: #64748b; white-space: pre-wrap; }
  .signature-block { margin-top: 32px; border-top: 2px solid #e2e8f0; padding-top: 24px; }
  .sig-line { border-bottom: 1px solid #0f172a; min-height: 40px; margin-bottom: 8px; }
  .sig-meta { font-size: 12px; color: #64748b; }
  @media print { body { padding: 24px; } }
</style>
</head>
<body>
  <h1>Change Order</h1>
  <p class="subtitle">Project: ${changeRequest.project?.name ?? 'N/A'} &nbsp;|&nbsp; Date: ${today}</p>

  <div class="section">
    <div class="section-title">Change Details</div>
    <div class="card">
      <div class="row"><span class="label">Change Order Title</span><span class="value">${changeOrder.title}</span></div>
      <div class="row"><span class="label">Change Request Reference</span><span class="value">${changeRequest.title}</span></div>
      <div class="row"><span class="label">Request Type</span><span class="value">${changeRequest.request_type.charAt(0).toUpperCase() + changeRequest.request_type.slice(1)}</span></div>
      <div class="row"><span class="label">Submitted By</span><span class="value">${changeRequest.client_name}</span></div>
    </div>
  </div>

  ${changeOrder.description ? `
  <div class="section">
    <div class="section-title">Description of Changes</div>
    <div class="card"><p class="description">${changeOrder.description}</p></div>
  </div>` : ''}

  ${changeOrder.scope_changes ? `
  <div class="section">
    <div class="section-title">Scope Changes</div>
    <div class="card"><p class="description">${changeOrder.scope_changes}</p></div>
  </div>` : ''}

  <div class="section">
    <div class="section-title">Impact Summary</div>
    <div class="highlight">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-size:12px;opacity:0.8;margin-bottom:4px">Additional Cost</div>
          <div class="amount">${formatCurrency(changeOrder.cost_amount, changeOrder.currency)}</div>
        </div>
        ${changeOrder.timeline_extension_days > 0 ? `
        <div style="text-align:right">
          <div style="font-size:12px;opacity:0.8;margin-bottom:4px">Timeline Extension</div>
          <div class="amount">${changeOrder.timeline_extension_days} day${changeOrder.timeline_extension_days !== 1 ? 's' : ''}</div>
        </div>` : ''}
      </div>
    </div>
  </div>

  ${changeOrder.terms_and_conditions ? `
  <div class="section">
    <div class="section-title">Terms & Conditions</div>
    <div class="card"><p class="terms">${changeOrder.terms_and_conditions}</p></div>
  </div>` : ''}

  <div class="signature-block">
    <div class="section-title">Client Approval</div>
    <p style="font-size:13px;color:#374151;margin-bottom:16px;">By signing below, you authorize the changes described in this document and agree to any applicable additional costs and timeline adjustments.</p>
    <div class="sig-line"></div>
    <div class="sig-meta">Signature &nbsp;&nbsp;&nbsp;&nbsp; Name: ${changeOrder.signer_name ?? '_______________________'} &nbsp;&nbsp;&nbsp;&nbsp; Date: ___________</div>
  </div>
</body>
</html>`;
}

export async function createChangeOrder(
  data: {
    org_id: string;
    project_id: string;
    change_request_id: string;
    title: string;
    description?: string;
    scope_changes?: string;
    timeline_extension_days?: number;
    cost_amount: number;
    currency?: string;
    terms_and_conditions?: string;
  },
  createdByUserId: string
): Promise<ProjectChangeOrder> {
  const { data: row, error } = await supabase
    .from('project_change_orders')
    .insert({
      org_id: data.org_id,
      project_id: data.project_id,
      change_request_id: data.change_request_id,
      title: data.title,
      description: data.description ?? null,
      scope_changes: data.scope_changes ?? null,
      timeline_extension_days: data.timeline_extension_days ?? 0,
      cost_amount: data.cost_amount,
      currency: data.currency ?? 'USD',
      terms_and_conditions: data.terms_and_conditions ?? null,
      status: 'draft',
      created_by_user_id: createdByUserId,
    })
    .select()
    .single();

  if (error) throw error;
  return row as ProjectChangeOrder;
}

export async function sendChangeOrderForSignature(
  changeOrderId: string,
  changeRequest: ProjectChangeRequest,
  signerName: string,
  signerEmail: string,
  expiresInDays: number,
  actorUserId: string
): Promise<{ rawToken: string; signingUrl: string }> {
  const { data: order, error: fetchErr } = await supabase
    .from('project_change_orders')
    .select('*')
    .eq('id', changeOrderId)
    .single();

  if (fetchErr || !order) throw new Error('Change order not found');

  const htmlSnapshot = generateChangeOrderHTML(order as ProjectChangeOrder, changeRequest);
  const documentHash = await computeHash(htmlSnapshot);

  const token = generateSecureToken();
  const tokenHash = await token.hashPromise;

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  const { error: updateErr } = await supabase
    .from('project_change_orders')
    .update({
      status: 'sent',
      signer_name: signerName,
      signer_email: signerEmail,
      access_token_hash: tokenHash,
      expires_at: expiresAt.toISOString(),
      frozen_html_snapshot: htmlSnapshot,
      frozen_document_hash: documentHash,
      sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', changeOrderId);

  if (updateErr) throw updateErr;

  await createAuditEvent({
    changeRequestId: changeRequest.id,
    orgId: changeRequest.org_id,
    eventType: 'change_order_sent',
    actorType: 'user',
    actorId: actorUserId,
    metadata: { change_order_id: changeOrderId, signer_name: signerName, signer_email: signerEmail },
  });

  const signingUrl = `${window.location.origin}/project-change/sign/${changeOrderId}?token=${token.raw}`;
  return { rawToken: token.raw, signingUrl };
}

export async function getChangeOrderForSigning(
  changeOrderId: string,
  rawToken: string
): Promise<{ order: ProjectChangeOrder; changeRequest: ProjectChangeRequest } | null> {
  const tokenHash = await computeHash(rawToken);

  const { data: order, error } = await supabase
    .from('project_change_orders')
    .select('*')
    .eq('id', changeOrderId)
    .eq('access_token_hash', tokenHash)
    .maybeSingle();

  if (error || !order) return null;

  if (order.viewed_at === null && order.status === 'sent') {
    await supabase
      .from('project_change_orders')
      .update({ viewed_at: new Date().toISOString(), status: 'viewed', updated_at: new Date().toISOString() })
      .eq('id', changeOrderId);
    order.status = 'viewed';
    order.viewed_at = new Date().toISOString();
  }

  const { data: cr } = await supabase
    .from('project_change_requests')
    .select('*, project:projects(id, name, org_id)')
    .eq('id', order.change_request_id)
    .maybeSingle();

  if (!cr) return null;

  return { order: order as ProjectChangeOrder, changeRequest: cr as ProjectChangeRequest };
}

export async function signChangeOrder(params: {
  changeOrderId: string;
  changeRequest: ProjectChangeRequest;
  rawToken: string;
  signatureType: 'typed' | 'drawn';
  signatureText?: string;
  signatureImageUrl?: string;
  signerName: string;
  signerEmail: string;
  consentText: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  const tokenHash = await computeHash(params.rawToken);
  const now = new Date().toISOString();

  const { data: order } = await supabase
    .from('project_change_orders')
    .select('id, status, access_token_hash, frozen_document_hash, org_id, project_id, change_request_id')
    .eq('id', params.changeOrderId)
    .eq('access_token_hash', tokenHash)
    .maybeSingle();

  if (!order) throw new Error('Invalid token or change order not found');
  if (!['sent', 'viewed'].includes(order.status)) throw new Error('Change order is not awaiting signature');

  const { error } = await supabase
    .from('project_change_orders')
    .update({
      status: 'signed',
      signature_type: params.signatureType,
      signature_text: params.signatureText ?? null,
      signature_image_url: params.signatureImageUrl ?? null,
      signer_name: params.signerName,
      signer_email: params.signerEmail,
      consent_text: params.consentText,
      ip_address: params.ipAddress ?? null,
      user_agent: params.userAgent ?? null,
      signed_at: now,
      updated_at: now,
    })
    .eq('id', params.changeOrderId);

  if (error) throw error;

  await supabase
    .from('project_change_requests')
    .update({
      status: 'approved',
      client_decision: 'approved',
      approved_at: now,
      updated_at: now,
    })
    .eq('id', params.changeRequest.id);

  await createAuditEvent({
    changeRequestId: params.changeRequest.id,
    orgId: params.changeRequest.org_id,
    eventType: 'change_order_signed',
    actorType: 'client',
    actorName: params.signerName,
    metadata: {
      change_order_id: params.changeOrderId,
      signer_name: params.signerName,
      signer_email: params.signerEmail,
      ip_address: params.ipAddress,
    },
  });

  await logProjectActivity({
    org_id: params.changeRequest.org_id,
    project_id: params.changeRequest.project_id,
    event_type: 'change_order_signed',
    summary: `Change order signed by ${params.signerName}`,
    payload: { change_order_id: params.changeOrderId, change_request_id: params.changeRequest.id },
    actor_user_id: null,
  });
}

export async function declineChangeOrder(params: {
  changeOrderId: string;
  changeRequest: ProjectChangeRequest;
  rawToken: string;
  reason?: string;
  ipAddress?: string;
}): Promise<void> {
  const tokenHash = await computeHash(params.rawToken);
  const now = new Date().toISOString();

  const { data: order } = await supabase
    .from('project_change_orders')
    .select('id, status, access_token_hash')
    .eq('id', params.changeOrderId)
    .eq('access_token_hash', tokenHash)
    .maybeSingle();

  if (!order) throw new Error('Invalid token or change order not found');
  if (!['sent', 'viewed'].includes(order.status)) throw new Error('Change order cannot be declined in its current state');

  await supabase
    .from('project_change_orders')
    .update({
      status: 'declined',
      declined_at: now,
      decline_reason: params.reason ?? null,
      ip_address: params.ipAddress ?? null,
      updated_at: now,
    })
    .eq('id', params.changeOrderId);

  await supabase
    .from('project_change_requests')
    .update({
      client_decision: 'declined',
      updated_at: now,
    })
    .eq('id', params.changeRequest.id);

  await createAuditEvent({
    changeRequestId: params.changeRequest.id,
    orgId: params.changeRequest.org_id,
    eventType: 'change_order_declined',
    actorType: 'client',
    metadata: {
      change_order_id: params.changeOrderId,
      reason: params.reason ?? null,
    },
  });

  await logProjectActivity({
    org_id: params.changeRequest.org_id,
    project_id: params.changeRequest.project_id,
    event_type: 'change_order_declined',
    summary: `Change order declined by client`,
    payload: { change_order_id: params.changeOrderId, reason: params.reason },
    actor_user_id: null,
  });
}

export async function uploadChangeOrderSignatureImage(
  orgId: string,
  changeOrderId: string,
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
    const path = `${orgId}/${changeOrderId}/signature.png`;

    const { error } = await supabase.storage
      .from('change-order-signatures')
      .upload(path, blob, { contentType: 'image/png', upsert: true });

    if (error) return null;

    const { data } = supabase.storage.from('change-order-signatures').getPublicUrl(path);
    return data.publicUrl;
  } catch {
    return null;
  }
}
