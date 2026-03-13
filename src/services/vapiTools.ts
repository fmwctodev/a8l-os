import { supabase } from '../lib/supabase';

export interface VapiTool {
  id: string;
  org_id: string | null;
  tool_name: string;
  description: string;
  input_schema: Record<string, unknown>;
  endpoint_path: string;
  allowed_assistant_scopes: string[];
  active: boolean;
  created_at: string;
  is_system: boolean;
}

export interface CreateToolInput {
  tool_name: string;
  description: string;
  input_schema: Record<string, unknown>;
  endpoint_path: string;
  allowed_assistant_scopes?: string[];
}

export async function listTools(orgId: string): Promise<VapiTool[]> {
  const { data, error } = await supabase
    .from('vapi_tool_registry')
    .select('*')
    .or(`org_id.is.null,org_id.eq.${orgId}`)
    .order('tool_name', { ascending: true });

  if (error) throw error;
  return (data || []).map(t => ({
    ...t,
    is_system: t.org_id === null,
  }));
}

export async function createTool(orgId: string, input: CreateToolInput): Promise<VapiTool> {
  const { data, error } = await supabase
    .from('vapi_tool_registry')
    .insert({
      org_id: orgId,
      tool_name: input.tool_name,
      description: input.description,
      input_schema: input.input_schema,
      endpoint_path: input.endpoint_path,
      allowed_assistant_scopes: input.allowed_assistant_scopes || ['*'],
      active: true,
    })
    .select()
    .single();

  if (error) throw error;
  return { ...data, is_system: false };
}

export async function updateTool(
  id: string,
  updates: Partial<CreateToolInput>
): Promise<VapiTool> {
  const { data, error } = await supabase
    .from('vapi_tool_registry')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return { ...data, is_system: data.org_id === null };
}

export async function toggleTool(id: string, active: boolean): Promise<void> {
  const { error } = await supabase
    .from('vapi_tool_registry')
    .update({ active })
    .eq('id', id);

  if (error) throw error;
}

export async function deleteTool(id: string): Promise<void> {
  const { error } = await supabase
    .from('vapi_tool_registry')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
