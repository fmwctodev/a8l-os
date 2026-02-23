import { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, Loader2, Mail, Calendar, Video, HardDrive, RefreshCw, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import {
  getUnifiedGoogleConnection,
  initiateUnifiedGoogleOAuth,
  openUnifiedGoogleOAuthPopup,
  disconnectUnifiedGoogle,
  type UnifiedGoogleConnection,
} from '../../../services/googleOAuthUnified';
import {
  getGoogleCalendarList,
  updateSelectedCalendars,
  testGoogleSync,
  type GoogleCalendarItem,
} from '../../../services/googleCalendarConnections';
import { getGmailConnectionStatus } from '../../../services/gmailApi';
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
  scopeKey: 'gmail' | 'calendar' | 'drive';
}

const googleServices: GoogleService[] = [
  { id: 'gmail', name: 'Gmail', icon: Mail, description: 'Send and receive emails', scopeKey: 'gmail' },
  { id: 'calendar', name: 'Calendar', icon: Calendar, description: 'Sync appointments and events', scopeKey: 'calendar' },
  { id: 'meet', name: 'Meet', icon: Video, description: 'Video conferencing integration', scopeKey: 'calendar' },
  { id: 'drive', name: 'Drive', icon: HardDrive, description: 'Access and store files', scopeKey: 'drive' },
];

export function ConnectedAccountsTab() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [showConfirmDisconnect, setShowConfirmDisconnect] = useState(false);

  const [connection, setConnection] = useState<UnifiedGoogleConnection>({
    connected: false, email: null, gmail: false, calendar: false, drive: false, scopes: [],
  });

  const [gmailSyncStatus, setGmailSyncStatus] = useState<{
    lastSyncAt: string | null;
    syncStatus: string | null;
  }>({ lastSyncAt: null, syncStatus: null });

  const [calendars, setCalendars] = useState<GoogleCalendarItem[]>([]);
  const [selectedCalendarIds, setSelectedCalendarIds] = useState<string[]>([]);
  const [savingCalendars, setSavingCalendars] = useState(false);
  const [testingSync, setTestingSync] = useState(false);
  const [syncTestResult, setSyncTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    async function loadAccounts() {
      if (!user) return;

      try {
        const [conn, gmailConn] = await Promise.all([
          getUnifiedGoogleConnection().catch(() => ({
            connected: false, email: null, gmail: false, calendar: false, drive: false, scopes: [],
          } as UnifiedGoogleConnection)),
          getGmailConnectionStatus(user.id).catch(() => ({
            connected: false, email: null, lastSyncAt: null, syncStatus: null,
          })),
        ]);

        setConnection(conn);
        setGmailSyncStatus({
          lastSyncAt: gmailConn.lastSyncAt,
          syncStatus: gmailConn.syncStatus,
        });

        if (conn.calendar) {
          try {
            const { calendars: calList, selectedCalendarIds: selected } = await getGoogleCalendarList();
            setCalendars(calList);
            setSelectedCalendarIds(selected);
          } catch {}
        }
      } catch (error) {
        console.error('Failed to load connected accounts:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadAccounts();
  }, [user]);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const authUrl = await initiateUnifiedGoogleOAuth();
      const result = await openUnifiedGoogleOAuthPopup(authUrl);
      if (result.success) {
        const conn = await getUnifiedGoogleConnection();
        setConnection(conn);
        if (conn.calendar) {
          try {
            const { calendars: calList, selectedCalendarIds: selected } = await getGoogleCalendarList();
            setCalendars(calList);
            setSelectedCalendarIds(selected);
          } catch {}
        }
        if (conn.gmail && user) {
          const gmailConn = await getGmailConnectionStatus(user.id).catch(() => null);
          if (gmailConn) {
            setGmailSyncStatus({
              lastSyncAt: gmailConn.lastSyncAt,
              syncStatus: gmailConn.syncStatus,
            });
          }
        }
        showToast('success', `Google Workspace connected${result.email ? ` as ${result.email}` : ''}`);
      } else if (result.error && result.error !== 'Popup closed') {
        showToast('warning', result.error);
      }
    } catch (error) {
      console.error('Failed to connect Google:', error);
      showToast('warning', 'Failed to connect Google Workspace');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await disconnectUnifiedGoogle();
      setConnection({ connected: false, email: null, gmail: false, calendar: false, drive: false, scopes: [] });
      setCalendars([]);
      setSelectedCalendarIds([]);
      setGmailSyncStatus({ lastSyncAt: null, syncStatus: null });
      setShowConfirmDisconnect(false);
      showToast('success', 'Google Workspace disconnected');
    } catch (error) {
      console.error('Failed to disconnect Google:', error);
      showToast('warning', 'Failed to disconnect Google Workspace');
    } finally {
      setDisconnecting(false);
    }
  };

  const handleSaveCalendars = async () => {
    setSavingCalendars(true);
    try {
      await updateSelectedCalendars(selectedCalendarIds);
      showToast('success', 'Calendar selection saved');
    } catch (error) {
      console.error('Failed to save calendars:', error);
      showToast('warning', 'Failed to save calendar selection');
    } finally {
      setSavingCalendars(false);
    }
  };

  const handleTestSync = async () => {
    setTestingSync(true);
    setSyncTestResult(null);
    try {
      const result = await testGoogleSync();
      setSyncTestResult({
        success: result.success,
        message: result.message || result.error || 'Test completed',
      });
    } catch {
      setSyncTestResult({ success: false, message: 'Failed to test sync' });
    } finally {
      setTestingSync(false);
    }
  };

  const handleCalendarToggle = (calendarId: string) => {
    setSelectedCalendarIds(prev =>
      prev.includes(calendarId)
        ? prev.filter(id => id !== calendarId)
        : [...prev, calendarId]
    );
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
              {connection.connected && (
                <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-500/20 text-emerald-400">
                  <CheckCircle className="w-3 h-3" />
                  Connected
                </span>
              )}
            </div>

            {connection.connected && connection.email && (
              <p className="text-sm text-slate-400 mb-3">{connection.email}</p>
            )}

            {!connection.connected && (
              <p className="text-sm text-slate-400 mb-4">
                Connect your Google account to sync email, calendar, video meetings, and files
              </p>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              {googleServices.map((service) => {
                const Icon = service.icon;
                const connected = connection[service.scopeKey] || false;
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

            {connection.connected ? (
              <div className="space-y-4">
                {connection.tokenExpired && (
                  <div className="flex items-center gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                    <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    <p className="text-amber-400 text-sm flex-1">
                      Google has revoked access. Please reconnect your account.
                    </p>
                    <button
                      onClick={handleConnect}
                      disabled={connecting}
                      className="px-3 py-1 bg-amber-500/20 text-amber-400 rounded text-xs hover:bg-amber-500/30 transition-colors"
                    >
                      Reconnect
                    </button>
                  </div>
                )}

                {connection.gmail && gmailSyncStatus.syncStatus === 'syncing' && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="w-4 h-4 text-cyan-400" />
                    <span className="text-slate-400">Gmail:</span>
                    <span className="flex items-center gap-1.5 text-xs text-cyan-400">
                      <RefreshCw size={12} className="animate-spin" />
                      Syncing...
                    </span>
                  </div>
                )}

                {connection.gmail && gmailSyncStatus.lastSyncAt && (
                  <p className="text-xs text-slate-500">
                    Gmail last synced: {new Date(gmailSyncStatus.lastSyncAt).toLocaleString()}
                  </p>
                )}

                {connection.calendar && calendars.length > 0 && (
                  <div className="pt-3 border-t border-slate-800">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">
                        Calendars checked for conflicts
                      </p>
                      <button
                        onClick={handleSaveCalendars}
                        disabled={savingCalendars}
                        className="text-cyan-400 hover:text-cyan-300 text-xs transition-colors"
                      >
                        {savingCalendars ? 'Saving...' : 'Save Selection'}
                      </button>
                    </div>
                    <div className="space-y-1">
                      {calendars.map(cal => (
                        <label
                          key={cal.id}
                          className="flex items-center gap-2.5 px-3 py-2 bg-slate-800/50 rounded-lg cursor-pointer hover:bg-slate-800 transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={selectedCalendarIds.includes(cal.id)}
                            onChange={() => handleCalendarToggle(cal.id)}
                            className="w-3.5 h-3.5 rounded border-slate-600 bg-slate-700 text-cyan-500 focus:ring-cyan-500"
                          />
                          <span className="text-sm text-white">{cal.name}</span>
                          {cal.primary && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-cyan-500/20 text-cyan-400 rounded font-medium">
                              Primary
                            </span>
                          )}
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {connection.calendar && (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleTestSync}
                      disabled={testingSync}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors text-xs font-medium"
                    >
                      <RefreshCw className={`w-3 h-3 ${testingSync ? 'animate-spin' : ''}`} />
                      {testingSync ? 'Testing...' : 'Test Calendar Sync'}
                    </button>
                    {syncTestResult && (
                      <span className={`text-xs ${syncTestResult.success ? 'text-emerald-400' : 'text-red-400'}`}>
                        {syncTestResult.message}
                      </span>
                    )}
                  </div>
                )}

                <div className="pt-3 border-t border-slate-800">
                  <button
                    onClick={() => setShowConfirmDisconnect(true)}
                    className="px-4 py-2 rounded-lg bg-slate-800 text-red-400 hover:bg-slate-700 transition-colors text-sm font-medium"
                  >
                    Disconnect Google
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={handleConnect}
                disabled={connecting}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white text-slate-900 hover:bg-slate-100 transition-colors text-sm font-semibold shadow-lg shadow-white/5 disabled:opacity-50"
              >
                {connecting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <GoogleIcon className="w-4 h-4" />
                )}
                {connecting ? 'Connecting...' : 'Connect Google Workspace'}
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
              Connecting Google Workspace grants access to Gmail, Calendar, Meet, and Drive in a single
              sign-in. All services share one secure connection so they never interfere with each other.
              Outbound emails go through your Gmail account. Busy times from Calendar sync to prevent
              double-bookings. You can disconnect at any time, which immediately revokes access but
              won't delete previously synced data.
            </p>
          </div>
        </div>
      </div>

      {showConfirmDisconnect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-white mb-2">Disconnect Google Workspace?</h3>
            <p className="text-sm text-slate-400 mb-2">
              This will disconnect your Google account ({connection.email}) from the CRM.
            </p>
            <ul className="text-sm text-slate-400 mb-6 space-y-1">
              <li>- Gmail sync will stop, outbound emails fall back to the default provider</li>
              <li>- Calendar busy-time sync and double-booking prevention will be disabled</li>
              <li>- Google Drive file access will be revoked</li>
              <li>- Previously synced messages, events, and files remain in the CRM</li>
            </ul>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowConfirmDisconnect(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700 transition-colors text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors text-sm font-medium disabled:opacity-50"
              >
                {disconnecting && <Loader2 className="w-4 h-4 animate-spin" />}
                {disconnecting ? 'Disconnecting...' : 'Disconnect'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
