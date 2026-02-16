import { fetchEdge } from '../lib/edgeFunction';
import type { TwilioConnection } from './phoneConnection';
import type { TwilioNumber } from './phoneNumbers';
import type { MessagingService } from './phoneMessaging';
import type { VoiceRoutingGroup } from './phoneRouting';

export interface PhoneSettings {
  id: string;
  org_id: string;
  default_sms_mode: 'number' | 'messaging_service';
  default_sms_number_id?: string;
  default_messaging_service_id?: string;
  default_voice_number_id?: string;
  default_routing_group_id?: string;
  call_timeout: number;
  voicemail_fallback_number?: string;
  record_inbound_calls: boolean;
  record_outbound_calls: boolean;
  record_voicemail: boolean;
  recording_retention_days: number;
  quiet_hours_enabled: boolean;
  quiet_hours_start?: string;
  quiet_hours_end?: string;
  quiet_hours_timezone: string;
  business_name?: string;
  opt_out_language: string;
  auto_append_opt_out: boolean;
  default_sms_number?: TwilioNumber;
  default_voice_number?: TwilioNumber;
  default_messaging_service?: MessagingService;
  default_routing_group?: VoiceRoutingGroup;
  created_at: string;
  updated_at: string;
}

export interface WebhookHealth {
  webhook_type: 'sms' | 'voice' | 'status';
  last_received_at?: string;
  success_count: number;
  failure_count: number;
  last_error?: string;
}

export interface PhoneSetupStatus {
  isConfigured: boolean;
  isConnected: boolean;
  activeNumbers: number;
  hasDefaultSms: boolean;
  hasDefaultVoice: boolean;
  webhookHealth: WebhookHealth[];
  blockingReasons: string[];
}

export interface PhoneSettingsResponse {
  settings: PhoneSettings | null;
  connection: TwilioConnection | null;
  numberCount: number;
  webhookHealth: WebhookHealth[];
  isConfigured: boolean;
  blockingReasons: string[];
}

const SLUG = 'phone-settings';

async function callEdgeFunction(action: string, payload: Record<string, unknown> = {}) {
  const response = await fetchEdge(SLUG, { body: { action, ...payload } });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error);
  return result;
}

export async function getPhoneSettings(): Promise<PhoneSettingsResponse> {
  return callEdgeFunction('get');
}

export async function updatePhoneSettings(params: Partial<{
  defaultSmsMode: 'number' | 'messaging_service';
  defaultSmsNumberId: string | null;
  defaultMessagingServiceId: string | null;
  defaultVoiceNumberId: string | null;
  defaultRoutingGroupId: string | null;
  callTimeout: number;
  voicemailFallbackNumber: string | null;
  recordInboundCalls: boolean;
  recordOutboundCalls: boolean;
  recordVoicemail: boolean;
  recordingRetentionDays: number;
  quietHoursEnabled: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  quietHoursTimezone: string;
  businessName: string | null;
  optOutLanguage: string;
  autoAppendOptOut: boolean;
}>): Promise<PhoneSettings> {
  const result = await callEdgeFunction('update', params);
  return result.settings;
}

export async function getPhoneSetupStatus(): Promise<PhoneSetupStatus> {
  return callEdgeFunction('get-status');
}
