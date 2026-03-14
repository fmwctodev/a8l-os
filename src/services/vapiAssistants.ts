import { supabase } from '../lib/supabase';
import { callEdgeFunction } from '../lib/edgeFunction';

export interface VapiAssistant {
  id: string;
  org_id: string;
  name: string;
  slug: string;
  channel_modes: string[];
  vapi_assistant_id: string | null;
  first_message: string;
  system_prompt: string;
  llm_provider: string;
  llm_model: string;
  transcriber_provider: string;
  transcriber_model: string;
  voice_provider: string;
  voice_id: string | null;
  status: 'draft' | 'published' | 'archived';
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
  bindings_count?: number;
  created_by?: { name: string } | null;
}

export interface VapiAssistantVersion {
  id: string;
  assistant_id: string;
  version_number: number;
  snapshot: Record<string, unknown>;
  notes: string | null;
  created_by_user_id: string | null;
  created_at: string;
  created_by?: { name: string } | null;
}

export interface VapiAssistantFilters {
  search?: string;
  status?: string;
  channel?: string;
}

export interface CreateVapiAssistantInput {
  name: string;
  slug: string;
  channel_modes?: string[];
  first_message?: string;
  system_prompt?: string;
  llm_provider?: string;
  llm_model?: string;
  transcriber_provider?: string;
  transcriber_model?: string;
  voice_provider?: string;
  voice_id?: string | null;
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 60);
}

export async function listAssistants(
  orgId: string,
  filters?: VapiAssistantFilters
): Promise<VapiAssistant[]> {
  let query = supabase
    .from('vapi_assistants')
    .select('*, created_by:users!vapi_assistants_created_by_user_id_fkey(name)')
    .eq('org_id', orgId)
    .order('updated_at', { ascending: false });

  if (filters?.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  }
  if (filters?.search) {
    query = query.ilike('name', `%${filters.search}%`);
  }

  const { data, error } = await query;
  if (error) throw error;

  const assistants = data || [];

  if (assistants.length > 0) {
    const ids = assistants.map(a => a.id);
    const { data: bindings } = await supabase
      .from('vapi_bindings')
      .select('assistant_id')
      .in('assistant_id', ids)
      .eq('status', 'active');

    const countMap: Record<string, number> = {};
    (bindings || []).forEach(b => {
      countMap[b.assistant_id] = (countMap[b.assistant_id] || 0) + 1;
    });

    assistants.forEach(a => {
      a.bindings_count = countMap[a.id] || 0;
    });
  }

  if (filters?.channel) {
    return assistants.filter(a =>
      Array.isArray(a.channel_modes) && a.channel_modes.includes(filters.channel!)
    );
  }

  return assistants;
}

export async function getAssistant(id: string): Promise<VapiAssistant | null> {
  const { data, error } = await supabase
    .from('vapi_assistants')
    .select('*, created_by:users!vapi_assistants_created_by_user_id_fkey(name)')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const { data: bindings } = await supabase
    .from('vapi_bindings')
    .select('id')
    .eq('assistant_id', id)
    .eq('status', 'active');

  data.bindings_count = bindings?.length || 0;
  return data;
}

export async function createAssistant(
  orgId: string,
  input: CreateVapiAssistantInput,
  userId: string
): Promise<VapiAssistant> {
  const slug = input.slug || generateSlug(input.name);

  const { data, error } = await supabase
    .from('vapi_assistants')
    .insert({
      org_id: orgId,
      name: input.name,
      slug,
      channel_modes: input.channel_modes || ['voice'],
      first_message: input.first_message || '',
      system_prompt: input.system_prompt || '',
      llm_provider: input.llm_provider || 'openai',
      llm_model: input.llm_model || 'gpt-4o',
      transcriber_provider: input.transcriber_provider || 'deepgram',
      transcriber_model: input.transcriber_model || 'nova-2',
      voice_provider: input.voice_provider || 'elevenlabs',
      voice_id: input.voice_id || null,
      status: 'draft',
      created_by_user_id: userId,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateAssistant(
  id: string,
  updates: Partial<CreateVapiAssistantInput>
): Promise<VapiAssistant> {
  const { data, error } = await supabase
    .from('vapi_assistants')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function publishAssistant(id: string, userId: string, notes?: string): Promise<VapiAssistant> {
  const assistant = await getAssistant(id);
  if (!assistant) throw new Error('Assistant not found');

  const vapiConfig: Record<string, unknown> = {
    name: assistant.name,
    model: {
      provider: assistant.llm_provider,
      model: assistant.llm_model,
      messages: [{ role: 'system', content: assistant.system_prompt }],
    },
    transcriber: {
      provider: assistant.transcriber_provider,
      model: assistant.transcriber_model,
    },
  };

  if (assistant.first_message) {
    vapiConfig.firstMessage = assistant.first_message;
  }

  if (assistant.voice_id) {
    vapiConfig.voice = {
      provider: assistant.voice_provider,
      voiceId: assistant.voice_id,
    };
  } else if (assistant.voice_provider) {
    vapiConfig.voice = {
      provider: assistant.voice_provider,
    };
  }

  const { data: toolBindings } = await supabase
    .from('vapi_assistant_tool_bindings')
    .select('tool_id')
    .eq('assistant_id', id);

  if (toolBindings && toolBindings.length > 0) {
    const toolIds = toolBindings.map(tb => tb.tool_id);
    const { data: tools } = await supabase
      .from('vapi_tool_registry')
      .select('*')
      .in('id', toolIds)
      .eq('active', true);

    if (tools && tools.length > 0) {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      vapiConfig.tools = tools.map(t => ({
        type: 'function',
        function: {
          name: t.tool_name,
          description: t.description,
          parameters: t.input_schema,
        },
        server: {
          url: `${supabaseUrl}/functions/v1/vapi-tool-gateway`,
        },
      }));
    }
  }

  let vapiResult: Record<string, unknown>;
  if (assistant.vapi_assistant_id) {
    const response = await callEdgeFunction('vapi-client', {
      action: 'update_assistant',
      vapi_assistant_id: assistant.vapi_assistant_id,
      config: vapiConfig,
    });
    const json = await response.json();
    if (!json.success) {
      const detail = json.error?.details?.message || json.error?.details?.error || '';
      throw new Error(json.error?.message + (detail ? `: ${detail}` : '') || 'Failed to update Vapi assistant');
    }
    vapiResult = json.data;
  } else {
    const response = await callEdgeFunction('vapi-client', {
      action: 'create_assistant',
      config: vapiConfig,
    });
    const json = await response.json();
    if (!json.success) {
      const detail = json.error?.details?.message || json.error?.details?.error || '';
      throw new Error(json.error?.message + (detail ? `: ${detail}` : '') || 'Failed to create Vapi assistant');
    }
    vapiResult = json.data;
  }

  const vapiAssistantId = (vapiResult as { id?: string }).id || assistant.vapi_assistant_id;

  const { data: versions } = await supabase
    .from('vapi_assistant_versions')
    .select('version_number')
    .eq('assistant_id', id)
    .order('version_number', { ascending: false })
    .limit(1);

  const nextVersion = (versions?.[0]?.version_number || 0) + 1;

  await supabase.from('vapi_assistant_versions').insert({
    assistant_id: id,
    version_number: nextVersion,
    snapshot: { ...assistant, vapi_config: vapiConfig },
    notes: notes || `Published version ${nextVersion}`,
    created_by_user_id: userId,
  });

  const { data: updated, error: updateError } = await supabase
    .from('vapi_assistants')
    .update({
      vapi_assistant_id: vapiAssistantId,
      status: 'published',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (updateError) throw updateError;
  return updated;
}

export async function archiveAssistant(id: string): Promise<void> {
  const { error } = await supabase
    .from('vapi_assistants')
    .update({ status: 'archived', updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
}

export async function duplicateAssistant(id: string, userId: string): Promise<VapiAssistant> {
  const original = await getAssistant(id);
  if (!original) throw new Error('Assistant not found');

  return createAssistant(original.org_id, {
    name: `${original.name} (Copy)`,
    slug: `${original.slug}-copy-${Date.now()}`,
    channel_modes: original.channel_modes,
    first_message: original.first_message,
    system_prompt: original.system_prompt,
    llm_provider: original.llm_provider,
    llm_model: original.llm_model,
    transcriber_provider: original.transcriber_provider,
    transcriber_model: original.transcriber_model,
    voice_provider: original.voice_provider,
    voice_id: original.voice_id,
  }, userId);
}

export async function getAssistantVersions(assistantId: string): Promise<VapiAssistantVersion[]> {
  const { data, error } = await supabase
    .from('vapi_assistant_versions')
    .select('*, created_by:users!vapi_assistant_versions_created_by_user_id_fkey(name)')
    .eq('assistant_id', assistantId)
    .order('version_number', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function deleteAssistant(id: string): Promise<void> {
  const assistant = await getAssistant(id);
  if (assistant?.vapi_assistant_id) {
    try {
      await callEdgeFunction('vapi-client', {
        action: 'delete_assistant',
        vapi_assistant_id: assistant.vapi_assistant_id,
      });
    } catch (e) {
      console.warn('Failed to delete Vapi assistant:', e);
    }
  }

  const { error } = await supabase
    .from('vapi_assistants')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
