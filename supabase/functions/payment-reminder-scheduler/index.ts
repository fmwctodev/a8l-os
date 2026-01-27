import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface PaymentReminder {
  id: string;
  org_id: string;
  invoice_id: string;
  reminder_type: string;
  scheduled_for: string;
  channel: 'email' | 'sms' | 'both';
  status: string;
  invoice: {
    id: string;
    doc_number: string;
    total: number;
    due_date: string;
    status: string;
    payment_link_url: string | null;
    contact_id: string;
    contact: {
      id: string;
      first_name: string;
      last_name: string;
      email: string | null;
      phone: string | null;
    };
  };
}

interface ReminderSettings {
  org_id: string;
  enabled: boolean;
  email_template_subject: string;
  email_template_body: string;
  sms_template: string;
}

function replaceTemplateVariables(
  template: string,
  variables: Record<string, string>
): string {
  let result = template;

  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }

  const isOverdue = variables.is_overdue === 'true';
  if (isOverdue) {
    result = result.replace(/{{#if is_overdue}}([\s\S]*?){{else}}[\s\S]*?{{\/if}}/g, '$1');
  } else {
    result = result.replace(/{{#if is_overdue}}[\s\S]*?{{else}}([\s\S]*?){{\/if}}/g, '$1');
  }

  result = result.replace(/{{#if \w+}}[\s\S]*?{{\/if}}/g, '');

  return result;
}

async function sendEmailReminder(
  supabase: ReturnType<typeof createClient>,
  reminder: PaymentReminder,
  settings: ReminderSettings,
  supabaseUrl: string,
  supabaseServiceKey: string
): Promise<{ success: boolean; error?: string }> {
  const contact = reminder.invoice.contact;
  if (!contact.email) {
    return { success: false, error: 'Contact has no email address' };
  }

  const { data: org } = await supabase
    .from('organizations')
    .select('name')
    .eq('id', reminder.org_id)
    .single();

  const dueDate = new Date(reminder.invoice.due_date);
  const today = new Date();
  const isOverdue = dueDate < today;

  const variables: Record<string, string> = {
    contact_name: `${contact.first_name} ${contact.last_name}`.trim(),
    invoice_number: reminder.invoice.doc_number || 'N/A',
    invoice_total: `$${reminder.invoice.total.toFixed(2)}`,
    due_date: dueDate.toLocaleDateString(),
    status_text: isOverdue ? 'overdue' : 'due soon',
    payment_link: reminder.invoice.payment_link_url || '',
    company_name: org?.name || 'Our Company',
    is_overdue: isOverdue.toString(),
  };

  const subject = replaceTemplateVariables(settings.email_template_subject, variables);
  const body = replaceTemplateVariables(settings.email_template_body, variables);

  try {
    const emailResponse = await fetch(`${supabaseUrl}/functions/v1/email-send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        org_id: reminder.org_id,
        to: contact.email,
        subject,
        body,
        contact_id: contact.id,
        template_type: 'payment_reminder',
      }),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.json();
      return { success: false, error: errorData.error?.message || 'Email send failed' };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Email send failed',
    };
  }
}

async function sendSmsReminder(
  supabase: ReturnType<typeof createClient>,
  reminder: PaymentReminder,
  settings: ReminderSettings,
  supabaseUrl: string,
  supabaseServiceKey: string
): Promise<{ success: boolean; error?: string }> {
  const contact = reminder.invoice.contact;
  if (!contact.phone) {
    return { success: false, error: 'Contact has no phone number' };
  }

  const dueDate = new Date(reminder.invoice.due_date);
  const today = new Date();
  const isOverdue = dueDate < today;

  const variables: Record<string, string> = {
    contact_name: contact.first_name,
    invoice_number: reminder.invoice.doc_number || 'N/A',
    invoice_total: `$${reminder.invoice.total.toFixed(2)}`,
    due_date: dueDate.toLocaleDateString(),
    status_text: isOverdue ? 'overdue' : 'due soon',
    payment_link: reminder.invoice.payment_link_url || '',
  };

  const message = replaceTemplateVariables(settings.sms_template, variables);

  try {
    const smsResponse = await fetch(`${supabaseUrl}/functions/v1/phone-twilio-messaging`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        org_id: reminder.org_id,
        to: contact.phone,
        body: message,
        contact_id: contact.id,
      }),
    });

    if (!smsResponse.ok) {
      const errorData = await smsResponse.json();
      return { success: false, error: errorData.error?.message || 'SMS send failed' };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'SMS send failed',
    };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date().toISOString();

    const { data: dueReminders, error: fetchError } = await supabase
      .from('payment_reminders')
      .select(`
        id,
        org_id,
        invoice_id,
        reminder_type,
        scheduled_for,
        channel,
        status,
        invoice:invoices!payment_reminders_invoice_id_fkey(
          id, doc_number, total, due_date, status, payment_link_url, contact_id,
          contact:contacts!invoices_contact_id_fkey(
            id, first_name, last_name, email, phone
          )
        )
      `)
      .eq('status', 'pending')
      .lte('scheduled_for', now)
      .order('scheduled_for', { ascending: true })
      .limit(50);

    if (fetchError) {
      throw new Error(`Failed to fetch reminders: ${fetchError.message}`);
    }

    if (!dueReminders || dueReminders.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No due reminders', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const orgIds = [...new Set(dueReminders.map(r => r.org_id))];
    const { data: allSettings } = await supabase
      .from('payment_reminder_settings')
      .select('*')
      .in('org_id', orgIds);

    const settingsMap = new Map<string, ReminderSettings>();
    for (const setting of allSettings || []) {
      settingsMap.set(setting.org_id, setting);
    }

    const results: Array<{
      reminderId: string;
      status: string;
      channel?: string;
      error?: string;
    }> = [];

    for (const reminderData of dueReminders) {
      const reminder = reminderData as unknown as PaymentReminder;

      if (!reminder.invoice ||
          reminder.invoice.status === 'paid' ||
          reminder.invoice.status === 'void') {
        await supabase
          .from('payment_reminders')
          .update({ status: 'cancelled' })
          .eq('id', reminder.id);

        results.push({
          reminderId: reminder.id,
          status: 'cancelled',
          error: 'Invoice is paid or voided',
        });
        continue;
      }

      const settings = settingsMap.get(reminder.org_id);
      if (!settings || !settings.enabled) {
        await supabase
          .from('payment_reminders')
          .update({ status: 'cancelled' })
          .eq('id', reminder.id);

        results.push({
          reminderId: reminder.id,
          status: 'cancelled',
          error: 'Reminders disabled for organization',
        });
        continue;
      }

      let emailResult = { success: true, error: undefined as string | undefined };
      let smsResult = { success: true, error: undefined as string | undefined };

      if (reminder.channel === 'email' || reminder.channel === 'both') {
        emailResult = await sendEmailReminder(
          supabase,
          reminder,
          settings,
          supabaseUrl,
          supabaseServiceKey
        );
      }

      if (reminder.channel === 'sms' || reminder.channel === 'both') {
        smsResult = await sendSmsReminder(
          supabase,
          reminder,
          settings,
          supabaseUrl,
          supabaseServiceKey
        );
      }

      const overallSuccess =
        (reminder.channel === 'email' && emailResult.success) ||
        (reminder.channel === 'sms' && smsResult.success) ||
        (reminder.channel === 'both' && (emailResult.success || smsResult.success));

      const errorMessages: string[] = [];
      if (!emailResult.success && emailResult.error) {
        errorMessages.push(`Email: ${emailResult.error}`);
      }
      if (!smsResult.success && smsResult.error) {
        errorMessages.push(`SMS: ${smsResult.error}`);
      }

      await supabase
        .from('payment_reminders')
        .update({
          status: overallSuccess ? 'sent' : 'failed',
          sent_at: overallSuccess ? now : null,
          error_message: errorMessages.length > 0 ? errorMessages.join('; ') : null,
        })
        .eq('id', reminder.id);

      if (overallSuccess) {
        await supabase
          .from('invoices')
          .update({
            last_reminder_sent_at: now,
            reminder_count: supabase.sql`reminder_count + 1`,
          })
          .eq('id', reminder.invoice_id);

        await supabase.from('payment_events').insert({
          org_id: reminder.org_id,
          invoice_id: reminder.invoice_id,
          event_type: 'reminder_sent',
          amount: reminder.invoice.total,
          metadata: {
            reminder_id: reminder.id,
            reminder_type: reminder.reminder_type,
            channel: reminder.channel,
          },
        });

        await supabase.from('event_outbox').insert({
          organization_id: reminder.org_id,
          event_type: 'payment_reminder_sent',
          contact_id: reminder.invoice.contact_id,
          entity_type: 'invoice',
          entity_id: reminder.invoice_id,
          payload: {
            reminder_id: reminder.id,
            reminder_type: reminder.reminder_type,
            channel: reminder.channel,
            invoice_id: reminder.invoice_id,
          },
        });
      }

      results.push({
        reminderId: reminder.id,
        status: overallSuccess ? 'sent' : 'failed',
        channel: reminder.channel,
        error: errorMessages.length > 0 ? errorMessages.join('; ') : undefined,
      });
    }

    const successCount = results.filter(r => r.status === 'sent').length;
    const errorCount = results.filter(r => r.status === 'failed').length;
    const cancelledCount = results.filter(r => r.status === 'cancelled').length;

    return new Response(
      JSON.stringify({
        processed: results.length,
        sent: successCount,
        failed: errorCount,
        cancelled: cancelledCount,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Payment reminder scheduler error:', error);

    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
