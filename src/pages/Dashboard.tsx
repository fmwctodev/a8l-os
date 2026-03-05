import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Users,
  MessageSquare,
  Target,
  Calendar,
  RefreshCw,
  UserPlus,
  Send,
  FileText,
  CalendarPlus,
  DollarSign,
  Receipt,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useDashboardData } from '../hooks/useDashboardData';
import { useUserDashboardAnalytics } from '../hooks/useUserDashboardAnalytics';
import { getGreeting, type DateRange } from '../services/dashboard';
import { usePermission } from '../hooks/usePermission';
import {
  StatCard,
  QuickActionButton,
  QueuePanel,
  AppointmentsList,
  ActivityFeed,
  CreateContactDrawer,
  ComposeMessageDrawer,
  CreateOpportunityDrawer,
  CreateInvoiceDrawer,
  BookAppointmentDrawer,
} from '../components/dashboard';
import { TimeRangeSelector, ExportButton } from '../components/analytics';
import { SystemDashboard } from './SystemDashboard';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function Dashboard() {
  const { user, isSuperAdmin } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const mode = searchParams.get('mode');
  const [refreshing, setRefreshing] = useState(false);
  const [createContactOpen, setCreateContactOpen] = useState(false);
  const [composeMessageOpen, setComposeMessageOpen] = useState(false);
  const [createOpportunityOpen, setCreateOpportunityOpen] = useState(false);
  const [createInvoiceOpen, setCreateInvoiceOpen] = useState(false);
  const [bookAppointmentOpen, setBookAppointmentOpen] = useState(false);

  const {
    data: analytics,
    loading: analyticsLoading,
    timeRange,
    startDate,
    endDate,
    setTimeRange,
    refetch: refetchAnalytics,
    exportToPDF,
  } = useUserDashboardAnalytics();

  const dateRange: DateRange = (() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endDate = new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString();
    if (timeRange === 'custom' && startDate && endDate) {
      return { label: 'Custom', startDate, endDate };
    }
    const days = timeRange === '7d' ? 7 : timeRange === '90d' ? 90 : 30;
    return {
      label: `Last ${days} Days`,
      startDate: new Date(today.getTime() - days * 24 * 60 * 60 * 1000).toISOString(),
      endDate,
    };
  })();

  const {
    stats,
    conversations,
    tasks,
    appointments,
    activity,
    loading,
    activityFilter,
    setActivityFilter,
    refetch,
  } = useDashboardData(dateRange);

  const canCreateContact = usePermission('contacts.create');
  const canSendMessage = usePermission('conversations.send');
  const canCreateOpportunity = usePermission('opportunities.create');
  const canCreateInvoice = usePermission('invoices.create');
  const canCreateAppointment = usePermission('appointments.create');

  if (isSuperAdmin && mode === 'system') {
    return <SystemDashboard />;
  }

  async function handleRefresh() {
    setRefreshing(true);
    await Promise.all([refetch(), refetchAnalytics()]);
    setTimeout(() => setRefreshing(false), 500);
  }

  function handleDrawerSuccess() {
    refetch();
    refetchAnalytics();
  }

  function formatNextAppointment(): string | undefined {
    if (!stats?.nextAppointmentTime) return undefined;
    const date = new Date(stats.nextAppointmentTime);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const isTomorrow =
      date.toDateString() === new Date(now.getTime() + 86400000).toDateString();

    const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    if (isToday) return `Next: Today ${time}`;
    if (isTomorrow) return `Next: Tomorrow ${time}`;
    return `Next: ${date.toLocaleDateString([], { weekday: 'short' })} ${time}`;
  }

  const isLoading = loading.stats || analyticsLoading;

  return (
    <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">
            {getGreeting()}, {user?.name?.split(' ')[0]}
          </h1>
          <p className="text-slate-400 mt-1">Here's what's happening today.</p>
        </div>
        <div className="flex items-center gap-3">
          {isSuperAdmin && (
            <div className="flex items-center bg-slate-800 border border-slate-700 rounded-lg p-1">
              <button className="px-3 py-1.5 text-sm text-white bg-slate-700 rounded">
                User Dashboard
              </button>
              <button
                onClick={() => setSearchParams({ mode: 'system' })}
                className="px-3 py-1.5 text-sm text-slate-400 hover:text-white transition-colors rounded"
              >
                System Dashboard
              </button>
            </div>
          )}
          <TimeRangeSelector
            value={timeRange}
            onChange={setTimeRange}
            startDate={startDate}
            endDate={endDate}
          />
          <ExportButton onExport={exportToPDF} disabled={!analytics} />
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          title="Total Contacts"
          value={analytics?.contacts.total ?? stats?.totalContacts ?? '--'}
          delta={analytics?.contacts.newInPeriod.deltaPercent}
          deltaType={
            analytics?.contacts.newInPeriod.trend === 'up'
              ? 'positive'
              : analytics?.contacts.newInPeriod.trend === 'down'
              ? 'negative'
              : 'neutral'
          }
          sublabel={
            analytics?.contacts.newInPeriod
              ? `+${analytics.contacts.newInPeriod.current} new this period`
              : undefined
          }
          icon={Users}
          accentColor="cyan"
          onClick={() => navigate('/contacts')}
          isLoading={isLoading}
        />
        <StatCard
          title="Active Conversations"
          value={analytics?.conversations.active ?? stats?.openConversations ?? '--'}
          delta={analytics?.conversations.messagesSent.deltaPercent}
          deltaType={
            analytics?.conversations.messagesSent.trend === 'up'
              ? 'positive'
              : analytics?.conversations.messagesSent.trend === 'down'
              ? 'negative'
              : 'neutral'
          }
          sublabel={
            analytics?.conversations.messagesSent
              ? `${analytics.conversations.messagesSent.current} messages sent`
              : stats?.unreadConversations
              ? `${stats.unreadConversations} unread`
              : undefined
          }
          icon={MessageSquare}
          accentColor="teal"
          onClick={() =>
            navigate(
              stats?.unreadConversations
                ? '/conversations?filter=unread'
                : '/conversations'
            )
          }
          isLoading={isLoading}
        />
        <StatCard
          title="Open Opportunities"
          value={analytics?.opportunities.open ?? stats?.activeOpportunities ?? '--'}
          delta={analytics?.opportunities.winRate.deltaPercent}
          deltaType={
            analytics?.opportunities.winRate.trend === 'up'
              ? 'positive'
              : analytics?.opportunities.winRate.trend === 'down'
              ? 'negative'
              : 'neutral'
          }
          sublabel={
            analytics?.opportunities.pipelineValue
              ? `${formatCurrency(analytics.opportunities.pipelineValue.current)} pipeline`
              : undefined
          }
          icon={Target}
          accentColor="amber"
          onClick={() => navigate('/opportunities')}
          isLoading={isLoading}
        />
        <StatCard
          title="Upcoming Appointments"
          value={analytics?.appointments.upcoming ?? stats?.upcomingAppointments ?? '--'}
          delta={analytics?.appointments.completedInPeriod.deltaPercent}
          deltaType={
            analytics?.appointments.completedInPeriod.trend === 'up'
              ? 'positive'
              : analytics?.appointments.completedInPeriod.trend === 'down'
              ? 'negative'
              : 'neutral'
          }
          sublabel={formatNextAppointment()}
          icon={Calendar}
          accentColor="rose"
          onClick={() => navigate('/calendars')}
          isLoading={isLoading}
        />
        <StatCard
          title="Total Paid"
          value={
            analytics?.revenue.totalPaid != null
              ? formatCurrency(analytics.revenue.totalPaid)
              : '--'
          }
          delta={analytics?.revenue.paidInPeriod.deltaPercent}
          deltaType={
            analytics?.revenue.paidInPeriod.trend === 'up'
              ? 'positive'
              : analytics?.revenue.paidInPeriod.trend === 'down'
              ? 'negative'
              : 'neutral'
          }
          sublabel={
            analytics?.revenue.paidInPeriod
              ? `${formatCurrency(analytics.revenue.paidInPeriod.current)} collected this period`
              : 'All paid invoices'
          }
          icon={Receipt}
          accentColor="emerald"
          onClick={() => navigate('/payments')}
          isLoading={isLoading}
        />
        <StatCard
          title="Outstanding"
          value={
            analytics?.revenue.outstanding != null
              ? formatCurrency(analytics.revenue.outstanding)
              : '--'
          }
          sublabel="Unpaid invoices"
          icon={DollarSign}
          accentColor="amber"
          onClick={() => navigate('/payments')}
          isLoading={isLoading}
        />
      </div>

      <div>
        <h2 className="text-sm font-medium text-slate-400 mb-3">Quick Actions</h2>
        <div className="flex flex-wrap gap-3 justify-center">
          <QuickActionButton
            icon={UserPlus}
            label="Add Contact"
            onClick={() => setCreateContactOpen(true)}
            disabled={!canCreateContact}
            iconColor="text-cyan-400"
          />
          <QuickActionButton
            icon={Send}
            label="New Message"
            onClick={() => setComposeMessageOpen(true)}
            disabled={!canSendMessage}
            iconColor="text-teal-400"
          />
          <QuickActionButton
            icon={Target}
            label="Create Opportunity"
            onClick={() => setCreateOpportunityOpen(true)}
            disabled={!canCreateOpportunity}
            iconColor="text-amber-400"
          />
          <QuickActionButton
            icon={FileText}
            label="Create Invoice"
            onClick={() => setCreateInvoiceOpen(true)}
            disabled={!canCreateInvoice}
            iconColor="text-emerald-400"
          />
          <QuickActionButton
            icon={CalendarPlus}
            label="Book Appointment"
            onClick={() => setBookAppointmentOpen(true)}
            disabled={!canCreateAppointment}
            iconColor="text-rose-400"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <QueuePanel
          conversations={conversations}
          tasks={tasks}
          onConversationClick={(conv) => navigate(`/conversations?id=${conv.id}`)}
          onTaskClick={(task) => navigate(`/contacts/${task.contact_id}`)}
          isLoading={loading.conversations || loading.tasks}
        />
        <AppointmentsList appointments={appointments} isLoading={loading.appointments} />
      </div>

      <ActivityFeed
        events={activity}
        activeFilter={activityFilter}
        onFilterChange={setActivityFilter}
        onItemClick={(event) => {
          switch (event.entity_type) {
            case 'contact':
              navigate(`/contacts/${event.entity_id}`);
              break;
            case 'conversation':
              navigate(`/conversations?id=${event.entity_id}`);
              break;
            case 'opportunity':
              navigate(`/opportunities/${event.entity_id}`);
              break;
            case 'appointment':
              navigate(`/calendars`);
              break;
            case 'invoice':
              navigate(`/payments/invoices/${event.entity_id}`);
              break;
            default:
              break;
          }
        }}
        isLoading={loading.activity}
      />

      <CreateContactDrawer
        open={createContactOpen}
        onClose={() => setCreateContactOpen(false)}
        onSuccess={handleDrawerSuccess}
      />
      <ComposeMessageDrawer
        open={composeMessageOpen}
        onClose={() => setComposeMessageOpen(false)}
        onSuccess={handleDrawerSuccess}
      />
      <CreateOpportunityDrawer
        open={createOpportunityOpen}
        onClose={() => setCreateOpportunityOpen(false)}
        onSuccess={handleDrawerSuccess}
      />
      <CreateInvoiceDrawer
        open={createInvoiceOpen}
        onClose={() => setCreateInvoiceOpen(false)}
        onSuccess={handleDrawerSuccess}
      />
      <BookAppointmentDrawer
        open={bookAppointmentOpen}
        onClose={() => setBookAppointmentOpen(false)}
        onSuccess={handleDrawerSuccess}
      />
    </div>
  );
}
