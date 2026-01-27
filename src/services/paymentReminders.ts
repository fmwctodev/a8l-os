import { supabase } from '../lib/supabase';
import type { User } from '../types';

export interface PaymentReminder {
  id: string;
  org_id: string;
  invoice_id: string;
  reminder_type: 'first_notice' | 'second_notice' | 'third_notice' | 'final_notice' | 'custom';
  scheduled_for: string;
  sent_at?: string;
  channel: 'email' | 'sms' | 'both';
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
  error_message?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  invoice?: {
    id: string;
    doc_number: string;
    total: number;
    due_date: string;
    status: string;
    contact_id: string;
    contact?: {
      id: string;
      first_name: string;
      last_name: string;
      email?: string;
      phone?: string;
    };
  };
}

export interface PaymentReminderSettings {
  id: string;
  org_id: string;
  enabled: boolean;
  first_reminder_days: number;
  second_reminder_days: number;
  third_reminder_days: number;
  final_reminder_days: number;
  channels: string[];
  email_template_subject: string;
  email_template_body: string;
  sms_template: string;
  created_at: string;
  updated_at: string;
}

export interface PaymentReminderFilters {
  invoiceId?: string;
  status?: ('pending' | 'sent' | 'failed' | 'cancelled')[];
  reminderType?: string;
  startDate?: string;
  endDate?: string;
}

export async function getPaymentReminders(filters?: PaymentReminderFilters): Promise<PaymentReminder[]> {
  let query = supabase
    .from('payment_reminders')
    .select(`
      *,
      invoice:invoices!payment_reminders_invoice_id_fkey(
        id, doc_number, total, due_date, status, contact_id,
        contact:contacts!invoices_contact_id_fkey(id, first_name, last_name, email, phone)
      )
    `)
    .order('scheduled_for', { ascending: true });

  if (filters?.invoiceId) {
    query = query.eq('invoice_id', filters.invoiceId);
  }

  if (filters?.status?.length) {
    query = query.in('status', filters.status);
  }

  if (filters?.reminderType) {
    query = query.eq('reminder_type', filters.reminderType);
  }

  if (filters?.startDate) {
    query = query.gte('scheduled_for', filters.startDate);
  }

  if (filters?.endDate) {
    query = query.lte('scheduled_for', filters.endDate);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching payment reminders:', error);
    throw error;
  }

  return data || [];
}

export async function getPaymentReminder(id: string): Promise<PaymentReminder | null> {
  const { data, error } = await supabase
    .from('payment_reminders')
    .select(`
      *,
      invoice:invoices!payment_reminders_invoice_id_fkey(
        id, doc_number, total, due_date, status, contact_id,
        contact:contacts!invoices_contact_id_fkey(id, first_name, last_name, email, phone)
      )
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('Error fetching payment reminder:', error);
    throw error;
  }

  return data;
}

export async function createPaymentReminder(
  invoiceId: string,
  scheduledFor: string,
  reminderType: PaymentReminder['reminder_type'],
  channel: PaymentReminder['channel'],
  user: User
): Promise<PaymentReminder> {
  const { data: userData } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single();

  if (!userData) {
    throw new Error('User not found');
  }

  const { data, error } = await supabase
    .from('payment_reminders')
    .insert({
      org_id: userData.organization_id,
      invoice_id: invoiceId,
      reminder_type: reminderType,
      scheduled_for: scheduledFor,
      channel,
      status: 'pending',
      created_by: user.id,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating payment reminder:', error);
    throw error;
  }

  return getPaymentReminder(data.id) as Promise<PaymentReminder>;
}

export async function cancelPaymentReminder(id: string): Promise<PaymentReminder> {
  const reminder = await getPaymentReminder(id);
  if (!reminder) {
    throw new Error('Reminder not found');
  }

  if (reminder.status !== 'pending') {
    throw new Error('Only pending reminders can be cancelled');
  }

  const { error } = await supabase
    .from('payment_reminders')
    .update({ status: 'cancelled' })
    .eq('id', id);

  if (error) {
    console.error('Error cancelling reminder:', error);
    throw error;
  }

  return getPaymentReminder(id) as Promise<PaymentReminder>;
}

export async function scheduleInvoiceReminders(
  invoiceId: string,
  user: User
): Promise<PaymentReminder[]> {
  const { data: invoice } = await supabase
    .from('invoices')
    .select('id, due_date, org_id, status')
    .eq('id', invoiceId)
    .single();

  if (!invoice || !invoice.due_date) {
    throw new Error('Invoice not found or has no due date');
  }

  if (invoice.status === 'paid' || invoice.status === 'void') {
    throw new Error('Cannot schedule reminders for paid or voided invoices');
  }

  const { data: settings } = await supabase
    .from('payment_reminder_settings')
    .select('*')
    .eq('org_id', invoice.org_id)
    .maybeSingle();

  if (!settings?.enabled) {
    return [];
  }

  const { error: deleteError } = await supabase
    .from('payment_reminders')
    .delete()
    .eq('invoice_id', invoiceId)
    .eq('status', 'pending');

  if (deleteError) {
    console.error('Error deleting existing reminders:', deleteError);
  }

  const dueDate = new Date(invoice.due_date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const remindersToCreate: {
    type: PaymentReminder['reminder_type'];
    daysOffset: number;
  }[] = [
    { type: 'first_notice', daysOffset: settings.first_reminder_days },
    { type: 'second_notice', daysOffset: settings.second_reminder_days },
    { type: 'third_notice', daysOffset: settings.third_reminder_days },
    { type: 'final_notice', daysOffset: settings.final_reminder_days },
  ];

  const channel = settings.channels.includes('email') && settings.channels.includes('sms')
    ? 'both'
    : settings.channels[0] as 'email' | 'sms';

  const createdReminders: PaymentReminder[] = [];

  for (const reminderConfig of remindersToCreate) {
    const reminderDate = new Date(dueDate);
    reminderDate.setDate(reminderDate.getDate() + reminderConfig.daysOffset);

    if (reminderDate >= today) {
      const reminder = await createPaymentReminder(
        invoiceId,
        reminderDate.toISOString(),
        reminderConfig.type,
        channel,
        user
      );
      createdReminders.push(reminder);
    }
  }

  return createdReminders;
}

export async function getPaymentReminderSettings(): Promise<PaymentReminderSettings | null> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;

  const { data: user } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', userData.user.id)
    .single();

  if (!user) return null;

  const { data, error } = await supabase
    .from('payment_reminder_settings')
    .select('*')
    .eq('org_id', user.organization_id)
    .maybeSingle();

  if (error) {
    console.error('Error fetching reminder settings:', error);
    throw error;
  }

  return data;
}

export async function updatePaymentReminderSettings(
  updates: Partial<Omit<PaymentReminderSettings, 'id' | 'org_id' | 'created_at' | 'updated_at'>>
): Promise<PaymentReminderSettings> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error('Not authenticated');

  const { data: user } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', userData.user.id)
    .single();

  if (!user) throw new Error('User not found');

  const { data, error } = await supabase
    .from('payment_reminder_settings')
    .upsert({
      org_id: user.organization_id,
      ...updates,
    }, {
      onConflict: 'org_id',
    })
    .select()
    .single();

  if (error) {
    console.error('Error updating reminder settings:', error);
    throw error;
  }

  return data;
}

export async function getInvoiceReminders(invoiceId: string): Promise<PaymentReminder[]> {
  return getPaymentReminders({ invoiceId });
}

export async function getPendingReminders(): Promise<PaymentReminder[]> {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('payment_reminders')
    .select(`
      *,
      invoice:invoices!payment_reminders_invoice_id_fkey(
        id, doc_number, total, due_date, status, contact_id, payment_link_url,
        contact:contacts!invoices_contact_id_fkey(id, first_name, last_name, email, phone)
      )
    `)
    .eq('status', 'pending')
    .lte('scheduled_for', now)
    .order('scheduled_for', { ascending: true });

  if (error) {
    console.error('Error fetching pending reminders:', error);
    throw error;
  }

  return (data || []).filter(r =>
    r.invoice &&
    r.invoice.status !== 'paid' &&
    r.invoice.status !== 'void'
  );
}

export async function markReminderSent(
  id: string,
  success: boolean,
  errorMessage?: string
): Promise<void> {
  const updates: Record<string, unknown> = {
    status: success ? 'sent' : 'failed',
    sent_at: success ? new Date().toISOString() : null,
  };

  if (errorMessage) {
    updates.error_message = errorMessage;
  }

  const { error } = await supabase
    .from('payment_reminders')
    .update(updates)
    .eq('id', id);

  if (error) {
    console.error('Error updating reminder status:', error);
    throw error;
  }

  if (success) {
    const { data: reminder } = await supabase
      .from('payment_reminders')
      .select('invoice_id')
      .eq('id', id)
      .single();

    if (reminder) {
      await supabase
        .from('invoices')
        .update({
          last_reminder_sent_at: new Date().toISOString(),
          reminder_count: supabase.rpc('increment_reminder_count', { invoice_id: reminder.invoice_id }),
        })
        .eq('id', reminder.invoice_id);

      await supabase.rpc('increment_reminder_count_direct', { p_invoice_id: reminder.invoice_id });
    }
  }
}

export async function getReminderStats(): Promise<{
  pending: number;
  sentToday: number;
  sentThisWeek: number;
  failed: number;
}> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString();

  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoStr = weekAgo.toISOString();

  const { count: pending } = await supabase
    .from('payment_reminders')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');

  const { count: sentToday } = await supabase
    .from('payment_reminders')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'sent')
    .gte('sent_at', todayStr);

  const { count: sentThisWeek } = await supabase
    .from('payment_reminders')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'sent')
    .gte('sent_at', weekAgoStr);

  const { count: failed } = await supabase
    .from('payment_reminders')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'failed');

  return {
    pending: pending || 0,
    sentToday: sentToday || 0,
    sentThisWeek: sentThisWeek || 0,
    failed: failed || 0,
  };
}
