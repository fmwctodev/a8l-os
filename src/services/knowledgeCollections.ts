import { supabase } from '../lib/supabase';
import type {
  KnowledgeCollection,
  KnowledgeVersion,
  KnowledgeCollectionFilters,
  KnowledgeSearchResult,
  CreateKnowledgeCollectionInput,
  UpdateKnowledgeCollectionInput,
  CreateKnowledgeVersionInput,
} from '../types';

export async function getCollections(
  orgId: string,
  filters?: KnowledgeCollectionFilters
): Promise<KnowledgeCollection[]> {
  let query = supabase
    .from('knowledge_collections')
    .select(`
      *,
      created_by_user:users!knowledge_collections_created_by_fkey(id, name, email)
    `)
    .eq('org_id', orgId)
    .order('name');

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.applyToAllAgents !== undefined) {
    query = query.eq('apply_to_all_agents', filters.applyToAllAgents);
  }
  if (filters?.sourceType) {
    query = query.eq('source_type', filters.sourceType);
  }
  if (filters?.search) {
    query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
  }

  const { data, error } = await query;

  if (error) throw error;

  const collectionsWithVersions = await Promise.all(
    (data || []).map(async (collection) => {
      const latestVersion = await getLatestVersion(collection.id);
      const agentCount = await getAgentCount(collection.id);
      return {
        ...collection,
        latest_version: latestVersion,
        agent_count: agentCount,
      };
    })
  );

  return collectionsWithVersions;
}

export async function getCollectionById(id: string): Promise<KnowledgeCollection | null> {
  const { data, error } = await supabase
    .from('knowledge_collections')
    .select(`
      *,
      created_by_user:users!knowledge_collections_created_by_fkey(id, name, email)
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;

  if (data) {
    const latestVersion = await getLatestVersion(id);
    const agentCount = await getAgentCount(id);
    return {
      ...data,
      latest_version: latestVersion,
      agent_count: agentCount,
    };
  }

  return null;
}

export async function getGlobalCollections(orgId: string): Promise<KnowledgeCollection[]> {
  return getCollections(orgId, { applyToAllAgents: true, status: 'active' });
}

export async function createCollection(
  orgId: string,
  input: CreateKnowledgeCollectionInput,
  userId: string
): Promise<KnowledgeCollection> {
  const { data, error } = await supabase
    .from('knowledge_collections')
    .insert({
      org_id: orgId,
      name: input.name,
      description: input.description || null,
      status: input.status || 'active',
      apply_to_all_agents: input.apply_to_all_agents ?? false,
      source_type: input.source_type || 'rich_text',
      source_config: input.source_config || {},
      created_by: userId,
    })
    .select()
    .single();

  if (error) throw error;

  if (input.body_text || input.drive_file_ids || input.source_config) {
    await createVersion(data.id, {
      body_text: input.body_text,
      drive_file_ids: input.drive_file_ids,
      source_config: input.source_config,
    }, userId);
  }

  return getCollectionById(data.id) as Promise<KnowledgeCollection>;
}

export async function updateCollection(
  id: string,
  input: UpdateKnowledgeCollectionInput
): Promise<KnowledgeCollection> {
  const updates: Record<string, unknown> = {};

  if (input.name !== undefined) {
    updates.name = input.name;
  }
  if (input.description !== undefined) {
    updates.description = input.description || null;
  }
  if (input.status !== undefined) {
    updates.status = input.status;
  }
  if (input.apply_to_all_agents !== undefined) {
    updates.apply_to_all_agents = input.apply_to_all_agents;
  }
  if (input.source_type !== undefined) {
    updates.source_type = input.source_type;
  }
  if (input.source_config !== undefined) {
    updates.source_config = input.source_config;
  }

  const { error } = await supabase
    .from('knowledge_collections')
    .update(updates)
    .eq('id', id);

  if (error) throw error;

  return getCollectionById(id) as Promise<KnowledgeCollection>;
}

export async function toggleCollectionStatus(
  id: string,
  status: 'active' | 'inactive'
): Promise<KnowledgeCollection> {
  return updateCollection(id, { status });
}

export async function deleteCollection(id: string): Promise<void> {
  const { error } = await supabase
    .from('knowledge_collections')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function getVersions(collectionId: string): Promise<KnowledgeVersion[]> {
  const { data, error } = await supabase
    .from('knowledge_versions')
    .select(`
      *,
      created_by_user:users!knowledge_versions_created_by_fkey(id, name, email)
    `)
    .eq('collection_id', collectionId)
    .order('version_number', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getLatestVersion(collectionId: string): Promise<KnowledgeVersion | null> {
  const { data, error } = await supabase
    .from('knowledge_versions')
    .select(`
      *,
      created_by_user:users!knowledge_versions_created_by_fkey(id, name, email)
    `)
    .eq('collection_id', collectionId)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getVersionById(id: string): Promise<KnowledgeVersion | null> {
  const { data, error } = await supabase
    .from('knowledge_versions')
    .select(`
      *,
      created_by_user:users!knowledge_versions_created_by_fkey(id, name, email)
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createVersion(
  collectionId: string,
  input: CreateKnowledgeVersionInput,
  userId: string
): Promise<KnowledgeVersion> {
  const { data: nextVersion } = await supabase
    .rpc('get_next_knowledge_version', { p_collection_id: collectionId });

  const { data, error } = await supabase
    .from('knowledge_versions')
    .insert({
      collection_id: collectionId,
      version_number: nextVersion || 1,
      body_text: input.body_text || null,
      drive_file_ids: input.drive_file_ids || null,
      source_config: input.source_config || null,
      created_by: userId,
    })
    .select()
    .single();

  if (error) throw error;

  const hasContent = input.body_text || input.source_config;
  if (hasContent) {
    await generateEmbeddings(collectionId, data.id);
  }

  return data;
}

async function generateEmbeddings(
  collectionId: string,
  versionId: string
): Promise<void> {
  try {
    await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-knowledge-embeddings`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'generate',
          collection_id: collectionId,
          version_id: versionId,
        }),
      }
    );
  } catch {
    console.error('Failed to generate embeddings');
  }
}

async function getAgentCount(collectionId: string): Promise<number> {
  const { count, error } = await supabase
    .from('agent_knowledge_links')
    .select('*', { count: 'exact', head: true })
    .eq('collection_id', collectionId);

  if (error) return 0;
  return count || 0;
}

export async function getAgentCollections(agentId: string): Promise<KnowledgeCollection[]> {
  const { data, error } = await supabase
    .from('agent_knowledge_links')
    .select(`
      collection:knowledge_collections(
        *,
        created_by_user:users!knowledge_collections_created_by_fkey(id, name, email)
      )
    `)
    .eq('agent_id', agentId);

  if (error) throw error;

  return (data || [])
    .map(link => link.collection)
    .filter((c): c is KnowledgeCollection => c !== null);
}

export async function linkCollectionToAgent(
  agentId: string,
  collectionId: string
): Promise<void> {
  const { error } = await supabase
    .from('agent_knowledge_links')
    .insert({ agent_id: agentId, collection_id: collectionId })
    .select();

  if (error && !error.message.includes('duplicate')) throw error;
}

export async function unlinkCollectionFromAgent(
  agentId: string,
  collectionId: string
): Promise<void> {
  const { error } = await supabase
    .from('agent_knowledge_links')
    .delete()
    .eq('agent_id', agentId)
    .eq('collection_id', collectionId);

  if (error) throw error;
}

export async function setAgentCollections(
  agentId: string,
  collectionIds: string[]
): Promise<void> {
  await supabase
    .from('agent_knowledge_links')
    .delete()
    .eq('agent_id', agentId);

  if (collectionIds.length > 0) {
    const links = collectionIds.map(collectionId => ({
      agent_id: agentId,
      collection_id: collectionId,
    }));

    const { error } = await supabase
      .from('agent_knowledge_links')
      .insert(links);

    if (error) throw error;
  }
}

export async function searchKnowledge(
  orgId: string,
  query: string,
  collectionIds?: string[],
  limit = 5
): Promise<KnowledgeSearchResult[]> {
  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-knowledge-embeddings`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'search',
        org_id: orgId,
        query,
        collection_ids: collectionIds,
        limit,
      }),
    }
  );

  const result = await response.json();
  return result.results || [];
}
