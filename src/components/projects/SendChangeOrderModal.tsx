import { useState } from 'react';
import { X, Send, Calendar, User, Mail, AlertCircle, CheckCircle2, Copy } from 'lucide-react';
import type { ProjectChangeOrder, ProjectChangeRequest } from '../../types';
import { sendChangeOrderForSignature } from '../../services/projectChangeOrders';

interface Props {
  changeOrder: ProjectChangeOrder;
  changeRequest: ProjectChangeRequest;
  currentUserId: string;
  onClose: () => void;
  onSent: () => Promise<void>;
}

export function SendChangeOrderModal({ changeOrder, changeRequest, currentUserId, onClose, onSent }: Props) {
  const [signerName, setSignerName] = useState(changeRequest.client_name);
  const [signerEmail, setSignerEmail] = useState(changeRequest.client_email ?? '');
  const [expirationDays, setExpirationDays] = useState(14);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [signingUrl, setSigningUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleSend() {
    if (!signerName.trim() || !signerEmail.trim()) {
      setError('Signer name and email are required.');
      return;
    }
    setSending(true);
    setError(null);
    try {
      const result = await sendChangeOrderForSignature(
        changeOrder.id,
        changeRequest,
        signerName,
        signerEmail,
        expirationDays,
        currentUserId
      );
      setSigningUrl(result.signingUrl);
      setSent(true);
      await onSent();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send change order for signature.');
    } finally {
      setSending(false);
    }
  }

  async function handleCopy() {
    if (!signingUrl) return;
    await navigator.clipboard.writeText(signingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  const expiresAt = new Date(Date.now() + expirationDays * 86400000).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-500/20 rounded-lg">
              <Send className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Send Change Order for Signature</h2>
              <p className="text-xs text-slate-400">{changeOrder.title}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        {sent ? (
          <div className="p-6 text-center space-y-4">
            <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white mb-1">Change Order Ready to Sign</h3>
              <p className="text-sm text-slate-400">
                The change order has been prepared. Copy the signing link and share it with {signerName}.
              </p>
            </div>
            {signingUrl && (
              <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 text-left">
                <p className="text-xs text-slate-400 mb-2">Signing Link</p>
                <p className="text-xs text-slate-300 break-all font-mono leading-relaxed">{signingUrl}</p>
                <button
                  onClick={handleCopy}
                  className="mt-2 flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300"
                >
                  {copied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied!' : 'Copy Link'}
                </button>
              </div>
            )}
            <button onClick={onClose} className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition-colors">
              Close
            </button>
          </div>
        ) : (
          <div className="p-6 space-y-4">
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Cost</span>
                <span className="text-white font-medium">
                  {new Intl.NumberFormat('en-US', { style: 'currency', currency: changeOrder.currency }).format(changeOrder.cost_amount)}
                </span>
              </div>
              {changeOrder.timeline_extension_days > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Timeline Extension</span>
                  <span className="text-white font-medium">+{changeOrder.timeline_extension_days} days</span>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <label className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                  <User className="w-3.5 h-3.5" /> Signer Name
                </label>
                <input
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
                  placeholder="Full name"
                />
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                  <Mail className="w-3.5 h-3.5" /> Signer Email
                </label>
                <input
                  type="email"
                  value={signerEmail}
                  onChange={(e) => setSignerEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
                  placeholder="email@example.com"
                />
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                  <Calendar className="w-3.5 h-3.5" /> Expires In
                </label>
                <select
                  value={expirationDays}
                  onChange={(e) => setExpirationDays(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
                >
                  {[7, 14, 21, 30, 60, 90].map((d) => (
                    <option key={d} value={d}>{d} days ({expiresAt})</option>
                  ))}
                </select>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                <AlertCircle className="w-4 h-4 flex-none" />
                {error}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button onClick={onClose} className="flex-1 px-4 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors">
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={sending || !signerName.trim() || !signerEmail.trim()}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
              >
                <Send className="w-4 h-4" />
                {sending ? 'Preparing...' : 'Generate Signing Link'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
