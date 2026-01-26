import { useState } from 'react';
import {
  BarChart3,
  TrendingUp,
  Clock,
  FileText,
  Image,
  Lightbulb,
  RefreshCw,
  ChevronDown,
} from 'lucide-react';
import { useContentAIAnalytics } from '../../hooks/useContentAIAnalytics';
import {
  AnalyticsKPICard,
  TimeRangeSelector,
  ExportButton,
  PlatformComparisonCard,
  InsightCard,
  TimingHeatmap,
} from '../../components/analytics';

const tabs = [
  { id: 'platforms', label: 'Platforms', icon: BarChart3 },
  { id: 'hooks', label: 'Hooks & Copy', icon: FileText },
  { id: 'media', label: 'Media', icon: Image },
  { id: 'timing', label: 'Timing', icon: Clock },
  { id: 'insights', label: 'AI Learnings', icon: Lightbulb },
] as const;

type TabId = typeof tabs[number]['id'];

const platformOptions = [
  { value: '', label: 'All Platforms' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'twitter', label: 'Twitter' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'youtube', label: 'YouTube' },
];

export function ContentAIAnalytics() {
  const [activeTab, setActiveTab] = useState<TabId>('platforms');

  const {
    data,
    loading,
    error,
    timeRange,
    platformFilter,
    startDate,
    endDate,
    setTimeRange,
    setPlatformFilter,
    refetch,
    exportToPDF,
  } = useContentAIAnalytics();

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-6 text-center">
          <p className="text-red-400">Failed to load analytics: {error}</p>
          <button
            onClick={refetch}
            className="mt-4 px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Content AI Analytics</h1>
          <p className="text-slate-400 mt-1">
            Analyze your social content performance and discover what works best
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <select
              value={platformFilter || ''}
              onChange={(e) => setPlatformFilter(e.target.value || undefined)}
              className="appearance-none pl-4 pr-10 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {platformOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
          <TimeRangeSelector
            value={timeRange}
            onChange={setTimeRange}
            startDate={startDate}
            endDate={endDate}
          />
          <ExportButton onExport={exportToPDF} disabled={!data} />
          <button
            onClick={refetch}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <AnalyticsKPICard
          title="Total Posts"
          value={data?.overview.totalPosts.current ?? '--'}
          delta={data?.overview.totalPosts}
          icon={FileText}
          iconColor="text-blue-400"
        />
        <AnalyticsKPICard
          title="Avg Engagement"
          value={data?.overview.avgEngagement.current ? `${data.overview.avgEngagement.current}%` : '--'}
          delta={data?.overview.avgEngagement}
          icon={TrendingUp}
          iconColor="text-emerald-400"
        />
        <AnalyticsKPICard
          title="Avg Reach"
          value={data?.overview.avgReach.current ? `${data.overview.avgReach.current}%` : '--'}
          delta={data?.overview.avgReach}
          icon={BarChart3}
          iconColor="text-amber-400"
        />
        <AnalyticsKPICard
          title="High Performers"
          value={data?.overview.highPerformerPercent ? `${data.overview.highPerformerPercent}%` : '--'}
          icon={Lightbulb}
          iconColor="text-rose-400"
          sublabel="Posts above 75th percentile"
        />
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-xl">
        <div className="flex border-b border-slate-700">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'text-white border-b-2 border-blue-500 -mb-px'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="p-6">
          {loading && !data ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 text-slate-500 animate-spin" />
            </div>
          ) : (
            <>
              {activeTab === 'platforms' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-medium text-white">Platform Performance</h3>
                  {data?.platforms && data.platforms.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {data.platforms.map((platform) => (
                        <PlatformComparisonCard key={platform.platform} data={platform} />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-slate-400">
                      No platform data available for the selected period
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'hooks' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium text-white mb-4">Top Performing Hooks</h3>
                    {data?.topHooks && data.topHooks.length > 0 ? (
                      <div className="space-y-3">
                        {data.topHooks.map((hook, index) => (
                          <div
                            key={index}
                            className="bg-slate-700/50 border border-slate-600 rounded-lg p-4"
                          >
                            <p className="text-white mb-2">"{hook.hookText}"</p>
                            <div className="flex items-center gap-4 text-sm text-slate-400">
                              <span className="capitalize">{hook.platform}</span>
                              <span>Engagement: {hook.engagementScore}%</span>
                              <span>Reach: {hook.reachScore}%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-slate-400">
                        No hook data available for the selected period
                      </div>
                    )}
                  </div>

                  <div>
                    <h3 className="text-lg font-medium text-white mb-4">Caption Length Analysis</h3>
                    {data?.captionLengths && data.captionLengths.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="text-left border-b border-slate-700">
                              <th className="pb-3 text-sm font-medium text-slate-400">Length Range</th>
                              <th className="pb-3 text-sm font-medium text-slate-400 text-right">Posts</th>
                              <th className="pb-3 text-sm font-medium text-slate-400 text-right">Avg Engagement</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.captionLengths.map((item) => (
                              <tr key={item.range} className="border-b border-slate-700/50">
                                <td className="py-3 text-white">{item.range}</td>
                                <td className="py-3 text-slate-300 text-right">{item.count}</td>
                                <td className="py-3 text-slate-300 text-right">{item.avgEngagement}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-slate-400">
                        No caption data available for the selected period
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'media' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-medium text-white mb-4">Content Type Performance</h3>
                  {data?.contentTypes && data.contentTypes.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {data.contentTypes.map((type) => (
                        <div
                          key={type.mediaType}
                          className="bg-slate-700/50 border border-slate-600 rounded-lg p-4"
                        >
                          <div className="flex items-center gap-2 mb-3">
                            <Image className="w-5 h-5 text-slate-400" />
                            <span className="text-white font-medium capitalize">{type.mediaType}</span>
                          </div>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-slate-400">Posts</span>
                              <span className="text-white">{type.count}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Avg Engagement</span>
                              <span className="text-emerald-400">{type.avgEngagement}%</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Avg Reach</span>
                              <span className="text-blue-400">{type.avgReach}%</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-slate-400">
                      No media data available for the selected period
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'timing' && (
                <div className="space-y-6">
                  {data?.timing && data.timing.length > 0 ? (
                    <TimingHeatmap data={data.timing} />
                  ) : (
                    <div className="text-center py-8 text-slate-400">
                      No timing data available for the selected period
                    </div>
                  )}

                  {data?.timing && data.timing.length > 0 && (
                    <div>
                      <h3 className="text-lg font-medium text-white mb-4">Top Performing Time Slots</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="text-left border-b border-slate-700">
                              <th className="pb-3 text-sm font-medium text-slate-400">Day</th>
                              <th className="pb-3 text-sm font-medium text-slate-400">Time</th>
                              <th className="pb-3 text-sm font-medium text-slate-400 text-right">Posts</th>
                              <th className="pb-3 text-sm font-medium text-slate-400 text-right">Avg Engagement</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.timing.slice(0, 10).map((item, index) => {
                              const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                              const formatHour = (hour: number) => {
                                if (hour === 0) return '12AM';
                                if (hour === 12) return '12PM';
                                if (hour > 12) return `${hour - 12}PM`;
                                return `${hour}AM`;
                              };

                              return (
                                <tr key={index} className="border-b border-slate-700/50">
                                  <td className="py-3 text-white">{dayNames[item.dayOfWeek]}</td>
                                  <td className="py-3 text-slate-300">{formatHour(item.hour)}</td>
                                  <td className="py-3 text-slate-300 text-right">{item.postCount}</td>
                                  <td className="py-3 text-emerald-400 text-right">{item.avgEngagement}%</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'insights' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-white mb-4">AI-Generated Insights</h3>
                  {data?.insights && data.insights.length > 0 ? (
                    data.insights.map((insight, index) => (
                      <InsightCard key={index} insight={insight} />
                    ))
                  ) : (
                    <div className="text-center py-8 text-slate-400">
                      Not enough data to generate insights. Post more content to see AI recommendations.
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
