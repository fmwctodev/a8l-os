import { supabase } from '../lib/supabase';
import {
  TimeRangeParams,
  getTimeRangeDates,
  getPreviousPeriodDates,
  calculateDelta,
  DeltaResult,
  getCacheKey,
  getCachedData,
  setCachedData,
  averageField,
} from './analyticsEngine';

const CACHE_TTL = 15 * 60 * 1000;

export interface ContentOverviewMetrics {
  totalPosts: DeltaResult;
  avgEngagement: DeltaResult;
  avgReach: DeltaResult;
  highPerformerPercent: number;
}

export interface PlatformMetrics {
  platform: string;
  postsCount: number;
  avgEngagement: number;
  avgReach: number;
  topMediaType: string;
  bestPostingHour: number;
  trend: 'up' | 'down' | 'stable';
}

export interface ContentTypeMetrics {
  mediaType: string;
  count: number;
  avgEngagement: number;
  avgReach: number;
}

export interface CaptionLengthMetrics {
  range: string;
  count: number;
  avgEngagement: number;
}

export interface HookMetrics {
  hookText: string;
  engagementScore: number;
  reachScore: number;
  platform: string;
}

export interface TimingMetrics {
  dayOfWeek: number;
  hour: number;
  avgEngagement: number;
  postCount: number;
}

export interface AIInsight {
  category: 'timing' | 'content' | 'media' | 'engagement' | 'platform';
  title: string;
  description: string;
  confidence: 'high' | 'medium' | 'low';
  dataPoints: string[];
}

export interface ContentAIAnalytics {
  overview: ContentOverviewMetrics;
  platforms: PlatformMetrics[];
  contentTypes: ContentTypeMetrics[];
  captionLengths: CaptionLengthMetrics[];
  topHooks: HookMetrics[];
  underperformingPatterns: string[];
  timing: TimingMetrics[];
  insights: AIInsight[];
}

async function fetchOverviewMetrics(
  organizationId: string,
  timeRange: TimeRangeParams,
  platformFilter?: string
): Promise<ContentOverviewMetrics> {
  const { start, end } = getTimeRangeDates(timeRange);
  const { start: prevStart, end: prevEnd } = getPreviousPeriodDates(timeRange);

  let currentQuery = supabase
    .from('social_post_metrics')
    .select('id, engagement_score, reach_score')
    .eq('organization_id', organizationId)
    .gte('created_at', start.toISOString())
    .lte('created_at', end.toISOString());

  if (platformFilter) {
    currentQuery = currentQuery.eq('platform', platformFilter);
  }

  const { data: currentData } = await currentQuery;

  let prevQuery = supabase
    .from('social_post_metrics')
    .select('id, engagement_score, reach_score')
    .eq('organization_id', organizationId)
    .gte('created_at', prevStart.toISOString())
    .lte('created_at', prevEnd.toISOString());

  if (platformFilter) {
    prevQuery = prevQuery.eq('platform', platformFilter);
  }

  const { data: prevData } = await prevQuery;

  const currentPosts = currentData?.length || 0;
  const prevPosts = prevData?.length || 0;

  const currentAvgEngagement = averageField(currentData || [], 'engagement_score' as keyof typeof currentData[0]);
  const prevAvgEngagement = averageField(prevData || [], 'engagement_score' as keyof typeof prevData[0]);

  const currentAvgReach = averageField(currentData || [], 'reach_score' as keyof typeof currentData[0]);
  const prevAvgReach = averageField(prevData || [], 'reach_score' as keyof typeof prevData[0]);

  let signalsQuery = supabase
    .from('social_ai_learning_signals')
    .select('id, is_high_performer')
    .eq('organization_id', organizationId)
    .gte('analyzed_at', start.toISOString())
    .lte('analyzed_at', end.toISOString());

  if (platformFilter) {
    signalsQuery = signalsQuery.eq('platform', platformFilter);
  }

  const { data: signalsData } = await signalsQuery;

  const highPerformers = (signalsData || []).filter(s => s.is_high_performer).length;
  const highPerformerPercent = signalsData?.length
    ? Math.round((highPerformers / signalsData.length) * 100)
    : 0;

  return {
    totalPosts: calculateDelta(currentPosts, prevPosts),
    avgEngagement: calculateDelta(
      Math.round(currentAvgEngagement * 100) / 100,
      Math.round(prevAvgEngagement * 100) / 100
    ),
    avgReach: calculateDelta(
      Math.round(currentAvgReach * 100) / 100,
      Math.round(prevAvgReach * 100) / 100
    ),
    highPerformerPercent,
  };
}

async function fetchPlatformMetrics(
  organizationId: string,
  timeRange: TimeRangeParams
): Promise<PlatformMetrics[]> {
  const { start, end } = getTimeRangeDates(timeRange);
  const { start: prevStart, end: prevEnd } = getPreviousPeriodDates(timeRange);

  const { data: currentData } = await supabase
    .from('social_ai_learning_signals')
    .select('platform, media_type, posting_hour, engagement_score, reach_score')
    .eq('organization_id', organizationId)
    .gte('analyzed_at', start.toISOString())
    .lte('analyzed_at', end.toISOString());

  const { data: prevData } = await supabase
    .from('social_ai_learning_signals')
    .select('platform, engagement_score')
    .eq('organization_id', organizationId)
    .gte('analyzed_at', prevStart.toISOString())
    .lte('analyzed_at', prevEnd.toISOString());

  const platformGroups: Record<string, typeof currentData> = {};
  const prevPlatformGroups: Record<string, typeof prevData> = {};

  (currentData || []).forEach(item => {
    if (!platformGroups[item.platform]) platformGroups[item.platform] = [];
    platformGroups[item.platform].push(item);
  });

  (prevData || []).forEach(item => {
    if (!prevPlatformGroups[item.platform]) prevPlatformGroups[item.platform] = [];
    prevPlatformGroups[item.platform].push(item);
  });

  return Object.entries(platformGroups).map(([platform, items]) => {
    const avgEngagement = averageField(items, 'engagement_score' as keyof typeof items[0]);
    const avgReach = averageField(items, 'reach_score' as keyof typeof items[0]);

    const mediaTypeCounts: Record<string, number> = {};
    const hourCounts: Record<number, { count: number; totalEngagement: number }> = {};

    items.forEach(item => {
      mediaTypeCounts[item.media_type] = (mediaTypeCounts[item.media_type] || 0) + 1;

      if (item.posting_hour !== null) {
        if (!hourCounts[item.posting_hour]) {
          hourCounts[item.posting_hour] = { count: 0, totalEngagement: 0 };
        }
        hourCounts[item.posting_hour].count++;
        hourCounts[item.posting_hour].totalEngagement += Number(item.engagement_score) || 0;
      }
    });

    const topMediaType = Object.entries(mediaTypeCounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'image';

    const bestHour = Object.entries(hourCounts)
      .map(([hour, data]) => ({
        hour: parseInt(hour),
        avgEngagement: data.totalEngagement / data.count
      }))
      .sort((a, b) => b.avgEngagement - a.avgEngagement)[0]?.hour || 12;

    const prevItems = prevPlatformGroups[platform] || [];
    const prevAvgEngagement = averageField(prevItems, 'engagement_score' as keyof typeof prevItems[0]);

    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (avgEngagement > prevAvgEngagement * 1.05) trend = 'up';
    else if (avgEngagement < prevAvgEngagement * 0.95) trend = 'down';

    return {
      platform,
      postsCount: items.length,
      avgEngagement: Math.round(avgEngagement * 100) / 100,
      avgReach: Math.round(avgReach * 100) / 100,
      topMediaType,
      bestPostingHour: bestHour,
      trend,
    };
  }).sort((a, b) => b.avgEngagement - a.avgEngagement);
}

async function fetchContentTypeMetrics(
  organizationId: string,
  timeRange: TimeRangeParams,
  platformFilter?: string
): Promise<ContentTypeMetrics[]> {
  const { start, end } = getTimeRangeDates(timeRange);

  let query = supabase
    .from('social_ai_learning_signals')
    .select('media_type, engagement_score, reach_score')
    .eq('organization_id', organizationId)
    .gte('analyzed_at', start.toISOString())
    .lte('analyzed_at', end.toISOString());

  if (platformFilter) {
    query = query.eq('platform', platformFilter);
  }

  const { data } = await query;

  const typeGroups: Record<string, typeof data> = {};
  (data || []).forEach(item => {
    if (!typeGroups[item.media_type]) typeGroups[item.media_type] = [];
    typeGroups[item.media_type].push(item);
  });

  return Object.entries(typeGroups).map(([mediaType, items]) => ({
    mediaType,
    count: items.length,
    avgEngagement: Math.round(averageField(items, 'engagement_score' as keyof typeof items[0]) * 100) / 100,
    avgReach: Math.round(averageField(items, 'reach_score' as keyof typeof items[0]) * 100) / 100,
  })).sort((a, b) => b.avgEngagement - a.avgEngagement);
}

async function fetchCaptionLengthMetrics(
  organizationId: string,
  timeRange: TimeRangeParams,
  platformFilter?: string
): Promise<CaptionLengthMetrics[]> {
  const { start, end } = getTimeRangeDates(timeRange);

  let query = supabase
    .from('social_ai_learning_signals')
    .select('caption_length, engagement_score')
    .eq('organization_id', organizationId)
    .gte('analyzed_at', start.toISOString())
    .lte('analyzed_at', end.toISOString());

  if (platformFilter) {
    query = query.eq('platform', platformFilter);
  }

  const { data } = await query;

  const ranges = [
    { range: '0-50 chars', min: 0, max: 50 },
    { range: '51-100 chars', min: 51, max: 100 },
    { range: '101-200 chars', min: 101, max: 200 },
    { range: '201-300 chars', min: 201, max: 300 },
    { range: '300+ chars', min: 301, max: Infinity },
  ];

  return ranges.map(({ range, min, max }) => {
    const items = (data || []).filter(
      item => item.caption_length >= min && item.caption_length <= max
    );
    return {
      range,
      count: items.length,
      avgEngagement: items.length > 0
        ? Math.round(averageField(items, 'engagement_score' as keyof typeof items[0]) * 100) / 100
        : 0,
    };
  });
}

async function fetchTopHooks(
  organizationId: string,
  timeRange: TimeRangeParams,
  platformFilter?: string
): Promise<HookMetrics[]> {
  const { start, end } = getTimeRangeDates(timeRange);

  let query = supabase
    .from('social_ai_learning_signals')
    .select('hook_text, engagement_score, reach_score, platform')
    .eq('organization_id', organizationId)
    .eq('is_high_performer', true)
    .gte('analyzed_at', start.toISOString())
    .lte('analyzed_at', end.toISOString())
    .not('hook_text', 'is', null)
    .order('engagement_score', { ascending: false })
    .limit(10);

  if (platformFilter) {
    query = query.eq('platform', platformFilter);
  }

  const { data } = await query;

  return (data || []).map(item => ({
    hookText: item.hook_text || '',
    engagementScore: Math.round(Number(item.engagement_score) * 100) / 100,
    reachScore: Math.round(Number(item.reach_score) * 100) / 100,
    platform: item.platform,
  }));
}

async function fetchUnderperformingPatterns(
  organizationId: string,
  timeRange: TimeRangeParams
): Promise<string[]> {
  const { start, end } = getTimeRangeDates(timeRange);

  const { data } = await supabase
    .from('social_ai_learning_signals')
    .select('hook_text, caption_length, media_type, posting_hour, has_cta, emoji_count, hashtag_count')
    .eq('organization_id', organizationId)
    .eq('is_low_performer', true)
    .gte('analyzed_at', start.toISOString())
    .lte('analyzed_at', end.toISOString())
    .limit(50);

  const patterns: string[] = [];

  if (!data || data.length === 0) return patterns;

  const avgCaptionLength = averageField(data, 'caption_length' as keyof typeof data[0]);
  const avgEmojiCount = averageField(data, 'emoji_count' as keyof typeof data[0]);
  const avgHashtagCount = averageField(data, 'hashtag_count' as keyof typeof data[0]);
  const ctaCount = data.filter(d => d.has_cta).length;

  if (avgCaptionLength < 50) {
    patterns.push('Very short captions (under 50 characters) tend to underperform');
  }

  if (avgCaptionLength > 300) {
    patterns.push('Very long captions (over 300 characters) may reduce engagement');
  }

  if (avgEmojiCount === 0) {
    patterns.push('Posts without emojis show lower engagement on average');
  }

  if (avgHashtagCount > 10) {
    patterns.push('Using too many hashtags (10+) can decrease visibility');
  }

  if (ctaCount / data.length < 0.2) {
    patterns.push('Posts without a clear call-to-action often underperform');
  }

  return patterns;
}

async function fetchTimingMetrics(
  organizationId: string,
  timeRange: TimeRangeParams,
  platformFilter?: string
): Promise<TimingMetrics[]> {
  const { start, end } = getTimeRangeDates(timeRange);

  let query = supabase
    .from('social_ai_learning_signals')
    .select('posting_day_of_week, posting_hour, engagement_score')
    .eq('organization_id', organizationId)
    .gte('analyzed_at', start.toISOString())
    .lte('analyzed_at', end.toISOString())
    .not('posting_day_of_week', 'is', null)
    .not('posting_hour', 'is', null);

  if (platformFilter) {
    query = query.eq('platform', platformFilter);
  }

  const { data } = await query;

  const timingMap: Record<string, { totalEngagement: number; count: number }> = {};

  (data || []).forEach(item => {
    const key = `${item.posting_day_of_week}-${item.posting_hour}`;
    if (!timingMap[key]) {
      timingMap[key] = { totalEngagement: 0, count: 0 };
    }
    timingMap[key].totalEngagement += Number(item.engagement_score) || 0;
    timingMap[key].count++;
  });

  return Object.entries(timingMap).map(([key, value]) => {
    const [day, hour] = key.split('-').map(Number);
    return {
      dayOfWeek: day,
      hour,
      avgEngagement: Math.round((value.totalEngagement / value.count) * 100) / 100,
      postCount: value.count,
    };
  }).sort((a, b) => b.avgEngagement - a.avgEngagement);
}

function generateInsights(
  overview: ContentOverviewMetrics,
  platforms: PlatformMetrics[],
  contentTypes: ContentTypeMetrics[],
  captionLengths: CaptionLengthMetrics[],
  timing: TimingMetrics[],
  underperformingPatterns: string[]
): AIInsight[] {
  const insights: AIInsight[] = [];

  if (timing.length > 0) {
    const bestTiming = timing[0];
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const hourFormatted = bestTiming.hour > 12
      ? `${bestTiming.hour - 12}PM`
      : bestTiming.hour === 12
        ? '12PM'
        : `${bestTiming.hour}AM`;

    insights.push({
      category: 'timing',
      title: 'Optimal Posting Time',
      description: `Your best performing posts are published on ${dayNames[bestTiming.dayOfWeek]}s around ${hourFormatted}`,
      confidence: bestTiming.postCount >= 10 ? 'high' : bestTiming.postCount >= 5 ? 'medium' : 'low',
      dataPoints: [
        `Based on ${bestTiming.postCount} posts`,
        `Average engagement: ${bestTiming.avgEngagement}%`,
      ],
    });
  }

  if (contentTypes.length > 0) {
    const bestType = contentTypes[0];
    const typeLabel = bestType.mediaType === 'carousel' ? 'Carousels' : `${bestType.mediaType.charAt(0).toUpperCase()}${bestType.mediaType.slice(1)}s`;

    insights.push({
      category: 'media',
      title: 'Best Performing Media Type',
      description: `${typeLabel} generate the highest engagement for your audience`,
      confidence: bestType.count >= 10 ? 'high' : 'medium',
      dataPoints: [
        `${bestType.count} posts analyzed`,
        `Average engagement: ${bestType.avgEngagement}%`,
        `Average reach: ${bestType.avgReach}%`,
      ],
    });
  }

  if (captionLengths.length > 0) {
    const bestLength = captionLengths.reduce((best, current) =>
      current.avgEngagement > best.avgEngagement && current.count >= 3 ? current : best
    , captionLengths[0]);

    insights.push({
      category: 'content',
      title: 'Optimal Caption Length',
      description: `Captions in the ${bestLength.range} range perform best with your audience`,
      confidence: bestLength.count >= 10 ? 'high' : 'medium',
      dataPoints: [
        `${bestLength.count} posts in this range`,
        `Average engagement: ${bestLength.avgEngagement}%`,
      ],
    });
  }

  if (platforms.length > 1) {
    const bestPlatform = platforms[0];
    const worstPlatform = platforms[platforms.length - 1];

    insights.push({
      category: 'platform',
      title: 'Platform Performance',
      description: `${bestPlatform.platform.charAt(0).toUpperCase()}${bestPlatform.platform.slice(1)} is your top performing platform`,
      confidence: bestPlatform.postsCount >= 10 ? 'high' : 'medium',
      dataPoints: [
        `${bestPlatform.postsCount} posts analyzed`,
        `Average engagement: ${bestPlatform.avgEngagement}%`,
        `Best media type: ${bestPlatform.topMediaType}`,
      ],
    });

    if (worstPlatform.avgEngagement < bestPlatform.avgEngagement * 0.5) {
      insights.push({
        category: 'platform',
        title: 'Platform Opportunity',
        description: `Consider optimizing your ${worstPlatform.platform} strategy - engagement is significantly lower than other platforms`,
        confidence: 'medium',
        dataPoints: [
          `Current engagement: ${worstPlatform.avgEngagement}%`,
          `Best performing platform: ${bestPlatform.avgEngagement}%`,
        ],
      });
    }
  }

  if (overview.avgEngagement.trend === 'up') {
    insights.push({
      category: 'engagement',
      title: 'Engagement Growing',
      description: 'Your overall engagement is trending upward - keep up the good work!',
      confidence: Math.abs(overview.avgEngagement.deltaPercent) > 20 ? 'high' : 'medium',
      dataPoints: [
        `${overview.avgEngagement.deltaPercent > 0 ? '+' : ''}${overview.avgEngagement.deltaPercent}% vs previous period`,
        `Current average: ${overview.avgEngagement.current}%`,
      ],
    });
  } else if (overview.avgEngagement.trend === 'down' && Math.abs(overview.avgEngagement.deltaPercent) > 10) {
    insights.push({
      category: 'engagement',
      title: 'Engagement Declining',
      description: 'Your engagement has decreased - review your recent content strategy',
      confidence: 'high',
      dataPoints: [
        `${overview.avgEngagement.deltaPercent}% vs previous period`,
        `Current average: ${overview.avgEngagement.current}%`,
      ],
    });
  }

  underperformingPatterns.slice(0, 2).forEach(pattern => {
    insights.push({
      category: 'content',
      title: 'Content Optimization',
      description: pattern,
      confidence: 'medium',
      dataPoints: ['Based on analysis of underperforming posts'],
    });
  });

  return insights;
}

export async function getContentAIAnalytics(
  organizationId: string,
  timeRange: TimeRangeParams,
  platformFilter?: string
): Promise<ContentAIAnalytics> {
  const cacheKey = getCacheKey('content-ai', { organizationId, timeRange, platformFilter });
  const cached = getCachedData<ContentAIAnalytics>(cacheKey);
  if (cached) return cached;

  const [
    overview,
    platforms,
    contentTypes,
    captionLengths,
    topHooks,
    underperformingPatterns,
    timing,
  ] = await Promise.all([
    fetchOverviewMetrics(organizationId, timeRange, platformFilter),
    fetchPlatformMetrics(organizationId, timeRange),
    fetchContentTypeMetrics(organizationId, timeRange, platformFilter),
    fetchCaptionLengthMetrics(organizationId, timeRange, platformFilter),
    fetchTopHooks(organizationId, timeRange, platformFilter),
    fetchUnderperformingPatterns(organizationId, timeRange),
    fetchTimingMetrics(organizationId, timeRange, platformFilter),
  ]);

  const insights = generateInsights(
    overview,
    platforms,
    contentTypes,
    captionLengths,
    timing,
    underperformingPatterns
  );

  const result: ContentAIAnalytics = {
    overview,
    platforms,
    contentTypes,
    captionLengths,
    topHooks,
    underperformingPatterns,
    timing,
    insights,
  };

  setCachedData(cacheKey, result, CACHE_TTL);

  return result;
}
