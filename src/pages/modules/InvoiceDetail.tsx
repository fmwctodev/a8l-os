import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getInvoice, sendInvoice, voidInvoice } from '../../services/invoices';
import type { Invoice, InvoiceStatus } from '../../types';
import {
  ArrowLeft,
  FileText,
  Loader2,
  Send,
  XCircle,
  Copy,
  ExternalLink,
  CheckCircle2,
  User,
  Building2,
  Calendar,
  Clock,
  DollarSign,
  CreditCard,
  AlertCircle,
} from 'lucide-react';

const STATUS_STYLES: Record<InvoiceStatus, { bg: string; text: string; label: string }> = {
  draft: { bg: 'bg-slate-500/20', text: 'text-slate-300', label: 'Draft' },
  sent: { bg: 'bg-cyan-500/20', text: 'text-cyan-300', label: 'Sent' },
  paid: { bg: 'bg-emerald-500/20', text: 'text-emerald-300', label: 'Paid' },
  overdue: { bg: 'bg-red-500/20', text: 'text-red-300', label: 'Overdue' },
  void: { bg: 'bg-slate-700/50', text: 'text-slate-500', label: 'Void' },
};

export function InvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canSend = hasPermission('invoices.send');
  const canVoid = hasPermission('invoices.void');

  useEffect(() => {
    if (id) {
      loadInvoice();
    }
  }, [id]);

  const loadInvoice = async () => {
    if (!id) return;
    try {
      setIsLoading(true);
      const data = await getInvoice(id);
      setInvoice(data);
    } catch (err) {
      console.error('Failed to load invoice:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    if (!invoice || !user) return;
    try {
      setIsProcessing(true);
      setErrorMessage(null);
      await sendInvoice(invoice.id, user);
      await loadInvoice();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to send invoice';
      setErrorMessage(msg);
      console.error('Failed to send invoice:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleVoid = async () => {
    if (!invoice || !user || !confirm('Are you sure you want to void this invoice?')) return;
    try {
      setIsProcessing(true);
      setErrorMessage(null);
      await voidInvoice(invoice.id, user);
      await loadInvoice();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to void invoice';
      setErrorMessage(msg);
      console.error('Failed to void invoice:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const copyPaymentLink = () => {
    if (invoice?.payment_link_url) {
      navigator.clipboard.writeText(invoice.payment_link_url);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  const formatCurrency = (amount: number, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getContactName = () => {
    if (!invoice?.contact) return 'Unknown Contact';
    return invoice.contact.company || `${invoice.contact.first_name} ${invoice.contact.last_name}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="text-center py-12">
        <FileText className="w-12 h-12 mx-auto text-slate-600 mb-4" />
        <h2 className="text-xl font-semibold text-white">Invoice not found</h2>
        <button
          onClick={() => navigate('/payments')}
          className="mt-4 text-cyan-400 hover:text-cyan-300"
        >
          Back to Payments
        </button>
      </div>
    );
  }

  const statusStyle = STATUS_STYLES[invoice.status];
  const totalPaid = invoice.payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
  const balanceDue = invoice.total - totalPaid;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/payments')}
            className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-white">
                Invoice {invoice.doc_number || '#' + invoice.id.slice(0, 8)}
              </h1>
              <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${statusStyle.bg} ${statusStyle.text}`}>
                {statusStyle.label}
              </span>
            </div>
            <p className="text-slate-400 mt-1">
              Created {formatDateTime(invoice.created_at)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {invoice.status === 'draft' && canSend && (
            <button
              onClick={handleSend}
              disabled={isProcessing}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-600 text-white font-medium hover:from-cyan-600 hover:to-teal-700 disabled:opacity-50 transition-colors"
            >
              {isProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Send Invoice
            </button>
          )}
          {invoice.status !== 'void' && invoice.status !== 'paid' && canVoid && (
            <button
              onClick={handleVoid}
              disabled={isProcessing}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 disabled:opacity-50 transition-colors"
            >
              {isProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <XCircle className="w-4 h-4" />
              )}
              Void
            </button>
          )}
        </div>
      </div>

      {errorMessage && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <p className="text-red-300 text-sm">{errorMessage}</p>
          <button
            onClick={() => setErrorMessage(null)}
            className="ml-auto text-red-400 hover:text-red-300"
          >
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Line Items</h3>
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left py-2 text-sm font-medium text-slate-400">Description</th>
                  <th className="text-right py-2 text-sm font-medium text-slate-400">Qty</th>
                  <th className="text-right py-2 text-sm font-medium text-slate-400">Price</th>
                  <th className="text-right py-2 text-sm font-medium text-slate-400">Total</th>
                </tr>
              </thead>
              <tbody>
                {invoice.line_items?.map((item) => (
                  <tr key={item.id} className="border-b border-slate-800/50">
                    <td className="py-3 text-white">{item.description}</td>
                    <td className="py-3 text-right text-slate-300">{item.quantity}</td>
                    <td className="py-3 text-right text-slate-300">{formatCurrency(item.unit_price)}</td>
                    <td className="py-3 text-right text-white font-medium">{formatCurrency(item.total_price)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} className="py-3 text-right text-slate-400">Subtotal</td>
                  <td className="py-3 text-right text-white">{formatCurrency(invoice.subtotal)}</td>
                </tr>
                {invoice.discount_amount > 0 && (
                  <tr>
                    <td colSpan={3} className="py-2 text-right text-slate-400">
                      Discount {invoice.discount_type === 'percentage' && `(${invoice.discount_amount}%)`}
                    </td>
                    <td className="py-2 text-right text-red-400">
                      -{formatCurrency(invoice.discount_type === 'percentage' ? (invoice.subtotal * invoice.discount_amount / 100) : invoice.discount_amount)}
                    </td>
                  </tr>
                )}
                <tr className="border-t border-slate-700">
                  <td colSpan={3} className="py-3 text-right text-lg font-semibold text-white">Total</td>
                  <td className="py-3 text-right text-lg font-semibold text-white">{formatCurrency(invoice.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {(invoice.payments?.length ?? 0) > 0 && (
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-400" />
                Payments Received
              </h3>
              <div className="space-y-3">
                {invoice.payments?.map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-emerald-500/10">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-white font-medium">{formatCurrency(payment.amount)}</p>
                        <p className="text-sm text-slate-400">
                          {payment.payment_method.replace('_', ' ')} - {formatDateTime(payment.received_at)}
                        </p>
                      </div>
                    </div>
                    {payment.reference_number && (
                      <span className="text-sm text-slate-400">Ref: {payment.reference_number}</span>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-slate-800 flex justify-between">
                <span className="text-slate-400">Balance Due</span>
                <span className={`text-lg font-semibold ${balanceDue > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {formatCurrency(balanceDue)}
                </span>
              </div>
            </div>
          )}

          {invoice.memo && (
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
              <h3 className="text-sm font-medium text-slate-400 mb-2">Customer Memo</h3>
              <p className="text-white">{invoice.memo}</p>
            </div>
          )}

          {invoice.internal_notes && (
            <div className="bg-slate-900 rounded-xl border border-amber-500/20 p-6">
              <h3 className="text-sm font-medium text-amber-400 mb-2">Internal Notes</h3>
              <p className="text-slate-300">{invoice.internal_notes}</p>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Details</h3>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <User className="w-5 h-5 text-slate-400 mt-0.5" />
                <div>
                  <p className="text-sm text-slate-400">Contact</p>
                  <Link
                    to={`/contacts/${invoice.contact_id}`}
                    className="text-white hover:text-cyan-400 transition-colors"
                  >
                    {getContactName()}
                  </Link>
                  {invoice.contact?.email && (
                    <p className="text-sm text-slate-400">{invoice.contact.email}</p>
                  )}
                </div>
              </div>

              {invoice.opportunity && (
                <div className="flex items-start gap-3">
                  <Building2 className="w-5 h-5 text-slate-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-slate-400">Opportunity</p>
                    <Link
                      to={`/opportunities/${invoice.opportunity_id}`}
                      className="text-white hover:text-cyan-400 transition-colors"
                    >
                      {formatCurrency(invoice.opportunity.value_amount)}
                    </Link>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-slate-400 mt-0.5" />
                <div>
                  <p className="text-sm text-slate-400">Due Date</p>
                  <p className="text-white">{formatDate(invoice.due_date)}</p>
                </div>
              </div>

              {invoice.sent_at && (
                <div className="flex items-start gap-3">
                  <Send className="w-5 h-5 text-slate-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-slate-400">Sent</p>
                    <p className="text-white">{formatDateTime(invoice.sent_at)}</p>
                  </div>
                </div>
              )}

              {invoice.paid_at && (
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-slate-400">Paid</p>
                    <p className="text-white">{formatDateTime(invoice.paid_at)}</p>
                  </div>
                </div>
              )}

              {invoice.qbo_invoice_id && (
                <div className="flex items-start gap-3">
                  <FileText className="w-5 h-5 text-slate-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-slate-400">QuickBooks ID</p>
                    <p className="text-white font-mono text-sm">{invoice.qbo_invoice_id}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {invoice.payment_link_url && invoice.status !== 'paid' && invoice.status !== 'void' && (
            <div className="bg-slate-900 rounded-xl border border-emerald-500/20 p-6">
              <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-400" />
                Payment Link
              </h3>
              <p className="text-sm text-slate-400 mb-4">
                Share this link with your customer to collect payment through QuickBooks.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={copyPaymentLink}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700 transition-colors"
                >
                  {copySuccess ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy Link
                    </>
                  )}
                </button>
                <a
                  href={invoice.payment_link_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open
                </a>
              </div>
            </div>
          )}

          <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Summary</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-slate-400">Subtotal</span>
                <span className="text-white">{formatCurrency(invoice.subtotal)}</span>
              </div>
              {invoice.discount_amount > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Discount</span>
                  <span className="text-red-400">
                    -{formatCurrency(invoice.discount_type === 'percentage' ? (invoice.subtotal * invoice.discount_amount / 100) : invoice.discount_amount)}
                  </span>
                </div>
              )}
              <div className="flex justify-between pt-3 border-t border-slate-800">
                <span className="text-white font-medium">Total</span>
                <span className="text-white font-semibold text-lg">{formatCurrency(invoice.total)}</span>
              </div>
              {totalPaid > 0 && (
                <>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Paid</span>
                    <span className="text-emerald-400">-{formatCurrency(totalPaid)}</span>
                  </div>
                  <div className="flex justify-between pt-3 border-t border-slate-800">
                    <span className="text-white font-medium">Balance Due</span>
                    <span className={`font-semibold text-lg ${balanceDue > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {formatCurrency(balanceDue)}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}