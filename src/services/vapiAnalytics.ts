import { supabase } from '../lib/supabase';

export interface VapiAnalyticsData {
  totalAssistants: number;
  publishedAssistants: number;
  callsToday: number;
  smsSessionsToday: number;
  webchatSessionsToday: number;
  avgCallDuration: number;
  toolCallSuccessRate: number;
  failedCount: number;
}

export async function getVoiceAnalytics(
  orgId: string,
  dateFrom?: string,
  dateTo?: string
): Promise<VapiAnalyticsData> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIso = dateFrom || today.toISOString();
  const endIso = dateTo || new Date().toISOString();

  const [
    assistantsResult,
    callsResult,
    smsResult,
    webchatResult,
    durationResult,
    failedCallsResult,
    failedSessionsResult,
    toolSuccessResult,
    toolTotalResult,
  ] = await Promise.all([
    supabase
      .from('vapi_assistants')
      .select('id, status', { count: 'exact' })
      .eq('org_id', orgId)
      .neq('status', 'archived'),

    supabase
      .from('vapi_calls')
      .select('id', { count: 'exact' })
      .eq('org_id', orgId)
      .gte('created_at', todayIso)
      .lte('created_at', endIso),

    supabase
      .from('vapi_sessions')
      .select('id', { count: 'exact' })
      .eq('org_id', orgId)
      .eq('channel', 'sms')
      .gte('created_at', todayIso)
      .lte('created_at', endIso),

    supabase
      .from('vapi_sessions')
      .select('id', { count: 'exact' })
      .eq('org_id', orgId)
      .eq('channel', 'webchat')
      .gte('created_at', todayIso)
      .lte('created_at', endIso),

    supabase
      .from('vapi_calls')
      .select('duration_seconds')
      .eq('org_id', orgId)
      .not('duration_seconds', 'is', null)
      .gte('created_at', todayIso)
      .lte('created_at', endIso),

    supabase
      .from('vapi_calls')
      .select('id', { count: 'exact' })
      .eq('org_id', orgId)
      .eq('status', 'failed')
      .gte('created_at', todayIso)
      .lte('created_at', endIso),

    supabase
      .from('vapi_sessions')
      .select('id', { count: 'exact' })
      .eq('org_id', orgId)
      .eq('status', 'failed')
      .gte('created_at', todayIso)
      .lte('created_at', endIso),

    supabase
      .from('vapi_webhook_logs')
      .select('id', { count: 'exact' })
      .eq('org_id', orgId)
      .like('event_type', 'tool.%')
      .eq('processed', true)
      .gte('created_at', todayIso)
      .lte('created_at', endIso),

    supabase
      .from('vapi_webhook_logs')
      .select('id', { count: 'exact' })
      .eq('org_id', orgId)
      .like('event_type', 'tool.%')
      .gte('created_at', todayIso)
      .lte('created_at', endIso),
  ]);

  const totalAssistants = assistantsResult.count || 0;
  const publishedAssistants = (assistantsResult.data || []).filter(a => a.status === 'published').length;

  const durations = (durationResult.data || []).map(d => d.duration_seconds || 0);
  const avgCallDuration = durations.length > 0
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : 0;

  const toolTotal = toolTotalResult.count || 0;
  const toolSuccess = toolSuccessResult.count || 0;
  const toolCallSuccessRate = toolTotal > 0 ? Math.round((toolSuccess / toolTotal) * 100) : 100;

  return {
    totalAssistants,
    publishedAssistants,
    callsToday: callsResult.count || 0,
    smsSessionsToday: smsResult.count || 0,
    webchatSessionsToday: webchatResult.count || 0,
    avgCallDuration,
    toolCallSuccessRate,
    failedCount: (failedCallsResult.count || 0) + (failedSessionsResult.count || 0),
  };
}
