import { useState, useEffect } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { adjustScore, getAdjustmentLimits, type EntityScore, type AdjustmentLimits } from '../../services/scoring';

interface AdjustScoreModalProps {
  entityType: 'contact' | 'opportunity';
  entityId: string;
  score: EntityScore;
  onClose: () => void;
  onSaved: () => void;
}

export function AdjustScoreModal({ entityType, entityId, score, onClose, onSaved }: AdjustScoreModalProps) {
  const [limits, setLimits] = useState<AdjustmentLimits | null>(null);
  const [isPositive, setIsPositive] = useState(true);
  const [points, setPoints] = useState<number>(0);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingLimits, setLoadingLimits] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadLimits();
  }, []);

  async function loadLimits() {
    try {
      const data = await getAdjustmentLimits();
      setLimits(data);
    } catch (err) {
      console.error('Failed to load limits:', err);
    } finally {
      setLoadingLimits(false);
    }
  }

  const maxScore = score.scoring_models?.max_score;
  const currentScore = score.current_score;
  const finalPoints = isPositive ? Math.abs(points) : -Math.abs(points);
  let newScore = currentScore + finalPoints;
  if (maxScore !== null && maxScore !== undefined && newScore > maxScore) {
    newScore = maxScore;
  }
  if (newScore < 0) {
    newScore = 0;
  }

  const exceedsLimit = limits && (
    (isPositive && points > limits.max_positive_adjustment) ||
    (!isPositive && points > limits.max_negative_adjustment)
  );

  const requiresReason = limits?.require_reason && (!reason || reason.trim() === '');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (points === 0) {
      setError('Points cannot be zero');
      return;
    }

    if (exceedsLimit) {
      setError(`Adjustment exceeds the ${isPositive ? 'positive' : 'negative'} limit of ${isPositive ? limits?.max_positive_adjustment : limits?.max_negative_adjustment} points`);
      return;
    }

    if (requiresReason) {
      setError('A reason is required for manual adjustments');
      return;
    }

    try {
      setLoading(true);
      setError('');
      await adjustScore({
        modelId: score.model_id,
        entityType,
        entityId,
        points: finalPoints,
        reason: reason.trim() || undefined,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to adjust score');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50" onClick={onClose} />
        <div className="relative w-full max-w-md bg-white rounded-xl shadow-xl">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Adjust Score</h2>
            <button onClick={onClose} className="p-1 rounded hover:bg-gray-100">
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <div className="text-center py-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500 mb-1">{score.scoring_models?.name || 'Current Score'}</p>
              <p className="text-3xl font-bold text-gray-900">{currentScore}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Adjustment</label>
              <div className="flex items-center gap-3">
                <div className="flex rounded-lg overflow-hidden border border-gray-300">
                  <button
                    type="button"
                    onClick={() => setIsPositive(true)}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                      isPositive
                        ? 'bg-green-100 text-green-700 border-r border-gray-300'
                        : 'bg-white text-gray-600 hover:bg-gray-50 border-r border-gray-300'
                    }`}
                  >
                    + Add
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPositive(false)}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                      !isPositive
                        ? 'bg-red-100 text-red-700'
                        : 'bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    - Subtract
                  </button>
                </div>
                <input
                  type="number"
                  value={points || ''}
                  onChange={(e) => setPoints(Math.abs(Number(e.target.value)))}
                  min={0}
                  placeholder="0"
                  className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
                <span className="text-sm text-gray-500">points</span>
              </div>
              {limits && (
                <p className="mt-1 text-xs text-gray-500">
                  Limit: +{limits.max_positive_adjustment} / -{limits.max_negative_adjustment} points
                </p>
              )}
            </div>

            {points > 0 && (
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-600">New Score</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-400 line-through">{currentScore}</span>
                  <span className="text-lg font-bold text-gray-900">{newScore}</span>
                  <span className={`text-sm font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                    ({isPositive ? '+' : ''}{finalPoints})
                  </span>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reason {limits?.require_reason && <span className="text-red-500">*</span>}
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain why you're adjusting this score..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 resize-none"
              />
              <p className="mt-1 text-xs text-gray-500 text-right">{reason.length}/500</p>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || loadingLimits || points === 0}
                className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50"
              >
                {loading ? 'Adjusting...' : 'Apply Adjustment'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
