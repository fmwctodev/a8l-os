export function buildSignatureRequestEmail(params: {
  signerName: string;
  proposalTitle: string;
  totalValue?: string;
  signingUrl: string;
  expiresAt: string;
  companyName: string;
}): string {
  const expiresFormatted = new Date(params.expiresAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
      <div style="padding: 40px 32px 32px;">
        <p style="font-size: 16px; color: #1e293b; margin: 0 0 20px;">Hi ${params.signerName},</p>

        <p style="font-size: 16px; color: #334155; line-height: 1.6; margin: 0 0 24px;">
          A proposal requires your electronic signature. Please review the document and sign at your convenience.
        </p>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 0 0 28px;">
          <p style="font-size: 14px; color: #64748b; margin: 0 0 4px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Proposal</p>
          <p style="font-size: 18px; color: #0f172a; font-weight: 600; margin: 0;">${params.proposalTitle}</p>
          ${params.totalValue ? `<p style="font-size: 16px; color: #0891b2; font-weight: 600; margin: 8px 0 0;">${params.totalValue}</p>` : ''}
        </div>

        <div style="text-align: center; margin: 32px 0;">
          <a href="${params.signingUrl}" style="display: inline-block; padding: 14px 40px; background-color: #0891b2; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
            Review &amp; Sign
          </a>
        </div>

        <p style="font-size: 14px; color: #94a3b8; text-align: center; margin: 0 0 32px;">
          This signature request expires on ${expiresFormatted}
        </p>

        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />

        <p style="color: #94a3b8; font-size: 12px; text-align: center; margin: 0;">
          You're receiving this email because your signature was requested by ${params.companyName}.
          <br />If you did not expect this email, you can safely ignore it.
        </p>
      </div>
    </div>
  `;
}

export function buildSignatureReminderEmail(params: {
  signerName: string;
  proposalTitle: string;
  signingUrl: string;
  expiresAt: string;
  daysRemaining: number;
  companyName: string;
}): string {
  const expiresFormatted = new Date(params.expiresAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const urgencyText =
    params.daysRemaining <= 1
      ? 'This request expires tomorrow.'
      : `This request expires in ${params.daysRemaining} days.`;

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
      <div style="padding: 40px 32px 32px;">
        <p style="font-size: 16px; color: #1e293b; margin: 0 0 20px;">Hi ${params.signerName},</p>

        <p style="font-size: 16px; color: #334155; line-height: 1.6; margin: 0 0 16px;">
          This is a friendly reminder that your signature is still needed on the following proposal:
        </p>

        <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 16px 20px; margin: 0 0 24px;">
          <p style="font-size: 14px; color: #92400e; font-weight: 600; margin: 0;">${urgencyText}</p>
        </div>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 0 0 28px;">
          <p style="font-size: 18px; color: #0f172a; font-weight: 600; margin: 0;">${params.proposalTitle}</p>
          <p style="font-size: 13px; color: #94a3b8; margin: 4px 0 0;">Expires: ${expiresFormatted}</p>
        </div>

        <div style="text-align: center; margin: 32px 0;">
          <a href="${params.signingUrl}" style="display: inline-block; padding: 14px 40px; background-color: #0891b2; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
            Review &amp; Sign Now
          </a>
        </div>

        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />

        <p style="color: #94a3b8; font-size: 12px; text-align: center; margin: 0;">
          Sent by ${params.companyName}
        </p>
      </div>
    </div>
  `;
}

export function buildSignatureCompletionEmail(params: {
  signerName: string;
  proposalTitle: string;
  signedPdfUrl?: string;
  companyName: string;
}): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
      <div style="padding: 40px 32px 32px;">
        <div style="text-align: center; margin: 0 0 24px;">
          <div style="display: inline-block; width: 48px; height: 48px; background: #d1fae5; border-radius: 50%; line-height: 48px; text-align: center;">
            <span style="color: #059669; font-size: 24px;">&#10003;</span>
          </div>
        </div>

        <h2 style="font-size: 20px; color: #0f172a; text-align: center; margin: 0 0 16px;">Document Signed Successfully</h2>

        <p style="font-size: 16px; color: #334155; line-height: 1.6; margin: 0 0 24px; text-align: center;">
          Hi ${params.signerName}, your signature has been recorded for <strong>${params.proposalTitle}</strong>.
        </p>

        ${
          params.signedPdfUrl
            ? `
          <div style="text-align: center; margin: 32px 0;">
            <a href="${params.signedPdfUrl}" style="display: inline-block; padding: 14px 40px; background-color: #059669; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
              Download Signed PDF
            </a>
          </div>
        `
            : ''
        }

        <p style="font-size: 14px; color: #64748b; text-align: center; margin: 0 0 32px;">
          A copy of the signed document has been sent to you for your records.
        </p>

        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />

        <p style="color: #94a3b8; font-size: 12px; text-align: center; margin: 0;">
          Thank you for your business. &mdash; ${params.companyName}
        </p>
      </div>
    </div>
  `;
}

export function buildInternalSignatureNotificationEmail(params: {
  proposalTitle: string;
  signerName: string;
  signerEmail: string;
  signedAt: string;
  proposalUrl: string;
}): string {
  const signedFormatted = new Date(params.signedAt).toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
      <div style="padding: 40px 32px 32px;">
        <div style="background: #d1fae5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 16px 20px; margin: 0 0 24px;">
          <p style="font-size: 14px; color: #065f46; font-weight: 600; margin: 0;">Proposal Signed</p>
        </div>

        <p style="font-size: 16px; color: #334155; line-height: 1.6; margin: 0 0 24px;">
          <strong>${params.signerName}</strong> (${params.signerEmail}) has signed the proposal
          <strong>${params.proposalTitle}</strong>.
        </p>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px 20px; margin: 0 0 28px;">
          <p style="font-size: 13px; color: #64748b; margin: 0 0 4px;">Signed at</p>
          <p style="font-size: 15px; color: #0f172a; font-weight: 500; margin: 0;">${signedFormatted}</p>
        </div>

        <div style="text-align: center; margin: 32px 0;">
          <a href="${params.proposalUrl}" style="display: inline-block; padding: 14px 40px; background-color: #0891b2; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
            View Proposal
          </a>
        </div>
      </div>
    </div>
  `;
}
