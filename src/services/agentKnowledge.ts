import { supabase } from '../lib/supabase';
import { callEdgeFunction, fetchEdge } from '../lib/edgeFunction';
import type {
  AgentKnowledgeSource,
  CreateAgentKnowledgeSourceInput,
  UpdateAgentKnowledgeSourceInput,
  AgentKnowledgeSourceFilters,
} from '../types';

export async function getKnowledgeSources(
  orgId: string,
  filters?: AgentKnowledgeSourceFilters
): Promise<AgentKnowledgeSource[]> {
  let query = supabase
    .from('agent_knowledge_sources')
    .select(`
      *,
      created_by_user:users!agent_knowledge_sources_created_by_user_id_fkey(id, name, email),
      agent:ai_agents(id, name, agent_type)
    `)
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  if (filters?.agentId) {
    query = query.eq('agent_id', filters.agentId);
  }
  if (filters?.sourceType) {
    query = query.eq('source_type', filters.sourceType);
  }
  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.search) {
    query = query.ilike('source_name', `%${filters.search}%`);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
}

export async function getKnowledgeSourceById(id: string): Promise<AgentKnowledgeSource | null> {
  const { data, error } = await supabase
    .from('agent_knowledge_sources')
    .select(`
      *,
      created_by_user:users!agent_knowledge_sources_created_by_user_id_fkey(id, name, email),
      agent:ai_agents(id, name, agent_type)
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createKnowledgeSource(
  orgId: string,
  input: CreateAgentKnowledgeSourceInput,
  userId: string
): Promise<AgentKnowledgeSource> {
  const { data, error } = await supabase
    .from('agent_knowledge_sources')
    .insert({
      org_id: orgId,
      agent_id: input.agentId || null,
      source_type: input.sourceType,
      source_name: input.sourceName,
      source_config: input.sourceConfig || {},
      chunk_size: input.chunkSize || 1000,
      refresh_frequency: input.refreshFrequency || null,
      status: 'processing',
      created_by_user_id: userId,
    })
    .select()
    .single();

  if (error) throw error;

  await processKnowledgeSource(data.id);

  return data;
}

export async function updateKnowledgeSource(
  id: string,
  input: UpdateAgentKnowledgeSourceInput
): Promise<AgentKnowledgeSource> {
  const updates: Record<string, unknown> = {};

  if (input.sourceName !== undefined) {
    updates.source_name = input.sourceName;
  }
  if (input.sourceConfig !== undefined) {
    updates.source_config = input.sourceConfig;
  }
  if (input.chunkSize !== undefined) {
    updates.chunk_size = input.chunkSize;
  }
  if (input.refreshFrequency !== undefined) {
    updates.refresh_frequency = input.refreshFrequency;
  }
  if (input.status !== undefined) {
    updates.status = input.status;
  }

  const { data, error } = await supabase
    .from('agent_knowledge_sources')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteKnowledgeSource(id: string): Promise<void> {
  const { error } = await supabase
    .from('agent_knowledge_sources')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function linkKnowledgeToAgent(
  knowledgeSourceId: string,
  agentId: string
): Promise<void> {
  const { error } = await supabase
    .from('agent_knowledge_sources')
    .update({ agent_id: agentId })
    .eq('id', knowledgeSourceId);

  if (error) throw error;
}

export async function unlinkKnowledgeFromAgent(knowledgeSourceId: string): Promise<void> {
  const { error } = await supabase
    .from('agent_knowledge_sources')
    .update({ agent_id: null })
    .eq('id', knowledgeSourceId);

  if (error) throw error;
}

export async function reEmbedKnowledgeSource(id: string): Promise<void> {
  await supabase
    .from('agent_knowledge_sources')
    .update({ status: 'processing', last_embedded_at: null, embedding_count: 0 })
    .eq('id', id);

  await processKnowledgeSource(id);
}

async function processKnowledgeSource(id: string): Promise<void> {
  try {
    await callEdgeFunction('ai-knowledge-embeddings', {
      action: 'process-knowledge-source',
      knowledge_source_id: id,
    });
  } catch (error) {
    console.error('Failed to process knowledge source:', error);
  }
}

export async function testKnowledgeRetrieval(
  orgId: string,
  query: string,
  knowledgeSourceIds: string[]
): Promise<{ results: Array<{ content: string; score: number; source: string }> }> {
  const response = await callEdgeFunction('ai-knowledge-embeddings', {
    action: 'test-retrieval',
    org_id: orgId,
    query,
    knowledge_source_ids: knowledgeSourceIds,
  });

  return await response.json();
}

export async function parseFileUpload(
  file: File
): Promise<{ success: boolean; content?: string; error?: string }> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetchEdge('ai-knowledge-embeddings', {
    method: 'POST',
    body: formData,
  });

  return await response.json();
}

export async function crawlWebsite(
  url: string,
  depth: number = 1,
  includePatterns?: string[],
  excludePatterns?: string[]
): Promise<{ success: boolean; pages?: Array<{ url: string; content: string }>; error?: string }> {
  const response = await callEdgeFunction('ai-knowledge-embeddings', {
    action: 'crawl-website',
    url,
    depth,
    include_patterns: includePatterns,
    exclude_patterns: excludePatterns,
  });

  return await response.json();
}

export async function getAgentKnowledgeSources(agentId: string): Promise<AgentKnowledgeSource[]> {
  const { data, error } = await supabase
    .from('agent_knowledge_sources')
    .select('*')
    .eq('agent_id', agentId)
    .eq('status', 'active')
    .order('source_name');

  if (error) throw error;
  return data || [];
}
