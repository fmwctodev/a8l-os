import { useState } from 'react';
import { Link2, CheckCircle, AlertCircle } from 'lucide-react';

interface ConnectedAccount {
  provider: string;
  name: string;
  logo: string;
  description: string;
  isConnected: boolean;
  connectedEmail?: string;
  connectedAt?: string;
}

export function ConnectedAccountsTab() {
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([
    {
      provider: 'google',
      name: 'Google',
      logo: '🔵',
      description: 'Connect your Google account to sync calendar, email, and contacts',
      isConnected: false,
    },
    {
      provider: 'microsoft',
      name: 'Microsoft',
      logo: '🟦',
      description: 'Connect your Microsoft account to sync Outlook calendar and email',
      isConnected: false,
    },
    {
      provider: 'facebook',
      name: 'Facebook',
      logo: '🔵',
      description: 'Connect Facebook to manage social media posts and messages',
      isConnected: false,
    },
  ]);

  const handleConnect = (provider: string) => {
    // TODO: Implement OAuth flow
    console.log('Connecting to:', provider);
  };

  const handleDisconnect = (provider: string) => {
    if (!confirm(`Are you sure you want to disconnect your ${provider} account?`)) {
      return;
    }

    setAccounts((prev) =>
      prev.map((acc) =>
        acc.provider === provider
          ? { ...acc, isConnected: false, connectedEmail: undefined, connectedAt: undefined }
          : acc
      )
    );
  };

  return (
    <div className="space-y-4">
      {accounts.map((account) => (
        <div
          key={account.provider}
          className="bg-slate-900 rounded-xl border border-slate-800 p-6"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4 flex-1">
              <div className="text-4xl">{account.logo}</div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-lg font-semibold text-white">{account.name}</h3>
                  {account.isConnected && (
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                  )}
                </div>
                <p className="text-sm text-slate-400 mb-3">{account.description}</p>

                {account.isConnected && account.connectedEmail && (
                  <div className="text-sm text-slate-300 mb-2">
                    <span className="text-slate-400">Connected as:</span> {account.connectedEmail}
                  </div>
                )}

                {account.isConnected && account.connectedAt && (
                  <div className="text-xs text-slate-500">
                    Connected on {new Date(account.connectedAt).toLocaleDateString()}
                  </div>
                )}
              </div>
            </div>

            <div>
              {account.isConnected ? (
                <button
                  onClick={() => handleDisconnect(account.provider)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-red-400 hover:bg-slate-700 transition-colors text-sm font-medium"
                >
                  Disconnect
                </button>
              ) : (
                <button
                  onClick={() => handleConnect(account.provider)}
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-600 text-white hover:from-cyan-600 hover:to-teal-700 transition-colors text-sm font-medium"
                >
                  Connect
                </button>
              )}
            </div>
          </div>
        </div>
      ))}

      <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-white mb-1">About Connected Accounts</h4>
            <p className="text-sm text-slate-400 leading-relaxed">
              When you connect an account, you're granting Autom8ion access to specific data and
              services from that provider. You can disconnect an account at any time. Disconnecting
              will revoke access but won't delete any data that was previously synced.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
