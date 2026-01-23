import { supabase } from '../lib/supabase';
import type {
  AIAgent,
  AIAgentMemory,
  AIAgentRun,
  AIAgentToolCall,
  AIAgentFilters,
  AIAgentRunFilters,
  AIAgentToolName,
  AIAgentChannel,
  AIAgentRunStatus
} from '../types';

export async function getAgents(
  orgId: string,
  filters: AIAgentFilters = {}
): Promise<AIAgent[]> {
  let query = supabase
    .from('ai_agents')
    .select(`
      *,
      created_by:users!created_by_user_id(id, name, email)
    `)
    .eq('org_id', orgId)
    .order('updated_at', { ascending: false });

  if (filters.enabled !== undefined) {
    query = query.eq('enabled', filters.enabled);
  }

  if (filters.search) {
    query = query.ilike('name', `%${filters.search}%`);
  }

  const { data, error } = await query;
  if (error) throw error;

  const agents = data as AIAgent[];

  const agentIds = agents.map(a => a.id);
  if (agentIds.length > 0) {
    const { data: runStats } = await supabase
      .from('ai_agent_runs')
      .select('agent_id, status, created_at')
      .in('agent_id', agentIds);

    const statsMap = new Map<string, {
      total: number;
      successful: number;
      failed: number;
      lastRunAt: string | null;
    }>();

    runStats?.forEach(run => {
      const current = statsMap.get(run.agent_id) || {
        total: 0,
        successful: 0,
        failed: 0,
        lastRunAt: null
      };
      current.total++;
      if (run.status === 'success') current.successful++;
      if (run.status === 'failed') current.failed++;
      if (!current.lastRunAt || run.created_at > current.lastRunAt) {
        current.lastRunAt = run.created_at;
      }
      statsMap.set(run.agent_id, current);
    });

    agents.forEach(agent => {
      const s = statsMap.get(agent.id);
      agent.stats = {
        total_runs: s?.total || 0,
        successful_runs: s?.successful || 0,
        failed_runs: s?.failed || 0,
        success_rate: s?.total ? Math.round((s.successful / s.total) * 100) : 0,
        last_run_at: s?.lastRunAt || null
      };
    });
  }

  return agents;
}

export async function getAgentById(id: string): Promise<AIAgent | null> {
  const { data, error } = await supabase
    .from('ai_agents')
    .select(`
      *,
      created_by:users!created_by_user_id(id, name, email)
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const agent = data as AIAgent;

  const { data: runStats } = await supabase
    .from('ai_agent_runs')
    .select('status, created_at')
    .eq('agent_id', id);

  let total = 0;
  let successful = 0;
  let failed = 0;
  let lastRunAt: string | null = null;

  runStats?.forEach(run => {
    total++;
    if (run.status === 'success') successful++;
    if (run.status === 'failed') failed++;
    if (!lastRunAt || run.created_at > lastRunAt) {
      lastRunAt = run.created_at;
    }
  });

  agent.stats = {
    total_runs: total,
    successful_runs: successful,
    failed_runs: failed,
    success_rate: total ? Math.round((successful / total) * 100) : 0,
    last_run_at: lastRunAt
  };

  return agent;
}

export async function createAgent(
  orgId: string,
  data: {
    name: string;
    description?: string | null;
    system_prompt: string;
    allowed_tools: AIAgentToolName[];
    allowed_channels: AIAgentChannel[];
    temperature?: number;
    max_tokens?: number;
    enabled?: boolean;
  },
  userId: string
): Promise<AIAgent> {
  const { data: agent, error } = await supabase
    .from('ai_agents')
    .insert({
      org_id: orgId,
      name: data.name,
      description: data.description || null,
      system_prompt: data.system_prompt,
      allowed_tools: data.allowed_tools,
      allowed_channels: data.allowed_channels,
      temperature: data.temperature ?? 0.7,
      max_tokens: data.max_tokens ?? 1024,
      enabled: data.enabled ?? true,
      created_by_user_id: userId
    })
    .select()
    .single();

  if (error) throw error;
  return agent as AIAgent;
}

export async function updateAgent(
  id: string,
  updates: {
    name?: string;
    description?: string | null;
    system_prompt?: string;
    allowed_tools?: AIAgentToolName[];
    allowed_channels?: AIAgentChannel[];
    temperature?: number;
    max_tokens?: number;
    enabled?: boolean;
  }
): Promise<AIAgent> {
  const { data, error } = await supabase
    .from('ai_agents')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as AIAgent;
}

export async function deleteAgent(id: string): Promise<void> {
  const { error } = await supabase
    .from('ai_agents')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function toggleAgentEnabled(id: string, enabled: boolean): Promise<AIAgent> {
  return updateAgent(id, { enabled });
}

export async function getAgentMemoryForContact(
  agentId: string,
  contactId: string
): Promise<AIAgentMemory | null> {
  const { data, error } = await supabase
    .from('ai_agent_memory')
    .select(`
      *,
      contact:contacts!contact_id(id, first_name, last_name, email, phone),
      agent:ai_agents!agent_id(id, name)
    `)
    .eq('agent_id', agentId)
    .eq('contact_id', contactId)
    .maybeSingle();

  if (error) throw error;
  return data as AIAgentMemory | null;
}

export async function getAgentMemories(
  agentId: string,
  page = 1,
  pageSize = 20
): Promise<{ data: AIAgentMemory[]; total: number }> {
  const offset = (page - 1) * pageSize;

  const { data, error, count } = await supabase
    .from('ai_agent_memory')
    .select(`
      *,
      contact:contacts!contact_id(id, first_name, last_name, email, phone)
    `, { count: 'exact' })
    .eq('agent_id', agentId)
    .order('last_updated_at', { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (error) throw error;

  return {
    data: data as AIAgentMemory[],
    total: count || 0
  };
}

export async function updateAgentMemory(
  agentId: string,
  contactId: string,
  orgId: string,
  updates: {
    memory_summary?: string;
    key_facts?: Record<string, string>;
    conversation_summary?: string;
    last_decision?: string;
    confidence_level?: string;
    lead_stage?: string;
  }
): Promise<AIAgentMemory> {
  const { data, error } = await supabase
    .from('ai_agent_memory')
    .upsert({
      agent_id: agentId,
      contact_id: contactId,
      org_id: orgId,
      ...updates
    }, {
      onConflict: 'agent_id,contact_id'
    })
    .select()
    .single();

  if (error) throw error;
  return data as AIAgentMemory;
}

export async function resetAgentMemory(
  agentId: string,
  contactId: string
): Promise<void> {
  const { error } = await supabase
    .from('ai_agent_memory')
    .delete()
    .eq('agent_id', agentId)
    .eq('contact_id', contactId);

  if (error) throw error;
}

export async function getAgentRuns(
  orgId: string,
  filters: AIAgentRunFilters = {},
  page = 1,
  pageSize = 50
): Promise<{ data: AIAgentRun[]; total: number }> {
  const offset = (page - 1) * pageSize;

  let query = supabase
    .from('ai_agent_runs')
    .select(`
      *,
      agent:ai_agents!agent_id(id, name),
      contact:contacts!contact_id(id, first_name, last_name, email, phone),
      approved_by:users!approved_by_user_id(id, name)
    `, { count: 'exact' })
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (filters.agentId) {
    query = query.eq('agent_id', filters.agentId);
  }

  if (filters.contactId) {
    query = query.eq('contact_id', filters.contactId);
  }

  if (filters.status && filters.status.length > 0) {
    query = query.in('status', filters.status);
  }

  if (filters.triggeredBy) {
    query = query.eq('triggered_by', filters.triggeredBy);
  }

  if (filters.startDate) {
    query = query.gte('created_at', filters.startDate);
  }

  if (filters.endDate) {
    query = query.lte('created_at', filters.endDate);
  }

  const { data, error, count } = await query;
  if (error) throw error;

  return {
    data: data as AIAgentRun[],
    total: count || 0
  };
}

export async function getAgentRunById(id: string): Promise<AIAgentRun | null> {
  const { data: run, error } = await supabase
    .from('ai_agent_runs')
    .select(`
      *,
      agent:ai_agents!agent_id(id, name, system_prompt),
      contact:contacts!contact_id(id, first_name, last_name, email, phone),
      conversation:conversations!conversation_id(id, status),
      approved_by:users!approved_by_user_id(id, name)
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  if (!run) return null;

  const { data: toolCalls } = await supabase
    .from('ai_agent_tool_calls')
    .select('*')
    .eq('agent_run_id', id)
    .order('created_at', { ascending: true });

  const result = run as AIAgentRun;
  result.tool_calls = toolCalls as AIAgentToolCall[] || [];

  return result;
}

export async function getRunsByContact(
  contactId: string,
  limit = 10
): Promise<AIAgentRun[]> {
  const { data, error } = await supabase
    .from('ai_agent_runs')
    .select(`
      *,
      agent:ai_agents!agent_id(id, name)
    `)
    .eq('contact_id', contactId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data as AIAgentRun[];
}

export async function createAgentRun(
  orgId: string,
  data: {
    agent_id: string;
    contact_id: string;
    conversation_id?: string;
    triggered_by: 'user' | 'automation';
    trigger_source_id?: string;
    input_prompt: string;
  }
): Promise<AIAgentRun> {
  const { data: run, error } = await supabase
    .from('ai_agent_runs')
    .insert({
      org_id: orgId,
      agent_id: data.agent_id,
      contact_id: data.contact_id,
      conversation_id: data.conversation_id || null,
      triggered_by: data.triggered_by,
      trigger_source_id: data.trigger_source_id || null,
      input_prompt: data.input_prompt,
      status: 'pending'
    })
    .select()
    .single();

  if (error) throw error;
  return run as AIAgentRun;
}

export async function updateAgentRun(
  id: string,
  updates: {
    status?: AIAgentRunStatus;
    output_summary?: string;
    draft_message?: string;
    draft_channel?: string;
    draft_subject?: string;
    user_approved?: boolean;
    approved_at?: string;
    approved_by_user_id?: string;
    messages_sent?: number;
    tool_calls_count?: number;
    error_message?: string;
    completed_at?: string;
  }
): Promise<AIAgentRun> {
  const { data, error } = await supabase
    .from('ai_agent_runs')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as AIAgentRun;
}

export async function approveAgentDraft(
  runId: string,
  userId: string
): Promise<AIAgentRun> {
  return updateAgentRun(runId, {
    user_approved: true,
    approved_at: new Date().toISOString(),
    approved_by_user_id: userId
  });
}

export async function rejectAgentDraft(runId: string): Promise<AIAgentRun> {
  return updateAgentRun(runId, {
    user_approved: false
  });
}

export async function createToolCall(
  orgId: string,
  runId: string,
  data: {
    tool_name: string;
    input_payload: Record<string, unknown>;
    output_payload?: Record<string, unknown>;
    status: 'success' | 'failed';
    error_message?: string;
    duration_ms: number;
  }
): Promise<AIAgentToolCall> {
  const { data: toolCall, error } = await supabase
    .from('ai_agent_tool_calls')
    .insert({
      org_id: orgId,
      agent_run_id: runId,
      tool_name: data.tool_name,
      input_payload: data.input_payload,
      output_payload: data.output_payload || null,
      status: data.status,
      error_message: data.error_message || null,
      duration_ms: data.duration_ms
    })
    .select()
    .single();

  if (error) throw error;
  return toolCall as AIAgentToolCall;
}

export async function getContactAIInsights(
  contactId: string
): Promise<{
  memories: AIAgentMemory[];
  recentRuns: AIAgentRun[];
}> {
  const { data: memories } = await supabase
    .from('ai_agent_memory')
    .select(`
      *,
      agent:ai_agents!agent_id(id, name)
    `)
    .eq('contact_id', contactId)
    .order('last_updated_at', { ascending: false });

  const { data: runs } = await supabase
    .from('ai_agent_runs')
    .select(`
      *,
      agent:ai_agents!agent_id(id, name)
    `)
    .eq('contact_id', contactId)
    .eq('status', 'success')
    .order('created_at', { ascending: false })
    .limit(5);

  return {
    memories: memories as AIAgentMemory[] || [],
    recentRuns: runs as AIAgentRun[] || []
  };
}

export async function getAgentStats(orgId: string): Promise<{
  totalAgents: number;
  enabledAgents: number;
  totalRuns: number;
  successfulRuns: number;
  pendingApprovals: number;
}> {
  const { data: agents } = await supabase
    .from('ai_agents')
    .select('enabled')
    .eq('org_id', orgId);

  const { data: runs } = await supabase
    .from('ai_agent_runs')
    .select('status, user_approved, draft_message')
    .eq('org_id', orgId);

  const totalAgents = agents?.length || 0;
  const enabledAgents = agents?.filter(a => a.enabled).length || 0;
  const totalRuns = runs?.length || 0;
  const successfulRuns = runs?.filter(r => r.status === 'success').length || 0;
  const pendingApprovals = runs?.filter(
    r => r.status === 'success' && r.draft_message && r.user_approved === null
  ).length || 0;

  return {
    totalAgents,
    enabledAgents,
    totalRuns,
    successfulRuns,
    pendingApprovals
  };
}
