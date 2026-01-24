import { useState } from 'react';
import { Sparkles, TrendingDown, TrendingUp, Pause, Play, Check, X, AlertTriangle } from 'lucide-react';
import { applyRecommendation, dismissRecommendation } from '../../../services/emailCampaignDomains';
import type { EmailWarmupAIRecommendation } from '../../../types';

interface AIRecommendationsPanelProps {
  domainId: string;
  recommendations: EmailWarmupAIRecommendation[];
  onUpdate: () => void;
}

export function AIRecommendationsPanel({ domainId, recommendations, onUpdate }: AIRecommendationsPanelProps) {
  const [applying, setApplying] = useState<string | null>(null);
  const [dismissing, setDismissing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleApply = async (recommendationId: string) => {
    setApplying(recommendationId);
    setError(null);
    try {
      const result = await applyRecommendation(recommendationId);
      if (result.success) {
        onUpdate();
      } else {
        setError(result.error || 'Failed to apply recommendation');
      }
    } catch (err) {
      setError('Failed to apply recommendation');
    } finally {
      setApplying(null);
    }
  };

  const handleDismiss = async (recommendationId: string) => {
    setDismissing(recommendationId);
    setError(null);
    try {
      const result = await dismissRecommendation(recommendationId);
      if (result.success) {
        onUpdate();
      } else {
        setError(result.error || 'Failed to dismiss recommendation');
      }
    } catch (err) {
      setError('Failed to dismiss recommendation');
    } finally {
      setDismissing(null);
    }
  };

  const getRecommendationIcon = (type: EmailWarmupAIRecommendation['recommendation_type']) => {
    switch (type) {
      case 'slow_down':
        return <TrendingDown className="h-5 w-5 text-amber-400" />;
      case 'speed_up':
        return <TrendingUp className="h-5 w-5 text-emerald-400" />;
      case 'pause':
        return <Pause className="h-5 w-5 text-red-400" />;
      case 'resume':
        return <Play className="h-5 w-5 text-cyan-400" />;
      default:
        return <Sparkles className="h-5 w-5 text-cyan-400" />;
    }
  };

  const getRecommendationTitle = (type: EmailWarmupAIRecommendation['recommendation_type']) => {
    switch (type) {
      case 'slow_down':
        return 'Slow Down Recommended';
      case 'speed_up':
        return 'Speed Up Recommended';
      case 'pause':
        return 'Pause Recommended';
      case 'resume':
        return 'Resume Recommended';
      default:
        return 'AI Recommendation';
    }
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.8) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          High Confidence
        </span>
      );
    }
    if (confidence >= 0.6) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
          Medium Confidence
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20">
        Low Confidence
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Sparkles className="h-5 w-5 text-amber-400" />
        <div>
          <h4 className="text-sm font-medium text-white">AI Recommendations</h4>
          <p className="text-xs text-slate-400">
            Intelligent suggestions to optimize your warm-up
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {recommendations.length === 0 ? (
        <div className="bg-slate-900/50 rounded-lg p-8 text-center">
          <Sparkles className="h-12 w-12 text-slate-600 mx-auto mb-4" />
          <p className="text-sm text-slate-400">No pending recommendations</p>
          <p className="text-xs text-slate-500 mt-1">
            AI will analyze your metrics and suggest optimizations
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {recommendations.map((rec) => (
            <div
              key={rec.id}
              className={`bg-slate-900/50 border rounded-lg p-4 ${
                rec.recommendation_type === 'pause' || rec.recommendation_type === 'slow_down'
                  ? 'border-amber-500/20'
                  : 'border-slate-700'
              }`}
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 mt-0.5">
                  {getRecommendationIcon(rec.recommendation_type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h5 className="text-sm font-medium text-white">
                      {getRecommendationTitle(rec.recommendation_type)}
                    </h5>
                    {getConfidenceBadge(rec.confidence_score)}
                  </div>
                  <p className="mt-2 text-sm text-slate-300">{rec.reason}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    Suggested {new Date(rec.created_at).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  onClick={() => handleDismiss(rec.id)}
                  disabled={dismissing === rec.id}
                  className="inline-flex items-center px-3 py-1.5 border border-slate-600 text-sm font-medium rounded-md text-slate-300 bg-slate-700 hover:bg-slate-600 disabled:opacity-50"
                >
                  <X className="h-4 w-4 mr-1" />
                  {dismissing === rec.id ? 'Dismissing...' : 'Dismiss'}
                </button>
                <button
                  onClick={() => handleApply(rec.id)}
                  disabled={applying === rec.id}
                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50"
                >
                  <Check className="h-4 w-4 mr-1" />
                  {applying === rec.id ? 'Applying...' : 'Apply'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-cyan-500/5 border border-cyan-500/10 rounded-lg p-4">
        <div className="flex gap-3">
          <AlertTriangle className="h-5 w-5 text-cyan-400 flex-shrink-0" />
          <div>
            <p className="text-sm text-cyan-400 font-medium">How AI recommendations work</p>
            <p className="text-xs text-slate-400 mt-1">
              Our AI analyzes your delivery metrics, bounce rates, and engagement patterns to suggest
              optimal warm-up adjustments. Recommendations require your approval before being applied.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
