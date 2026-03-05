import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  handleCors,
  successResponse,
  errorResponse,
  getSupabaseClient,
  extractUserContext,
  requireAuth,
} from "../_shared/index.ts";

type TimeRange = "7d" | "30d" | "90d" | "custom";

interface TimeRangeParams {
  range: TimeRange;
  startDate?: string;
  endDate?: string;
}

interface DeltaResult {
  current: number;
  previous: number;
  delta: number;
  deltaPercent: number;
  trend: "up" | "down" | "stable";
}

function getTimeRangeDates(params: TimeRangeParams): { start: Date; end: Date } {
  const now = new Date();
  const end = params.endDate ? new Date(params.endDate) : new Date(now);
  end.setHours(23, 59, 59, 999);

  let start: Date;

  if (params.range === "custom" && params.startDate) {
    start = new Date(params.startDate);
  } else {
    start = new Date(end);
    switch (params.range) {
      case "7d":
        start.setDate(start.getDate() - 7);
        break;
      case "30d":
        start.setDate(start.getDate() - 30);
        break;
      case "90d":
        start.setDate(start.getDate() - 90);
        break;
      default:
        start.setDate(start.getDate() - 30);
    }
  }

  start.setHours(0, 0, 0, 0);
  return { start, end };
}

function getPreviousPeriodDates(params: TimeRangeParams): { start: Date; end: Date } {
  const { start: currentStart, end: currentEnd } = getTimeRangeDates(params);
  const periodLength = currentEnd.getTime() - currentStart.getTime();

  const previousEnd = new Date(currentStart.getTime() - 1);
  const previousStart = new Date(previousEnd.getTime() - periodLength);

  return { start: previousStart, end: previousEnd };
}

function calculateDelta(current: number, previous: number): DeltaResult {
  const delta = current - previous;
  const deltaPercent = previous === 0 ? (current > 0 ? 100 : 0) : Math.round((delta / previous) * 100);

  let trend: "up" | "down" | "stable" = "stable";
  if (deltaPercent > 2) trend = "up";
  else if (deltaPercent < -2) trend = "down";

  return { current, previous, delta, deltaPercent, trend };
}

Deno.serve(async (req: Request) => {
  try {
    const corsResponse = handleCors(req);
    if (corsResponse) return corsResponse;

    const supabase = getSupabaseClient();
    const userContext = await extractUserContext(req, supabase);
    const user = requireAuth(userContext);

    if (!user.permissions.includes("dashboard.view")) {
      return errorResponse("FORBIDDEN", "You do not have permission to view dashboard analytics", 403);
    }

    const url = new URL(req.url);
    const range = (url.searchParams.get("range") || "30d") as TimeRange;
    const startDate = url.searchParams.get("startDate") || undefined;
    const endDate = url.searchParams.get("endDate") || undefined;
    const departmentId = url.searchParams.get("departmentId") || undefined;
    const ownedOnly = url.searchParams.get("ownedOnly") === "true";

    const timeRange: TimeRangeParams = { range, startDate, endDate };
    const { start, end } = getTimeRangeDates(timeRange);
    const { start: prevStart, end: prevEnd } = getPreviousPeriodDates(timeRange);

    let ownerFilter: string | undefined;
    let deptFilter: string | undefined;

    const roleName = user.roleName.toLowerCase();
    if (roleName === "admin" || roleName === "superadmin" || user.isSuperAdmin) {
      if (departmentId) deptFilter = departmentId;
      if (ownedOnly) ownerFilter = user.id;
    } else if (roleName === "manager") {
      deptFilter = departmentId || user.departmentId || undefined;
      if (ownedOnly) ownerFilter = user.id;
    } else {
      ownerFilter = user.id;
    }

    const { count: totalContacts } = await supabase
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", user.orgId);

    let newContactsCurrentQuery = supabase
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", user.orgId)
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString());

    if (ownerFilter) newContactsCurrentQuery = newContactsCurrentQuery.eq("owner_id", ownerFilter);

    const { count: newContactsCurrent } = await newContactsCurrentQuery;

    let newContactsPrevQuery = supabase
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", user.orgId)
      .gte("created_at", prevStart.toISOString())
      .lte("created_at", prevEnd.toISOString());

    if (ownerFilter) newContactsPrevQuery = newContactsPrevQuery.eq("owner_id", ownerFilter);

    const { count: newContactsPrev } = await newContactsPrevQuery;

    let activeConvQuery = supabase
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", user.orgId)
      .eq("status", "open");

    if (ownerFilter) activeConvQuery = activeConvQuery.eq("assigned_user_id", ownerFilter);

    const { count: activeConversations } = await activeConvQuery;

    let msgCurrentQuery = supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", user.orgId)
      .eq("direction", "outbound")
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString());

    if (ownerFilter) msgCurrentQuery = msgCurrentQuery.eq("sender_id", ownerFilter);

    const { count: messagesCurrent } = await msgCurrentQuery;

    let msgPrevQuery = supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", user.orgId)
      .eq("direction", "outbound")
      .gte("created_at", prevStart.toISOString())
      .lte("created_at", prevEnd.toISOString());

    if (ownerFilter) msgPrevQuery = msgPrevQuery.eq("sender_id", ownerFilter);

    const { count: messagesPrev } = await msgPrevQuery;

    let openOppsQuery = supabase
      .from("opportunities")
      .select("id, value_amount")
      .eq("org_id", user.orgId)
      .eq("status", "open");

    if (ownerFilter) openOppsQuery = openOppsQuery.eq("assigned_user_id", ownerFilter);

    const { data: openOpps } = await openOppsQuery;

    const pipelineValue = (openOpps || []).reduce((sum, o) => sum + (o.value_amount || 0), 0);

    let wonCurrentQuery = supabase
      .from("opportunities")
      .select("id", { count: "exact", head: true })
      .eq("org_id", user.orgId)
      .eq("status", "won")
      .gte("updated_at", start.toISOString())
      .lte("updated_at", end.toISOString());

    if (ownerFilter) wonCurrentQuery = wonCurrentQuery.eq("assigned_user_id", ownerFilter);

    const { count: wonCurrent } = await wonCurrentQuery;

    let lostCurrentQuery = supabase
      .from("opportunities")
      .select("id", { count: "exact", head: true })
      .eq("org_id", user.orgId)
      .eq("status", "lost")
      .gte("updated_at", start.toISOString())
      .lte("updated_at", end.toISOString());

    if (ownerFilter) lostCurrentQuery = lostCurrentQuery.eq("assigned_user_id", ownerFilter);

    const { count: lostCurrent } = await lostCurrentQuery;

    const totalClosedCurrent = (wonCurrent || 0) + (lostCurrent || 0);
    const winRateCurrent = totalClosedCurrent > 0 ? Math.round(((wonCurrent || 0) / totalClosedCurrent) * 100) : 0;

    let wonPrevQuery = supabase
      .from("opportunities")
      .select("id", { count: "exact", head: true })
      .eq("org_id", user.orgId)
      .eq("status", "won")
      .gte("updated_at", prevStart.toISOString())
      .lte("updated_at", prevEnd.toISOString());

    if (ownerFilter) wonPrevQuery = wonPrevQuery.eq("assigned_user_id", ownerFilter);

    const { count: wonPrev } = await wonPrevQuery;

    let lostPrevQuery = supabase
      .from("opportunities")
      .select("id", { count: "exact", head: true })
      .eq("org_id", user.orgId)
      .eq("status", "lost")
      .gte("updated_at", prevStart.toISOString())
      .lte("updated_at", prevEnd.toISOString());

    if (ownerFilter) lostPrevQuery = lostPrevQuery.eq("assigned_user_id", ownerFilter);

    const { count: lostPrev } = await lostPrevQuery;

    const totalClosedPrev = (wonPrev || 0) + (lostPrev || 0);
    const winRatePrev = totalClosedPrev > 0 ? Math.round(((wonPrev || 0) / totalClosedPrev) * 100) : 0;

    const now = new Date();
    let upcomingApptQuery = supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("org_id", user.orgId)
      .eq("status", "scheduled")
      .gte("start_at_utc", now.toISOString());

    if (ownerFilter) upcomingApptQuery = upcomingApptQuery.eq("assigned_user_id", ownerFilter);

    const { count: upcomingAppointments } = await upcomingApptQuery;

    let completedApptCurrentQuery = supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("org_id", user.orgId)
      .eq("status", "completed")
      .gte("end_at_utc", start.toISOString())
      .lte("end_at_utc", end.toISOString());

    if (ownerFilter) completedApptCurrentQuery = completedApptCurrentQuery.eq("assigned_user_id", ownerFilter);

    const { count: completedApptCurrent } = await completedApptCurrentQuery;

    let completedApptPrevQuery = supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("org_id", user.orgId)
      .eq("status", "completed")
      .gte("end_at_utc", prevStart.toISOString())
      .lte("end_at_utc", prevEnd.toISOString());

    if (ownerFilter) completedApptPrevQuery = completedApptPrevQuery.eq("assigned_user_id", ownerFilter);

    const { count: completedApptPrev } = await completedApptPrevQuery;

    const { data: invoicedCurrentData } = await supabase
      .from("invoices")
      .select("total")
      .eq("org_id", user.orgId)
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString());

    const invoicedCurrent = (invoicedCurrentData || []).reduce((sum, inv) => sum + (inv.total || 0), 0);

    const { data: invoicedPrevData } = await supabase
      .from("invoices")
      .select("total")
      .eq("org_id", user.orgId)
      .gte("created_at", prevStart.toISOString())
      .lte("created_at", prevEnd.toISOString());

    const invoicedPrev = (invoicedPrevData || []).reduce((sum, inv) => sum + (inv.total || 0), 0);

    const { data: paidCurrentData } = await supabase
      .from("invoices")
      .select("total")
      .eq("org_id", user.orgId)
      .eq("status", "paid")
      .gte("paid_at", start.toISOString())
      .lte("paid_at", end.toISOString());

    const paidCurrent = (paidCurrentData || []).reduce((sum, inv) => sum + (inv.total || 0), 0);

    const { data: paidPrevData } = await supabase
      .from("invoices")
      .select("total")
      .eq("org_id", user.orgId)
      .eq("status", "paid")
      .gte("paid_at", prevStart.toISOString())
      .lte("paid_at", prevEnd.toISOString());

    const paidPrev = (paidPrevData || []).reduce((sum, inv) => sum + (inv.total || 0), 0);

    const { data: outstandingData } = await supabase
      .from("invoices")
      .select("total")
      .eq("org_id", user.orgId)
      .in("status", ["sent", "viewed", "overdue"]);

    const outstanding = (outstandingData || []).reduce((sum, inv) => sum + (inv.total || 0), 0);

    return successResponse({
      contacts: {
        total: totalContacts || 0,
        newInPeriod: calculateDelta(newContactsCurrent || 0, newContactsPrev || 0),
      },
      conversations: {
        active: activeConversations || 0,
        messagesSent: calculateDelta(messagesCurrent || 0, messagesPrev || 0),
      },
      opportunities: {
        open: openOpps?.length || 0,
        pipelineValue,
        winRate: calculateDelta(winRateCurrent, winRatePrev),
        closedWon: wonCurrent || 0,
        closedLost: lostCurrent || 0,
      },
      appointments: {
        upcoming: upcomingAppointments || 0,
        completedInPeriod: calculateDelta(completedApptCurrent || 0, completedApptPrev || 0),
      },
      revenue: {
        invoicedInPeriod: calculateDelta(invoicedCurrent, invoicedPrev),
        paidInPeriod: calculateDelta(paidCurrent, paidPrev),
        outstanding,
      },
      timeRange: {
        start: start.toISOString(),
        end: end.toISOString(),
        range,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "An unexpected error occurred";
    return errorResponse("INTERNAL_ERROR", message, 500);
  }
});
