import { supabase } from '../lib/supabase';

export interface RevenueByPeriod {
  period: string;
  revenue: number;
  invoiceCount: number;
  paidCount: number;
}

export interface OutstandingAging {
  bucket: string;
  amount: number;
  count: number;
}

export interface PaymentMethodBreakdown {
  method: string;
  amount: number;
  count: number;
  percentage: number;
}

export interface PaymentAnalyticsSummary {
  totalRevenue: number;
  totalOutstanding: number;
  totalOverdue: number;
  averageInvoiceValue: number;
  collectionRate: number;
  daysOutstanding: number;
  monthlyRecurringRevenue: number;
  annualRecurringRevenue: number;
}

export interface ProductRevenue {
  productId: string;
  productName: string;
  revenue: number;
  invoiceCount: number;
  quantity: number;
}

export async function getPaymentAnalyticsSummary(): Promise<PaymentAnalyticsSummary> {
  const { data: invoices } = await supabase
    .from('invoices')
    .select('id, status, total, due_date, created_at, paid_at')
    .neq('status', 'void');

  if (!invoices?.length) {
    return {
      totalRevenue: 0,
      totalOutstanding: 0,
      totalOverdue: 0,
      averageInvoiceValue: 0,
      collectionRate: 0,
      daysOutstanding: 0,
      monthlyRecurringRevenue: 0,
      annualRecurringRevenue: 0,
    };
  }

  const today = new Date();
  let totalRevenue = 0;
  let totalOutstanding = 0;
  let totalOverdue = 0;
  let paidInvoices = 0;
  let totalDaysOutstanding = 0;
  let outstandingCount = 0;

  for (const inv of invoices) {
    if (inv.status === 'paid') {
      totalRevenue += inv.total || 0;
      paidInvoices++;
    } else if (inv.status === 'sent' || inv.status === 'overdue') {
      totalOutstanding += inv.total || 0;
      outstandingCount++;

      const dueDate = inv.due_date ? new Date(inv.due_date) : null;
      if (dueDate && dueDate < today) {
        totalOverdue += inv.total || 0;
      }

      const createdAt = new Date(inv.created_at);
      const daysSinceCreated = Math.floor((today.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
      totalDaysOutstanding += daysSinceCreated;
    }
  }

  const totalInvoiceValue = invoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
  const averageInvoiceValue = invoices.length > 0 ? totalInvoiceValue / invoices.length : 0;
  const collectionRate = totalInvoiceValue > 0 ? (totalRevenue / totalInvoiceValue) * 100 : 0;
  const daysOutstanding = outstandingCount > 0 ? totalDaysOutstanding / outstandingCount : 0;

  const { data: recurringProfiles } = await supabase
    .from('recurring_profiles')
    .select('id, frequency, status')
    .eq('status', 'active');

  let mrr = 0;
  if (recurringProfiles?.length) {
    const profileIds = recurringProfiles.map(p => p.id);
    const { data: items } = await supabase
      .from('recurring_profile_items')
      .select('recurring_profile_id, quantity, unit_price')
      .in('recurring_profile_id', profileIds);

    const profileTotals = new Map<string, number>();
    for (const item of items || []) {
      const current = profileTotals.get(item.recurring_profile_id) || 0;
      profileTotals.set(item.recurring_profile_id, current + (item.quantity * item.unit_price));
    }

    for (const profile of recurringProfiles) {
      const total = profileTotals.get(profile.id) || 0;
      switch (profile.frequency) {
        case 'weekly':
          mrr += total * 4.33;
          break;
        case 'monthly':
          mrr += total;
          break;
        case 'quarterly':
          mrr += total / 3;
          break;
        case 'annually':
          mrr += total / 12;
          break;
      }
    }
  }

  return {
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    totalOutstanding: Math.round(totalOutstanding * 100) / 100,
    totalOverdue: Math.round(totalOverdue * 100) / 100,
    averageInvoiceValue: Math.round(averageInvoiceValue * 100) / 100,
    collectionRate: Math.round(collectionRate * 10) / 10,
    daysOutstanding: Math.round(daysOutstanding),
    monthlyRecurringRevenue: Math.round(mrr * 100) / 100,
    annualRecurringRevenue: Math.round(mrr * 12 * 100) / 100,
  };
}

export async function getRevenueByPeriod(
  periodType: 'daily' | 'weekly' | 'monthly' = 'monthly',
  startDate?: string,
  endDate?: string
): Promise<RevenueByPeriod[]> {
  let query = supabase
    .from('invoices')
    .select('id, status, total, paid_at, created_at')
    .eq('status', 'paid')
    .not('paid_at', 'is', null);

  if (startDate) {
    query = query.gte('paid_at', startDate);
  }
  if (endDate) {
    query = query.lte('paid_at', endDate);
  }

  const { data: invoices } = await query;

  if (!invoices?.length) {
    return [];
  }

  const periodMap = new Map<string, { revenue: number; invoiceCount: number }>();

  for (const inv of invoices) {
    const date = new Date(inv.paid_at);
    let periodKey: string;

    switch (periodType) {
      case 'daily':
        periodKey = date.toISOString().split('T')[0];
        break;
      case 'weekly':
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        periodKey = weekStart.toISOString().split('T')[0];
        break;
      case 'monthly':
      default:
        periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        break;
    }

    const current = periodMap.get(periodKey) || { revenue: 0, invoiceCount: 0 };
    current.revenue += inv.total || 0;
    current.invoiceCount++;
    periodMap.set(periodKey, current);
  }

  const result: RevenueByPeriod[] = [];
  for (const [period, data] of periodMap) {
    result.push({
      period,
      revenue: Math.round(data.revenue * 100) / 100,
      invoiceCount: data.invoiceCount,
      paidCount: data.invoiceCount,
    });
  }

  return result.sort((a, b) => a.period.localeCompare(b.period));
}

export async function getOutstandingAging(): Promise<OutstandingAging[]> {
  const { data: invoices } = await supabase
    .from('invoices')
    .select('id, total, due_date, status')
    .in('status', ['sent', 'overdue'])
    .not('due_date', 'is', null);

  const buckets = {
    'Current': { amount: 0, count: 0 },
    '1-30 Days': { amount: 0, count: 0 },
    '31-60 Days': { amount: 0, count: 0 },
    '61-90 Days': { amount: 0, count: 0 },
    '90+ Days': { amount: 0, count: 0 },
  };

  const today = new Date();

  for (const inv of invoices || []) {
    const dueDate = new Date(inv.due_date);
    const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

    let bucket: keyof typeof buckets;
    if (daysOverdue <= 0) {
      bucket = 'Current';
    } else if (daysOverdue <= 30) {
      bucket = '1-30 Days';
    } else if (daysOverdue <= 60) {
      bucket = '31-60 Days';
    } else if (daysOverdue <= 90) {
      bucket = '61-90 Days';
    } else {
      bucket = '90+ Days';
    }

    buckets[bucket].amount += inv.total || 0;
    buckets[bucket].count++;
  }

  return Object.entries(buckets).map(([bucket, data]) => ({
    bucket,
    amount: Math.round(data.amount * 100) / 100,
    count: data.count,
  }));
}

export async function getPaymentMethodBreakdown(): Promise<PaymentMethodBreakdown[]> {
  const { data: payments } = await supabase
    .from('payments')
    .select('payment_method, amount');

  if (!payments?.length) {
    return [];
  }

  const methodMap = new Map<string, { amount: number; count: number }>();
  let totalAmount = 0;

  for (const payment of payments) {
    const method = payment.payment_method || 'other';
    const current = methodMap.get(method) || { amount: 0, count: 0 };
    current.amount += payment.amount || 0;
    current.count++;
    totalAmount += payment.amount || 0;
    methodMap.set(method, current);
  }

  const methodLabels: Record<string, string> = {
    credit_card: 'Credit Card',
    bank_transfer: 'Bank Transfer',
    cash: 'Cash',
    check: 'Check',
    other: 'Other',
  };

  return Array.from(methodMap.entries()).map(([method, data]) => ({
    method: methodLabels[method] || method,
    amount: Math.round(data.amount * 100) / 100,
    count: data.count,
    percentage: totalAmount > 0 ? Math.round((data.amount / totalAmount) * 1000) / 10 : 0,
  })).sort((a, b) => b.amount - a.amount);
}

export async function getProductRevenue(): Promise<ProductRevenue[]> {
  const { data: lineItems } = await supabase
    .from('invoice_line_items')
    .select(`
      product_id,
      quantity,
      total_price,
      invoice:invoices!invoice_line_items_invoice_id_fkey(status),
      product:products!invoice_line_items_product_id_fkey(id, name)
    `)
    .not('product_id', 'is', null);

  if (!lineItems?.length) {
    return [];
  }

  const productMap = new Map<string, {
    productName: string;
    revenue: number;
    invoiceCount: Set<string>;
    quantity: number;
  }>();

  for (const item of lineItems) {
    if (item.invoice?.status !== 'paid' || !item.product) continue;

    const productId = item.product_id!;
    const current = productMap.get(productId) || {
      productName: item.product.name,
      revenue: 0,
      invoiceCount: new Set<string>(),
      quantity: 0,
    };

    current.revenue += item.total_price || 0;
    current.quantity += item.quantity || 0;
    productMap.set(productId, current);
  }

  return Array.from(productMap.entries()).map(([productId, data]) => ({
    productId,
    productName: data.productName,
    revenue: Math.round(data.revenue * 100) / 100,
    invoiceCount: data.invoiceCount.size,
    quantity: data.quantity,
  })).sort((a, b) => b.revenue - a.revenue);
}

export async function getRecentPayments(limit = 10): Promise<{
  id: string;
  amount: number;
  payment_method: string;
  received_at: string;
  invoice?: { doc_number: string };
  contact?: { first_name: string; last_name: string; company?: string };
}[]> {
  const { data, error } = await supabase
    .from('payments')
    .select(`
      id,
      amount,
      payment_method,
      received_at,
      invoice:invoices!payments_invoice_id_fkey(doc_number),
      contact:contacts!payments_contact_id_fkey(first_name, last_name, company)
    `)
    .order('received_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching recent payments:', error);
    return [];
  }

  return data || [];
}
