import { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, Loader2, Mail, Calendar, Video, HardDrive, RefreshCw } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { getConnectedAccounts, type ConnectedAccount } from '../../../services/profile';
import { getGmailConnectionStatus, disconnectGmail } from '../../../services/gmailApi';
import { ConnectGmailModal } from './ConnectGmailModal';
import { useToast } from '../../../contexts/ToastContext';

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

interface GoogleService {
  id: string;
  name: string;
  icon: typeof Mail;
  description: string;
  connectedKey?: string;
}

const googleServices: GoogleService[] = [
  { id: 'gmail', name: 'Gmail', icon: Mail, description: 'Send and receive emails', connectedKey: 'gmail' },
  { id: 'calendar', name: 'Calendar', icon: Calendar, description: 'Sync appointments and events' },
  { id: 'meet', name: 'Meet', icon: Video, description: 'Video conferencing integration' },
  { id: 'drive', name: 'Drive', icon: HardDrive, description: 'Access and store files', connectedKey: 'drive' },
];

export function ConnectedAccountsTab() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [showConfirmDisconnect, setShowConfirmDisconnect] = useState(false);
  const [showConnectGmailModal, setShowConnectGmailModal] = useState(false);
  const [googleAccount, setGoogleAccount] = useState<ConnectedAccount | null>(null);
  const [gmailStatus, setGmailStatus] = useState<{
    connected: boolean;
    email: string | null;
    lastSyncAt: string | null;
    syncStatus: string | null;
  }>({ connected: false, email: null, lastSyncAt: null, syncStatus: null });

  useEffect(() => {
    async function loadAccounts() {
      if (!user) return;

      try {
        const [accounts, gmailConn] = await Promise.all([
          getConnectedAccounts(user.id),
          getGmailConnectionStatus(user.id),
        ]);

        const google = accounts.find(a => a.provider === 'google' || a.provider === 'google_gmail') || null;
        setGoogleAccount(google);
        setGmailStatus(gmailConn);
      } catch (error) {
        console.error('Failed to load connected accounts:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadAccounts();
  }, [user]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('gmail_connected') === 'true') {
      const email = params.get('email');
      addToast(`Gmail connected successfully${email ? ` as ${email}` : ''}`, 'success');
      setGmailStatus(prev => ({
        ...prev,
        connected: true,
        email: email || prev.email,
      }));

      const url = new URL(window.location.href);
      url.searchParams.delete('gmail_connected');
      url.searchParams.delete('email');
      window.history.replaceState({}, '', url.toString());

      if (user) {
        getGmailConnectionStatus(user.id).then(setGmailStatus).catch(() => {});
        getConnectedAccounts(user.id).then(accounts => {
          const google = accounts.find(a => a.provider === 'google' || a.provider === 'google_gmail') || null;
          setGoogleAccount(google);
        }).catch(() => {});
      }
    }
  }, [user, addToast]);

  const handleDisconnectGmail = async () => {
    if (!user) return;

    setIsDisconnecting(true);
    try {
      await disconnectGmail(user.id);
      setGmailStatus({ connected: false, email: null, lastSyncAt: null, syncStatus: null });
      setGoogleAccount(null);
      setShowConfirmDisconnect(false);
      addToast('Gmail disconnected', 'success');
    } catch (error) {
      console.error('Failed to disconnect Gmail:', error);
      addToast('Failed to disconnect Gmail', 'error');
    } finally {
      setIsDisconnecting(false);
    }
  };

  const isServiceConnected = (serviceId: string): boolean => {
    if (serviceId === 'gmail') return gmailStatus.connected;
    if (serviceId === 'drive') return user?.google_drive_connected || false;
    return false;
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
              {gmailStatus.connected && (
                <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-500/20 text-emerald-400">
                  <CheckCircle className="w-3 h-3" />
                  Connected
                </span>
              )}
            </div>

            <p className="text-sm text-slate-400 mb-4">
              Connect your Google account to sync email, calendar, video meetings, and files
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              {googleServices.map((service) => {
                const Icon = service.icon;
                const connected = isServiceConnected(service.id);
                return (
                  <div
                    key={service.id}
                    className={`flex items-center gap-2 p-3 rounded-lg border transition-colors ${
                      connected
                        ? 'bg-emerald-500/5 border-emerald-500/20'
                        : 'bg-slate-800/50 border-slate-700'
                    }`}
                  >
                    <div className="relative">
                      <Icon className={`w-4 h-4 ${connected ? 'text-emerald-400' : 'text-slate-500'}`} />
                      {connected && (
                        <CheckCircle className="absolute -top-1 -right-1 w-2.5 h-2.5 text-emerald-400" />
                      )}
                    </div>
                    <div>
                      <p className={`text-sm font-medium ${connected ? 'text-white' : 'text-slate-400'}`}>
                        {service.name}
                      </p>
                      <p className="text-xs text-slate-500">{service.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {gmailStatus.connected ? (
              <div className="space-y-3">
                <div className="flex items-center gap-6 text-sm">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-cyan-400" />
                    <span className="text-slate-400">Gmail:</span>
                    <span className="text-white font-medium">{gmailStatus.email}</span>
                  </div>
                  {gmailStatus.syncStatus === 'syncing' && (
                    <span className="flex items-center gap-1.5 text-xs text-cyan-400">
                      <RefreshCw size={12} className="animate-spin" />
                      Syncing...
                    </span>
                  )}
                </div>

                {gmailStatus.lastSyncAt && (
                  <p className="text-xs text-slate-500">
                    Last synced: {new Date(gmailStatus.lastSyncAt).toLocaleString()}
                  </p>
                )}

                <div className="flex gap-3 pt-1">
                  <button
                    onClick={() => setShowConfirmDisconnect(true)}
                    className="px-4 py-2 rounded-lg bg-slate-800 text-red-400 hover:bg-slate-700 transition-colors text-sm font-medium"
                  >
                    Disconnect Gmail
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowConnectGmailModal(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white text-slate-900 hover:bg-slate-100 transition-colors text-sm font-semibold shadow-lg shadow-white/5"
              >
                <Mail className="w-4 h-4" />
                Connect Gmail
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
              When you connect Gmail, your emails sync in real-time with the CRM. Outbound emails
              you send from conversations will go through your Gmail account, maintaining proper
              threading and delivery reputation. You can disconnect at any time, which immediately
              revokes access but won't delete previously synced data.
            </p>
          </div>
        </div>
      </div>

      {showConnectGmailModal && (
        <ConnectGmailModal onClose={() => setShowConnectGmailModal(false)} />
      )}

      {showConfirmDisconnect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-white mb-2">Disconnect Gmail?</h3>
            <p className="text-sm text-slate-400 mb-2">
              This will disconnect your Gmail account ({gmailStatus.email}) from the CRM.
            </p>
            <ul className="text-sm text-slate-400 mb-6 space-y-1">
              <li>- Real-time email sync will stop</li>
              <li>- Outbound emails will fall back to the default provider</li>
              <li>- Previously synced messages will remain in the CRM</li>
              <li>- Gmail drafts auto-save will be disabled</li>
            </ul>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowConfirmDisconnect(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700 transition-colors text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleDisconnectGmail}
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
