import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { bulkSendInvoices, bulkVoidInvoices, type BulkActionResult } from '../../services/invoices';
import {
  X,
  Send,
  XCircle,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import type { Invoice } from '../../types';

interface InvoiceBulkActionsBarProps {
  selectedInvoices: Invoice[];
  onClearSelection: () => void;
  onActionComplete: () => void;
}

export function InvoiceBulkActionsBar({
  selectedInvoices,
  onClearSelection,
  onActionComplete,
}: InvoiceBulkActionsBarProps) {
  const { user, hasPermission } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionType, setActionType] = useState<'send' | 'void' | null>(null);
  const [result, setResult] = useState<BulkActionResult | null>(null);

  const canSend = hasPermission('invoices.send');
  const canVoid = hasPermission('invoices.void');

  const draftInvoices = selectedInvoices.filter(inv => inv.status === 'draft');
  const voidableInvoices = selectedInvoices.filter(
    inv => inv.status !== 'void' && inv.status !== 'paid'
  );

  const handleBulkSend = async () => {
    if (!user || draftInvoices.length === 0) return;

    setIsProcessing(true);
    setActionType('send');
    try {
      const bulkResult = await bulkSendInvoices(
        draftInvoices.map(inv => inv.id),
        user
      );
      setResult(bulkResult);
      if (bulkResult.successIds.length > 0) {
        onActionComplete();
      }
    } catch (err) {
      console.error('Bulk send failed:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkVoid = async () => {
    if (!user || voidableInvoices.length === 0) return;
    if (!confirm(`Are you sure you want to void ${voidableInvoices.length} invoice(s)?`)) return;

    setIsProcessing(true);
    setActionType('void');
    try {
      const bulkResult = await bulkVoidInvoices(
        voidableInvoices.map(inv => inv.id),
        user
      );
      setResult(bulkResult);
      if (bulkResult.successIds.length > 0) {
        onActionComplete();
      }
    } catch (err) {
      console.error('Bulk void failed:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setResult(null);
    setActionType(null);
    onClearSelection();
  };

  if (result) {
    return (
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4">
        <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-xl p-4 min-w-[400px]">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              {result.failedIds.length === 0 ? (
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                </div>
              ) : (
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <AlertCircle className="w-5 h-5 text-amber-400" />
                </div>
              )}
              <div>
                <p className="text-white font-medium">
                  {actionType === 'send' ? 'Invoices Sent' : 'Invoices Voided'}
                </p>
                <p className="text-sm text-slate-400">
                  {result.successIds.length} succeeded
                  {result.failedIds.length > 0 && `, ${result.failedIds.length} failed`}
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {result.failedIds.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-800">
              <p className="text-xs text-slate-500 mb-2">Failed invoices:</p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {result.failedIds.map(id => (
                  <p key={id} className="text-xs text-red-400">
                    {result.errors[id] || 'Unknown error'}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (selectedInvoices.length === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-xl p-3 flex items-center gap-4">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800">
          <span className="text-white font-medium">{selectedInvoices.length}</span>
          <span className="text-slate-400 text-sm">selected</span>
        </div>

        <div className="h-6 w-px bg-slate-700" />

        <div className="flex items-center gap-2">
          {canSend && draftInvoices.length > 0 && (
            <button
              onClick={handleBulkSend}
              disabled={isProcessing}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing && actionType === 'send' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Send ({draftInvoices.length})
            </button>
          )}

          {canVoid && voidableInvoices.length > 0 && (
            <button
              onClick={handleBulkVoid}
              disabled={isProcessing}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing && actionType === 'void' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <XCircle className="w-4 h-4" />
              )}
              Void ({voidableInvoices.length})
            </button>
          )}
        </div>

        <div className="h-6 w-px bg-slate-700" />

        <button
          onClick={onClearSelection}
          className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
