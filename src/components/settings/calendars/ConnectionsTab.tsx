import { useState, useEffect } from 'react';
import {
  Check,
  X,
  Search,
  Calendar,
  RefreshCw,
  Clock,
  Link2,
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import {
  getGoogleConnection,
  getTeamConnections,
  type GoogleConnection,
  type TeamConnectionItem,
} from '../../../services/googleCalendarConnections';
import { getSyncStatus } from '../../../services/googleCalendarEvents';
import {
  initiateUnifiedGoogleOAuth,
  openUnifiedGoogleOAuthPopup,
} from '../../../services/googleOAuthUnified';
import { useToast } from '../../../contexts/ToastContext';

export function ConnectionsTab() {
  const { user, isSuperAdmin } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [connection, setConnection] = useState<GoogleConnection | null>(null);
  const [teamConnections, setTeamConnections] = useState<TeamConnectionItem[]>([]);
  const [teamSearch, setTeamSearch] = useState('');
  const [syncStatus, setSyncStatus] = useState<{
    connected: boolean; syncEnabled: boolean;
    lastFullSync: string | null; lastIncrementalSync: string | null;
    pendingJobs: number;
  } | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [conn] = await Promise.all([
          getGoogleConnection().catch(() => ({ connected: false }) as GoogleConnection),
          ...(isSuperAdmin ? [loadTeamConnections()] : []),
        ]);
        setConnection(conn);
        if (user?.id) {
          getSyncStatus(user.id).then(setSyncStatus).catch(() => {});
        }
      } catch (error) {
        console.error('Failed to load connections:', error);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user, isSuperAdmin]);

  async function handleConnect() {
    setConnecting(true);
    try {
      const authUrl = await initiateUnifiedGoogleOAuth();
      const result = await openUnifiedGoogleOAuthPopup(authUrl);

      const conn = await getGoogleConnection().catch(() => ({ connected: false }) as GoogleConnection);
      setConnection(conn);

      if (result.success || conn.connected) {
        showToast('Google Calendar connected successfully', 'success');
        if (user?.id) {
          getSyncStatus(user.id).then(setSyncStatus).catch(() => {});
        }
      } else if (result.error && result.error !== 'Popup closed') {
        showToast(result.error, 'error');
      }
    } catch (error) {
      console.error('Failed to connect:', error);
      showToast('Failed to connect Google Calendar', 'error');
    } finally {
      setConnecting(false);
    }
  }

  async function loadTeamConnections() {
    try {
      const connections = await getTeamConnections();
      setTeamConnections(connections);
    } catch (error) {
      console.error('Failed to load team connections:', error);
    }
  }

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
        <div className="flex items-center gap-3 mb-4">
          <Calendar className="w-5 h-5 text-cyan-400" />
          <h3 className="text-lg font-medium text-white">My Google Calendar Connection</h3>
        </div>

        <div className="flex items-center justify-between p-4 bg-slate-700/30 rounded-lg">
          <div>
            {connection?.connected ? (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-white font-medium">Connected</span>
                <span className="text-slate-400 text-sm">({connection.email})</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-slate-500" />
                <span className="text-slate-400">Not connected</span>
              </div>
            )}
            <p className="text-slate-500 text-sm mt-1">
              {connection?.connected
                ? 'Your Google Calendar is connected and syncing.'
                : 'Connect your Google Calendar to enable two-way sync.'}
            </p>
          </div>
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors flex items-center gap-2 text-sm font-medium whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {connecting ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Link2 className="w-4 h-4" />
            )}
            {connecting ? 'Connecting...' : connection?.connected ? 'Reconnect' : 'Connect'}
          </button>
        </div>

        {syncStatus?.connected && (
          <div className="mt-4 p-4 bg-slate-700/30 rounded-lg space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <RefreshCw className="w-4 h-4 text-cyan-400" />
              <span className="text-white font-medium">2-Way Sync Status</span>
              {syncStatus.syncEnabled ? (
                <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded text-xs">
                  <Check className="w-3 h-3" />
                  Active
                </span>
              ) : (
                <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 bg-slate-500/20 text-slate-400 rounded text-xs">
                  Disabled
                </span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-4 text-xs">
              <div>
                <p className="text-slate-500 mb-0.5">Last Full Sync</p>
                <p className="text-slate-300 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {syncStatus.lastFullSync
                    ? new Date(syncStatus.lastFullSync).toLocaleString()
                    : 'Never'}
                </p>
              </div>
              <div>
                <p className="text-slate-500 mb-0.5">Last Incremental Sync</p>
                <p className="text-slate-300 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {syncStatus.lastIncrementalSync
                    ? new Date(syncStatus.lastIncrementalSync).toLocaleString()
                    : 'Never'}
                </p>
              </div>
              <div>
                <p className="text-slate-500 mb-0.5">Pending Jobs</p>
                <p className="text-slate-300">{syncStatus.pendingJobs}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {isSuperAdmin && (
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
            View Google Calendar connection status for all team members. Users must connect their own accounts from their profile settings.
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
