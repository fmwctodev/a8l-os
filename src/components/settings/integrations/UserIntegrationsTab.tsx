import { useState, useEffect } from 'react';
import { User, CheckCircle, XCircle, Calendar, Mail, Loader2, Clock } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { getUserIntegrations } from '../../../services/integrations';
import { supabase } from '../../../lib/supabase';
import type { IntegrationConnection, User as UserType } from '../../../types';

interface UserWithConnections {
  user: UserType;
  connections: IntegrationConnection[];
}

export function UserIntegrationsTab() {
  const { user: currentUser, hasPermission } = useAuth();
  const [usersWithConnections, setUsersWithConnections] = useState<UserWithConnections[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [users, setUsers] = useState<UserType[]>([]);

  const isAdmin = hasPermission('integrations.manage');

  useEffect(() => {
    loadData();
  }, [selectedUserId]);

  const loadData = async () => {
    try {
      setLoading(true);

      if (isAdmin) {
        const { data: usersData } = await supabase
          .from('users')
          .select('id, name, email, avatar_url, department:departments(id, name)')
          .eq('status', 'active')
          .order('name');

        setUsers(usersData || []);

        const connections = await getUserIntegrations(selectedUserId || undefined);

        const grouped = (usersData || []).map((u) => ({
          user: u as UserType,
          connections: connections.filter((c) => c.user_id === u.id),
        }));

        setUsersWithConnections(grouped.filter((g) => g.connections.length > 0 || g.user.id === selectedUserId));
      } else {
        const myConnections = await getUserIntegrations(currentUser?.id);
        if (currentUser) {
          setUsersWithConnections([
            {
              user: currentUser as UserType,
              connections: myConnections,
            },
          ]);
        }
      }
    } catch (error) {
      console.error('Failed to load user integrations:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Unknown';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getIntegrationIcon = (key: string) => {
    if (key.includes('calendar')) return Calendar;
    if (key.includes('email') || key.includes('gmail')) return Mail;
    return User;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {isAdmin && (
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-slate-300">Filter by User:</label>
          <select
            value={selectedUserId || ''}
            onChange={(e) => setSelectedUserId(e.target.value || null)}
            className="rounded-lg border border-slate-700 bg-slate-800 py-2 pl-3 pr-8 text-sm text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          >
            <option value="">All Users</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name || u.email}
              </option>
            ))}
          </select>
        </div>
      )}

      {usersWithConnections.length === 0 ? (
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-12 text-center">
          <User className="mx-auto h-12 w-12 text-slate-600" />
          <h3 className="mt-4 text-lg font-medium text-white">No User Integrations</h3>
          <p className="mt-2 text-sm text-slate-400">
            User-level integrations like personal calendars will appear here once connected.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {usersWithConnections.map(({ user, connections }) => (
            <div key={user.id} className="rounded-lg border border-slate-700 bg-slate-800 overflow-hidden">
              <div className="border-b border-slate-700 bg-slate-800/50 px-6 py-4">
                <div className="flex items-center gap-3">
                  {user.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt={user.name || ''}
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-700 text-slate-400">
                      <User className="h-5 w-5" />
                    </div>
                  )}
                  <div>
                    <div className="font-medium text-white">{user.name || 'Unknown'}</div>
                    <div className="text-sm text-slate-400">{user.email}</div>
                  </div>
                </div>
              </div>
              <div className="divide-y divide-slate-700/50">
                {connections.length === 0 ? (
                  <div className="px-6 py-4 text-sm text-slate-500">
                    No personal integrations connected
                  </div>
                ) : (
                  connections.map((conn) => {
                    const Icon = getIntegrationIcon((conn as any).integrations?.key || '');
                    return (
                      <div
                        key={conn.id}
                        className="flex items-center justify-between px-6 py-4 transition-colors hover:bg-slate-800/50"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-700">
                            <Icon className="h-4 w-4 text-slate-400" />
                          </div>
                          <div>
                            <div className="font-medium text-white">
                              {(conn as any).integrations?.name || 'Unknown'}
                            </div>
                            <div className="text-sm text-slate-500">
                              {conn.account_info?.email || conn.account_info?.name || '-'}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="flex items-center gap-2 text-sm text-slate-500">
                            <Clock className="h-4 w-4" />
                            <span>Connected {formatDate(conn.connected_at)}</span>
                          </div>
                          {conn.status === 'connected' ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400">
                              <CheckCircle className="h-3 w-3" />
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-400">
                              <XCircle className="h-3 w-3" />
                              {conn.status}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
