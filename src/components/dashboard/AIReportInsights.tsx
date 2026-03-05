import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, TrendingUp, TrendingDown, Minus, ChevronRight, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getAIReports } from '../../services/aiReports';
import type { DashboardCard, AIReport } from '../../types/aiReports';

interface AIReportInsightsProps {
  className?: string;
}

export function AIReportInsights({ className = '' }: AIReportInsightsProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [cards, setCards] = useState<(DashboardCard & { reportId: string })[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user?.organization_id) loadCards();
  }, [user?.organization_id]);

  const loadCards = async () => {
    try {
      const reports = await getAIReports(user!.organization_id, { status: 'complete' });
      const allCards: (DashboardCard & { reportId: string })[] = [];

      for (const report of reports.slice(0, 10)) {
        if (report.result_json?.dashboard_cards) {
          for (const card of report.result_json.dashboard_cards) {
            allCards.push({ ...card, reportId: report.id });
          }
        }
      }

      setCards(allCards.slice(0, 6));
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className={`bg-slate-800 rounded-xl border border-slate-700 ${className}`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-semibold text-white">AI Report Insights</h3>
          </div>
        </div>
        <div className="p-5 flex items-center justify-center h-32">
          <Loader2 className="w-5 h-5 text-slate-500 animate-spin" />
        </div>
      </div>
    );
  }

  if (cards.length === 0) return null;

  const trendConfig = {
    up: { icon: TrendingUp, color: 'text-emerald-400' },
    down: { icon: TrendingDown, color: 'text-red-400' },
    flat: { icon: Minus, color: 'text-slate-400' },
  };

  return (
    <div className={`bg-slate-800 rounded-xl border border-slate-700 ${className}`}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-semibold text-white">AI Report Insights</h3>
        </div>
        <button
          onClick={() => navigate('/reporting')}
          className="flex items-center gap-1 text-xs font-medium text-cyan-400 hover:text-cyan-300 transition-colors"
        >
          View Reports
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="p-4 grid grid-cols-2 lg:grid-cols-3 gap-3">
        {cards.map((card, i) => {
          const trend = card.trend || 'flat';
          const config = trendConfig[trend];
          const TrendIcon = config.icon;

          return (
            <button
              key={`${card.card_id}-${i}`}
              onClick={() => navigate(`/reporting/${card.reportId}`)}
              className="bg-slate-700/40 border border-slate-700/60 rounded-lg p-3 text-left hover:bg-slate-700/60 transition-colors group"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-slate-400 truncate pr-2">{card.title}</span>
                {card.delta_pct != null && (
                  <TrendIcon className={`w-3 h-3 flex-shrink-0 ${config.color}`} />
                )}
              </div>
              <div className="text-lg font-bold text-white">{card.value}</div>
              {card.delta_pct != null && (
                <span className={`text-xs ${config.color}`}>
                  {card.delta_pct > 0 ? '+' : ''}{(card.delta_pct * 100).toFixed(1)}%
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
