import { supabase } from '../lib/supabase';

export interface VapiWidget {
  id: string;
  org_id: string;
  assistant_id: string;
  binding_type: 'web_widget';
  external_binding_id: string;
  display_name: string;
  status: 'active' | 'inactive';
  metadata: WidgetConfig;
  created_at: string;
  updated_at: string;
  assistant?: { id: string; name: string; status: string; vapi_assistant_id: string | null } | null;
}

export interface WidgetConfig {
  mode: 'chat' | 'voice' | 'hybrid';
  theme_primary_color: string;
  theme_text_color: string;
  position: 'bottom-right' | 'bottom-left';
  welcome_text: string;
  public_key: string;
  [key: string]: unknown;
}

export interface CreateWidgetInput {
  name: string;
  assistant_id: string;
  mode: 'chat' | 'voice' | 'hybrid';
  theme_primary_color?: string;
  theme_text_color?: string;
  position?: 'bottom-right' | 'bottom-left';
  welcome_text?: string;
}

export async function listWidgets(orgId: string): Promise<VapiWidget[]> {
  const { data, error } = await supabase
    .from('vapi_bindings')
    .select('*, assistant:vapi_assistants!vapi_bindings_assistant_id_fkey(id, name, status, vapi_assistant_id)')
    .eq('org_id', orgId)
    .eq('binding_type', 'web_widget')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as unknown as VapiWidget[];
}

export async function createWidget(
  orgId: string,
  input: CreateWidgetInput,
  publicKey: string
): Promise<VapiWidget> {
  const widgetId = `widget_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  const { data, error } = await supabase
    .from('vapi_bindings')
    .insert({
      org_id: orgId,
      assistant_id: input.assistant_id,
      binding_type: 'web_widget',
      external_binding_id: widgetId,
      display_name: input.name,
      status: 'active',
      metadata: {
        mode: input.mode,
        theme_primary_color: input.theme_primary_color || '#0ea5e9',
        theme_text_color: input.theme_text_color || '#ffffff',
        position: input.position || 'bottom-right',
        welcome_text: input.welcome_text || 'Hi! How can I help you today?',
        public_key: publicKey,
      },
    })
    .select('*, assistant:vapi_assistants!vapi_bindings_assistant_id_fkey(id, name, status, vapi_assistant_id)')
    .single();

  if (error) throw error;
  return data as unknown as VapiWidget;
}

export async function updateWidget(
  id: string,
  updates: Partial<CreateWidgetInput> & { active?: boolean }
): Promise<VapiWidget> {
  const { data: existing } = await supabase
    .from('vapi_bindings')
    .select('metadata')
    .eq('id', id)
    .single();

  const currentMeta = (existing?.metadata || {}) as Record<string, unknown>;
  const newMeta = { ...currentMeta };

  if (updates.mode !== undefined) newMeta.mode = updates.mode;
  if (updates.theme_primary_color !== undefined) newMeta.theme_primary_color = updates.theme_primary_color;
  if (updates.theme_text_color !== undefined) newMeta.theme_text_color = updates.theme_text_color;
  if (updates.position !== undefined) newMeta.position = updates.position;
  if (updates.welcome_text !== undefined) newMeta.welcome_text = updates.welcome_text;

  const updatePayload: Record<string, unknown> = {
    metadata: newMeta,
    updated_at: new Date().toISOString(),
  };

  if (updates.name) updatePayload.display_name = updates.name;
  if (updates.assistant_id) updatePayload.assistant_id = updates.assistant_id;
  if (updates.active !== undefined) updatePayload.status = updates.active ? 'active' : 'inactive';

  const { data, error } = await supabase
    .from('vapi_bindings')
    .update(updatePayload)
    .eq('id', id)
    .select('*, assistant:vapi_assistants!vapi_bindings_assistant_id_fkey(id, name, status, vapi_assistant_id)')
    .single();

  if (error) throw error;
  return data as unknown as VapiWidget;
}

export async function deleteWidget(id: string): Promise<void> {
  const { error } = await supabase
    .from('vapi_bindings')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export function generateEmbedSnippet(widget: VapiWidget): string {
  const meta = widget.metadata;
  const assistantId = widget.assistant?.vapi_assistant_id || '';
  const publicKey = meta.public_key || '';

  return `<!-- Autom8ion Voice Widget -->
<script>
  (function() {
    var script = document.createElement('script');
    script.src = 'https://cdn.vapi.ai/web-widget.js';
    script.defer = true;
    script.onload = function() {
      window.vapiWidget = new VapiWidget({
        apiKey: '${publicKey}',
        assistantId: '${assistantId}',
        mode: '${meta.mode || 'hybrid'}',
        position: '${meta.position || 'bottom-right'}',
        colors: {
          primary: '${meta.theme_primary_color || '#0ea5e9'}',
          text: '${meta.theme_text_color || '#ffffff'}'
        },
        welcomeMessage: '${(meta.welcome_text || '').replace(/'/g, "\\'")}'
      });
    };
    document.head.appendChild(script);
  })();
</script>`;
}
