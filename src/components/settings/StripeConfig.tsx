import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  connectStripe,
  disconnectStripe,
  getStripeConnectionStatus,
  testStripeConnection,
  type StripeConnectionStatus,
} from '../../services/stripeAuth';
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  Link2,
  Loader2,
  RefreshCw,
  Unlink,
} from 'lucide-react';

export function StripeConfig() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('settings.manage') || hasPermission('payments.manage');

  const [status, setStatus] = useState<StripeConnectionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [secretKey, setSecretKey] = useState('');
  const [publishableKey, setPublishableKey] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [nickname, setNickname] = useState('');
  const [showSecret, setShowSecret] = useState(false);

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    setIsLoading(true);
    try {
      const s = await getStripeConnectionStatus();
      setStatus(s);
    } catch (err) {
      console.error('Failed to load Stripe status:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setTestResult(null);
    setIsSaving(true);
    try {
      if (!secretKey.startsWith('sk_')) {
        setError('Stripe secret key must start with sk_test_ or sk_live_');
        setIsSaving(false);
        return;
      }
      const result = await connectStripe({
        secretKey,
        publishableKey: publishableKey || undefined,
        webhookSigningSecret: webhookSecret || undefined,
        nickname: nickname || undefined,
      });
      if (!result.success) {
        setError(result.error || 'Failed to connect Stripe');
      } else {
        setShowForm(false);
        setSecretKey('');
        setPublishableKey('');
        setWebhookSecret('');
        setNickname('');
        await loadStatus();
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    setError(null);
    setTestResult(null);
    setIsTesting(true);
    try {
      const result = await testStripeConnection();
      if (result.success) {
        setTestResult('Connection test passed');
      } else {
        setError(result.error || 'Connection test failed');
      }
    } finally {
      setIsTesting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Disconnect Stripe? Existing invoice records remain in the database, but new invoices will not be sent to Stripe until you reconnect.')) {
      return;
    }
    setError(null);
    setIsDisconnecting(true);
    try {
      const result = await disconnectStripe();
      if (!result.success) {
        setError(result.error || 'Failed to disconnect');
      } else {
        await loadStatus();
      }
    } finally {
      setIsDisconnecting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
      </div>
    );
  }

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            Stripe
            {status?.connected && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400">
                <CheckCircle2 className="w-3 h-3" />
                Connected
              </span>
            )}
          </h3>
          <p className="text-sm text-slate-400 mt-1">
            Online payments, invoicing, and subscription billing.
          </p>
        </div>
        <a
          href="https://dashboard.stripe.com/apikeys"
          target="_blank"
          rel="noreferrer"
          className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
        >
          Get keys <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {testResult && (
        <div className="mb-4 flex items-start gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{testResult}</span>
        </div>
      )}

      {status?.connected && !showForm && (
        <div className="space-y-4">
          <div className="text-sm text-slate-300 space-y-1">
            {status.account_info?.nickname && (
              <p>
                <span className="text-slate-500">Account: </span>
                {status.account_info.nickname}
              </p>
            )}
            {status.account_info?.stripe_account_id && (
              <p>
                <span className="text-slate-500">Stripe ID: </span>
                <span className="font-mono text-xs">{status.account_info.stripe_account_id}</span>
              </p>
            )}
            {status.account_info?.country && (
              <p>
                <span className="text-slate-500">Country: </span>
                {status.account_info.country.toUpperCase()}
              </p>
            )}
            {status.account_info?.default_currency && (
              <p>
                <span className="text-slate-500">Default currency: </span>
                {status.account_info.default_currency.toUpperCase()}
              </p>
            )}
          </div>
          {canManage && (
            <div className="flex gap-2">
              <button
                onClick={handleTest}
                disabled={isTesting}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm disabled:opacity-50"
              >
                {isTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                Test connection
              </button>
              <button
                onClick={() => setShowForm(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm"
              >
                Update keys
              </button>
              <button
                onClick={handleDisconnect}
                disabled={isDisconnecting}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 text-sm disabled:opacity-50"
              >
                {isDisconnecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unlink className="w-3.5 h-3.5" />}
                Disconnect
              </button>
            </div>
          )}
        </div>
      )}

      {(showForm || !status?.connected) && canManage && (
        <form onSubmit={handleConnect} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Secret Key</label>
            <div className="relative">
              <input
                type={showSecret ? 'text' : 'password'}
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                placeholder="sk_live_... or sk_test_..."
                required
                className="w-full px-3 py-2 pr-10 rounded-lg bg-slate-900 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
              <button
                type="button"
                onClick={() => setShowSecret((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Publishable Key <span className="text-slate-500">(optional)</span>
            </label>
            <input
              type="text"
              value={publishableKey}
              onChange={(e) => setPublishableKey(e.target.value)}
              placeholder="pk_live_..."
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Webhook Signing Secret <span className="text-slate-500">(optional, whsec_...)</span>
            </label>
            <input
              type="password"
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
              placeholder="whsec_..."
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
            <p className="mt-1 text-xs text-slate-500">
              Required for webhook event verification. Get from your Stripe webhook endpoint settings.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Nickname <span className="text-slate-500">(optional)</span>
            </label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Production / Test / etc"
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-600 text-white font-medium text-sm disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
              {status?.connected ? 'Update credentials' : 'Connect Stripe'}
            </button>
            {showForm && (
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setError(null);
                }}
                className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      )}

      {!status?.connected && !canManage && (
        <p className="text-sm text-slate-500">
          You don't have permission to connect Stripe. Ask an administrator.
        </p>
      )}
    </div>
  );
}
