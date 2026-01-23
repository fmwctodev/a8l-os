import { useAuth } from '../contexts/AuthContext';
import {
  Users,
  MessageSquare,
  Target,
  Calendar,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon: React.ReactNode;
}

function StatCard({ title, value, change, changeType = 'neutral', icon }: StatCardProps) {
  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-400 mb-1">{title}</p>
          <p className="text-2xl font-semibold text-white">{value}</p>
          {change && (
            <p
              className={`text-xs mt-1 ${
                changeType === 'positive'
                  ? 'text-emerald-400'
                  : changeType === 'negative'
                  ? 'text-red-400'
                  : 'text-slate-400'
              }`}
            >
              {change}
            </p>
          )}
        </div>
        <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center">
          {icon}
        </div>
      </div>
    </div>
  );
}

interface ActivityItemProps {
  title: string;
  description: string;
  time: string;
  icon: React.ReactNode;
  iconBg: string;
}

function ActivityItem({ title, description, time, icon, iconBg }: ActivityItemProps) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-800/50 transition-colors">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${iconBg}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white font-medium">{title}</p>
        <p className="text-xs text-slate-400 truncate">{description}</p>
      </div>
      <span className="text-xs text-slate-500 flex-shrink-0">{time}</span>
    </div>
  );
}

export function Dashboard() {
  const { user } = useAuth();

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">
          {greeting()}, {user?.name?.split(' ')[0]}
        </h1>
        <p className="text-slate-400 mt-1">Here's what's happening with your CRM today.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Contacts"
          value="--"
          change="Module not active"
          changeType="neutral"
          icon={<Users className="w-5 h-5 text-cyan-400" />}
        />
        <StatCard
          title="Open Conversations"
          value="--"
          change="Module not active"
          changeType="neutral"
          icon={<MessageSquare className="w-5 h-5 text-teal-400" />}
        />
        <StatCard
          title="Active Opportunities"
          value="--"
          change="Module not active"
          changeType="neutral"
          icon={<Target className="w-5 h-5 text-amber-400" />}
        />
        <StatCard
          title="Upcoming Appointments"
          value="--"
          change="Module not active"
          changeType="neutral"
          icon={<Calendar className="w-5 h-5 text-rose-400" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
          <h2 className="text-lg font-semibold text-white mb-4">Recent Activity</h2>
          <div className="space-y-1">
            <ActivityItem
              title="System Initialized"
              description="Autom8ion Lab OS is ready for configuration"
              time="Just now"
              icon={<CheckCircle2 className="w-4 h-4 text-emerald-400" />}
              iconBg="bg-emerald-500/10"
            />
            <ActivityItem
              title="Modules Pending"
              description="Feature modules are awaiting activation"
              time="Just now"
              icon={<Clock className="w-4 h-4 text-amber-400" />}
              iconBg="bg-amber-500/10"
            />
            <ActivityItem
              title="Welcome"
              description={`${user?.name} logged in as ${user?.role?.name}`}
              time="Just now"
              icon={<TrendingUp className="w-4 h-4 text-cyan-400" />}
              iconBg="bg-cyan-500/10"
            />
          </div>
        </div>

        <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
          <h2 className="text-lg font-semibold text-white mb-4">System Status</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-sm text-white">Database</span>
              </div>
              <span className="text-xs text-emerald-400">Connected</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-sm text-white">Authentication</span>
              </div>
              <span className="text-xs text-emerald-400">Active</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-amber-400" />
                <span className="text-sm text-white">Feature Modules</span>
              </div>
              <span className="text-xs text-amber-400">Pending Setup</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center flex-shrink-0">
            <AlertCircle className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h3 className="text-white font-medium">Phase 0 Complete</h3>
            <p className="text-sm text-slate-400 mt-1">
              The core CRM foundation is ready. Feature modules (Contacts, Conversations, Calendars, etc.)
              are not yet implemented. Enable them via feature flags when ready to build.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
