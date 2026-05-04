/**
 * Vendor-agnostic phone number helpers used by the conversations UI and
 * any caller that needs E.164 normalization or SMS-segment counting.
 *
 * (Previously lived in src/services/channels/twilio.ts.)
 */

export function normalizePhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (!phone.startsWith('+')) return `+${digits}`;
  return phone;
}

export function formatPhoneForDisplay(phone: string): string {
  const normalized = normalizePhoneNumber(phone);
  const digits = normalized.replace(/\D/g, '');

  if (digits.length === 11 && digits.startsWith('1')) {
    const areaCode = digits.slice(1, 4);
    const exchange = digits.slice(4, 7);
    const number = digits.slice(7);
    return `(${areaCode}) ${exchange}-${number}`;
  }

  return phone;
}

/**
 * Count SMS segments for a given message body. Both Twilio and Plivo bill by
 * segment using the same GSM-7 / UCS-2 thresholds, so this is provider-agnostic.
 */
export function calculateSMSSegments(body: string): { segments: number; encoding: string } {
  const gsmRegex = /^[\x00-\x7F£¥èéùìòÇØøÅåΔΦΓΛΩΠΨΣΘΞÆæßÉ¤¡ÄÖÑÜ§¿äöñüà]*$/;
  const isGSM = gsmRegex.test(body);

  if (isGSM) {
    if (body.length <= 160) return { segments: 1, encoding: 'GSM-7' };
    return { segments: Math.ceil(body.length / 153), encoding: 'GSM-7' };
  } else {
    if (body.length <= 70) return { segments: 1, encoding: 'UCS-2' };
    return { segments: Math.ceil(body.length / 67), encoding: 'UCS-2' };
  }
}
