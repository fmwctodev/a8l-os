import { supabase } from '../lib/supabase';

export interface DashboardStats {
  totalContacts: number;
  openConversations: number;
  unreadConversations: number;
  activeOpportunities: number;
  upcomingAppointments: number;
  nextAppointmentTime: string | null;
}

export interface AssignedConversation {
  id: string;
  contact_id: string;
  status: string;
  unread_count: number;
  last_message_at: string;
  contact: {
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
  };
}

export interface TaskDue {
  id: string;
  title: string;
  due_date: string;
  priority: 'high' | 'medium' | 'low';
  status: string;
  contact_id: string;
  contact: {
    id: string;
    first_name: string;
    last_name: string;
  };
}

export interface UpcomingAppointment {
  id: string;
  start_at_utc: string;
  end_at_utc: string;
  status: string;
  contact_id: string;
  calendar_id: string;
  appointment_type_id: string;
  contact: {
    id: string;
    first_name: string;
    last_name: string;
  };
  calendar: {
    id: string;
    name: string;
  };
  appointment_type: {
    id: string;
    name: string;
    color: string;
  };
}

export interface SystemHealthStatus {
  messaging: 'connected' | 'degraded' | 'disconnected';
  calendar: 'connected' | 'degraded' | 'disconnected';
  payments: 'connected' | 'degraded' | 'disconnected';
}

export interface DateRange {
  startDate: string;
  endDate: string;
  label: string;
}

export async function getDashboardStats(
  organizationId: string,
  dateRange?: DateRange
): Promise<{ data: DashboardStats | null; error: Error | null }> {
  try {
    const now = new Date().toISOString();

    const [contactsRes, conversationsRes, opportunitiesRes, appointmentsRes] = await Promise.all([
      supabase
        .from('contacts')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId),

      supabase
        .from('conversations')
        .select('id, unread_count', { count: 'exact' })
        .eq('organization_id', organizationId)
        .in('status', ['open', 'pending']),

      supabase
        .from('opportunities')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', organizationId)
        .in('status', ['open', 'qualified', 'proposal']),

      supabase
        .from('appointments')
        .select('id, start_at_utc', { count: 'exact' })
        .eq('org_id', organizationId)
        .gte('start_at_utc', now)
        .in('status', ['scheduled', 'confirmed'])
        .order('start_at_utc', { ascending: true })
        .limit(1),
    ]);

    const unreadCount = conversationsRes.data?.filter((c) => c.unread_count > 0).length || 0;
    const nextAppointment = appointmentsRes.data?.[0];

    return {
      data: {
        totalContacts: contactsRes.count || 0,
        openConversations: conversationsRes.count || 0,
        unreadConversations: unreadCount,
        activeOpportunities: opportunitiesRes.count || 0,
        upcomingAppointments: appointmentsRes.count || 0,
        nextAppointmentTime: nextAppointment?.start_at_utc || null,
      },
      error: null,
    };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

export async function getAssignedConversations(
  userId: string,
  organizationId: string,
  limit = 10
): Promise<{ data: AssignedConversation[]; error: Error | null }> {
  const { data, error } = await supabase
    .from('conversations')
    .select(`
      id,
      contact_id,
      status,
      unread_count,
      last_message_at,
      contact:contacts!conversations_contact_id_fkey(id, first_name, last_name, email, phone)
    `)
    .eq('organization_id', organizationId)
    .eq('assigned_user_id', userId)
    .in('status', ['open', 'pending'])
    .order('last_message_at', { ascending: false })
    .limit(limit);

  return {
    data: (data as unknown as AssignedConversation[]) || [],
    error: error ? new Error(error.message) : null,
  };
}

export async function getUserTasksDue(
  userId: string,
  organizationId: string,
  limit = 10
): Promise<{ data: TaskDue[]; error: Error | null }> {
  const { data, error } = await supabase
    .from('contact_tasks')
    .select(`
      id,
      title,
      due_date,
      priority,
      status,
      contact_id,
      contact:contacts!contact_tasks_contact_id_fkey(id, first_name, last_name, organization_id)
    `)
    .eq('assigned_to_user_id', userId)
    .eq('status', 'pending')
    .order('due_date', { ascending: true })
    .limit(limit);

  const filteredData = (data || []).filter(
    (task) => (task.contact as { organization_id?: string })?.organization_id === organizationId
  );

  return {
    data: filteredData as unknown as TaskDue[],
    error: error ? new Error(error.message) : null,
  };
}

export async function getNextAppointments(
  userId: string,
  organizationId: string,
  limit = 5
): Promise<{ data: UpcomingAppointment[]; error: Error | null }> {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('appointments')
    .select(`
      id,
      start_at_utc,
      end_at_utc,
      status,
      contact_id,
      calendar_id,
      appointment_type_id,
      contact:contacts!appointments_contact_id_fkey(id, first_name, last_name),
      calendar:calendars!appointments_calendar_id_fkey(id, name),
      appointment_type:appointment_types!appointments_appointment_type_id_fkey(id, name, color)
    `)
    .eq('org_id', organizationId)
    .eq('assigned_user_id', userId)
    .gte('start_at_utc', now)
    .in('status', ['scheduled', 'confirmed'])
    .order('start_at_utc', { ascending: true })
    .limit(limit);

  return {
    data: (data as unknown as UpcomingAppointment[]) || [],
    error: error ? new Error(error.message) : null,
  };
}

export async function getSystemHealthStatus(
  organizationId: string
): Promise<{ data: SystemHealthStatus; error: Error | null }> {
  try {
    const [channelsRes, calendarRes, paymentsRes] = await Promise.all([
      supabase
        .from('channel_configurations')
        .select('id, is_active')
        .eq('organization_id', organizationId)
        .eq('channel_type', 'sms')
        .maybeSingle(),

      supabase
        .from('google_calendar_connections')
        .select('id')
        .eq('org_id', organizationId)
        .maybeSingle(),

      supabase
        .from('integration_connections')
        .select('id, status')
        .eq('org_id', organizationId)
        .maybeSingle(),
    ]);

    const getMessagingStatus = (data: { is_active?: boolean } | null): SystemHealthStatus['messaging'] => {
      if (!data) return 'disconnected';
      return data.is_active ? 'connected' : 'disconnected';
    };

    const getCalendarStatus = (data: { id?: string } | null): SystemHealthStatus['calendar'] => {
      return data ? 'connected' : 'disconnected';
    };

    const getPaymentsStatus = (data: { status?: string } | null): SystemHealthStatus['payments'] => {
      if (!data) return 'disconnected';
      if (data.status === 'active' || data.status === 'connected') return 'connected';
      if (data.status === 'error' || data.status === 'failed') return 'degraded';
      return 'disconnected';
    };

    return {
      data: {
        messaging: getMessagingStatus(channelsRes.data),
        calendar: getCalendarStatus(calendarRes.data),
        payments: getPaymentsStatus(paymentsRes.data),
      },
      error: null,
    };
  } catch (err) {
    return {
      data: { messaging: 'disconnected', calendar: 'disconnected', payments: 'disconnected' },
      error: err as Error,
    };
  }
}

export function getDateRangePresets(): DateRange[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const formatDate = (d: Date) => d.toISOString();

  return [
    {
      label: 'Today',
      startDate: formatDate(today),
      endDate: formatDate(new Date(today.getTime() + 24 * 60 * 60 * 1000)),
    },
    {
      label: 'Last 7 Days',
      startDate: formatDate(new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)),
      endDate: formatDate(new Date(today.getTime() + 24 * 60 * 60 * 1000)),
    },
    {
      label: 'Last 30 Days',
      startDate: formatDate(new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)),
      endDate: formatDate(new Date(today.getTime() + 24 * 60 * 60 * 1000)),
    },
  ];
}

export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}
