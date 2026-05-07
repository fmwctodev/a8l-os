import { supabase } from '../lib/supabase';
import type {
  CreateInvoiceConfig,
  SendInvoiceConfig,
  VoidInvoiceConfig,
  ApplyDiscountConfig,
  CreateSubscriptionConfig,
  ManageSubscriptionConfig,
  InvoiceSource,
  SubscriptionSource,
  InvoiceLineItem,
} from '../types/workflowActions';

export interface PaymentActionContext {
  orgId: string;
  contactId: string;
  enrollmentId: string;
  actorUserId?: string;
  contextData?: Record<string, unknown>;
}

export interface PaymentActionResult {
  success: boolean;
  invoiceId?: string;
  subscriptionId?: string;
  error?: string;
  data?: Record<string, unknown>;
}

async function resolveInvoiceId(
  source: InvoiceSource,
  context: PaymentActionContext,
  specificId?: string
): Promise<string | null> {
  if (source === 'specific_id' && specificId) {
    return specificId;
  }

  if (source === 'context' && context.contextData?.invoiceId) {
    return context.contextData.invoiceId as string;
  }

  if (source === 'most_recent') {
    const { data } = await supabase
      .from('invoices')
      .select('id')
      .eq('org_id', context.orgId)
      .eq('contact_id', context.contactId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return data?.id || null;
  }

  return null;
}

async function resolveSubscriptionId(
  source: SubscriptionSource,
  context: PaymentActionContext,
  specificId?: string
): Promise<string | null> {
  if (source === 'specific_id' && specificId) {
    return specificId;
  }

  if (source === 'context' && context.contextData?.subscriptionId) {
    return context.contextData.subscriptionId as string;
  }

  if (source === 'most_recent') {
    const { data } = await supabase
      .from('recurring_profiles')
      .select('id')
      .eq('org_id', context.orgId)
      .eq('contact_id', context.contactId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return data?.id || null;
  }

  return null;
}

async function getQBOConnection(orgId: string): Promise<{ realmId: string; accessToken: string } | null> {
  const { data } = await supabase
    .from('payment_provider_connections')
    .select('realm_id, access_token_encrypted, token_expiry')
    .eq('org_id', orgId)
    .eq('provider', 'quickbooks_online')
    .maybeSingle();

  if (!data) return null;

  if (new Date(data.token_expiry) < new Date()) {
    return null;
  }

  return {
    realmId: data.realm_id,
    accessToken: data.access_token_encrypted,
  };
}

async function generateDocNumber(orgId: string): Promise<string> {
  const { data } = await supabase
    .from('invoices')
    .select('doc_number')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (data?.doc_number) {
    const match = data.doc_number.match(/(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10) + 1;
      return `INV-${num.toString().padStart(5, '0')}`;
    }
  }

  return 'INV-00001';
}

function calculateLineItems(items: InvoiceLineItem[]): { subtotal: number; lineItems: Array<InvoiceLineItem & { totalPrice: number }> } {
  let subtotal = 0;
  const lineItems = items.map(item => {
    const totalPrice = item.quantity * item.unitPrice;
    subtotal += totalPrice;
    return { ...item, totalPrice };
  });

  return { subtotal, lineItems };
}

export async function createInvoice(
  config: CreateInvoiceConfig,
  context: PaymentActionContext
): Promise<PaymentActionResult> {
  try {
    const { subtotal, lineItems } = calculateLineItems(config.lineItems);

    let dueDate: string;
    if (config.dueDate) {
      dueDate = config.dueDate;
    } else if (config.dueDays) {
      const date = new Date();
      date.setDate(date.getDate() + config.dueDays);
      dueDate = date.toISOString().split('T')[0];
    } else {
      const date = new Date();
      date.setDate(date.getDate() + 30);
      dueDate = date.toISOString().split('T')[0];
    }

    const docNumber = await generateDocNumber(context.orgId);

    let opportunityId: string | null = null;
    if (config.linkedOpportunitySource) {
      if (config.linkedOpportunitySource === 'specific_id' && config.linkedOpportunityId) {
        opportunityId = config.linkedOpportunityId;
      } else if (config.linkedOpportunitySource === 'most_recent') {
        const { data: opp } = await supabase
          .from('opportunities')
          .select('id')
          .eq('org_id', context.orgId)
          .eq('contact_id', context.contactId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        opportunityId = opp?.id || null;
      } else if (config.linkedOpportunitySource === 'context' && context.contextData?.opportunityId) {
        opportunityId = context.contextData.opportunityId as string;
      }
    }

    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        org_id: context.orgId,
        contact_id: context.contactId,
        opportunity_id: opportunityId,
        doc_number: docNumber,
        status: config.autoSend ? 'sent' : 'draft',
        subtotal,
        discount_amount: 0,
        discount_type: 'flat',
        total: subtotal,
        currency: 'USD',
        due_date: dueDate,
        memo: config.memo,
        internal_notes: config.internalNotes,
        sent_at: config.autoSend ? new Date().toISOString() : null,
        created_by: context.actorUserId,
      })
      .select()
      .single();

    if (invoiceError) throw invoiceError;

    const lineItemInserts = lineItems.map((item, index) => ({
      org_id: context.orgId,
      invoice_id: invoice.id,
      product_id: item.productId || null,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      total_price: item.totalPrice,
      sort_order: index,
    }));

    const { error: lineItemsError } = await supabase
      .from('invoice_line_items')
      .insert(lineItemInserts);

    if (lineItemsError) throw lineItemsError;

    if (config.syncToQBO) {
      const qboConnection = await getQBOConnection(context.orgId);
      if (qboConnection) {
        await supabase.functions.invoke('qbo-api', {
          body: {
            action: 'createInvoice',
            orgId: context.orgId,
            invoiceId: invoice.id,
          },
        });
      }
    }

    return {
      success: true,
      invoiceId: invoice.id,
      data: { invoice, lineItems: lineItemInserts },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create invoice',
    };
  }
}

export async function sendInvoice(
  config: SendInvoiceConfig,
  context: PaymentActionContext
): Promise<PaymentActionResult> {
  try {
    const invoiceId = await resolveInvoiceId(
      config.invoiceSource,
      context,
      config.invoiceId
    );

    if (!invoiceId) {
      return { success: false, error: 'Invoice not found' };
    }

    const { data: invoice } = await supabase
      .from('invoices')
      .select('*, contact:contacts(email, first_name, last_name)')
      .eq('id', invoiceId)
      .single();

    if (!invoice) {
      return { success: false, error: 'Invoice not found' };
    }

    const contact = invoice.contact as { email: string; first_name: string; last_name: string } | null;

    if (!contact?.email) {
      return { success: false, error: 'Contact does not have an email address' };
    }

    const { error: updateError } = await supabase
      .from('invoices')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
      })
      .eq('id', invoiceId);

    if (updateError) throw updateError;

    const subject = config.emailSubject || `Invoice ${invoice.doc_number}`;
    const body = config.emailBody || `Please find attached invoice ${invoice.doc_number} for $${invoice.total}`;

    await supabase.from('messages').insert({
      org_id: context.orgId,
      conversation_id: null,
      contact_id: context.contactId,
      direction: 'outbound',
      channel: 'email',
      content: body,
      status: 'queued',
      metadata: {
        invoice_id: invoiceId,
        type: 'invoice',
        subject,
        include_payment_link: config.includePaymentLink,
        cc_emails: config.ccEmails,
      },
    });

    return {
      success: true,
      invoiceId,
      data: { invoice, sentTo: contact.email },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send invoice',
    };
  }
}

export async function voidInvoice(
  config: VoidInvoiceConfig,
  context: PaymentActionContext
): Promise<PaymentActionResult> {
  try {
    const invoiceId = await resolveInvoiceId(
      config.invoiceSource,
      context,
      config.invoiceId
    );

    if (!invoiceId) {
      return { success: false, error: 'Invoice not found' };
    }

    const { data: invoice, error } = await supabase
      .from('invoices')
      .update({
        status: 'void',
        voided_at: new Date().toISOString(),
        internal_notes: config.reason
          ? `Voided: ${config.reason}`
          : 'Voided via workflow',
      })
      .eq('id', invoiceId)
      .select()
      .single();

    if (error) throw error;

    if (config.syncToQBO) {
      const qboConnection = await getQBOConnection(context.orgId);
      if (qboConnection && invoice.provider_invoice_id) {
        await supabase.functions.invoke('qbo-api', {
          body: {
            action: 'voidInvoice',
            orgId: context.orgId,
            invoiceId,
          },
        });
      }
    }

    if (config.notifyContact) {
      await supabase.from('messages').insert({
        org_id: context.orgId,
        conversation_id: null,
        contact_id: context.contactId,
        direction: 'outbound',
        channel: 'email',
        content: `Invoice ${invoice.doc_number} has been voided.`,
        status: 'queued',
        metadata: {
          invoice_id: invoiceId,
          type: 'invoice_void_notification',
        },
      });
    }

    return {
      success: true,
      invoiceId,
      data: { invoice },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to void invoice',
    };
  }
}

export async function applyDiscount(
  config: ApplyDiscountConfig,
  context: PaymentActionContext
): Promise<PaymentActionResult> {
  try {
    const invoiceId = await resolveInvoiceId(
      config.invoiceSource,
      context,
      config.invoiceId
    );

    if (!invoiceId) {
      return { success: false, error: 'Invoice not found' };
    }

    const { data: invoice } = await supabase
      .from('invoices')
      .select('subtotal, discount_amount, discount_type')
      .eq('id', invoiceId)
      .single();

    if (!invoice) {
      return { success: false, error: 'Invoice not found' };
    }

    let discountAmount: number;
    if (config.discountType === 'percentage') {
      discountAmount = invoice.subtotal * (config.discountValue / 100);
    } else {
      discountAmount = config.discountValue;
    }

    const newTotal = Math.max(0, invoice.subtotal - discountAmount);

    const { data: updatedInvoice, error } = await supabase
      .from('invoices')
      .update({
        discount_amount: discountAmount,
        discount_type: config.discountType,
        total: newTotal,
        internal_notes: config.reason
          ? `Discount applied: ${config.reason}`
          : undefined,
      })
      .eq('id', invoiceId)
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      invoiceId,
      data: { invoice: updatedInvoice, discountApplied: discountAmount },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to apply discount',
    };
  }
}

export async function createSubscription(
  config: CreateSubscriptionConfig,
  context: PaymentActionContext
): Promise<PaymentActionResult> {
  try {
    let startDate: string;
    if (config.startDate) {
      startDate = config.startDate;
    } else {
      startDate = new Date().toISOString().split('T')[0];
    }

    let nextInvoiceDate = new Date(startDate);
    switch (config.frequency) {
      case 'weekly':
        nextInvoiceDate.setDate(nextInvoiceDate.getDate() + 7);
        break;
      case 'monthly':
        nextInvoiceDate.setMonth(nextInvoiceDate.getMonth() + 1);
        break;
      case 'quarterly':
        nextInvoiceDate.setMonth(nextInvoiceDate.getMonth() + 3);
        break;
      case 'annually':
        nextInvoiceDate.setFullYear(nextInvoiceDate.getFullYear() + 1);
        break;
    }

    const { data: subscription, error: subError } = await supabase
      .from('recurring_profiles')
      .insert({
        org_id: context.orgId,
        contact_id: context.contactId,
        name: config.profileName,
        frequency: config.frequency,
        status: 'active',
        next_invoice_date: nextInvoiceDate.toISOString().split('T')[0],
        end_date: config.endDate || null,
        auto_send: config.autoSend,
        created_by: context.actorUserId,
      })
      .select()
      .single();

    if (subError) throw subError;

    const itemInserts = config.lineItems.map((item, index) => ({
      org_id: context.orgId,
      recurring_profile_id: subscription.id,
      product_id: item.productId || null,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      sort_order: index,
    }));

    const { error: itemsError } = await supabase
      .from('recurring_profile_items')
      .insert(itemInserts);

    if (itemsError) throw itemsError;

    if (config.syncToQBO) {
      const qboConnection = await getQBOConnection(context.orgId);
      if (qboConnection) {
        await supabase.functions.invoke('qbo-api', {
          body: {
            action: 'createRecurringTemplate',
            orgId: context.orgId,
            subscriptionId: subscription.id,
          },
        });
      }
    }

    return {
      success: true,
      subscriptionId: subscription.id,
      data: { subscription, items: itemInserts },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create subscription',
    };
  }
}

export async function manageSubscription(
  config: ManageSubscriptionConfig,
  context: PaymentActionContext
): Promise<PaymentActionResult> {
  try {
    const subscriptionId = await resolveSubscriptionId(
      config.subscriptionSource,
      context,
      config.subscriptionId
    );

    if (!subscriptionId) {
      return { success: false, error: 'Subscription not found' };
    }

    let updates: Record<string, unknown> = {};

    switch (config.action) {
      case 'pause':
        updates = { status: 'paused' };
        break;
      case 'resume':
        updates = { status: 'active' };
        if (config.pauseUntil) {
          const nextDate = new Date(config.pauseUntil);
          updates.next_invoice_date = nextDate.toISOString().split('T')[0];
        }
        break;
      case 'cancel':
        updates = { status: 'cancelled' };
        break;
    }

    const { data: subscription, error } = await supabase
      .from('recurring_profiles')
      .update(updates)
      .eq('id', subscriptionId)
      .select()
      .single();

    if (error) throw error;

    if (config.syncToQBO) {
      const qboConnection = await getQBOConnection(context.orgId);
      if (qboConnection && subscription.provider_recurring_template_id) {
        await supabase.functions.invoke('qbo-api', {
          body: {
            action: 'updateRecurringTemplate',
            orgId: context.orgId,
            subscriptionId,
            updates: { status: updates.status },
          },
        });
      }
    }

    return {
      success: true,
      subscriptionId,
      data: { subscription, action: config.action },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to manage subscription',
    };
  }
}
