import { useState, useEffect } from 'react';
import {
  Link2,
  Check,
  X,
  RefreshCw,
  AlertTriangle,
  ExternalLink,
  Search,
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import {
  getGoogleConnection,
  initiateGoogleOAuth,
  disconnectGoogle,
  getGoogleCalendarList,
  updateSelectedCalendars,
  testGoogleSync,
  getTeamConnections,
  openGoogleOAuthPopup,
  GoogleConnection,
  GoogleCalendarItem,
  TeamConnectionItem,
} from '../../../services/googleCalendarConnections';

export function ConnectionsTab() {
  const { user, hasPermission } = useAuth();
  const [loading, setLoading] = useState(true);
  const [connection, setConnection] = useState<GoogleConnection | null>(null);
  const [calendars, setCalendars] = useState<GoogleCalendarItem[]>([]);
  const [selectedCalendarIds, setSelectedCalendarIds] = useState<string[]>([]);
  const [teamConnections, setTeamConnections] = useState<TeamConnectionItem[]>([]);
  const [teamSearch, setTeamSearch] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [savingCalendars, setSavingCalendars] = useState(false);

  const isAdmin = hasPermission('calendars.manage_all');

  useEffect(() => {
    loadConnection();
    if (isAdmin) {
      loadTeamConnections();
    }
  }, [user, isAdmin]);

  const loadConnection = async () => {
    try {
      setLoading(true);
      const conn = await getGoogleConnection();
      setConnection(conn);

      if (conn.connected) {
        const { calendars: calList, selectedCalendarIds: selected } = await getGoogleCalendarList();
        setCalendars(calList);
        setSelectedCalendarIds(selected);
      }
    } catch (error) {
      console.error('Failed to load connection:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTeamConnections = async () => {
    try {
      const connections = await getTeamConnections();
      setTeamConnections(connections);
    } catch (error) {
      console.error('Failed to load team connections:', error);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const authUrl = await initiateGoogleOAuth();
      const result = await openGoogleOAuthPopup(authUrl);

      if (result.success) {
        await loadConnection();
      }
    } catch (error) {
      console.error('Failed to connect:', error);
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect Google Calendar? This will stop syncing busy times.')) {
      return;
    }

    setDisconnecting(true);
    try {
      await disconnectGoogle();
      setConnection({ connected: false });
      setCalendars([]);
      setSelectedCalendarIds([]);
    } catch (error) {
      console.error('Failed to disconnect:', error);
    } finally {
      setDisconnecting(false);
    }
  };

  const handleCalendarToggle = (calendarId: string) => {
    setSelectedCalendarIds((prev) =>
      prev.includes(calendarId)
        ? prev.filter((id) => id !== calendarId)
        : [...prev, calendarId]
    );
  };

  const handleSaveCalendars = async () => {
    setSavingCalendars(true);
    try {
      await updateSelectedCalendars(selectedCalendarIds);
    } catch (error) {
      console.error('Failed to save calendars:', error);
    } finally {
      setSavingCalendars(false);
    }
  };

  const handleTestSync = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testGoogleSync();
      setTestResult({
        success: result.success,
        message: result.message || result.error || 'Test completed',
      });
    } catch (error) {
      setTestResult({
        success: false,
        message: 'Failed to test sync',
      });
    } finally {
      setTesting(false);
    }
  };

  const filteredTeamConnections = teamConnections.filter(
    (c) =>
      c.userName.toLowerCase().includes(teamSearch.toLowerCase()) ||
      c.userEmail.toLowerCase().includes(teamSearch.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
        <h3 className="text-lg font-medium text-white mb-4">My Google Calendar Connection</h3>

        {!connection?.connected ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
            </div>
            <h4 className="text-white font-medium mb-2">Connect Google Calendar</h4>
            <p className="text-slate-400 text-sm mb-6 max-w-md mx-auto">
              Sync your Google Calendar to automatically block off busy times and prevent double-bookings.
            </p>
            <ul className="text-slate-400 text-sm mb-6 space-y-2 max-w-sm mx-auto text-left">
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                <span>Automatically check for conflicts</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                <span>Prevent double-bookings across calendars</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                <span>Read-only access to your calendar</span>
              </li>
            </ul>
            <button
              onClick={handleConnect}
              disabled={connecting}
              className="px-6 py-2.5 bg-white text-slate-900 rounded-lg font-medium hover:bg-slate-100 transition-colors flex items-center gap-2 mx-auto disabled:opacity-50"
            >
              {connecting ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  Connect with Google
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-500/20 rounded-full flex items-center justify-center">
                  <Check className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-white font-medium">Connected</p>
                  <p className="text-emerald-400 text-sm">{connection.email}</p>
                </div>
              </div>
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="px-3 py-1.5 text-red-400 hover:bg-red-500/10 rounded transition-colors text-sm"
              >
                {disconnecting ? 'Disconnecting...' : 'Disconnect'}
              </button>
            </div>

            {connection.tokenExpired && (
              <div className="flex items-center gap-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                <div className="flex-1">
                  <p className="text-amber-400 font-medium">Connection expired</p>
                  <p className="text-amber-400/80 text-sm">
                    Your Google Calendar connection has expired. Please reconnect.
                  </p>
                </div>
                <button
                  onClick={handleConnect}
                  className="px-3 py-1.5 bg-amber-500/20 text-amber-400 rounded hover:bg-amber-500/30 transition-colors text-sm"
                >
                  Reconnect
                </button>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-white font-medium">Calendars to check for conflicts</h4>
                <button
                  onClick={handleSaveCalendars}
                  disabled={savingCalendars}
                  className="text-cyan-400 hover:text-cyan-300 text-sm flex items-center gap-1"
                >
                  {savingCalendars ? 'Saving...' : 'Save Selection'}
                </button>
              </div>
              <div className="space-y-2">
                {calendars.map((cal) => (
                  <label
                    key={cal.id}
                    className="flex items-center gap-3 p-3 bg-slate-700/50 rounded-lg cursor-pointer hover:bg-slate-700"
                  >
                    <input
                      type="checkbox"
                      checked={selectedCalendarIds.includes(cal.id)}
                      onChange={() => handleCalendarToggle(cal.id)}
                      className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-cyan-500 focus:ring-cyan-500"
                    />
                    <span className="text-white">{cal.name}</span>
                    {cal.primary && (
                      <span className="text-xs px-2 py-0.5 bg-cyan-500/20 text-cyan-400 rounded">
                        Primary
                      </span>
                    )}
                  </label>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-700">
              <button
                onClick={handleTestSync}
                disabled={testing}
                className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors flex items-center gap-2"
              >
                {testing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    Test Sync
                  </>
                )}
              </button>
              {testResult && (
                <p
                  className={`mt-2 text-sm ${
                    testResult.success ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {testResult.message}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {isAdmin && (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-white">Team Connections</h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search team..."
                value={teamSearch}
                onChange={(e) => setTeamSearch(e.target.value)}
                className="pl-10 pr-4 py-1.5 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500 w-48"
              />
            </div>
          </div>

          <p className="text-slate-400 text-sm mb-4">
            View Google Calendar connection status for all team members. Users must connect their own accounts.
          </p>

          <div className="overflow-hidden rounded-lg border border-slate-700">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-700/50">
                  <th className="text-left px-4 py-2 text-slate-400 font-medium text-sm">User</th>
                  <th className="text-left px-4 py-2 text-slate-400 font-medium text-sm">Status</th>
                  <th className="text-left px-4 py-2 text-slate-400 font-medium text-sm">Google Account</th>
                  <th className="text-left px-4 py-2 text-slate-400 font-medium text-sm">Connected</th>
                </tr>
              </thead>
              <tbody>
                {filteredTeamConnections.map((conn) => (
                  <tr key={conn.userId} className="border-t border-slate-700/50">
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-white font-medium">{conn.userName}</p>
                        <p className="text-slate-400 text-sm">{conn.userEmail}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {conn.connected ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded text-xs">
                          <Check className="w-3 h-3" />
                          Connected
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-500/20 text-slate-400 rounded text-xs">
                          <X className="w-3 h-3" />
                          Not Connected
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {conn.googleEmail || '-'}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-sm">
                      {conn.connectedAt
                        ? new Date(conn.connectedAt).toLocaleDateString()
                        : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredTeamConnections.length === 0 && (
              <div className="text-center py-8 text-slate-400">
                No team members found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
