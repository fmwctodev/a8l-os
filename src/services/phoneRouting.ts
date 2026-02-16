import { fetchEdge } from '../lib/edgeFunction';

export interface VoiceRoutingDestination {
  id: string;
  org_id: string;
  group_id: string;
  phone_number: string;
  label?: string;
  sort_order: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface VoiceRoutingGroup {
  id: string;
  org_id: string;
  name: string;
  strategy: 'simultaneous' | 'sequential';
  ring_timeout: number;
  fallback_number?: string;
  is_default: boolean;
  enabled: boolean;
  destinations?: VoiceRoutingDestination[];
  created_at: string;
  updated_at: string;
}

const SLUG = 'phone-voice-routing';

async function callEdgeFunction(action: string, payload: Record<string, unknown> = {}) {
  const response = await fetchEdge(SLUG, { body: { action, ...payload } });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error);
  return result;
}

export async function getRoutingGroups(): Promise<VoiceRoutingGroup[]> {
  const result = await callEdgeFunction('list');
  return result.groups || [];
}

export async function createRoutingGroup(params: {
  name: string;
  strategy?: 'simultaneous' | 'sequential';
  ringTimeout?: number;
  fallbackNumber?: string;
}): Promise<VoiceRoutingGroup> {
  const result = await callEdgeFunction('create', params);
  return result.group;
}

export async function updateRoutingGroup(
  groupId: string,
  params: Partial<{
    name: string;
    strategy: 'simultaneous' | 'sequential';
    ringTimeout: number;
    fallbackNumber: string;
    enabled: boolean;
  }>
): Promise<VoiceRoutingGroup> {
  const result = await callEdgeFunction('update', { groupId, ...params });
  return result.group;
}

export async function deleteRoutingGroup(groupId: string): Promise<void> {
  await callEdgeFunction('delete', { groupId });
}

export async function setDefaultRoutingGroup(groupId: string): Promise<void> {
  await callEdgeFunction('set-default', { groupId });
}

export async function addDestination(
  groupId: string,
  phoneNumber: string,
  label?: string
): Promise<VoiceRoutingDestination> {
  const result = await callEdgeFunction('add-destination', { groupId, phoneNumber, label });
  return result.destination;
}

export async function updateDestination(
  destinationId: string,
  params: Partial<{
    phoneNumber: string;
    label: string;
    sortOrder: number;
    enabled: boolean;
  }>
): Promise<VoiceRoutingDestination> {
  const result = await callEdgeFunction('update-destination', { destinationId, ...params });
  return result.destination;
}

export async function removeDestination(destinationId: string): Promise<void> {
  await callEdgeFunction('remove-destination', { destinationId });
}

export async function reorderDestinations(groupId: string, destinationIds: string[]): Promise<void> {
  await callEdgeFunction('reorder-destinations', { groupId, destinationIds });
}
