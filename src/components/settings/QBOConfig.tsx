import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  getQBOConnectionStatus,
  generateQBOAuthUrl,
  exchangeQBOCode,
  disconnectQBO,
} from '../../services/qboAuth';
import {
  FileText,
  Link2,
  Unlink,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';

interface QBOConnectionStatus {
  connected: boolean;
  companyName?: string;
  realmId?: string;
  lastSyncAt?: string;
  tokenExpiring?: boolean;
}

export function QBOConfig() {
  const { user, hasPermission } = useAuth();
  const [status, setStatus] = useState<QBOConnectionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canManage = hasPermission('settings.manage');

  useEffect(() => {
    loadStatus();
    handleOAuthCallback();
  }, []);

  const loadStatus = async () => {
    try {
      setIsLoading(true);
      const connectionStatus = await getQBOConnectionStatus();
      setStatus(connectionStatus);
    } catch (err) {
      console.error('Failed to load QBO status:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuthCallback = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const realmId = urlParams.get('realmId');
    const state = urlParams.get('state');

    if (code && realmId && state) {
      try {
        setIsConnecting(true);
        setError(null);

        const redirectUri = `${window.location.origin}/admin/settings`;
        await exchangeQBOCode(code, realmId, redirectUri);

        window.history.replaceState({}, '', window.location.pathname);

        await loadStatus();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to connect to QuickBooks');
      } finally {
        setIsConnecting(false);
      }
    }
  };

  const handleConnect = async () => {
    if (!user?.organization_id) return;

    try {
      setIsConnecting(true);
      setError(null);
      const redirectUri = `${window.location.origin}/admin/settings`;
      const authUrl = await generateQBOAuthUrl(user.organization_id, redirectUri);
      window.location.href = authUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initiate QuickBooks connection');
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect QuickBooks Online? This will remove the integration.')) {
      return;
    }

    try {
      setIsDisconnecting(true);
      setError(null);
      await disconnectQBO();
      await loadStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect QuickBooks');
    } finally {
      setIsDisconnecting(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  if (isLoading) {
    return (
      <div className="bg-slate-900 rounded-xl border border-slate-800">
        <div className="p-4 border-b border-slate-800">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-400" />
            QuickBooks Online
          </h2>
        </div>
        <div className="p-8 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800">
      <div className="p-4 border-b border-slate-800">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <FileText className="w-5 h-5 text-emerald-400" />
          QuickBooks Online
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          Connect to QuickBooks Online for invoicing and payments
        </p>
      </div>

      <div className="p-4 space-y-4">
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {isConnecting && (
          <div className="flex items-center gap-3 p-4 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
            <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
            <span className="text-cyan-300">Connecting to QuickBooks Online...</span>
          </div>
        )}

        {!isConnecting && status?.connected ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <div className="flex-1">
                <p className="text-emerald-300 font-medium">Connected</p>
                <p className="text-sm text-emerald-400/70">
                  {status.companyName}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-400">Company ID (Realm)</p>
                <p className="text-white font-mono">{status.realmId}</p>
              </div>
              <div>
                <p className="text-slate-400">Last Sync</p>
                <p className="text-white">{formatDate(status.lastSyncAt)}</p>
              </div>
            </div>

            {status.tokenExpiring && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>Access token is expiring soon. Re-authorize to refresh.</span>
              </div>
            )}

            {canManage && (
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={handleDisconnect}
                  disabled={isDisconnecting}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                >
                  {isDisconnecting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Unlink className="w-4 h-4" />
                  )}
                  Disconnect
                </button>
                <a
                  href="https://app.qbo.intuit.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open QuickBooks
                </a>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
              <p className="text-slate-300">
                Connect your QuickBooks Online account to enable invoicing and payment features.
                Invoices created in this CRM will sync to QuickBooks, and customers will pay
                through QuickBooks' secure payment pages.
              </p>
              <ul className="mt-3 space-y-1 text-sm text-slate-400">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Create and send invoices
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Track payment status automatically
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Sync products and services
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Set up recurring billing
                </li>
              </ul>
            </div>

            {canManage ? (
              <button
                onClick={handleConnect}
                disabled={isConnecting}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-medium hover:from-emerald-600 hover:to-teal-700 transition-colors disabled:opacity-50"
              >
                {isConnecting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Link2 className="w-4 h-4" />
                )}
                Connect to QuickBooks Online
              </button>
            ) : (
              <p className="text-sm text-slate-400">
                Contact an administrator to connect QuickBooks Online.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}