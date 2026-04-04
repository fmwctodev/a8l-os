import { supabase } from '../lib/supabase';
import { sendEmail, getEmailSetupStatus } from './emailSend';
import { getEmailDefaults } from './emailDefaults';
import { buildSignatureRequestEmail } from './proposalSigningEmails';

export interface SignatureEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  blockingReasons?: string[];
}

export interface SignatureEmailParams {
  proposalTitle: string;
  totalValue?: string;
  signerName: string;
  signerEmail: string;
  signingUrl: string;
  expiresAt: string;
  orgId: string;
  companyName: string;
}

async function resolveFromAddress(orgId: string): Promise<{ id: string; email: string } | null> {
  try {
    const defaults = await getEmailDefaults(orgId);
    if (defaults?.default_from_address?.id) {
      return { id: defaults.default_from_address.id, email: defaults.default_from_address.email };
    }
  } catch {
    // fall through to fallback
  }

  const { data: fallback } = await supabase
    .from('email_from_addresses')
    .select('id, email')
    .eq('org_id', orgId)
    .eq('active', true)
    .order('is_default', { ascending: false })
    .limit(1)
    .maybeSingle();

  return fallback || null;
}

export async function validateEmailSetup(orgId: string): Promise<{
  ready: boolean;
  fromAddress: { id: string; email: string } | null;
  blockingReasons: string[];
}> {
  try {
    const status = await getEmailSetupStatus();
    if (!status.isConfigured) {
      return { ready: false, fromAddress: null, blockingReasons: status.blockingReasons || [] };
    }
  } catch {
    return { ready: false, fromAddress: null, blockingReasons: ['Unable to check email configuration'] };
  }

  const fromAddress = await resolveFromAddress(orgId);
  if (!fromAddress) {
    return {
      ready: false,
      fromAddress: null,
      blockingReasons: ['No verified SendGrid sender is configured for e-signature delivery.'],
    };
  }

  return { ready: true, fromAddress, blockingReasons: [] };
}

export async function sendSignatureRequestEmail(
  params: SignatureEmailParams
): Promise<SignatureEmailResult> {
  const { ready, fromAddress, blockingReasons } = await validateEmailSetup(params.orgId);
  if (!ready || !fromAddress) {
    return { success: false, error: blockingReasons[0] || 'Email not configured', blockingReasons };
  }

  const htmlBody = buildSignatureRequestEmail({
    signerName: params.signerName,
    proposalTitle: params.proposalTitle,
    totalValue: params.totalValue,
    signingUrl: params.signingUrl,
    expiresAt: params.expiresAt,
    companyName: params.companyName,
  });

  const result = await sendEmail({
    toEmail: params.signerEmail,
    toName: params.signerName,
    fromAddressId: fromAddress.id,
    subject: `Please review and sign: ${params.proposalTitle}`,
    htmlBody,
    trackOpens: true,
    trackClicks: false,
    transactional: true,
  });

  return result;
}

export async function updateSignatureRequestSendStatus(
  requestId: string,
  status: 'sent' | 'failed',
  messageId?: string,
  error?: string
): Promise<void> {
  await supabase
    .from('proposal_signature_requests')
    .update({
      send_status: status,
      sendgrid_message_id: messageId || null,
      send_error: status === 'failed' ? (error || 'Unknown error') : null,
      last_sent_at: status === 'sent' ? new Date().toISOString() : undefined,
    })
    .eq('id', requestId);
}
