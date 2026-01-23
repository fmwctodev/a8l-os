import { supabase } from '../lib/supabase';
import type { Payment, PaymentFilters, ContactPaymentSummary } from '../types';

export async function getPayments(filters?: PaymentFilters): Promise<Payment[]> {
  let query = supabase
    .from('payments')
    .select(`
      *,
      contact:contacts!payments_contact_id_fkey(id, first_name, last_name, email, company),
      invoice:invoices!payments_invoice_id_fkey(id, doc_number, total, status)
    `)
    .order('received_at', { ascending: false });

  if (filters?.contactId) {
    query = query.eq('contact_id', filters.contactId);
  }

  if (filters?.invoiceId) {
    query = query.eq('invoice_id', filters.invoiceId);
  }

  if (filters?.startDate) {
    query = query.gte('received_at', filters.startDate);
  }

  if (filters?.endDate) {
    query = query.lte('received_at', filters.endDate);
  }

  if (filters?.paymentMethod) {
    query = query.eq('payment_method', filters.paymentMethod);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching payments:', error);
    throw error;
  }

  return data || [];
}

export async function getPayment(id: string): Promise<Payment | null> {
  const { data, error } = await supabase
    .from('payments')
    .select(`
      *,
      contact:contacts!payments_contact_id_fkey(id, first_name, last_name, email, company),
      invoice:invoices!payments_invoice_id_fkey(id, doc_number, total, status)
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('Error fetching payment:', error);
    throw error;
  }

  return data;
}

export async function getContactPayments(contactId: string): Promise<Payment[]> {
  return getPayments({ contactId });
}

export async function getInvoicePayments(invoiceId: string): Promise<Payment[]> {
  return getPayments({ invoiceId });
}

export async function getContactPaymentSummary(contactId: string): Promise<ContactPaymentSummary> {
  const { data: invoices } = await supabase
    .from('invoices')
    .select('id, total, status')
    .eq('contact_id', contactId)
    .neq('status', 'void');

  const { data: payments } = await supabase
    .from('payments')
    .select('id, amount')
    .eq('contact_id', contactId);

  const totalInvoiced = invoices?.reduce((sum, inv) => sum + (inv.total || 0), 0) || 0;
  const totalPaid = payments?.reduce((sum, pmt) => sum + (pmt.amount || 0), 0) || 0;

  return {
    totalInvoiced,
    totalPaid,
    outstanding: totalInvoiced - totalPaid,
    invoiceCount: invoices?.length || 0,
    paymentCount: payments?.length || 0,
  };
}