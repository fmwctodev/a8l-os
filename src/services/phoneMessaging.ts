import { supabase } from '../lib/supabase';
import type { TwilioNumber } from './phoneNumbers';

export interface MessagingService {
  id: string;
  org_id: string;
  service_sid: string;
  name: string;
  description?: string;
  is_default: boolean;
  status: 'active' | 'disabled';
  a2p_registered: boolean;
  sender_count?: number;
  created_at: string;
  updated_at: string;
}

export interface MessagingServiceSender {
  id: string;
  service_id: string;
  number_id: string;
  number?: TwilioNumber;
  created_at: string;
}

async function callEdgeFunction(action: string, payload: Record<string, unknown> = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/phone-twilio-messaging`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action, ...payload }),
    }
  );

  const result = await response.json();
  if (!response.ok) throw new Error(result.error);
  return result;
}

export async function getMessagingServices(): Promise<MessagingService[]> {
  const result = await callEdgeFunction('list');
  return result.services || [];
}

export async function syncMessagingServices(): Promise<{ services: MessagingService[]; count: number }> {
  return callEdgeFunction('sync');
}

export async function createMessagingService(name: string, description?: string): Promise<MessagingService> {
  const result = await callEdgeFunction('create', { name, description });
  return result.service;
}

export async function linkService(serviceSid: string, name?: string): Promise<MessagingService> {
  const result = await callEdgeFunction('link', { serviceSid, name });
  return result.service;
}

export async function setDefaultService(serviceId: string): Promise<void> {
  await callEdgeFunction('set-default', { serviceId });
}

export async function getServiceSenders(serviceId: string): Promise<MessagingServiceSender[]> {
  const result = await callEdgeFunction('get-senders', { serviceId });
  return result.senders || [];
}

export async function addSender(serviceId: string, numberId: string): Promise<void> {
  await callEdgeFunction('add-sender', { serviceId, numberId });
}

export async function removeSender(serviceId: string, numberId: string): Promise<void> {
  await callEdgeFunction('remove-sender', { serviceId, numberId });
}

export async function deleteService(serviceId: string): Promise<void> {
  await callEdgeFunction('delete', { serviceId });
}
