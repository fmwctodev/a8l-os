import { callEdgeFunction } from '../lib/edgeFunction';
import type { Contact, Product, CreateInvoiceLineItem } from '../types';

const callQboApi = async (action: string, payload: Record<string, unknown> = {}) => {
  const response = await callEdgeFunction('qbo-api', { action, ...payload });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'QBO API request failed');
  }

  return response.json();
};

export async function findOrCreateQBOCustomer(
  contact: Pick<Contact, 'id' | 'email' | 'first_name' | 'last_name' | 'phone' | 'company'>
): Promise<{ Id: string; SyncToken: string }> {
  return callQboApi('find_or_create_customer', { contact });
}

export async function createQBOItem(
  product: Pick<Product, 'name' | 'description' | 'price_amount' | 'billing_type'>
): Promise<{ Id: string; SyncToken: string }> {
  return callQboApi('create_item', { product });
}

export async function findOrCreateQBOItem(
  product: Pick<Product, 'name' | 'description' | 'price_amount' | 'billing_type'>
): Promise<{ Id: string; SyncToken: string }> {
  return callQboApi('find_or_create_item', { product });
}

export async function createQBOInvoice(
  customerId: string,
  lineItems: Array<CreateInvoiceLineItem & { qbo_item_id?: string }>,
  dueDate?: string,
  memo?: string
): Promise<{ Id: string; DocNumber: string; InvoiceLink?: string }> {
  return callQboApi('create_invoice', { customerId, lineItems, dueDate, memo });
}

export async function sendQBOInvoice(
  invoiceId: string,
  email: string
): Promise<{ Invoice: { Id: string; InvoiceLink?: string } }> {
  return callQboApi('send_invoice', { invoiceId, email });
}

export async function getQBOInvoice(invoiceId: string): Promise<{ Invoice: unknown }> {
  return callQboApi('get_invoice', { invoiceId });
}

export async function voidQBOInvoice(invoiceId: string, syncToken: string): Promise<void> {
  await callQboApi('void_invoice', { invoiceId, syncToken });
}

export async function syncQBOInvoices(): Promise<{ synced: number; updated: number; total: number }> {
  return callQboApi('sync_invoices');
}

export interface QBOItem {
  Id: string;
  Name: string;
  Description?: string;
  UnitPrice?: number;
  Type: string;
  Active: boolean;
}

export async function getQBOItems(): Promise<QBOItem[]> {
  return callQboApi('list_items');
}
