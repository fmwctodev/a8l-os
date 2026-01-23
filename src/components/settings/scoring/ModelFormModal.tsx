import { useState } from 'react';
import { X } from 'lucide-react';
import type { ScoringModel } from '../../../services/scoring';

interface ModelFormModalProps {
  model: ScoringModel | null;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    scope: 'contact' | 'opportunity';
    startingScore: number;
    maxScore: number | null;
    isPrimary: boolean;
  }) => Promise<void>;
}

export function ModelFormModal({ model, onClose, onSubmit }: ModelFormModalProps) {
  const [name, setName] = useState(model?.name || '');
  const [scope, setScope] = useState<'contact' | 'opportunity'>(model?.scope || 'contact');
  const [startingScore, setStartingScore] = useState(model?.starting_score || 0);
  const [maxScore, setMaxScore] = useState<number | ''>(model?.max_score ?? '');
  const [isPrimary, setIsPrimary] = useState(model?.is_primary || false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    try {
      setLoading(true);
      setError('');
      await onSubmit({
        name: name.trim(),
        scope,
        startingScore,
        maxScore: maxScore === '' ? null : Number(maxScore),
        isPrimary,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save model');
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
            <h2 className="text-lg font-semibold text-gray-900">
              {model ? 'Edit Model' : 'Create Scoring Model'}
            </h2>
            <button onClick={onClose} className="p-1 rounded hover:bg-gray-100">
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Model Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Lead Score, Engagement Score"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Scope
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="scope"
                    value="contact"
                    checked={scope === 'contact'}
                    onChange={() => setScope('contact')}
                    disabled={!!model}
                    className="text-teal-600 focus:ring-teal-500"
                  />
                  <span className="text-sm text-gray-700">Contact</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="scope"
                    value="opportunity"
                    checked={scope === 'opportunity'}
                    onChange={() => setScope('opportunity')}
                    disabled={!!model}
                    className="text-teal-600 focus:ring-teal-500"
                  />
                  <span className="text-sm text-gray-700">Opportunity</span>
                </label>
              </div>
              {model && (
                <p className="mt-1 text-xs text-gray-500">Scope cannot be changed after creation</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Starting Score
                </label>
                <input
                  type="number"
                  value={startingScore}
                  onChange={(e) => setStartingScore(Number(e.target.value))}
                  min={0}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Score
                </label>
                <input
                  type="number"
                  value={maxScore}
                  onChange={(e) => setMaxScore(e.target.value === '' ? '' : Number(e.target.value))}
                  min={1}
                  placeholder="No limit"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>
            </div>

            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPrimary}
                  onChange={(e) => setIsPrimary(e.target.checked)}
                  className="rounded text-teal-600 focus:ring-teal-500"
                />
                <span className="text-sm text-gray-700">Set as primary model for this scope</span>
              </label>
              <p className="mt-1 text-xs text-gray-500 ml-6">
                The primary model is displayed by default on contact/opportunity cards
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50"
              >
                {loading ? 'Saving...' : model ? 'Update Model' : 'Create Model'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
