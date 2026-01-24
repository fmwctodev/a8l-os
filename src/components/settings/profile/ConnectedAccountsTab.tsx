import { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, Loader2, ExternalLink, Mail, Calendar, Video, HardDrive } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { getConnectedAccounts, disconnectAccount, type ConnectedAccount } from '../../../services/profile';

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

interface GoogleService {
  id: string;
  name: string;
  icon: typeof Mail;
  description: string;
}

const googleServices: GoogleService[] = [
  { id: 'gmail', name: 'Gmail', icon: Mail, description: 'Send and receive emails' },
  { id: 'calendar', name: 'Calendar', icon: Calendar, description: 'Sync appointments and events' },
  { id: 'meet', name: 'Meet', icon: Video, description: 'Video conferencing integration' },
  { id: 'drive', name: 'Drive', icon: HardDrive, description: 'Access and store files' },
];

export function ConnectedAccountsTab() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [showConfirmDisconnect, setShowConfirmDisconnect] = useState(false);
  const [googleAccount, setGoogleAccount] = useState<ConnectedAccount | null>(null);

  useEffect(() => {
    async function loadAccounts() {
      if (!user) return;

      try {
        const accounts = await getConnectedAccounts(user.id);
        const google = accounts.find(a => a.provider === 'google') || null;
        setGoogleAccount(google);
      } catch (error) {
        console.error('Failed to load connected accounts:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadAccounts();
  }, [user]);

  const handleConnect = async () => {
    setIsConnecting(true);

    try {
      const baseUrl = window.location.origin;
      const redirectUri = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/integrations-oauth-callback`;

      const params = new URLSearchParams({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: [
          'https://www.googleapis.com/auth/gmail.send',
          'https://www.googleapis.com/auth/gmail.readonly',
          'https://www.googleapis.com/auth/calendar',
          'https://www.googleapis.com/auth/drive.file',
          'https://www.googleapis.com/auth/userinfo.email',
          'https://www.googleapis.com/auth/userinfo.profile',
        ].join(' '),
        access_type: 'offline',
        prompt: 'consent',
        state: JSON.stringify({
          provider: 'google',
          user_id: user?.id,
          return_url: `${baseUrl}/settings/profile?tab=connected-accounts`,
        }),
      });

      window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    } catch (error) {
      console.error('Failed to initiate Google OAuth:', error);
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!user) return;

    setIsDisconnecting(true);

    try {
      await disconnectAccount(user.id, 'google');
      setGoogleAccount(null);
      setShowConfirmDisconnect(false);
    } catch (error) {
      console.error('Failed to disconnect Google account:', error);
    } finally {
      setIsDisconnecting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-white">
            <GoogleIcon className="w-8 h-8" />
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-lg font-semibold text-white">Google Workspace</h3>
              {googleAccount && (
                <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-500/20 text-emerald-400">
                  <CheckCircle className="w-3 h-3" />
                  Connected
                </span>
              )}
            </div>

            <p className="text-sm text-slate-400 mb-4">
              Connect your Google account to sync email, calendar, video meetings, and files
            </p>

            {googleAccount ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-slate-400">Connected as:</span>
                  <span className="text-white font-medium">{googleAccount.provider_account_email}</span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {googleServices.map((service) => {
                    const Icon = service.icon;
                    return (
                      <div
                        key={service.id}
                        className="flex items-center gap-2 p-3 rounded-lg bg-slate-800/50 border border-slate-700"
                      >
                        <Icon className="w-4 h-4 text-cyan-400" />
                        <div>
                          <p className="text-sm font-medium text-white">{service.name}</p>
                          <p className="text-xs text-slate-500">{service.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center gap-4 pt-2">
                  {googleAccount.last_synced_at && (
                    <p className="text-xs text-slate-500">
                      Last synced: {new Date(googleAccount.last_synced_at).toLocaleString()}
                    </p>
                  )}
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowConfirmDisconnect(true)}
                    className="px-4 py-2 rounded-lg bg-slate-800 text-red-400 hover:bg-slate-700 transition-colors text-sm font-medium"
                  >
                    Disconnect
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={handleConnect}
                disabled={isConnecting}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white text-slate-900 hover:bg-slate-100 transition-colors text-sm font-medium disabled:opacity-50"
              >
                {isConnecting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <GoogleIcon className="w-4 h-4" />
                )}
                {isConnecting ? 'Connecting...' : 'Sign in with Google'}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-white mb-1">About Connected Accounts</h4>
            <p className="text-sm text-slate-400 leading-relaxed">
              When you connect your Google account, you grant access to Gmail, Calendar, Meet, and Drive.
              This enables email sending, appointment syncing, video meeting creation, and file attachments.
              You can disconnect at any time, which will revoke access but won't delete previously synced data.
            </p>
          </div>
        </div>
      </div>

      {showConfirmDisconnect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-white mb-2">Disconnect Google Account?</h3>
            <p className="text-sm text-slate-400 mb-6">
              This will disconnect your Google account from Autom8ion. You'll need to reconnect to use
              Gmail, Calendar, Meet, and Drive integrations.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowConfirmDisconnect(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700 transition-colors text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleDisconnect}
                disabled={isDisconnecting}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors text-sm font-medium disabled:opacity-50"
              >
                {isDisconnecting && <Loader2 className="w-4 h-4 animate-spin" />}
                {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
