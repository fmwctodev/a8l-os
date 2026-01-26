import { supabase } from '../lib/supabase';
import {
  TimeRangeParams,
  UserContext,
  AnalyticsScope,
  DeltaResult,
  getTimeRangeDates,
  getPreviousPeriodDates,
  calculateDelta,
  getUserPermissionScope,
  buildOwnershipFilter,
  getCacheKey,
  getCachedData,
  setCachedData,
} from './analyticsEngine';

const CACHE_TTL = 5 * 60 * 1000;

export interface ContactsMetrics {
  total: number;
  newInPeriod: DeltaResult;
  sourceBreakdown: { source: string; count: number }[];
}

export interface ConversationsMetrics {
  active: number;
  messagesSent: DeltaResult;
  responseRate: DeltaResult;
}

export interface OpportunitiesMetrics {
  open: number;
  pipelineValue: DeltaResult;
  winRate: DeltaResult;
  closedWon: number;
  closedLost: number;
}

export interface AppointmentsMetrics {
  upcoming: number;
  completedInPeriod: DeltaResult;
  noShowRate: DeltaResult;
}

export interface RevenueMetrics {
  invoicedInPeriod: DeltaResult;
  paidInPeriod: DeltaResult;
  outstanding: number;
}

export interface DashboardAnalytics {
  contacts: ContactsMetrics;
  conversations: ConversationsMetrics;
  opportunities: OpportunitiesMetrics;
  appointments: AppointmentsMetrics;
  revenue: RevenueMetrics;
}

async function fetchContactsMetrics(
  organizationId: string,
  timeRange: TimeRangeParams,
  ownerFilter?: string,
  departmentFilter?: string
): Promise<ContactsMetrics> {
  const { start, end } = getTimeRangeDates(timeRange);
  const { start: prevStart, end: prevEnd } = getPreviousPeriodDates(timeRange);

  let baseQuery = supabase
    .from('contacts')
    .select('id, source, created_at', { count: 'exact' })
    .eq('organization_id', organizationId);

  if (ownerFilter) {
    baseQuery = baseQuery.eq('owner_id', ownerFilter);
  }

  const { count: total } = await baseQuery;

  let currentQuery = supabase
    .from('contacts')
    .select('id', { count: 'exact' })
    .eq('organization_id', organizationId)
    .gte('created_at', start.toISOString())
    .lte('created_at', end.toISOString());

  if (ownerFilter) {
    currentQuery = currentQuery.eq('owner_id', ownerFilter);
  }

  const { count: currentNew } = await currentQuery;

  let prevQuery = supabase
    .from('contacts')
    .select('id', { count: 'exact' })
    .eq('organization_id', organizationId)
    .gte('created_at', prevStart.toISOString())
    .lte('created_at', prevEnd.toISOString());

  if (ownerFilter) {
    prevQuery = prevQuery.eq('owner_id', ownerFilter);
  }

  const { count: prevNew } = await prevQuery;

  let sourceQuery = supabase
    .from('contacts')
    .select('source')
    .eq('organization_id', organizationId);

  if (ownerFilter) {
    sourceQuery = sourceQuery.eq('owner_id', ownerFilter);
  }

  const { data: sourceData } = await sourceQuery;

  const sourceCounts = (sourceData || []).reduce((acc, contact) => {
    const src = contact.source || 'Unknown';
    acc[src] = (acc[src] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const sourceBreakdown = Object.entries(sourceCounts)
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    total: total || 0,
    newInPeriod: calculateDelta(currentNew || 0, prevNew || 0),
    sourceBreakdown,
  };
}

async function fetchConversationsMetrics(
  organizationId: string,
  timeRange: TimeRangeParams,
  ownerFilter?: string
): Promise<ConversationsMetrics> {
  const { start, end } = getTimeRangeDates(timeRange);
  const { start: prevStart, end: prevEnd } = getPreviousPeriodDates(timeRange);

  let activeQuery = supabase
    .from('conversations')
    .select('id', { count: 'exact' })
    .eq('organization_id', organizationId)
    .eq('status', 'open');

  if (ownerFilter) {
    activeQuery = activeQuery.eq('assigned_to', ownerFilter);
  }

  const { count: active } = await activeQuery;

  let currentMsgQuery = supabase
    .from('messages')
    .select('id, direction', { count: 'exact' })
    .eq('organization_id', organizationId)
    .eq('direction', 'outbound')
    .gte('created_at', start.toISOString())
    .lte('created_at', end.toISOString());

  if (ownerFilter) {
    currentMsgQuery = currentMsgQuery.eq('sender_id', ownerFilter);
  }

  const { count: currentMessages } = await currentMsgQuery;

  let prevMsgQuery = supabase
    .from('messages')
    .select('id', { count: 'exact' })
    .eq('organization_id', organizationId)
    .eq('direction', 'outbound')
    .gte('created_at', prevStart.toISOString())
    .lte('created_at', prevEnd.toISOString());

  if (ownerFilter) {
    prevMsgQuery = prevMsgQuery.eq('sender_id', ownerFilter);
  }

  const { count: prevMessages } = await prevMsgQuery;

  let inboundCurrentQuery = supabase
    .from('messages')
    .select('id', { count: 'exact' })
    .eq('organization_id', organizationId)
    .eq('direction', 'inbound')
    .gte('created_at', start.toISOString())
    .lte('created_at', end.toISOString());

  const { count: inboundCurrent } = await inboundCurrentQuery;

  const currentResponseRate = inboundCurrent && inboundCurrent > 0
    ? Math.round(((currentMessages || 0) / inboundCurrent) * 100)
    : 0;

  let inboundPrevQuery = supabase
    .from('messages')
    .select('id', { count: 'exact' })
    .eq('organization_id', organizationId)
    .eq('direction', 'inbound')
    .gte('created_at', prevStart.toISOString())
    .lte('created_at', prevEnd.toISOString());

  const { count: inboundPrev } = await inboundPrevQuery;

  const prevResponseRate = inboundPrev && inboundPrev > 0
    ? Math.round(((prevMessages || 0) / inboundPrev) * 100)
    : 0;

  return {
    active: active || 0,
    messagesSent: calculateDelta(currentMessages || 0, prevMessages || 0),
    responseRate: calculateDelta(currentResponseRate, prevResponseRate),
  };
}

async function fetchOpportunitiesMetrics(
  organizationId: string,
  timeRange: TimeRangeParams,
  ownerFilter?: string
): Promise<OpportunitiesMetrics> {
  const { start, end } = getTimeRangeDates(timeRange);
  const { start: prevStart, end: prevEnd } = getPreviousPeriodDates(timeRange);

  let openQuery = supabase
    .from('opportunities')
    .select('id, value_amount', { count: 'exact' })
    .eq('organization_id', organizationId)
    .eq('status', 'open');

  if (ownerFilter) {
    openQuery = openQuery.eq('owner_id', ownerFilter);
  }

  const { data: openOpps, count: openCount } = await openQuery;

  const currentPipelineValue = (openOpps || []).reduce((sum, opp) => sum + (opp.value_amount || 0), 0);

  let closedWonCurrentQuery = supabase
    .from('opportunities')
    .select('id, value_amount', { count: 'exact' })
    .eq('organization_id', organizationId)
    .eq('status', 'won')
    .gte('updated_at', start.toISOString())
    .lte('updated_at', end.toISOString());

  if (ownerFilter) {
    closedWonCurrentQuery = closedWonCurrentQuery.eq('owner_id', ownerFilter);
  }

  const { data: wonCurrentData, count: closedWonCurrent } = await closedWonCurrentQuery;

  let closedLostCurrentQuery = supabase
    .from('opportunities')
    .select('id', { count: 'exact' })
    .eq('organization_id', organizationId)
    .eq('status', 'lost')
    .gte('updated_at', start.toISOString())
    .lte('updated_at', end.toISOString());

  if (ownerFilter) {
    closedLostCurrentQuery = closedLostCurrentQuery.eq('owner_id', ownerFilter);
  }

  const { count: closedLostCurrent } = await closedLostCurrentQuery;

  const totalClosedCurrent = (closedWonCurrent || 0) + (closedLostCurrent || 0);
  const currentWinRate = totalClosedCurrent > 0
    ? Math.round(((closedWonCurrent || 0) / totalClosedCurrent) * 100)
    : 0;

  let closedWonPrevQuery = supabase
    .from('opportunities')
    .select('id, value_amount', { count: 'exact' })
    .eq('organization_id', organizationId)
    .eq('status', 'won')
    .gte('updated_at', prevStart.toISOString())
    .lte('updated_at', prevEnd.toISOString());

  if (ownerFilter) {
    closedWonPrevQuery = closedWonPrevQuery.eq('owner_id', ownerFilter);
  }

  const { data: wonPrevData, count: closedWonPrev } = await closedWonPrevQuery;

  let closedLostPrevQuery = supabase
    .from('opportunities')
    .select('id', { count: 'exact' })
    .eq('organization_id', organizationId)
    .eq('status', 'lost')
    .gte('updated_at', prevStart.toISOString())
    .lte('updated_at', prevEnd.toISOString());

  if (ownerFilter) {
    closedLostPrevQuery = closedLostPrevQuery.eq('owner_id', ownerFilter);
  }

  const { count: closedLostPrev } = await closedLostPrevQuery;

  const totalClosedPrev = (closedWonPrev || 0) + (closedLostPrev || 0);
  const prevWinRate = totalClosedPrev > 0
    ? Math.round(((closedWonPrev || 0) / totalClosedPrev) * 100)
    : 0;

  const prevPipelineValue = (wonPrevData || []).reduce((sum, opp) => sum + (opp.value_amount || 0), 0);

  return {
    open: openCount || 0,
    pipelineValue: calculateDelta(currentPipelineValue, prevPipelineValue),
    winRate: calculateDelta(currentWinRate, prevWinRate),
    closedWon: closedWonCurrent || 0,
    closedLost: closedLostCurrent || 0,
  };
}

async function fetchAppointmentsMetrics(
  organizationId: string,
  timeRange: TimeRangeParams,
  ownerFilter?: string
): Promise<AppointmentsMetrics> {
  const { start, end } = getTimeRangeDates(timeRange);
  const { start: prevStart, end: prevEnd } = getPreviousPeriodDates(timeRange);
  const now = new Date();

  let upcomingQuery = supabase
    .from('appointments')
    .select('id', { count: 'exact' })
    .eq('organization_id', organizationId)
    .eq('status', 'scheduled')
    .gte('start_time', now.toISOString());

  if (ownerFilter) {
    upcomingQuery = upcomingQuery.eq('user_id', ownerFilter);
  }

  const { count: upcoming } = await upcomingQuery;

  let completedCurrentQuery = supabase
    .from('appointments')
    .select('id', { count: 'exact' })
    .eq('organization_id', organizationId)
    .eq('status', 'completed')
    .gte('end_time', start.toISOString())
    .lte('end_time', end.toISOString());

  if (ownerFilter) {
    completedCurrentQuery = completedCurrentQuery.eq('user_id', ownerFilter);
  }

  const { count: completedCurrent } = await completedCurrentQuery;

  let completedPrevQuery = supabase
    .from('appointments')
    .select('id', { count: 'exact' })
    .eq('organization_id', organizationId)
    .eq('status', 'completed')
    .gte('end_time', prevStart.toISOString())
    .lte('end_time', prevEnd.toISOString());

  if (ownerFilter) {
    completedPrevQuery = completedPrevQuery.eq('user_id', ownerFilter);
  }

  const { count: completedPrev } = await completedPrevQuery;

  let noShowCurrentQuery = supabase
    .from('appointments')
    .select('id', { count: 'exact' })
    .eq('organization_id', organizationId)
    .in('status', ['no_show', 'cancelled'])
    .gte('start_time', start.toISOString())
    .lte('start_time', end.toISOString());

  if (ownerFilter) {
    noShowCurrentQuery = noShowCurrentQuery.eq('user_id', ownerFilter);
  }

  const { count: noShowCurrent } = await noShowCurrentQuery;

  let scheduledCurrentQuery = supabase
    .from('appointments')
    .select('id', { count: 'exact' })
    .eq('organization_id', organizationId)
    .gte('start_time', start.toISOString())
    .lte('start_time', end.toISOString());

  if (ownerFilter) {
    scheduledCurrentQuery = scheduledCurrentQuery.eq('user_id', ownerFilter);
  }

  const { count: scheduledCurrent } = await scheduledCurrentQuery;

  const currentNoShowRate = scheduledCurrent && scheduledCurrent > 0
    ? Math.round(((noShowCurrent || 0) / scheduledCurrent) * 100)
    : 0;

  let noShowPrevQuery = supabase
    .from('appointments')
    .select('id', { count: 'exact' })
    .eq('organization_id', organizationId)
    .in('status', ['no_show', 'cancelled'])
    .gte('start_time', prevStart.toISOString())
    .lte('start_time', prevEnd.toISOString());

  if (ownerFilter) {
    noShowPrevQuery = noShowPrevQuery.eq('user_id', ownerFilter);
  }

  const { count: noShowPrev } = await noShowPrevQuery;

  let scheduledPrevQuery = supabase
    .from('appointments')
    .select('id', { count: 'exact' })
    .eq('organization_id', organizationId)
    .gte('start_time', prevStart.toISOString())
    .lte('start_time', prevEnd.toISOString());

  if (ownerFilter) {
    scheduledPrevQuery = scheduledPrevQuery.eq('user_id', ownerFilter);
  }

  const { count: scheduledPrev } = await scheduledPrevQuery;

  const prevNoShowRate = scheduledPrev && scheduledPrev > 0
    ? Math.round(((noShowPrev || 0) / scheduledPrev) * 100)
    : 0;

  return {
    upcoming: upcoming || 0,
    completedInPeriod: calculateDelta(completedCurrent || 0, completedPrev || 0),
    noShowRate: calculateDelta(currentNoShowRate, prevNoShowRate),
  };
}

async function fetchRevenueMetrics(
  organizationId: string,
  timeRange: TimeRangeParams,
  ownerFilter?: string
): Promise<RevenueMetrics> {
  const { start, end } = getTimeRangeDates(timeRange);
  const { start: prevStart, end: prevEnd } = getPreviousPeriodDates(timeRange);

  let invoicedCurrentQuery = supabase
    .from('invoices')
    .select('id, total, status')
    .eq('organization_id', organizationId)
    .gte('created_at', start.toISOString())
    .lte('created_at', end.toISOString());

  const { data: invoicedCurrentData } = await invoicedCurrentQuery;

  const invoicedCurrent = (invoicedCurrentData || []).reduce((sum, inv) => sum + (inv.total || 0), 0);

  let invoicedPrevQuery = supabase
    .from('invoices')
    .select('id, total')
    .eq('organization_id', organizationId)
    .gte('created_at', prevStart.toISOString())
    .lte('created_at', prevEnd.toISOString());

  const { data: invoicedPrevData } = await invoicedPrevQuery;

  const invoicedPrev = (invoicedPrevData || []).reduce((sum, inv) => sum + (inv.total || 0), 0);

  let paidCurrentQuery = supabase
    .from('invoices')
    .select('id, total')
    .eq('organization_id', organizationId)
    .eq('status', 'paid')
    .gte('paid_at', start.toISOString())
    .lte('paid_at', end.toISOString());

  const { data: paidCurrentData } = await paidCurrentQuery;

  const paidCurrent = (paidCurrentData || []).reduce((sum, inv) => sum + (inv.total || 0), 0);

  let paidPrevQuery = supabase
    .from('invoices')
    .select('id, total')
    .eq('organization_id', organizationId)
    .eq('status', 'paid')
    .gte('paid_at', prevStart.toISOString())
    .lte('paid_at', prevEnd.toISOString());

  const { data: paidPrevData } = await paidPrevQuery;

  const paidPrev = (paidPrevData || []).reduce((sum, inv) => sum + (inv.total || 0), 0);

  let outstandingQuery = supabase
    .from('invoices')
    .select('id, total')
    .eq('organization_id', organizationId)
    .in('status', ['sent', 'viewed', 'overdue']);

  const { data: outstandingData } = await outstandingQuery;

  const outstanding = (outstandingData || []).reduce((sum, inv) => sum + (inv.total || 0), 0);

  return {
    invoicedInPeriod: calculateDelta(invoicedCurrent, invoicedPrev),
    paidInPeriod: calculateDelta(paidCurrent, paidPrev),
    outstanding,
  };
}

export async function getDashboardAnalytics(
  userContext: UserContext,
  timeRange: TimeRangeParams,
  scope: AnalyticsScope = {}
): Promise<DashboardAnalytics> {
  const cacheKey = getCacheKey('dashboard', {
    userId: userContext.userId,
    orgId: userContext.organizationId,
    timeRange,
    scope
  });

  const cached = getCachedData<DashboardAnalytics>(cacheKey);
  if (cached) return cached;

  const permissionScope = await getUserPermissionScope(userContext);
  const { ownerFilter, departmentFilter } = buildOwnershipFilter(scope, userContext, permissionScope);

  const [contacts, conversations, opportunities, appointments, revenue] = await Promise.all([
    fetchContactsMetrics(userContext.organizationId, timeRange, ownerFilter, departmentFilter),
    fetchConversationsMetrics(userContext.organizationId, timeRange, ownerFilter),
    fetchOpportunitiesMetrics(userContext.organizationId, timeRange, ownerFilter),
    fetchAppointmentsMetrics(userContext.organizationId, timeRange, ownerFilter),
    fetchRevenueMetrics(userContext.organizationId, timeRange, ownerFilter),
  ]);

  const result: DashboardAnalytics = {
    contacts,
    conversations,
    opportunities,
    appointments,
    revenue,
  };

  setCachedData(cacheKey, result, CACHE_TTL);

  return result;
}
