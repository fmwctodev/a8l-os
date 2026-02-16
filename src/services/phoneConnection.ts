import { fetchEdge } from '../lib/edgeFunction';

export interface TwilioConnection {
  id: string;
  accountSid: string;
  subaccountSid?: string;
  friendlyName?: string;
  status: 'connected' | 'disconnected';
  connectedAt?: string;
}

export interface ConnectTwilioParams {
  accountSid: string;
  authToken: string;
  subaccountSid?: string;
  friendlyName?: string;
}

const SLUG = 'phone-twilio-connection';

export async function getConnection(): Promise<TwilioConnection | null> {
  const response = await fetchEdge(SLUG, { body: { action: 'get' } });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error);
  return result.connection;
}

export async function connectTwilio(params: ConnectTwilioParams): Promise<TwilioConnection> {
  const response = await fetchEdge(SLUG, { body: { action: 'connect', ...params } });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error);
  return result.connection;
}

export async function testConnection(): Promise<{ success: boolean; status: string }> {
  const response = await fetchEdge(SLUG, { body: { action: 'test' } });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error);
  return result;
}

export async function disconnectTwilio(): Promise<void> {
  const response = await fetchEdge(SLUG, { body: { action: 'disconnect' } });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error);
}
