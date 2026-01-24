import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, RefreshCw, Loader2, AlertTriangle, Calendar, Mail, ExternalLink } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import {
  getGoogleConnection,
  initiateGoogleOAuth,
  disconnectGoogle,
  openGoogleOAuthPopup,
  getGoogleCalendarList,
  updateSelectedCalendars,
  type GoogleConnection,
  type GoogleCalendarItem,
} from '../../../services/googleCalendarConnections';

export function MyAccountTab() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [connection, setConnection] = useState<GoogleConnection | null>(null);
  const [calendars, setCalendars] = useState<GoogleCalendarItem[]>([]);
  const [selectedCalendarIds, setSelectedCalendarIds] = useState<string[]>([]);
  const [showCalendarSettings, setShowCalendarSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadConnection();
  }, []);

  const loadConnection = async () => {
    try {
      setLoading(true);
      setError(null);
      const conn = await getGoogleConnection();
      setConnection(conn);

      if (conn.connected) {
        const calData = await getGoogleCalendarList();
        setCalendars(calData.calendars);
        setSelectedCalendarIds(calData.selectedCalendarIds);
      }
    } catch (err) {
      console.error('Failed to load Google connection:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
      setConnecting(true);
      setError(null);

      const authUrl = await initiateGoogleOAuth();
      const result = await openGoogleOAuthPopup(authUrl);

      if (result.success) {
        setSuccess('Successfully connected your Google Workspace account');
        setTimeout(() => setSuccess(null), 5000);
        await loadConnection();
      } else if (result.error && result.error !== 'Popup closed') {
        setError(result.error);
      }
    } catch (err) {
      setError('Failed to connect Google account');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect your Google Workspace account? This will remove access to your calendar and email sync.')) {
      return;
    }

    try {
      setDisconnecting(true);
      setError(null);
      await disconnectGoogle();
      setConnection(null);
      setCalendars([]);
      setSelectedCalendarIds([]);
      setSuccess('Successfully disconnected your Google account');
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      setError('Failed to disconnect Google account');
    } finally {
      setDisconnecting(false);
    }
  };

  const handleCalendarToggle = async (calendarId: string) => {
    const newSelected = selectedCalendarIds.includes(calendarId)
      ? selectedCalendarIds.filter((id) => id !== calendarId)
      : [...selectedCalendarIds, calendarId];

    try {
      setSyncing(true);
      await updateSelectedCalendars(newSelected);
      setSelectedCalendarIds(newSelected);
    } catch (err) {
      setError('Failed to update calendar selection');
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-gray-500">
          Connect your personal Google Workspace account to sync your calendar and enable email features.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
          <AlertTriangle className="h-5 w-5 text-red-500" />
          <p className="text-sm font-medium">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto opacity-70 hover:opacity-100">
            &times;
          </button>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4 text-green-800">
          <CheckCircle className="h-5 w-5 text-green-500" />
          <p className="text-sm font-medium">{success}</p>
          <button onClick={() => setSuccess(null)} className="ml-auto opacity-70 hover:opacity-100">
            &times;
          </button>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-green-500">
              <svg className="h-8 w-8 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900">Google Workspace</h3>
              <p className="mt-1 text-sm text-gray-500">
                Connect to sync your calendar and enable email integration
              </p>
            </div>
            {connection?.connected ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-sm font-medium text-green-700">
                <CheckCircle className="h-4 w-4" />
                Connected
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-600">
                <XCircle className="h-4 w-4" />
                Not Connected
              </span>
            )}
          </div>
        </div>

        {connection?.connected ? (
          <div className="border-t border-gray-100 bg-gray-50 p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">{connection.email}</p>
                {connection.connectedAt && (
                  <p className="text-xs text-gray-500">
                    Connected {new Date(connection.connectedAt).toLocaleDateString()}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => loadConnection()}
                  disabled={syncing}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
                <button
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  {disconnecting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Disconnect'
                  )}
                </button>
              </div>
            </div>

            {connection.tokenExpired && (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm">Your connection has expired. Please reconnect to restore access.</span>
                <button
                  onClick={handleConnect}
                  className="ml-auto text-sm font-medium text-amber-700 hover:text-amber-900"
                >
                  Reconnect
                </button>
              </div>
            )}

            <div className="space-y-3">
              <button
                onClick={() => setShowCalendarSettings(!showCalendarSettings)}
                className="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-white p-4 text-left hover:border-gray-300"
              >
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="font-medium text-gray-900">Calendar Sync</p>
                    <p className="text-sm text-gray-500">
                      {selectedCalendarIds.length} calendar{selectedCalendarIds.length !== 1 ? 's' : ''} selected
                    </p>
                  </div>
                </div>
                <ExternalLink className="h-4 w-4 text-gray-400" />
              </button>

              <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-4">
                <Mail className="h-5 w-5 text-red-500" />
                <div>
                  <p className="font-medium text-gray-900">Email Integration</p>
                  <p className="text-sm text-gray-500">
                    Enabled for sending and receiving messages
                  </p>
                </div>
              </div>
            </div>

            {showCalendarSettings && calendars.length > 0 && (
              <div className="mt-4 rounded-lg border border-gray-200 bg-white p-4">
                <h4 className="mb-3 text-sm font-medium text-gray-900">Select Calendars to Sync</h4>
                <div className="space-y-2">
                  {calendars.map((cal) => (
                    <label
                      key={cal.id}
                      className="flex items-center gap-3 rounded-lg p-2 hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedCalendarIds.includes(cal.id)}
                        onChange={() => handleCalendarToggle(cal.id)}
                        disabled={syncing}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">
                          {cal.name}
                          {cal.primary && (
                            <span className="ml-2 text-xs text-gray-500">(Primary)</span>
                          )}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="border-t border-gray-100 bg-gray-50 p-6">
            <div className="text-center">
              <p className="mb-4 text-sm text-gray-600">
                Connect your Google Workspace account to:
              </p>
              <ul className="mb-6 space-y-2 text-sm text-gray-600">
                <li className="flex items-center justify-center gap-2">
                  <Calendar className="h-4 w-4 text-blue-500" />
                  Sync your calendar for scheduling
                </li>
                <li className="flex items-center justify-center gap-2">
                  <Mail className="h-4 w-4 text-red-500" />
                  Send and receive emails through the platform
                </li>
              </ul>
              <button
                onClick={handleConnect}
                disabled={connecting}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {connecting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    Connect Google Workspace
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h4 className="text-sm font-medium text-gray-900">About Google Workspace Integration</h4>
        <p className="mt-2 text-sm text-gray-500">
          Your Google Workspace connection is personal to your account. It enables calendar synchronization
          for appointment scheduling and allows you to send/receive emails through the platform using your
          Google account.
        </p>
        <p className="mt-2 text-sm text-gray-500">
          Only one Google account can be connected per user. Your credentials are securely stored and
          can be revoked at any time.
        </p>
      </div>
    </div>
  );
}
