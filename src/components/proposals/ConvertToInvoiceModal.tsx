import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { createInvoice } from '../../services/invoices';
import type { Proposal, CreateInvoiceInput } from '../../types';
import { X, FileText, Loader2, DollarSign, Calendar } from 'lucide-react';

interface ConvertToInvoiceModalProps {
  proposal: Proposal;
  onClose: () => void;
  onConverted: () => void;
}

export function ConvertToInvoiceModal({ proposal, onClose, onConverted }: ConvertToInvoiceModalProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [dueDate, setDueDate] = useState('');
  const [autoSend, setAutoSend] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const defaultDueDate = () => {
    const date = new Date();
    date.setDate(date.getDate() + 30);
    return date.toISOString().split('T')[0];
  };

  const handleConvert = async () => {
    if (!user || !proposal.line_items || proposal.line_items.length === 0) {
      setError('Proposal must have line items to convert to an invoice');
      return;
    }

    try {
      setIsConverting(true);
      setError(null);

      const invoiceInput: CreateInvoiceInput = {
        contact_id: proposal.contact_id,
        opportunity_id: proposal.opportunity_id || undefined,
        line_items: proposal.line_items.map(item => ({
          product_id: item.product_id || undefined,
          description: item.description || item.name,
          quantity: item.quantity,
          unit_price: item.unit_price,
        })),
        discount_amount: 0,
        discount_type: 'flat',
        due_date: dueDate || defaultDueDate(),
        memo: `Converted from proposal: ${proposal.title}`,
        internal_notes: `Source proposal ID: ${proposal.id}`,
        auto_send: autoSend,
      };

      const invoice = await createInvoice(invoiceInput, user);

      navigate(`/payments/invoices/${invoice.id}`);
      onConverted();
    } catch (err) {
      console.error('Failed to convert proposal to invoice:', err);
      setError('Failed to create invoice. Please try again.');
    } finally {
      setIsConverting(false);
    }
  };

  const lineItemsTotal = proposal.line_items?.reduce((sum, item) => {
    const subtotal = item.quantity * item.unit_price;
    const discount = subtotal * (item.discount_percent / 100);
    return sum + (subtotal - discount);
  }, 0) || 0;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-xl border border-slate-700 w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-cyan-400" />
              Convert to Invoice
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Create an invoice from this proposal
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6">
          <div className="space-y-6">
            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
              <h3 className="text-sm font-medium text-slate-300 mb-3">Proposal Details</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Title:</span>
                  <span className="text-white">{proposal.title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Contact:</span>
                  <span className="text-white">
                    {proposal.contact?.first_name} {proposal.contact?.last_name}
                  </span>
                </div>
                {proposal.opportunity && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Opportunity:</span>
                    <span className="text-white">{proposal.opportunity.stage?.name}</span>
                  </div>
                )}
              </div>
            </div>

            {proposal.line_items && proposal.line_items.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-slate-300 mb-3">
                  Line Items ({proposal.line_items.length})
                </h3>
                <div className="border border-slate-700 rounded-lg overflow-hidden">
                  <div className="max-h-64 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-800 sticky top-0">
                        <tr>
                          <th className="text-left px-4 py-2 text-slate-300 font-medium">Item</th>
                          <th className="text-right px-4 py-2 text-slate-300 font-medium">Qty</th>
                          <th className="text-right px-4 py-2 text-slate-300 font-medium">Price</th>
                          <th className="text-right px-4 py-2 text-slate-300 font-medium">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700">
                        {proposal.line_items.map((item) => {
                          const subtotal = item.quantity * item.unit_price;
                          const discount = subtotal * (item.discount_percent / 100);
                          const total = subtotal - discount;

                          return (
                            <tr key={item.id} className="bg-slate-800/30">
                              <td className="px-4 py-2 text-white">{item.name}</td>
                              <td className="px-4 py-2 text-right text-slate-300">{item.quantity}</td>
                              <td className="px-4 py-2 text-right text-slate-300">
                                {proposal.currency} {item.unit_price.toLocaleString()}
                              </td>
                              <td className="px-4 py-2 text-right text-white">
                                {proposal.currency} {total.toLocaleString()}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="bg-slate-800 border-t-2 border-slate-600">
                        <tr>
                          <td colSpan={3} className="px-4 py-2 text-right font-semibold text-white">
                            Total
                          </td>
                          <td className="px-4 py-2 text-right font-semibold text-white">
                            {proposal.currency} {lineItemsTotal.toLocaleString()}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                placeholder={defaultDueDate()}
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              />
              <p className="text-xs text-slate-400 mt-1">
                Default: 30 days from today
              </p>
            </div>

            <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoSend}
                  onChange={(e) => setAutoSend(e.target.checked)}
                  className="mt-0.5 w-5 h-5 rounded border-slate-600 bg-slate-700 text-cyan-500 focus:ring-cyan-500/50"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium">Send invoice immediately</span>
                  </div>
                  <p className="text-sm text-slate-400 mt-1">
                    The invoice will be marked as sent and the client will be notified
                  </p>
                </div>
              </label>
            </div>

            <div className="p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
              <div className="flex items-start gap-2">
                <DollarSign className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-cyan-400 mb-1">What happens next?</h4>
                  <ul className="text-sm text-slate-300 space-y-1">
                    <li>• Invoice will be created with all line items from this proposal</li>
                    <li>• Original proposal will remain unchanged</li>
                    <li>• You can edit the invoice after creation</li>
                    {autoSend && <li>• Client will receive an email with the invoice</li>}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-700 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isConverting}
            className="px-4 py-2 text-slate-300 hover:text-white transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConvert}
            disabled={isConverting}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            {isConverting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Converting...
              </>
            ) : (
              <>
                <FileText className="w-4 h-4" />
                Create Invoice
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
