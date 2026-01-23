import { supabase } from '../lib/supabase';
import { findOrCreateQBOCustomer, createQBOInvoice, sendQBOInvoice, voidQBOInvoice } from './qboApi';
import { getQBOConnectionStatus } from './qboAuth';
import { publishEvent } from './eventOutbox';
import type {
  Invoice,
  InvoiceLineItem,
  InvoiceFilters,
  InvoiceStats,
  CreateInvoiceInput,
  User,
  Contact,
} from '../types';

export async function getInvoices(filters?: InvoiceFilters): Promise<Invoice[]> {
  let query = supabase
    .from('invoices')
    .select(`
      *,
      contact:contacts!invoices_contact_id_fkey(id, first_name, last_name, email, company),
      opportunity:opportunities!invoices_opportunity_id_fkey(id, value_amount, status),
      created_by_user:users!invoices_created_by_fkey(id, name, email)
    `)
    .order('created_at', { ascending: false });

  if (filters?.status?.length) {
    query = query.in('status', filters.status);
  }

  if (filters?.contactId) {
    query = query.eq('contact_id', filters.contactId);
  }

  if (filters?.opportunityId) {
    query = query.eq('opportunity_id', filters.opportunityId);
  }

  if (filters?.startDate) {
    query = query.gte('created_at', filters.startDate);
  }

  if (filters?.endDate) {
    query = query.lte('created_at', filters.endDate);
  }

  if (filters?.search) {
    query = query.or(`doc_number.ilike.%${filters.search}%,memo.ilike.%${filters.search}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching invoices:', error);
    throw error;
  }

  return data || [];
}

export async function getInvoice(id: string): Promise<Invoice | null> {
  const { data, error } = await supabase
    .from('invoices')
    .select(`
      *,
      contact:contacts!invoices_contact_id_fkey(id, first_name, last_name, email, phone, company),
      opportunity:opportunities!invoices_opportunity_id_fkey(id, value_amount, status, pipeline_id, stage_id),
      created_by_user:users!invoices_created_by_fkey(id, name, email)
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('Error fetching invoice:', error);
    throw error;
  }

  if (data) {
    const { data: lineItems } = await supabase
      .from('invoice_line_items')
      .select(`
        *,
        product:products!invoice_line_items_product_id_fkey(id, name, price_amount, billing_type)
      `)
      .eq('invoice_id', id)
      .order('sort_order');

    const { data: payments } = await supabase
      .from('payments')
      .select('*')
      .eq('invoice_id', id)
      .order('received_at', { ascending: false });

    data.line_items = lineItems || [];
    data.payments = payments || [];
  }

  return data;
}

export async function getInvoiceLineItems(invoiceId: string): Promise<InvoiceLineItem[]> {
  const { data, error } = await supabase
    .from('invoice_line_items')
    .select(`
      *,
      product:products!invoice_line_items_product_id_fkey(id, name, price_amount, billing_type)
    `)
    .eq('invoice_id', invoiceId)
    .order('sort_order');

  if (error) {
    console.error('Error fetching invoice line items:', error);
    throw error;
  }

  return data || [];
}

export async function createInvoice(
  input: CreateInvoiceInput,
  user: User
): Promise<Invoice> {
  const { data: userData } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single();

  if (!userData) {
    throw new Error('User not found');
  }

  const { data: contact } = await supabase
    .from('contacts')
    .select('id, first_name, last_name, email, phone, company')
    .eq('id', input.contact_id)
    .single();

  if (!contact) {
    throw new Error('Contact not found');
  }

  let subtotal = 0;
  const lineItemsWithTotal = input.line_items.map((item) => {
    const total = item.quantity * item.unit_price;
    subtotal += total;
    return { ...item, total_price: total };
  });

  let discountValue = input.discount_amount || 0;
  if (input.discount_type === 'percentage' && discountValue > 0) {
    discountValue = (subtotal * discountValue) / 100;
  }
  const total = subtotal - discountValue;

  let qboInvoiceId: string | null = null;
  let docNumber: string | null = null;
  let paymentLinkUrl: string | null = null;

  const qboStatus = await getQBOConnectionStatus();
  if (qboStatus.connected) {
    try {
      const qboCustomer = await findOrCreateQBOCustomer(contact as Contact);

      const { data: products } = await supabase
        .from('products')
        .select('id, qbo_item_id')
        .in('id', input.line_items.filter(i => i.product_id).map(i => i.product_id!));

      const productMap = new Map(products?.map(p => [p.id, p.qbo_item_id]) || []);

      const qboLineItems = input.line_items.map(item => ({
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        qbo_item_id: item.product_id ? productMap.get(item.product_id) || undefined : undefined,
      }));

      const qboInvoice = await createQBOInvoice(
        qboCustomer.Id,
        qboLineItems,
        input.due_date,
        input.memo
      );

      qboInvoiceId = qboInvoice.Id;
      docNumber = qboInvoice.DocNumber;
      paymentLinkUrl = qboInvoice.InvoiceLink || null;
    } catch (err) {
      console.error('Failed to create QBO invoice:', err);
    }
  }

  if (!docNumber) {
    const { count } = await supabase
      .from('invoices')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', userData.organization_id);

    docNumber = `INV-${String((count || 0) + 1).padStart(5, '0')}`;
  }

  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .insert({
      org_id: userData.organization_id,
      contact_id: input.contact_id,
      opportunity_id: input.opportunity_id || null,
      qbo_invoice_id: qboInvoiceId,
      doc_number: docNumber,
      status: input.auto_send ? 'sent' : 'draft',
      subtotal,
      discount_amount: input.discount_amount || 0,
      discount_type: input.discount_type || 'flat',
      total,
      due_date: input.due_date || null,
      payment_link_url: paymentLinkUrl,
      memo: input.memo || null,
      internal_notes: input.internal_notes || null,
      sent_at: input.auto_send ? new Date().toISOString() : null,
      created_by: user.id,
    })
    .select()
    .single();

  if (invoiceError) {
    console.error('Error creating invoice:', invoiceError);
    throw invoiceError;
  }

  const lineItemInserts = lineItemsWithTotal.map((item, index) => ({
    org_id: userData.organization_id,
    invoice_id: invoice.id,
    product_id: item.product_id || null,
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unit_price,
    total_price: item.total_price,
    sort_order: index,
  }));

  const { error: lineItemError } = await supabase
    .from('invoice_line_items')
    .insert(lineItemInserts);

  if (lineItemError) {
    console.error('Error creating line items:', lineItemError);
  }

  await publishEvent(
    userData.organization_id,
    'invoice_created',
    input.contact_id,
    'invoice',
    invoice.id,
    {
      invoice_id: invoice.id,
      contact_id: input.contact_id,
      opportunity_id: input.opportunity_id,
      total,
      doc_number: docNumber,
    }
  );

  if (input.auto_send && contact.email && qboInvoiceId) {
    try {
      const sendResult = await sendQBOInvoice(qboInvoiceId, contact.email);
      if (sendResult.Invoice?.InvoiceLink) {
        await supabase
          .from('invoices')
          .update({ payment_link_url: sendResult.Invoice.InvoiceLink })
          .eq('id', invoice.id);
      }

      await publishEvent(
        userData.organization_id,
        'invoice_sent',
        input.contact_id,
        'invoice',
        invoice.id,
        {
          invoice_id: invoice.id,
          contact_id: input.contact_id,
          email: contact.email,
          payment_link_url: sendResult.Invoice?.InvoiceLink,
        }
      );
    } catch (err) {
      console.error('Failed to send invoice:', err);
    }
  }

  return getInvoice(invoice.id) as Promise<Invoice>;
}

export async function sendInvoice(id: string, user: User): Promise<Invoice> {
  const invoice = await getInvoice(id);
  if (!invoice) {
    throw new Error('Invoice not found');
  }

  if (invoice.status !== 'draft') {
    throw new Error('Only draft invoices can be sent');
  }

  const contact = invoice.contact;
  if (!contact?.email) {
    throw new Error('Contact email is required to send invoice');
  }

  let paymentLinkUrl = invoice.payment_link_url;

  if (invoice.qbo_invoice_id) {
    try {
      const sendResult = await sendQBOInvoice(invoice.qbo_invoice_id, contact.email);
      if (sendResult.Invoice?.InvoiceLink) {
        paymentLinkUrl = sendResult.Invoice.InvoiceLink;
      }
    } catch (err) {
      console.error('Failed to send via QBO:', err);
    }
  }

  const { data, error } = await supabase
    .from('invoices')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      payment_link_url: paymentLinkUrl,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error sending invoice:', error);
    throw error;
  }

  const { data: userData } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single();

  if (userData) {
    await publishEvent(
      userData.organization_id,
      'invoice_sent',
      invoice.contact_id,
      'invoice',
      id,
      {
        invoice_id: id,
        contact_id: invoice.contact_id,
        email: contact.email,
        payment_link_url: paymentLinkUrl,
      }
    );
  }

  return getInvoice(id) as Promise<Invoice>;
}

export async function voidInvoice(id: string, user: User): Promise<Invoice> {
  const invoice = await getInvoice(id);
  if (!invoice) {
    throw new Error('Invoice not found');
  }

  if (invoice.status === 'void' || invoice.status === 'paid') {
    throw new Error('Cannot void this invoice');
  }

  if (invoice.qbo_invoice_id) {
    try {
      await voidQBOInvoice(invoice.qbo_invoice_id, '0');
    } catch (err) {
      console.error('Failed to void in QBO:', err);
    }
  }

  const { error } = await supabase
    .from('invoices')
    .update({
      status: 'void',
      voided_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) {
    console.error('Error voiding invoice:', error);
    throw error;
  }

  return getInvoice(id) as Promise<Invoice>;
}

export async function getInvoiceStats(): Promise<InvoiceStats> {
  const { data: invoices } = await supabase
    .from('invoices')
    .select('status, total');

  if (!invoices) {
    return {
      totalInvoices: 0,
      draftInvoices: 0,
      sentInvoices: 0,
      paidInvoices: 0,
      overdueInvoices: 0,
      totalOutstanding: 0,
      totalPaid: 0,
    };
  }

  const stats: InvoiceStats = {
    totalInvoices: invoices.length,
    draftInvoices: 0,
    sentInvoices: 0,
    paidInvoices: 0,
    overdueInvoices: 0,
    totalOutstanding: 0,
    totalPaid: 0,
  };

  for (const inv of invoices) {
    switch (inv.status) {
      case 'draft':
        stats.draftInvoices++;
        break;
      case 'sent':
        stats.sentInvoices++;
        stats.totalOutstanding += inv.total || 0;
        break;
      case 'paid':
        stats.paidInvoices++;
        stats.totalPaid += inv.total || 0;
        break;
      case 'overdue':
        stats.overdueInvoices++;
        stats.totalOutstanding += inv.total || 0;
        break;
    }
  }

  return stats;
}

export async function getContactInvoices(contactId: string): Promise<Invoice[]> {
  return getInvoices({ contactId });
}

export async function getOpportunityInvoices(opportunityId: string): Promise<Invoice[]> {
  return getInvoices({ opportunityId });
}