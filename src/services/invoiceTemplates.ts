import { supabase } from '../lib/supabase';
import type { User } from '../types';

export interface InvoiceTemplate {
  id: string;
  org_id: string;
  name: string;
  description?: string;
  is_default: boolean;
  logo_url?: string;
  header_text?: string;
  footer_text?: string;
  accent_color: string;
  show_payment_instructions: boolean;
  payment_instructions?: string;
  include_due_date: boolean;
  include_invoice_number: boolean;
  include_line_item_descriptions: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateInvoiceTemplateInput {
  name: string;
  description?: string;
  is_default?: boolean;
  logo_url?: string;
  header_text?: string;
  footer_text?: string;
  accent_color?: string;
  show_payment_instructions?: boolean;
  payment_instructions?: string;
  include_due_date?: boolean;
  include_invoice_number?: boolean;
  include_line_item_descriptions?: boolean;
}

export async function getInvoiceTemplates(): Promise<InvoiceTemplate[]> {
  const { data, error } = await supabase
    .from('invoice_templates')
    .select('*')
    .order('is_default', { ascending: false })
    .order('name');

  if (error) {
    console.error('Error fetching invoice templates:', error);
    throw error;
  }

  return data || [];
}

export async function getInvoiceTemplate(id: string): Promise<InvoiceTemplate | null> {
  const { data, error } = await supabase
    .from('invoice_templates')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('Error fetching invoice template:', error);
    throw error;
  }

  return data;
}

export async function getDefaultTemplate(): Promise<InvoiceTemplate | null> {
  const { data, error } = await supabase
    .from('invoice_templates')
    .select('*')
    .eq('is_default', true)
    .maybeSingle();

  if (error) {
    console.error('Error fetching default template:', error);
    throw error;
  }

  return data;
}

export async function createInvoiceTemplate(
  input: CreateInvoiceTemplateInput,
  user: User
): Promise<InvoiceTemplate> {
  const { data: userData } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single();

  if (!userData) {
    throw new Error('User not found');
  }

  if (input.is_default) {
    await supabase
      .from('invoice_templates')
      .update({ is_default: false })
      .eq('org_id', userData.organization_id)
      .eq('is_default', true);
  }

  const { data, error } = await supabase
    .from('invoice_templates')
    .insert({
      org_id: userData.organization_id,
      name: input.name,
      description: input.description || null,
      is_default: input.is_default ?? false,
      logo_url: input.logo_url || null,
      header_text: input.header_text || null,
      footer_text: input.footer_text ?? 'Thank you for your business!',
      accent_color: input.accent_color ?? '#2563eb',
      show_payment_instructions: input.show_payment_instructions ?? true,
      payment_instructions: input.payment_instructions || null,
      include_due_date: input.include_due_date ?? true,
      include_invoice_number: input.include_invoice_number ?? true,
      include_line_item_descriptions: input.include_line_item_descriptions ?? true,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating invoice template:', error);
    throw error;
  }

  return data;
}

export async function updateInvoiceTemplate(
  id: string,
  input: Partial<CreateInvoiceTemplateInput>
): Promise<InvoiceTemplate> {
  const template = await getInvoiceTemplate(id);
  if (!template) {
    throw new Error('Template not found');
  }

  if (input.is_default) {
    await supabase
      .from('invoice_templates')
      .update({ is_default: false })
      .eq('org_id', template.org_id)
      .eq('is_default', true)
      .neq('id', id);
  }

  const { data, error } = await supabase
    .from('invoice_templates')
    .update({
      ...input,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating invoice template:', error);
    throw error;
  }

  return data;
}

export async function deleteInvoiceTemplate(id: string): Promise<void> {
  const template = await getInvoiceTemplate(id);
  if (!template) {
    throw new Error('Template not found');
  }

  if (template.is_default) {
    throw new Error('Cannot delete the default template');
  }

  const { count } = await supabase
    .from('invoices')
    .select('*', { count: 'exact', head: true })
    .eq('template_id', id);

  if (count && count > 0) {
    await supabase
      .from('invoices')
      .update({ template_id: null })
      .eq('template_id', id);
  }

  const { error } = await supabase
    .from('invoice_templates')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting invoice template:', error);
    throw error;
  }
}

export async function setDefaultTemplate(id: string): Promise<InvoiceTemplate> {
  const template = await getInvoiceTemplate(id);
  if (!template) {
    throw new Error('Template not found');
  }

  await supabase
    .from('invoice_templates')
    .update({ is_default: false })
    .eq('org_id', template.org_id)
    .eq('is_default', true);

  const { data, error } = await supabase
    .from('invoice_templates')
    .update({ is_default: true })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error setting default template:', error);
    throw error;
  }

  return data;
}

export async function duplicateTemplate(
  id: string,
  newName: string,
  user: User
): Promise<InvoiceTemplate> {
  const template = await getInvoiceTemplate(id);
  if (!template) {
    throw new Error('Template not found');
  }

  return createInvoiceTemplate({
    name: newName,
    description: template.description,
    is_default: false,
    logo_url: template.logo_url,
    header_text: template.header_text,
    footer_text: template.footer_text,
    accent_color: template.accent_color,
    show_payment_instructions: template.show_payment_instructions,
    payment_instructions: template.payment_instructions,
    include_due_date: template.include_due_date,
    include_invoice_number: template.include_invoice_number,
    include_line_item_descriptions: template.include_line_item_descriptions,
  }, user);
}
