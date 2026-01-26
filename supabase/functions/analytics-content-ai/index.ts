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

function average(items: { [key: string]: number | null }[], field: string): number {
  if (items.length === 0) return 0;
  const sum = items.reduce((acc, item) => acc + (Number(item[field]) || 0), 0);
  return sum / items.length;
}

interface AIInsight {
  category: "timing" | "content" | "media" | "engagement" | "platform";
  title: string;
  description: string;
  confidence: "high" | "medium" | "low";
  dataPoints: string[];
}

Deno.serve(async (req: Request) => {
  try {
    const corsResponse = handleCors(req);
    if (corsResponse) return corsResponse;

    const supabase = getSupabaseClient();
    const userContext = await extractUserContext(req, supabase);
    const user = requireAuth(userContext);

    if (!user.permissions.includes("ai_agents.view")) {
      return errorResponse("FORBIDDEN", "You do not have permission to view AI analytics", 403);
    }

    const url = new URL(req.url);
    const range = (url.searchParams.get("range") || "30d") as TimeRange;
    const startDate = url.searchParams.get("startDate") || undefined;
    const endDate = url.searchParams.get("endDate") || undefined;
    const platformFilter = url.searchParams.get("platform") || undefined;

    const timeRange: TimeRangeParams = { range, startDate, endDate };
    const { start, end } = getTimeRangeDates(timeRange);
    const { start: prevStart, end: prevEnd } = getPreviousPeriodDates(timeRange);

    let currentMetricsQuery = supabase
      .from("social_post_metrics")
      .select("id, engagement_score, reach_score")
      .eq("organization_id", user.orgId)
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString());

    if (platformFilter) {
      currentMetricsQuery = currentMetricsQuery.eq("platform", platformFilter);
    }

    const { data: currentMetrics } = await currentMetricsQuery;

    let prevMetricsQuery = supabase
      .from("social_post_metrics")
      .select("id, engagement_score, reach_score")
      .eq("organization_id", user.orgId)
      .gte("created_at", prevStart.toISOString())
      .lte("created_at", prevEnd.toISOString());

    if (platformFilter) {
      prevMetricsQuery = prevMetricsQuery.eq("platform", platformFilter);
    }

    const { data: prevMetrics } = await prevMetricsQuery;

    const currentPosts = currentMetrics?.length || 0;
    const prevPosts = prevMetrics?.length || 0;
    const currentAvgEngagement = average(currentMetrics || [], "engagement_score");
    const prevAvgEngagement = average(prevMetrics || [], "engagement_score");
    const currentAvgReach = average(currentMetrics || [], "reach_score");
    const prevAvgReach = average(prevMetrics || [], "reach_score");

    let signalsQuery = supabase
      .from("social_ai_learning_signals")
      .select("id, is_high_performer")
      .eq("organization_id", user.orgId)
      .gte("analyzed_at", start.toISOString())
      .lte("analyzed_at", end.toISOString());

    if (platformFilter) {
      signalsQuery = signalsQuery.eq("platform", platformFilter);
    }

    const { data: signalsData } = await signalsQuery;
    const highPerformers = (signalsData || []).filter((s) => s.is_high_performer).length;
    const highPerformerPercent = signalsData?.length
      ? Math.round((highPerformers / signalsData.length) * 100)
      : 0;

    const { data: platformData } = await supabase
      .from("social_ai_learning_signals")
      .select("platform, media_type, posting_hour, engagement_score, reach_score")
      .eq("organization_id", user.orgId)
      .gte("analyzed_at", start.toISOString())
      .lte("analyzed_at", end.toISOString());

    const platformGroups: Record<string, typeof platformData> = {};
    (platformData || []).forEach((item) => {
      if (!platformGroups[item.platform]) platformGroups[item.platform] = [];
      platformGroups[item.platform].push(item);
    });

    const platforms = Object.entries(platformGroups)
      .map(([platform, items]) => {
        const avgEngagement = average(items, "engagement_score");
        const avgReach = average(items, "reach_score");

        const mediaTypeCounts: Record<string, number> = {};
        const hourCounts: Record<number, { count: number; totalEngagement: number }> = {};

        items.forEach((item) => {
          mediaTypeCounts[item.media_type] = (mediaTypeCounts[item.media_type] || 0) + 1;
          if (item.posting_hour !== null) {
            if (!hourCounts[item.posting_hour]) {
              hourCounts[item.posting_hour] = { count: 0, totalEngagement: 0 };
            }
            hourCounts[item.posting_hour].count++;
            hourCounts[item.posting_hour].totalEngagement += Number(item.engagement_score) || 0;
          }
        });

        const topMediaType =
          Object.entries(mediaTypeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "image";

        const bestHour =
          Object.entries(hourCounts)
            .map(([hour, data]) => ({
              hour: parseInt(hour),
              avgEngagement: data.totalEngagement / data.count,
            }))
            .sort((a, b) => b.avgEngagement - a.avgEngagement)[0]?.hour || 12;

        return {
          platform,
          postsCount: items.length,
          avgEngagement: Math.round(avgEngagement * 100) / 100,
          avgReach: Math.round(avgReach * 100) / 100,
          topMediaType,
          bestPostingHour: bestHour,
          trend: "stable" as const,
        };
      })
      .sort((a, b) => b.avgEngagement - a.avgEngagement);

    let contentTypeQuery = supabase
      .from("social_ai_learning_signals")
      .select("media_type, engagement_score, reach_score")
      .eq("organization_id", user.orgId)
      .gte("analyzed_at", start.toISOString())
      .lte("analyzed_at", end.toISOString());

    if (platformFilter) {
      contentTypeQuery = contentTypeQuery.eq("platform", platformFilter);
    }

    const { data: contentTypeData } = await contentTypeQuery;

    const typeGroups: Record<string, typeof contentTypeData> = {};
    (contentTypeData || []).forEach((item) => {
      if (!typeGroups[item.media_type]) typeGroups[item.media_type] = [];
      typeGroups[item.media_type].push(item);
    });

    const contentTypes = Object.entries(typeGroups)
      .map(([mediaType, items]) => ({
        mediaType,
        count: items.length,
        avgEngagement: Math.round(average(items, "engagement_score") * 100) / 100,
        avgReach: Math.round(average(items, "reach_score") * 100) / 100,
      }))
      .sort((a, b) => b.avgEngagement - a.avgEngagement);

    let captionQuery = supabase
      .from("social_ai_learning_signals")
      .select("caption_length, engagement_score")
      .eq("organization_id", user.orgId)
      .gte("analyzed_at", start.toISOString())
      .lte("analyzed_at", end.toISOString());

    if (platformFilter) {
      captionQuery = captionQuery.eq("platform", platformFilter);
    }

    const { data: captionData } = await captionQuery;

    const captionRanges = [
      { range: "0-50 chars", min: 0, max: 50 },
      { range: "51-100 chars", min: 51, max: 100 },
      { range: "101-200 chars", min: 101, max: 200 },
      { range: "201-300 chars", min: 201, max: 300 },
      { range: "300+ chars", min: 301, max: Infinity },
    ];

    const captionLengths = captionRanges.map(({ range: label, min, max }) => {
      const items = (captionData || []).filter(
        (item) => item.caption_length >= min && item.caption_length <= max
      );
      return {
        range: label,
        count: items.length,
        avgEngagement:
          items.length > 0 ? Math.round(average(items, "engagement_score") * 100) / 100 : 0,
      };
    });

    let hooksQuery = supabase
      .from("social_ai_learning_signals")
      .select("hook_text, engagement_score, reach_score, platform")
      .eq("organization_id", user.orgId)
      .eq("is_high_performer", true)
      .gte("analyzed_at", start.toISOString())
      .lte("analyzed_at", end.toISOString())
      .not("hook_text", "is", null)
      .order("engagement_score", { ascending: false })
      .limit(10);

    if (platformFilter) {
      hooksQuery = hooksQuery.eq("platform", platformFilter);
    }

    const { data: hooksData } = await hooksQuery;

    const topHooks = (hooksData || []).map((item) => ({
      hookText: item.hook_text || "",
      engagementScore: Math.round(Number(item.engagement_score) * 100) / 100,
      reachScore: Math.round(Number(item.reach_score) * 100) / 100,
      platform: item.platform,
    }));

    let timingQuery = supabase
      .from("social_ai_learning_signals")
      .select("posting_day_of_week, posting_hour, engagement_score")
      .eq("organization_id", user.orgId)
      .gte("analyzed_at", start.toISOString())
      .lte("analyzed_at", end.toISOString())
      .not("posting_day_of_week", "is", null)
      .not("posting_hour", "is", null);

    if (platformFilter) {
      timingQuery = timingQuery.eq("platform", platformFilter);
    }

    const { data: timingData } = await timingQuery;

    const timingMap: Record<string, { totalEngagement: number; count: number }> = {};
    (timingData || []).forEach((item) => {
      const key = `${item.posting_day_of_week}-${item.posting_hour}`;
      if (!timingMap[key]) {
        timingMap[key] = { totalEngagement: 0, count: 0 };
      }
      timingMap[key].totalEngagement += Number(item.engagement_score) || 0;
      timingMap[key].count++;
    });

    const timing = Object.entries(timingMap)
      .map(([key, value]) => {
        const [day, hour] = key.split("-").map(Number);
        return {
          dayOfWeek: day,
          hour,
          avgEngagement: Math.round((value.totalEngagement / value.count) * 100) / 100,
          postCount: value.count,
        };
      })
      .sort((a, b) => b.avgEngagement - a.avgEngagement);

    const insights: AIInsight[] = [];

    if (timing.length > 0) {
      const bestTiming = timing[0];
      const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const hourFormatted =
        bestTiming.hour > 12
          ? `${bestTiming.hour - 12}PM`
          : bestTiming.hour === 12
          ? "12PM"
          : `${bestTiming.hour}AM`;

      insights.push({
        category: "timing",
        title: "Optimal Posting Time",
        description: `Your best performing posts are published on ${dayNames[bestTiming.dayOfWeek]}s around ${hourFormatted}`,
        confidence: bestTiming.postCount >= 10 ? "high" : bestTiming.postCount >= 5 ? "medium" : "low",
        dataPoints: [
          `Based on ${bestTiming.postCount} posts`,
          `Average engagement: ${bestTiming.avgEngagement}%`,
        ],
      });
    }

    if (contentTypes.length > 0) {
      const bestType = contentTypes[0];
      const typeLabel =
        bestType.mediaType === "carousel"
          ? "Carousels"
          : `${bestType.mediaType.charAt(0).toUpperCase()}${bestType.mediaType.slice(1)}s`;

      insights.push({
        category: "media",
        title: "Best Performing Media Type",
        description: `${typeLabel} generate the highest engagement for your audience`,
        confidence: bestType.count >= 10 ? "high" : "medium",
        dataPoints: [
          `${bestType.count} posts analyzed`,
          `Average engagement: ${bestType.avgEngagement}%`,
          `Average reach: ${bestType.avgReach}%`,
        ],
      });
    }

    if (captionLengths.length > 0) {
      const bestLength = captionLengths.reduce(
        (best, current) =>
          current.avgEngagement > best.avgEngagement && current.count >= 3 ? current : best,
        captionLengths[0]
      );

      insights.push({
        category: "content",
        title: "Optimal Caption Length",
        description: `Captions in the ${bestLength.range} range perform best with your audience`,
        confidence: bestLength.count >= 10 ? "high" : "medium",
        dataPoints: [
          `${bestLength.count} posts in this range`,
          `Average engagement: ${bestLength.avgEngagement}%`,
        ],
      });
    }

    if (platforms.length > 1) {
      const bestPlatform = platforms[0];

      insights.push({
        category: "platform",
        title: "Platform Performance",
        description: `${bestPlatform.platform.charAt(0).toUpperCase()}${bestPlatform.platform.slice(1)} is your top performing platform`,
        confidence: bestPlatform.postsCount >= 10 ? "high" : "medium",
        dataPoints: [
          `${bestPlatform.postsCount} posts analyzed`,
          `Average engagement: ${bestPlatform.avgEngagement}%`,
          `Best media type: ${bestPlatform.topMediaType}`,
        ],
      });
    }

    const engagementDelta = calculateDelta(
      Math.round(currentAvgEngagement * 100) / 100,
      Math.round(prevAvgEngagement * 100) / 100
    );

    if (engagementDelta.trend === "up") {
      insights.push({
        category: "engagement",
        title: "Engagement Growing",
        description: "Your overall engagement is trending upward - keep up the good work!",
        confidence: Math.abs(engagementDelta.deltaPercent) > 20 ? "high" : "medium",
        dataPoints: [
          `${engagementDelta.deltaPercent > 0 ? "+" : ""}${engagementDelta.deltaPercent}% vs previous period`,
          `Current average: ${engagementDelta.current}%`,
        ],
      });
    } else if (engagementDelta.trend === "down" && Math.abs(engagementDelta.deltaPercent) > 10) {
      insights.push({
        category: "engagement",
        title: "Engagement Declining",
        description: "Your engagement has decreased - review your recent content strategy",
        confidence: "high",
        dataPoints: [
          `${engagementDelta.deltaPercent}% vs previous period`,
          `Current average: ${engagementDelta.current}%`,
        ],
      });
    }

    return successResponse({
      overview: {
        totalPosts: calculateDelta(currentPosts, prevPosts),
        avgEngagement: engagementDelta,
        avgReach: calculateDelta(
          Math.round(currentAvgReach * 100) / 100,
          Math.round(prevAvgReach * 100) / 100
        ),
        highPerformerPercent,
      },
      platforms,
      contentTypes,
      captionLengths,
      topHooks,
      timing,
      insights,
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
