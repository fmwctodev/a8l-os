import { supabase } from '../lib/supabase';

export type EditorMode = 'plain_text' | 'drag_drop';
export type TemplateStatus = 'draft' | 'published' | 'archived';

export interface EmailTemplate {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  subject_template: string;
  preview_text: string | null;
  category: string | null;
  editor_mode: EditorMode;
  body_plain: string | null;
  design_json: Record<string, unknown> | null;
  body_html: string;
  variables: string[];
  status: TemplateStatus;
  use_count: number;
  last_sent_at: string | null;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

export interface CreateEmailTemplateInput {
  name: string;
  description?: string;
  subject_template?: string;
  preview_text?: string;
  category?: string;
  editor_mode: EditorMode;
  body_plain?: string;
  design_json?: Record<string, unknown>;
  body_html?: string;
  variables?: string[];
}

export interface UpdateEmailTemplateInput extends Partial<CreateEmailTemplateInput> {
  status?: TemplateStatus;
}

export async function listEmailTemplates(
  organizationId: string,
  opts: { status?: TemplateStatus; category?: string } = {}
): Promise<EmailTemplate[]> {
  let q = supabase
    .from('email_templates')
    .select('*')
    .eq('organization_id', organizationId)
    .order('updated_at', { ascending: false });
  if (opts.status) q = q.eq('status', opts.status);
  if (opts.category) q = q.eq('category', opts.category);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as EmailTemplate[];
}

export async function getEmailTemplate(id: string): Promise<EmailTemplate | null> {
  const { data, error } = await supabase
    .from('email_templates')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return (data as EmailTemplate | null) ?? null;
}

export async function createEmailTemplate(
  organizationId: string,
  input: CreateEmailTemplateInput,
  userId: string | null
): Promise<EmailTemplate> {
  const { data, error } = await supabase
    .from('email_templates')
    .insert({
      organization_id: organizationId,
      name: input.name,
      description: input.description ?? null,
      subject_template: input.subject_template ?? '',
      preview_text: input.preview_text ?? null,
      category: input.category ?? null,
      editor_mode: input.editor_mode,
      body_plain: input.body_plain ?? null,
      design_json: input.design_json ?? null,
      body_html: input.body_html ?? '',
      variables: input.variables ?? [],
      status: 'draft',
      created_by_user_id: userId,
    })
    .select()
    .single();
  if (error) throw error;
  return data as EmailTemplate;
}

export async function updateEmailTemplate(
  id: string,
  patch: UpdateEmailTemplateInput
): Promise<EmailTemplate> {
  const { data, error } = await supabase
    .from('email_templates')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as EmailTemplate;
}

export async function deleteEmailTemplate(id: string): Promise<void> {
  const { error } = await supabase.from('email_templates').delete().eq('id', id);
  if (error) throw error;
}

export async function publishEmailTemplate(id: string): Promise<string> {
  const { data, error } = await supabase.rpc('publish_email_template', { p_template_id: id });
  if (error) throw error;
  return data as string;
}

export interface EmailTemplateVersion {
  id: string;
  template_id: string;
  version_number: number;
  editor_mode: EditorMode;
  subject_template: string;
  preview_text: string | null;
  body_plain: string | null;
  design_json: Record<string, unknown> | null;
  body_html: string;
  variables: string[];
  created_by_user_id: string | null;
  created_at: string;
}

export async function listEmailTemplateVersions(
  templateId: string
): Promise<EmailTemplateVersion[]> {
  const { data, error } = await supabase
    .from('email_template_versions')
    .select('*')
    .eq('template_id', templateId)
    .order('version_number', { ascending: false });
  if (error) throw error;
  return (data ?? []) as EmailTemplateVersion[];
}
