import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp, Pencil, History } from 'lucide-react';
import { getEntityScores, type EntityScore } from '../../services/scoring';
import { AdjustScoreModal } from './AdjustScoreModal';
import { ScoreHistoryPanel } from './ScoreHistoryPanel';

interface ScoreWidgetProps {
  entityType: 'contact' | 'opportunity';
  entityId: string;
  canAdjust?: boolean;
}

export function ScoreWidget({ entityType, entityId, canAdjust = false }: ScoreWidgetProps) {
  const [scores, setScores] = useState<EntityScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedScore, setSelectedScore] = useState<EntityScore | null>(null);

  useEffect(() => {
    loadScores();
  }, [entityType, entityId]);

  async function loadScores() {
    try {
      setLoading(true);
      const data = await getEntityScores(entityType, entityId);
      setScores(data);
    } catch (error) {
      console.error('Failed to load scores:', error);
    } finally {
      setLoading(false);
    }
  }

  function getPrimaryScore(): EntityScore | null {
    return scores.find(s => s.scoring_models?.is_primary) || scores[0] || null;
  }

  function getScoreTrend(score: EntityScore): 'up' | 'down' | 'neutral' {
    const lastUpdate = new Date(score.last_updated_at);
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    if (lastUpdate < dayAgo) return 'neutral';
    return 'neutral';
  }

  function getScorePercentage(score: EntityScore): number | null {
    const maxScore = score.scoring_models?.max_score;
    if (!maxScore) return null;
    return Math.round((score.current_score / maxScore) * 100);
  }

  function handleAdjust(score: EntityScore) {
    setSelectedScore(score);
    setShowAdjustModal(true);
  }

  function handleViewHistory(score: EntityScore) {
    setSelectedScore(score);
    setShowHistory(true);
  }

  if (loading) {
    return (
      <div className="animate-pulse bg-gray-100 rounded-lg h-16" />
    );
  }

  if (scores.length === 0) {
    return null;
  }

  const primaryScore = getPrimaryScore();
  const otherScores = scores.filter(s => s.id !== primaryScore?.id);

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex flex-col">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                {primaryScore?.scoring_models?.name || 'Score'}
              </span>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-2xl font-bold text-gray-900">
                  {primaryScore?.current_score ?? 0}
                </span>
                {primaryScore && getScorePercentage(primaryScore) !== null && (
                  <span className="text-sm text-gray-500">
                    / {primaryScore.scoring_models?.max_score}
                  </span>
                )}
                {primaryScore && (
                  <TrendIndicator trend={getScoreTrend(primaryScore)} />
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canAdjust && primaryScore && (
              <button
                onClick={() => handleAdjust(primaryScore)}
                className="p-2 text-gray-400 hover:text-teal-600 hover:bg-gray-50 rounded-lg transition-colors"
                title="Adjust score"
              >
                <Pencil className="h-4 w-4" />
              </button>
            )}
            {primaryScore && (
              <button
                onClick={() => handleViewHistory(primaryScore)}
                className="p-2 text-gray-400 hover:text-teal-600 hover:bg-gray-50 rounded-lg transition-colors"
                title="View history"
              >
                <History className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {primaryScore && getScorePercentage(primaryScore) !== null && (
          <div className="mt-3">
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-teal-500 to-teal-600 rounded-full transition-all duration-500"
                style={{ width: `${getScorePercentage(primaryScore)}%` }}
              />
            </div>
          </div>
        )}

        {otherScores.length > 0 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 mt-3 text-xs text-gray-500 hover:text-gray-700"
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {otherScores.length} more score{otherScores.length > 1 ? 's' : ''}
          </button>
        )}
      </div>

      {expanded && otherScores.length > 0 && (
        <div className="border-t border-gray-100 px-4 py-3 space-y-3 bg-gray-50">
          {otherScores.map((score) => (
            <div key={score.id} className="flex items-center justify-between">
              <div>
                <span className="text-xs text-gray-500">{score.scoring_models?.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-semibold text-gray-800">{score.current_score}</span>
                  {score.scoring_models?.max_score && (
                    <span className="text-xs text-gray-400">/ {score.scoring_models.max_score}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                {canAdjust && (
                  <button
                    onClick={() => handleAdjust(score)}
                    className="p-1 text-gray-400 hover:text-teal-600 rounded"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                )}
                <button
                  onClick={() => handleViewHistory(score)}
                  className="p-1 text-gray-400 hover:text-teal-600 rounded"
                >
                  <History className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdjustModal && selectedScore && (
        <AdjustScoreModal
          entityType={entityType}
          entityId={entityId}
          score={selectedScore}
          onClose={() => {
            setShowAdjustModal(false);
            setSelectedScore(null);
          }}
          onSaved={() => {
            loadScores();
            setShowAdjustModal(false);
            setSelectedScore(null);
          }}
        />
      )}

      {showHistory && selectedScore && (
        <ScoreHistoryPanel
          entityType={entityType}
          entityId={entityId}
          modelId={selectedScore.model_id}
          modelName={selectedScore.scoring_models?.name || 'Score'}
          onClose={() => {
            setShowHistory(false);
            setSelectedScore(null);
          }}
        />
      )}
    </div>
  );
}

function TrendIndicator({ trend }: { trend: 'up' | 'down' | 'neutral' }) {
  if (trend === 'up') {
    return <TrendingUp className="h-4 w-4 text-green-500" />;
  }
  if (trend === 'down') {
    return <TrendingDown className="h-4 w-4 text-red-500" />;
  }
  return <Minus className="h-4 w-4 text-gray-400" />;
}
