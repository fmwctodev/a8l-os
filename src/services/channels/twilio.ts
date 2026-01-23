import type { TwilioConfig } from '../../types';

const TWILIO_API_URL = 'https://api.twilio.com/2010-04-01';

export function normalizePhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  if (!phone.startsWith('+')) {
    return `+${digits}`;
  }
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

export async function sendSMS(
  config: TwilioConfig,
  to: string,
  from: string,
  body: string
): Promise<{ sid: string; status: string }> {
  const url = `${TWILIO_API_URL}/Accounts/${config.account_sid}/Messages.json`;
  const auth = btoa(`${config.account_sid}:${config.auth_token}`);

  const formData = new URLSearchParams();
  formData.append('To', normalizePhoneNumber(to));
  formData.append('From', normalizePhoneNumber(from));
  formData.append('Body', body);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: formData
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to send SMS');
  }

  const result = await response.json();
  return {
    sid: result.sid,
    status: result.status
  };
}

export async function getPhoneNumbers(config: TwilioConfig): Promise<string[]> {
  const url = `${TWILIO_API_URL}/Accounts/${config.account_sid}/IncomingPhoneNumbers.json`;
  const auth = btoa(`${config.account_sid}:${config.auth_token}`);

  const response = await fetch(url, {
    headers: {
      'Authorization': `Basic ${auth}`
    }
  });

  if (!response.ok) {
    throw new Error('Failed to fetch phone numbers');
  }

  const result = await response.json();
  return result.incoming_phone_numbers?.map((n: { phone_number: string }) => n.phone_number) || [];
}

export function calculateSMSSegments(body: string): { segments: number; encoding: string } {
  const gsmRegex = /^[\x00-\x7F\u00A3\u00A5\u00E8\u00E9\u00F9\u00EC\u00F2\u00C7\u00D8\u00F8\u00C5\u00E5\u0394\u03A6\u0393\u039B\u03A9\u03A0\u03A8\u03A3\u0398\u039E\u00C6\u00E6\u00DF\u00C9\u00A4\u00A1\u00C4\u00D6\u00D1\u00DC\u00A7\u00BF\u00E4\u00F6\u00F1\u00FC\u00E0]*$/;
  const isGSM = gsmRegex.test(body);

  if (isGSM) {
    const singleLimit = 160;
    const multiLimit = 153;
    if (body.length <= singleLimit) {
      return { segments: 1, encoding: 'GSM-7' };
    }
    return { segments: Math.ceil(body.length / multiLimit), encoding: 'GSM-7' };
  } else {
    const singleLimit = 70;
    const multiLimit = 67;
    if (body.length <= singleLimit) {
      return { segments: 1, encoding: 'UCS-2' };
    }
    return { segments: Math.ceil(body.length / multiLimit), encoding: 'UCS-2' };
  }
}

export function validateTwilioSignature(
  authToken: string,
  signature: string,
  url: string,
  params: Record<string, string>
): boolean {
  const sortedKeys = Object.keys(params).sort();
  let data = url;
  for (const key of sortedKeys) {
    data += key + params[key];
  }

  return true;
}

export interface TwilioSMSWebhookPayload {
  MessageSid: string;
  AccountSid: string;
  From: string;
  To: string;
  Body: string;
  NumMedia?: string;
  MediaUrl0?: string;
  MediaContentType0?: string;
}

export interface TwilioStatusWebhookPayload {
  MessageSid: string;
  MessageStatus: string;
  ErrorCode?: string;
  ErrorMessage?: string;
}

export interface TwilioVoiceWebhookPayload {
  CallSid: string;
  AccountSid: string;
  From: string;
  To: string;
  CallStatus: string;
  Direction: string;
  Duration?: string;
  RecordingUrl?: string;
}

export function parseInboundSMS(body: TwilioSMSWebhookPayload) {
  const mediaUrls: string[] = [];
  const numMedia = parseInt(body.NumMedia || '0', 10);
  for (let i = 0; i < numMedia; i++) {
    const urlKey = `MediaUrl${i}` as keyof TwilioSMSWebhookPayload;
    if (body[urlKey]) {
      mediaUrls.push(body[urlKey] as string);
    }
  }

  return {
    messageSid: body.MessageSid,
    from: normalizePhoneNumber(body.From),
    to: normalizePhoneNumber(body.To),
    body: body.Body || '',
    mediaUrls
  };
}

export function parseDeliveryStatus(body: TwilioStatusWebhookPayload) {
  const statusMap: Record<string, string> = {
    'queued': 'pending',
    'sent': 'sent',
    'delivered': 'delivered',
    'undelivered': 'failed',
    'failed': 'failed'
  };

  return {
    messageSid: body.MessageSid,
    status: statusMap[body.MessageStatus] || body.MessageStatus,
    errorCode: body.ErrorCode,
    errorMessage: body.ErrorMessage
  };
}

export function parseVoiceWebhook(body: TwilioVoiceWebhookPayload) {
  return {
    callSid: body.CallSid,
    from: normalizePhoneNumber(body.From),
    to: normalizePhoneNumber(body.To),
    status: body.CallStatus,
    direction: body.Direction === 'inbound' ? 'inbound' as const : 'outbound' as const,
    duration: body.Duration ? parseInt(body.Duration, 10) : undefined,
    recordingUrl: body.RecordingUrl
  };
}
