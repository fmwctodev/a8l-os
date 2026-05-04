import { fetchEdge } from '../lib/edgeFunction';

export interface PlivoConnection {
  id: string;
  authId: string;
  subaccountAuthId?: string;
  friendlyName?: string;
  status: 'connected' | 'disconnected';
  connectedAt?: string;
  vapiSipUsername?: string;
}

export interface ConnectPlivoParams {
  authId: string;
  authToken: string;
  subaccountAuthId?: string;
  friendlyName?: string;
}

export interface SetVapiSipParams {
  sipUsername: string;
  sipPassword: string;
}

const SLUG = 'plivo-connection';

export async function getConnection(): Promise<PlivoConnection | null> {
  const response = await fetchEdge(SLUG, { body: { action: 'get' } });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error);
  return result.connection;
}

export async function connectPlivo(params: ConnectPlivoParams): Promise<PlivoConnection> {
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

export async function disconnectPlivo(): Promise<void> {
  const response = await fetchEdge(SLUG, { body: { action: 'disconnect' } });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error);
}

export async function setVapiSipCredentials(params: SetVapiSipParams): Promise<void> {
  const response = await fetchEdge(SLUG, { body: { action: 'set_vapi_sip', ...params } });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error);
}
