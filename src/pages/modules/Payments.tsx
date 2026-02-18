import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getInvoices, getInvoiceStats, sendInvoice, voidInvoice } from '../../services/invoices';
import { getProducts, toggleProductActive } from '../../services/products';
import { getQBOConnectionStatus } from '../../services/qboAuth';
import { syncQBOInvoices } from '../../services/qboApi';
import type { Invoice, Product, InvoiceStats, InvoiceStatus, BillingType } from '../../types';
import {
  CreditCard,
  Plus,
  Search,
  Filter,
  MoreVertical,
  Send,
  Eye,
  XCircle,
  Loader2,
  FileText,
  Package,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  DollarSign,
  Copy,
  ExternalLink,
  ToggleLeft,
  ToggleRight,
  CalendarDays,
} from 'lucide-react';
import { CreateInvoiceModal } from '../../components/payments/CreateInvoiceModal';
import { CreateProductModal } from '../../components/payments/CreateProductModal';
import { RecurringProfilesTab } from '../../components/payments/RecurringProfilesTab';
import { PaymentReportsTab } from '../../components/payments/PaymentReportsTab';
import { InvoiceTemplatesTab } from '../../components/payments/InvoiceTemplatesTab';
import { InvoiceBulkActionsBar } from '../../components/payments/InvoiceBulkActionsBar';
import { BarChart3, Layout } from 'lucide-react';

type TabType = 'invoices' | 'products' | 'recurring' | 'templates' | 'reports';

const STATUS_STYLES: Record<InvoiceStatus, { bg: string; text: string; label: string }> = {
  draft: { bg: 'bg-slate-500/20', text: 'text-slate-300', label: 'Draft' },
  sent: { bg: 'bg-cyan-500/20', text: 'text-cyan-300', label: 'Sent' },
  paid: { bg: 'bg-emerald-500/20', text: 'text-emerald-300', label: 'Paid' },
  overdue: { bg: 'bg-red-500/20', text: 'text-red-300', label: 'Overdue' },
  void: { bg: 'bg-slate-700/50', text: 'text-slate-500', label: 'Void' },
};

export function Payments() {
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('invoices');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stats, setStats] = useState<InvoiceStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'all'>('all');
  const [monthFilter, setMonthFilter] = useState<string>('all');
  const [billingTypeFilter, setBillingTypeFilter] = useState<BillingType | 'all'>('all');
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  const [showCreateInvoice, setShowCreateInvoice] = useState(false);
  const [showCreateProduct, setShowCreateProduct] = useState(false);
  const [qboConnected, setQboConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ synced: number; updated: number; total: number } | null>(null);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<string>>(new Set());
  const hasSyncedRef = useRef(false);

  const canView = hasPermission('payments.view');
  const canManage = hasPermission('payments.manage');
  const canCreateInvoice = hasPermission('invoices.create');
  const canSendInvoice = hasPermission('invoices.send');
  const canVoidInvoice = hasPermission('invoices.void');

  useEffect(() => {
    if (canView) {
      loadData();
      checkQBOConnection();
    }
  }, [user, canView]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [invoiceData, productData, statsData] = await Promise.all([
        getInvoices(),
        getProducts(),
        getInvoiceStats(),
      ]);
      setInvoices(invoiceData);
      setProducts(productData);
      setStats(statsData);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const checkQBOConnection = async () => {
    try {
      const status = await getQBOConnectionStatus();
      setQboConnected(status.connected);
      if (status.connected && !hasSyncedRef.current) {
        hasSyncedRef.current = true;
        setIsSyncing(true);
        try {
          const result = await syncQBOInvoices();
          setSyncResult(result);
          if (result.synced > 0 || result.updated > 0) {
            await loadData();
          }
        } catch (syncErr) {
          console.error('Failed to sync QBO invoices:', syncErr);
        } finally {
          setIsSyncing(false);
          setTimeout(() => setSyncResult(null), 5000);
        }
      }
    } catch (err) {
      console.error('Failed to check QBO connection:', err);
    }
  };

  const handleSendInvoice = async (invoice: Invoice) => {
    if (!user) return;
    try {
      await sendInvoice(invoice.id, user);
      loadData();
    } catch (err) {
      console.error('Failed to send invoice:', err);
    }
    setActionMenuId(null);
  };

  const handleVoidInvoice = async (invoice: Invoice) => {
    if (!user || !confirm('Are you sure you want to void this invoice?')) return;
    try {
      await voidInvoice(invoice.id, user);
      loadData();
    } catch (err) {
      console.error('Failed to void invoice:', err);
    }
    setActionMenuId(null);
  };

  const handleToggleProduct = async (product: Product) => {
    if (!user) return;
    try {
      await toggleProductActive(product.id, !product.active, user);
      loadData();
    } catch (err) {
      console.error('Failed to toggle product:', err);
    }
  };

  const copyPaymentLink = (url: string) => {
    navigator.clipboard.writeText(url);
  };

  const toggleInvoiceSelection = (id: string) => {
    setSelectedInvoiceIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAllInvoices = () => {
    if (selectedInvoiceIds.size === filteredInvoices.length) {
      setSelectedInvoiceIds(new Set());
    } else {
      setSelectedInvoiceIds(new Set(filteredInvoices.map(inv => inv.id)));
    }
  };

  const clearSelection = () => {
    setSelectedInvoiceIds(new Set());
  };

  const selectedInvoices = invoices.filter(inv => selectedInvoiceIds.has(inv.id));

  const formatCurrency = (amount: number, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString();
  };

  const getContactName = (invoice: Invoice) => {
    if (!invoice.contact) return 'Unknown';
    return invoice.contact.company || `${invoice.contact.first_name} ${invoice.contact.last_name}`;
  };

  const availableMonths = useMemo(() => {
    const monthSet = new Set<string>();
    const now = new Date();
    monthSet.add(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
    for (const inv of invoices) {
      const dateStr = inv.due_date || inv.created_at;
      if (!dateStr) continue;
      const d = new Date(dateStr);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthSet.add(key);
    }
    return Array.from(monthSet).sort((a, b) => b.localeCompare(a));
  }, [invoices]);

  const formatMonthLabel = (key: string) => {
    const [year, month] = key.split('-');
    const d = new Date(Number(year), Number(month) - 1);
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const filteredInvoices = invoices.filter((inv) => {
    if (statusFilter !== 'all' && inv.status !== statusFilter) return false;
    if (monthFilter !== 'all') {
      const dateStr = inv.due_date || inv.created_at;
      if (!dateStr) return false;
      const d = new Date(dateStr);
      const invMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (invMonth !== monthFilter) return false;
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const contactName = getContactName(inv).toLowerCase();
      const docNum = (inv.doc_number || '').toLowerCase();
      if (!contactName.includes(query) && !docNum.includes(query)) return false;
    }
    return true;
  });

  const filteredProducts = products.filter((prod) => {
    if (showActiveOnly && !prod.active) return false;
    if (billingTypeFilter !== 'all' && prod.billing_type !== billingTypeFilter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (!prod.name.toLowerCase().includes(query) && !(prod.description || '').toLowerCase().includes(query)) return false;
    }
    return true;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white flex items-center gap-3">
            <CreditCard className="w-7 h-7 text-emerald-400" />
            Payments
          </h1>
          <p className="text-slate-400 mt-1">Manage invoices, products, and billing</p>
        </div>
        <div className="flex items-center gap-3">
          {!qboConnected && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm">
              <AlertCircle className="w-4 h-4" />
              <span>QuickBooks not connected</span>
            </div>
          )}
          {qboConnected && isSyncing && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Syncing from QuickBooks...</span>
            </div>
          )}
          {qboConnected && !isSyncing && syncResult && syncResult.synced > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
              <CheckCircle2 className="w-4 h-4" />
              <span>Synced {syncResult.synced} invoice{syncResult.synced !== 1 ? 's' : ''} from QuickBooks</span>
            </div>
          )}
          {qboConnected && !isSyncing && !syncResult && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
              <CheckCircle2 className="w-4 h-4" />
              <span>QuickBooks connected</span>
            </div>
          )}
          {activeTab === 'invoices' && canCreateInvoice && (
            <button
              onClick={() => setShowCreateInvoice(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-medium hover:from-emerald-600 hover:to-teal-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Invoice
            </button>
          )}
          {activeTab === 'products' && canManage && (
            <button
              onClick={() => setShowCreateProduct(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-medium hover:from-emerald-600 hover:to-teal-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Product
            </button>
          )}
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/10">
                <FileText className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-white">{filteredInvoices.length}</p>
                <p className="text-sm text-slate-400">Total Invoices</p>
              </div>
            </div>
          </div>
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-white">{formatCurrency(filteredInvoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + (i.total || 0), 0))}</p>
                <p className="text-sm text-slate-400">Total Paid</p>
              </div>
            </div>
          </div>
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Clock className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-white">{formatCurrency(filteredInvoices.filter(i => i.status === 'sent' || i.status === 'overdue').reduce((sum, i) => sum + (i.total || 0), 0))}</p>
                <p className="text-sm text-slate-400">Outstanding</p>
              </div>
            </div>
          </div>
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/10">
                <AlertCircle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-white">{filteredInvoices.filter(i => i.status === 'overdue').length}</p>
                <p className="text-sm text-slate-400">Overdue</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-slate-900 rounded-xl border border-slate-800">
        <div className="border-b border-slate-800">
          <nav className="flex gap-1 p-2">
            {[
              { key: 'invoices', label: 'Invoices', icon: FileText },
              { key: 'products', label: 'Products', icon: Package },
              { key: 'recurring', label: 'Recurring', icon: RefreshCw },
              { key: 'templates', label: 'Templates', icon: Layout },
              { key: 'reports', label: 'Reports', icon: BarChart3 },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key as TabType)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === key
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </nav>
        </div>

        {(activeTab === 'invoices' || activeTab === 'products') && (
          <div className="p-4 border-b border-slate-800">
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder={activeTab === 'invoices' ? 'Search invoices...' : 'Search products...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                />
              </div>
              {activeTab === 'invoices' && (
                <>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as InvoiceStatus | 'all')}
                    className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    <option value="all">All Status</option>
                    <option value="draft">Draft</option>
                    <option value="sent">Sent</option>
                    <option value="paid">Paid</option>
                    <option value="overdue">Overdue</option>
                    <option value="void">Void</option>
                  </select>
                  <div className="relative">
                    <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <select
                      value={monthFilter}
                      onChange={(e) => setMonthFilter(e.target.value)}
                      className="pl-9 pr-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 appearance-none cursor-pointer"
                      style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.5rem center' }}
                    >
                      <option value="all">All Months</option>
                      {availableMonths.map((key) => (
                        <option key={key} value={key}>{formatMonthLabel(key)}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}
              {activeTab === 'products' && (
                <>
                  <select
                    value={billingTypeFilter}
                    onChange={(e) => setBillingTypeFilter(e.target.value as BillingType | 'all')}
                    className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    <option value="all">All Types</option>
                    <option value="one_time">One-time</option>
                    <option value="recurring">Recurring</option>
                  </select>
                  <button
                    onClick={() => setShowActiveOnly(!showActiveOnly)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                      showActiveOnly
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                  >
                    {showActiveOnly ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                    Active only
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        <div className="p-4">
          {activeTab === 'invoices' && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-900 sticky top-0 z-10">
                  <tr className="border-b border-slate-800">
                    <th className="py-3 px-4 w-10">
                      <input
                        type="checkbox"
                        checked={filteredInvoices.length > 0 && selectedInvoiceIds.size === filteredInvoices.length}
                        onChange={toggleAllInvoices}
                        className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-cyan-500"
                      />
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Invoice</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Contact</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Amount</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Status</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Due Date</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Payment Link</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        No invoices found
                      </td>
                    </tr>
                  ) : (
                    filteredInvoices.map((invoice) => {
                      const statusStyle = STATUS_STYLES[invoice.status];
                      const isSelected = selectedInvoiceIds.has(invoice.id);
                      return (
                        <tr
                          key={invoice.id}
                          className={`border-b border-slate-800/50 hover:bg-slate-800/30 cursor-pointer ${
                            isSelected ? 'bg-cyan-500/5' : ''
                          }`}
                          onClick={() => navigate(`/payments/invoices/${invoice.id}`)}
                        >
                          <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleInvoiceSelection(invoice.id)}
                              className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-cyan-500"
                            />
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-white font-medium">{invoice.doc_number || '-'}</span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-white">{getContactName(invoice)}</span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-white font-medium">{formatCurrency(invoice.total, invoice.currency)}</span>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`}>
                              {statusStyle.label}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-slate-300">{formatDate(invoice.due_date)}</span>
                          </td>
                          <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                            {invoice.payment_link_url ? (
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => copyPaymentLink(invoice.payment_link_url!)}
                                  className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                                  title="Copy link"
                                >
                                  <Copy className="w-4 h-4" />
                                </button>
                                <a
                                  href={invoice.payment_link_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                                  title="Open payment page"
                                >
                                  <ExternalLink className="w-4 h-4" />
                                </a>
                              </div>
                            ) : (
                              <span className="text-slate-500 text-sm">-</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="relative">
                              <button
                                onClick={() => setActionMenuId(actionMenuId === invoice.id ? null : invoice.id)}
                                className="p-1.5 rounded hover:bg-slate-700 text-slate-400"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>
                              {actionMenuId === invoice.id && (
                                <div className="absolute right-0 top-full mt-1 w-48 rounded-lg bg-slate-800 border border-slate-700 shadow-xl z-50">
                                  <button
                                    onClick={() => {
                                      navigate(`/payments/invoices/${invoice.id}`);
                                      setActionMenuId(null);
                                    }}
                                    className="w-full flex items-center gap-2 px-4 py-2 text-left text-sm text-slate-300 hover:bg-slate-700 hover:text-white"
                                  >
                                    <Eye className="w-4 h-4" />
                                    View Details
                                  </button>
                                  {invoice.status === 'draft' && canSendInvoice && (
                                    <button
                                      onClick={() => handleSendInvoice(invoice)}
                                      className="w-full flex items-center gap-2 px-4 py-2 text-left text-sm text-slate-300 hover:bg-slate-700 hover:text-white"
                                    >
                                      <Send className="w-4 h-4" />
                                      Send Invoice
                                    </button>
                                  )}
                                  {invoice.status !== 'void' && invoice.status !== 'paid' && canVoidInvoice && (
                                    <button
                                      onClick={() => handleVoidInvoice(invoice)}
                                      className="w-full flex items-center gap-2 px-4 py-2 text-left text-sm text-red-400 hover:bg-slate-700"
                                    >
                                      <XCircle className="w-4 h-4" />
                                      Void Invoice
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'products' && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-900 sticky top-0 z-10">
                  <tr className="border-b border-slate-800">
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Product</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Description</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Price</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Type</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Status</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">QBO Sync</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        No products found
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((product) => (
                      <tr key={product.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                        <td className="py-3 px-4">
                          <span className="text-white font-medium">{product.name}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-slate-300 text-sm line-clamp-1">{product.description || '-'}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-white font-medium">{formatCurrency(product.price_amount, product.currency)}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                            product.billing_type === 'recurring'
                              ? 'bg-cyan-500/20 text-cyan-300'
                              : 'bg-slate-500/20 text-slate-300'
                          }`}>
                            {product.billing_type === 'recurring' ? 'Recurring' : 'One-time'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                            product.active
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-slate-700/50 text-slate-500'
                          }`}>
                            {product.active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {product.qbo_item_id ? (
                            <span className="inline-flex items-center gap-1 text-emerald-400 text-sm">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Synced
                            </span>
                          ) : (
                            <span className="text-slate-500 text-sm">Not synced</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {canManage && (
                            <button
                              onClick={() => handleToggleProduct(product)}
                              className={`px-3 py-1 rounded text-sm transition-colors ${
                                product.active
                                  ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                  : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                              }`}
                            >
                              {product.active ? 'Deactivate' : 'Activate'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'recurring' && (
            <RecurringProfilesTab onRefresh={loadData} />
          )}

          {activeTab === 'templates' && (
            <InvoiceTemplatesTab onRefresh={loadData} />
          )}

          {activeTab === 'reports' && (
            <PaymentReportsTab />
          )}
        </div>
      </div>

      <InvoiceBulkActionsBar
        selectedInvoices={selectedInvoices}
        onClearSelection={clearSelection}
        onActionComplete={() => {
          clearSelection();
          loadData();
        }}
      />

      {showCreateInvoice && (
        <CreateInvoiceModal
          onClose={() => setShowCreateInvoice(false)}
          onCreated={() => {
            setShowCreateInvoice(false);
            loadData();
          }}
        />
      )}

      {showCreateProduct && (
        <CreateProductModal
          onClose={() => setShowCreateProduct(false)}
          onCreated={() => {
            setShowCreateProduct(false);
            loadData();
          }}
        />
      )}
    </div>
  );
}