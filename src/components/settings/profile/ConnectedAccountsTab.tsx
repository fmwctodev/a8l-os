import { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, Loader2, Mail, Calendar, Video, HardDrive, RefreshCw, AlertTriangle, Check } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { getConnectedAccounts, type ConnectedAccount } from '../../../services/profile';
import { getGmailConnectionStatus, disconnectGmail } from '../../../services/gmailApi';
import {
  getGoogleConnection,
  initiateGoogleOAuth,
  disconnectGoogle,
  getGoogleCalendarList,
  updateSelectedCalendars,
  testGoogleSync,
  openGoogleOAuthPopup,
  type GoogleConnection,
  type GoogleCalendarItem,
} from '../../../services/googleCalendarConnections';
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
  const { showToast } = useToast();
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

  const [calendarConn, setCalendarConn] = useState<GoogleConnection>({ connected: false });
  const [calendars, setCalendars] = useState<GoogleCalendarItem[]>([]);
  const [selectedCalendarIds, setSelectedCalendarIds] = useState<string[]>([]);
  const [connectingCalendar, setConnectingCalendar] = useState(false);
  const [disconnectingCalendar, setDisconnectingCalendar] = useState(false);
  const [savingCalendars, setSavingCalendars] = useState(false);
  const [testingSync, setTestingSync] = useState(false);
  const [syncTestResult, setSyncTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showCalendarDisconnect, setShowCalendarDisconnect] = useState(false);

  useEffect(() => {
    async function loadAccounts() {
      if (!user) return;

      try {
        const [accounts, gmailConn, calConn] = await Promise.all([
          getConnectedAccounts(user.id),
          getGmailConnectionStatus(user.id),
          getGoogleConnection().catch(() => ({ connected: false }) as GoogleConnection),
        ]);

        const google = accounts.find(a => a.provider === 'google' || a.provider === 'google_gmail') || null;
        setGoogleAccount(google);
        setGmailStatus(gmailConn);
        setCalendarConn(calConn);

        if (calConn.connected) {
          try {
            const { calendars: calList, selectedCalendarIds: selected } = await getGoogleCalendarList();
            setCalendars(calList);
            setSelectedCalendarIds(selected);
          } catch {
            // Calendar list may fail if token expired
          }
        }
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
      showToast('success', `Gmail connected successfully${email ? ` as ${email}` : ''}`);
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
  }, [user, showToast]);

  const handleDisconnectGmail = async () => {
    if (!user) return;

    setIsDisconnecting(true);
    try {
      await disconnectGmail(user.id);
      setGmailStatus({ connected: false, email: null, lastSyncAt: null, syncStatus: null });
      setGoogleAccount(null);
      setShowConfirmDisconnect(false);
      showToast('success', 'Gmail disconnected');
    } catch (error) {
      console.error('Failed to disconnect Gmail:', error);
      showToast('warning', 'Failed to disconnect Gmail');
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleConnectCalendar = async () => {
    setConnectingCalendar(true);
    try {
      const authUrl = await initiateGoogleOAuth();
      const result = await openGoogleOAuthPopup(authUrl);
      if (result.success) {
        const conn = await getGoogleConnection();
        setCalendarConn(conn);
        if (conn.connected) {
          const { calendars: calList, selectedCalendarIds: selected } = await getGoogleCalendarList();
          setCalendars(calList);
          setSelectedCalendarIds(selected);
        }
        showToast('success', 'Google Calendar connected');
      }
    } catch (error) {
      console.error('Failed to connect calendar:', error);
      showToast('warning', 'Failed to connect Google Calendar');
    } finally {
      setConnectingCalendar(false);
    }
  };

  const handleDisconnectCalendar = async () => {
    setDisconnectingCalendar(true);
    try {
      await disconnectGoogle();
      setCalendarConn({ connected: false });
      setCalendars([]);
      setSelectedCalendarIds([]);
      setShowCalendarDisconnect(false);
      showToast('success', 'Google Calendar disconnected');
    } catch (error) {
      console.error('Failed to disconnect calendar:', error);
      showToast('warning', 'Failed to disconnect Google Calendar');
    } finally {
      setDisconnectingCalendar(false);
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

  const isServiceConnected = (serviceId: string): boolean => {
    if (serviceId === 'gmail') return gmailStatus.connected;
    if (serviceId === 'calendar') return calendarConn.connected;
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
              {(gmailStatus.connected || calendarConn.connected) && (
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

            <div className="mt-5 pt-5 border-t border-slate-800">
              {calendarConn.connected ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="w-4 h-4 text-cyan-400" />
                      <span className="text-slate-400">Calendar:</span>
                      <span className="text-white font-medium">{calendarConn.email}</span>
                    </div>
                    <button
                      onClick={() => setShowCalendarDisconnect(true)}
                      className="text-red-400 hover:text-red-300 text-xs transition-colors"
                    >
                      Disconnect
                    </button>
                  </div>

                  {calendarConn.tokenExpired && (
                    <div className="flex items-center gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                      <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                      <p className="text-amber-400 text-sm flex-1">
                        Connection expired. Please reconnect.
                      </p>
                      <button
                        onClick={handleConnectCalendar}
                        disabled={connectingCalendar}
                        className="px-3 py-1 bg-amber-500/20 text-amber-400 rounded text-xs hover:bg-amber-500/30 transition-colors"
                      >
                        Reconnect
                      </button>
                    </div>
                  )}

                  {calendars.length > 0 && (
                    <div>
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

                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleTestSync}
                      disabled={testingSync}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors text-xs font-medium"
                    >
                      <RefreshCw className={`w-3 h-3 ${testingSync ? 'animate-spin' : ''}`} />
                      {testingSync ? 'Testing...' : 'Test Sync'}
                    </button>
                    {syncTestResult && (
                      <span className={`text-xs ${syncTestResult.success ? 'text-emerald-400' : 'text-red-400'}`}>
                        {syncTestResult.message}
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-white font-medium">Google Calendar</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Sync busy times to prevent double-bookings
                    </p>
                  </div>
                  <button
                    onClick={handleConnectCalendar}
                    disabled={connectingCalendar}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700 transition-colors text-sm font-medium disabled:opacity-50"
                  >
                    {connectingCalendar ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      <>
                        <Calendar className="w-3.5 h-3.5" />
                        Connect Calendar
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
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
              you send from conversations will go through your Gmail account. When you connect
              Google Calendar, busy times are synced to prevent double-bookings when scheduling
              appointments. You can disconnect at any time, which immediately revokes access but
              won't delete previously synced data.
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

      {showCalendarDisconnect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-white mb-2">Disconnect Google Calendar?</h3>
            <p className="text-sm text-slate-400 mb-2">
              This will disconnect your Google Calendar ({calendarConn.email}) from the CRM.
            </p>
            <ul className="text-sm text-slate-400 mb-6 space-y-1">
              <li>- Busy time sync will stop</li>
              <li>- Double-booking prevention will be disabled</li>
              <li>- Your existing appointments in the CRM are unaffected</li>
            </ul>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowCalendarDisconnect(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700 transition-colors text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleDisconnectCalendar}
                disabled={disconnectingCalendar}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors text-sm font-medium disabled:opacity-50"
              >
                {disconnectingCalendar && <Loader2 className="w-4 h-4 animate-spin" />}
                {disconnectingCalendar ? 'Disconnecting...' : 'Disconnect'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
