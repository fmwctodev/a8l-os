import { supabase } from '../lib/supabase';
import type {
  Form,
  FormSubmission,
  FormDefinition,
  FormSettings,
  FormFilters,
  FormStats,
  FormStatus,
} from '../types';

function generateSlug(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let slug = '';
  for (let i = 0; i < 8; i++) {
    slug += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return slug;
}

export async function getForms(
  organizationId: string,
  filters?: FormFilters
): Promise<Form[]> {
  let query = supabase
    .from('forms')
    .select(`
      *,
      created_by_user:users!forms_created_by_fkey(id, name, email, avatar_url)
    `)
    .eq('organization_id', organizationId)
    .order('updated_at', { ascending: false });

  if (filters?.status && filters.status.length > 0) {
    query = query.in('status', filters.status);
  }

  if (filters?.search) {
    query = query.ilike('name', `%${filters.search}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getFormById(id: string): Promise<Form | null> {
  const { data, error } = await supabase
    .from('forms')
    .select(`
      *,
      created_by_user:users!forms_created_by_fkey(id, name, email, avatar_url)
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getFormBySlug(slug: string): Promise<Form | null> {
  const { data, error } = await supabase
    .from('forms')
    .select('*')
    .eq('public_slug', slug)
    .eq('status', 'published')
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createForm(
  organizationId: string,
  userId: string,
  name: string,
  description: string = ''
): Promise<Form> {
  const defaultDefinition: FormDefinition = {
    fields: [],
  };

  const defaultSettings: FormSettings = {
    contactMatching: 'email_first',
    fieldOverwrite: 'only_if_empty',
    honeypotEnabled: true,
    rateLimitPerIp: 10,
  };

  const { data, error } = await supabase
    .from('forms')
    .insert({
      organization_id: organizationId,
      name,
      description,
      status: 'draft',
      definition: defaultDefinition,
      settings: defaultSettings,
      created_by: userId,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateForm(
  id: string,
  updates: {
    name?: string;
    description?: string;
    definition?: FormDefinition;
    settings?: FormSettings;
  }
): Promise<Form> {
  const { data, error } = await supabase
    .from('forms')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function publishForm(id: string): Promise<Form> {
  const form = await getFormById(id);
  if (!form) throw new Error('Form not found');

  const slug = form.public_slug || generateSlug();

  const { data, error } = await supabase
    .from('forms')
    .update({
      status: 'published',
      public_slug: slug,
      published_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function unpublishForm(id: string): Promise<Form> {
  const { data, error } = await supabase
    .from('forms')
    .update({
      status: 'draft',
      published_at: null,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function archiveForm(id: string): Promise<Form> {
  const { data, error } = await supabase
    .from('forms')
    .update({ status: 'archived' })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function duplicateForm(
  id: string,
  userId: string
): Promise<Form> {
  const original = await getFormById(id);
  if (!original) throw new Error('Form not found');

  const { data, error } = await supabase
    .from('forms')
    .insert({
      organization_id: original.organization_id,
      name: `${original.name} (Copy)`,
      description: original.description,
      status: 'draft',
      definition: original.definition,
      settings: original.settings,
      created_by: userId,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteForm(id: string): Promise<void> {
  const { error } = await supabase
    .from('forms')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function getFormSubmissions(
  formId: string,
  options?: {
    limit?: number;
    offset?: number;
    startDate?: string;
    endDate?: string;
  }
): Promise<{ submissions: FormSubmission[]; total: number }> {
  let query = supabase
    .from('form_submissions')
    .select(`
      *,
      contact:contacts(id, first_name, last_name, email, phone)
    `, { count: 'exact' })
    .eq('form_id', formId)
    .order('submitted_at', { ascending: false });

  if (options?.startDate) {
    query = query.gte('submitted_at', options.startDate);
  }

  if (options?.endDate) {
    query = query.lte('submitted_at', options.endDate);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return { submissions: data || [], total: count || 0 };
}

export async function getFormStats(organizationId: string): Promise<FormStats> {
  const { data: forms, error: formsError } = await supabase
    .from('forms')
    .select('id, status')
    .eq('organization_id', organizationId);

  if (formsError) throw formsError;

  const totalForms = forms?.length || 0;
  const publishedForms = forms?.filter((f) => f.status === 'published').length || 0;

  const { count: totalSubmissions, error: submissionsError } = await supabase
    .from('form_submissions')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId);

  if (submissionsError) throw submissionsError;

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { count: recentSubmissions, error: recentError } = await supabase
    .from('form_submissions')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .gte('submitted_at', sevenDaysAgo.toISOString());

  if (recentError) throw recentError;

  return {
    totalForms,
    publishedForms,
    totalSubmissions: totalSubmissions || 0,
    recentSubmissions: recentSubmissions || 0,
  };
}

export function generateFormEmbedCode(
  formSlug: string,
  options: {
    type: 'iframe' | 'popup' | 'sdk';
    baseUrl: string;
  }
): string {
  const formUrl = `${options.baseUrl}/f/${formSlug}`;

  if (options.type === 'iframe') {
    return `<iframe
  src="${formUrl}?embed=true"
  width="100%"
  height="500"
  frameborder="0"
  style="border: none; max-width: 600px;"
></iframe>`;
  }

  if (options.type === 'popup') {
    return `<script src="${options.baseUrl}/sdk/autom8ion-forms.js"></script>
<script>
  Autom8ion.init({ baseUrl: '${options.baseUrl}' });
</script>
<button onclick="Autom8ion.openFormPopup('${formSlug}')">
  Open Form
</button>`;
  }

  return `<script src="${options.baseUrl}/sdk/autom8ion-forms.js"></script>
<script>
  Autom8ion.init({ baseUrl: '${options.baseUrl}' });
  Autom8ion.renderForm('${formSlug}', 'form-container', {
    onSubmit: function(data) {
      console.log('Form submitted:', data);
    },
    onError: function(error) {
      console.error('Form error:', error);
    }
  });
</script>
<div id="form-container"></div>`;
}

export function getFormPublicUrl(
  slug: string,
  baseUrl: string
): string {
  return `${baseUrl}/f/${slug}`;
}
