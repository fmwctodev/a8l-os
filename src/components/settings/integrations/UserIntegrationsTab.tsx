import { useState, useEffect } from 'react';
import { User, CheckCircle, XCircle, Calendar, Mail } from 'lucide-react';
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
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {isAdmin && (
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700">Filter by User:</label>
          <select
            value={selectedUserId || ''}
            onChange={(e) => setSelectedUserId(e.target.value || null)}
            className="rounded-lg border border-gray-300 py-2 pl-3 pr-8 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
          <User className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">No User Integrations</h3>
          <p className="mt-2 text-sm text-gray-500">
            User-level integrations like personal calendars will appear here once connected.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {usersWithConnections.map(({ user, connections }) => (
            <div key={user.id} className="rounded-lg border border-gray-200 bg-white">
              <div className="border-b border-gray-200 px-6 py-4">
                <div className="flex items-center gap-3">
                  {user.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt={user.name || ''}
                      className="h-10 w-10 rounded-full"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 text-gray-500">
                      <User className="h-5 w-5" />
                    </div>
                  )}
                  <div>
                    <div className="font-medium text-gray-900">{user.name || 'Unknown'}</div>
                    <div className="text-sm text-gray-500">{user.email}</div>
                  </div>
                </div>
              </div>
              <div className="divide-y divide-gray-100">
                {connections.length === 0 ? (
                  <div className="px-6 py-4 text-sm text-gray-500">
                    No personal integrations connected
                  </div>
                ) : (
                  connections.map((conn) => {
                    const Icon = getIntegrationIcon((conn as any).integrations?.key || '');
                    return (
                      <div
                        key={conn.id}
                        className="flex items-center justify-between px-6 py-4"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100">
                            <Icon className="h-4 w-4 text-gray-500" />
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">
                              {(conn as any).integrations?.name || 'Unknown'}
                            </div>
                            <div className="text-sm text-gray-500">
                              {conn.account_info?.email || conn.account_info?.name || '-'}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-sm text-gray-500">
                            Connected {formatDate(conn.connected_at)}
                          </span>
                          {conn.status === 'connected' ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700">
                              <CheckCircle className="h-3 w-3" />
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-700">
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
