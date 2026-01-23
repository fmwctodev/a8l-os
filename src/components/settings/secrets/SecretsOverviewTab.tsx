import { useState, useEffect } from 'react';
import { Key, Shield, AlertTriangle, Clock, FolderKey, TrendingUp } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import * as secretsService from '../../../services/secrets';

interface Props {
  onNavigate: (tab: string) => void;
}

export function SecretsOverviewTab({ onNavigate }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalSecrets: 0,
    categories: 0,
    expiringSoon: 0,
    expired: 0,
    recentlyUsed: 0,
  });

  useEffect(() => {
    if (user?.organization_id) {
      loadStats();
    }
  }, [user?.organization_id]);

  const loadStats = async () => {
    if (!user?.organization_id) return;

    try {
      setLoading(true);
      const [secretsResult, categories] = await Promise.all([
        secretsService.getSecrets(user.organization_id, { include_expired: true }),
        secretsService.getCategories(user.organization_id),
      ]);

      const now = new Date();
      const twoWeeksFromNow = new Date();
      twoWeeksFromNow.setDate(twoWeeksFromNow.getDate() + 14);
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      let expiringSoon = 0;
      let expired = 0;
      let recentlyUsed = 0;

      for (const secret of secretsResult.data) {
        if (secret.expires_at) {
          const expiryDate = new Date(secret.expires_at);
          if (expiryDate < now) {
            expired++;
          } else if (expiryDate <= twoWeeksFromNow) {
            expiringSoon++;
          }
        }
        if (secret.last_used_at) {
          const lastUsed = new Date(secret.last_used_at);
          if (lastUsed >= oneWeekAgo) {
            recentlyUsed++;
          }
        }
      }

      setStats({
        totalSecrets: secretsResult.pagination.total,
        categories: categories.length,
        expiringSoon,
        expired,
        recentlyUsed,
      });
    } catch (err) {
      console.error('Failed to load stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      label: 'Total Secrets',
      value: stats.totalSecrets,
      icon: Key,
      color: 'blue',
      onClick: () => onNavigate('secrets'),
    },
    {
      label: 'Categories',
      value: stats.categories,
      icon: FolderKey,
      color: 'emerald',
      onClick: () => onNavigate('categories'),
    },
    {
      label: 'Recently Used',
      value: stats.recentlyUsed,
      subtext: 'Last 7 days',
      icon: TrendingUp,
      color: 'cyan',
      onClick: () => onNavigate('logs'),
    },
    {
      label: 'Expiring Soon',
      value: stats.expiringSoon,
      subtext: 'Next 14 days',
      icon: Clock,
      color: 'amber',
      alert: stats.expiringSoon > 0,
      onClick: () => onNavigate('secrets'),
    },
    {
      label: 'Expired',
      value: stats.expired,
      icon: AlertTriangle,
      color: 'red',
      alert: stats.expired > 0,
      onClick: () => onNavigate('secrets'),
    },
  ];

  const getColorClasses = (color: string, alert?: boolean) => {
    const colors: Record<string, { bg: string; icon: string; text: string }> = {
      blue: { bg: 'bg-blue-50', icon: 'text-blue-600', text: 'text-blue-900' },
      emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-600', text: 'text-emerald-900' },
      cyan: { bg: 'bg-cyan-50', icon: 'text-cyan-600', text: 'text-cyan-900' },
      amber: { bg: 'bg-amber-50', icon: 'text-amber-600', text: 'text-amber-900' },
      red: { bg: 'bg-red-50', icon: 'text-red-600', text: 'text-red-900' },
    };
    return colors[color] || colors.blue;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          const colors = getColorClasses(stat.color, stat.alert);
          return (
            <button
              key={stat.label}
              onClick={stat.onClick}
              className={`relative overflow-hidden rounded-xl p-5 ${colors.bg} text-left transition-all hover:shadow-md hover:scale-[1.02]`}
            >
              {stat.alert && (
                <div className="absolute top-2 right-2">
                  <span className="flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                  </span>
                </div>
              )}
              <div className="flex items-center gap-3">
                <div className={`rounded-lg p-2 ${colors.bg}`}>
                  <Icon className={`h-5 w-5 ${colors.icon}`} />
                </div>
                <div>
                  <p className={`text-2xl font-bold ${colors.text}`}>{stat.value}</p>
                  <p className="text-sm text-gray-600">{stat.label}</p>
                  {stat.subtext && (
                    <p className="text-xs text-gray-400">{stat.subtext}</p>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">Security Overview</h3>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">Encryption</span>
              <span className="flex items-center gap-1 text-sm font-medium text-emerald-600">
                <Shield className="h-4 w-4" />
                AES-256 (Vault)
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">Access Control</span>
              <span className="text-sm font-medium text-emerald-600">Role-Based</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">Audit Logging</span>
              <span className="text-sm font-medium text-emerald-600">Enabled</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-gray-600">Auto-Scan Schedule</span>
              <span className="text-sm font-medium text-gray-900">Every 6 hours</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => onNavigate('secrets')}
              className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Key className="h-4 w-4 text-blue-600" />
              Add New Secret
            </button>
            <button
              onClick={() => onNavigate('categories')}
              className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <FolderKey className="h-4 w-4 text-emerald-600" />
              Manage Categories
            </button>
            <button
              onClick={() => onNavigate('logs')}
              className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Clock className="h-4 w-4 text-cyan-600" />
              View Usage Logs
            </button>
            <button
              onClick={() => onNavigate('scan')}
              className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Shield className="h-4 w-4 text-amber-600" />
              Run Security Scan
            </button>
          </div>
        </div>
      </div>

      {(stats.expired > 0 || stats.expiringSoon > 0) && (
        <div className={`rounded-xl p-4 ${stats.expired > 0 ? 'bg-red-50 border border-red-200' : 'bg-amber-50 border border-amber-200'}`}>
          <div className="flex items-start gap-3">
            <AlertTriangle className={`h-5 w-5 ${stats.expired > 0 ? 'text-red-600' : 'text-amber-600'}`} />
            <div>
              <h4 className={`font-medium ${stats.expired > 0 ? 'text-red-900' : 'text-amber-900'}`}>
                {stats.expired > 0 ? 'Attention Required' : 'Upcoming Expirations'}
              </h4>
              <p className={`text-sm mt-1 ${stats.expired > 0 ? 'text-red-700' : 'text-amber-700'}`}>
                {stats.expired > 0 && `${stats.expired} secret(s) have expired. `}
                {stats.expiringSoon > 0 && `${stats.expiringSoon} secret(s) will expire in the next 14 days.`}
              </p>
              <button
                onClick={() => onNavigate('secrets')}
                className={`mt-2 text-sm font-medium ${stats.expired > 0 ? 'text-red-700 hover:text-red-800' : 'text-amber-700 hover:text-amber-800'}`}
              >
                Review secrets &rarr;
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
