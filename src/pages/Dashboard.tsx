import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  MessageSquare,
  Target,
  Calendar,
  RefreshCw,
  UserPlus,
  Send,
  FileText,
  Bot,
  CalendarPlus,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useDashboardData } from '../hooks/useDashboardData';
import { getGreeting, getDateRangePresets, type DateRange } from '../services/dashboard';
import { usePermission } from '../hooks/usePermission';
import {
  StatCard,
  QuickActionButton,
  QueuePanel,
  AppointmentsList,
  ActivityFeed,
  SystemHealthIndicator,
  DateRangeSelector,
  CreateContactDrawer,
  ComposeMessageDrawer,
  CreateOpportunityDrawer,
  CreateInvoiceDrawer,
  BookAppointmentDrawer,
  RunAgentDrawer,
} from '../components/dashboard';

export function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dateRange, setDateRange] = useState<DateRange>(getDateRangePresets()[1]);
  const [refreshing, setRefreshing] = useState(false);

  const [createContactOpen, setCreateContactOpen] = useState(false);
  const [composeMessageOpen, setComposeMessageOpen] = useState(false);
  const [createOpportunityOpen, setCreateOpportunityOpen] = useState(false);
  const [createInvoiceOpen, setCreateInvoiceOpen] = useState(false);
  const [bookAppointmentOpen, setBookAppointmentOpen] = useState(false);
  const [runAgentOpen, setRunAgentOpen] = useState(false);

  const {
    stats,
    conversations,
    tasks,
    appointments,
    activity,
    systemHealth,
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
  const canRunAgent = usePermission('ai_agents.run');

  async function handleRefresh() {
    setRefreshing(true);
    await refetch();
    setTimeout(() => setRefreshing(false), 500);
  }

  function handleDrawerSuccess() {
    refetch();
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
          <DateRangeSelector value={dateRange} onChange={setDateRange} />
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Contacts"
          value={stats?.totalContacts ?? '--'}
          icon={Users}
          accentColor="cyan"
          onClick={() => navigate('/contacts')}
          isLoading={loading.stats}
        />
        <StatCard
          title="Open Conversations"
          value={stats?.openConversations ?? '--'}
          sublabel={
            stats?.unreadConversations
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
          isLoading={loading.stats}
        />
        <StatCard
          title="Active Opportunities"
          value={stats?.activeOpportunities ?? '--'}
          icon={Target}
          accentColor="amber"
          onClick={() => navigate('/opportunities')}
          isLoading={loading.stats}
        />
        <StatCard
          title="Upcoming Appointments"
          value={stats?.upcomingAppointments ?? '--'}
          sublabel={formatNextAppointment()}
          icon={Calendar}
          accentColor="rose"
          onClick={() => navigate('/calendars')}
          isLoading={loading.stats}
        />
      </div>

      <div>
        <h2 className="text-sm font-medium text-slate-400 mb-3">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
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
          <QuickActionButton
            icon={Bot}
            label="Run AI Agent"
            onClick={() => setRunAgentOpen(true)}
            disabled={!canRunAgent}
            iconColor="text-violet-400"
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

      <div>
        <h2 className="text-sm font-medium text-slate-400 mb-3">System Status</h2>
        <div className="flex flex-wrap gap-3">
          <SystemHealthIndicator
            label="Messaging"
            status={systemHealth.messaging}
            onClick={() => navigate('/settings/integrations')}
          />
          <SystemHealthIndicator
            label="Calendar Sync"
            status={systemHealth.calendar}
            onClick={() => navigate('/settings/calendars')}
          />
          <SystemHealthIndicator
            label="Payments"
            status={systemHealth.payments}
            onClick={() => navigate('/settings/integrations')}
          />
        </div>
      </div>

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
      <RunAgentDrawer
        open={runAgentOpen}
        onClose={() => setRunAgentOpen(false)}
        onSuccess={handleDrawerSuccess}
      />
    </div>
  );
}
