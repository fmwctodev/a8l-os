import { useState } from 'react';
import { X } from 'lucide-react';
import { createRule, updateRule, TRIGGER_TYPES, type ScoringRule } from '../../../services/scoring';

interface RuleFormModalProps {
  modelId: string;
  rule: ScoringRule | null;
  onClose: () => void;
  onSaved: () => void;
}

export function RuleFormModal({ modelId, rule, onClose, onSaved }: RuleFormModalProps) {
  const [name, setName] = useState(rule?.name || '');
  const [triggerType, setTriggerType] = useState(rule?.trigger_type || '');
  const [points, setPoints] = useState<number>(rule?.points ? Math.abs(rule.points) : 10);
  const [isPositive, setIsPositive] = useState(rule ? rule.points >= 0 : true);
  const [frequencyType, setFrequencyType] = useState<'once' | 'interval' | 'unlimited'>(
    rule?.frequency_type || 'unlimited'
  );
  const [cooldownInterval, setCooldownInterval] = useState<number>(rule?.cooldown_interval || 1);
  const [cooldownUnit, setCooldownUnit] = useState<'minutes' | 'hours' | 'days'>(
    rule?.cooldown_unit || 'days'
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const groupedTriggers = TRIGGER_TYPES.reduce((acc, trigger) => {
    if (!acc[trigger.category]) {
      acc[trigger.category] = [];
    }
    acc[trigger.category].push(trigger);
    return acc;
  }, {} as Record<string, typeof TRIGGER_TYPES>);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Rule name is required');
      return;
    }
    if (!triggerType) {
      setError('Please select a trigger type');
      return;
    }
    if (points === 0) {
      setError('Points cannot be zero');
      return;
    }

    const finalPoints = isPositive ? Math.abs(points) : -Math.abs(points);

    try {
      setLoading(true);
      setError('');

      if (rule) {
        await updateRule(rule.id, {
          name: name.trim(),
          triggerType,
          points: finalPoints,
          frequencyType,
          cooldownInterval: frequencyType === 'interval' ? cooldownInterval : null,
          cooldownUnit: frequencyType === 'interval' ? cooldownUnit : null,
        });
      } else {
        await createRule({
          modelId,
          name: name.trim(),
          triggerType,
          points: finalPoints,
          frequencyType,
          cooldownInterval: frequencyType === 'interval' ? cooldownInterval : null,
          cooldownUnit: frequencyType === 'interval' ? cooldownUnit : null,
        });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save rule');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/60" onClick={onClose} />
        <div className="relative w-full max-w-lg bg-slate-800 rounded-xl shadow-xl border border-slate-700">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
            <h2 className="text-lg font-semibold text-white">
              {rule ? 'Edit Rule' : 'Create Scoring Rule'}
            </h2>
            <button onClick={onClose} className="p-1 rounded hover:bg-slate-700">
              <X className="h-5 w-5 text-slate-400" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Rule Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Form Submission Bonus"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Trigger Event
              </label>
              <select
                value={triggerType}
                onChange={(e) => setTriggerType(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
              >
                <option value="">Select a trigger...</option>
                {Object.entries(groupedTriggers).map(([category, triggers]) => (
                  <optgroup key={category} label={category} className="bg-slate-900 text-slate-300">
                    {triggers.map((trigger) => (
                      <option key={trigger.value} value={trigger.value}>
                        {trigger.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Points
              </label>
              <div className="flex items-center gap-3">
                <div className="flex rounded-lg overflow-hidden border border-slate-700">
                  <button
                    type="button"
                    onClick={() => setIsPositive(true)}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                      isPositive
                        ? 'bg-emerald-500/20 text-emerald-400 border-r border-slate-700'
                        : 'bg-slate-900 text-slate-400 hover:bg-slate-800 border-r border-slate-700'
                    }`}
                  >
                    + Add
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPositive(false)}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                      !isPositive
                        ? 'bg-red-500/20 text-red-400'
                        : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    - Subtract
                  </button>
                </div>
                <input
                  type="number"
                  value={points}
                  onChange={(e) => setPoints(Math.abs(Number(e.target.value)))}
                  min={1}
                  className="w-24 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                />
                <span className="text-sm text-slate-400">points</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Frequency
              </label>
              <div className="space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="frequency"
                    value="unlimited"
                    checked={frequencyType === 'unlimited'}
                    onChange={() => setFrequencyType('unlimited')}
                    className="text-cyan-500 bg-slate-900 border-slate-600 focus:ring-cyan-500"
                  />
                  <span className="text-sm text-slate-300">Unlimited - Apply every time event occurs</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="frequency"
                    value="once"
                    checked={frequencyType === 'once'}
                    onChange={() => setFrequencyType('once')}
                    className="text-cyan-500 bg-slate-900 border-slate-600 focus:ring-cyan-500"
                  />
                  <span className="text-sm text-slate-300">Once - Apply only once per entity</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="frequency"
                    value="interval"
                    checked={frequencyType === 'interval'}
                    onChange={() => setFrequencyType('interval')}
                    className="text-cyan-500 bg-slate-900 border-slate-600 focus:ring-cyan-500"
                  />
                  <span className="text-sm text-slate-300">Cooldown period</span>
                </label>
                {frequencyType === 'interval' && (
                  <div className="ml-6 flex items-center gap-2">
                    <span className="text-sm text-slate-400">Apply once every</span>
                    <input
                      type="number"
                      value={cooldownInterval}
                      onChange={(e) => setCooldownInterval(Number(e.target.value))}
                      min={1}
                      className="w-20 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-white focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                    />
                    <select
                      value={cooldownUnit}
                      onChange={(e) => setCooldownUnit(e.target.value as 'minutes' | 'hours' | 'days')}
                      className="px-2 py-1 bg-slate-900 border border-slate-700 rounded text-white focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                    >
                      <option value="minutes">minutes</option>
                      <option value="hours">hours</option>
                      <option value="days">days</option>
                    </select>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-300 rounded-lg hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-cyan-500 to-teal-600 rounded-lg shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 hover:brightness-110 disabled:opacity-50 transition-all"
              >
                {loading ? 'Saving...' : rule ? 'Update Rule' : 'Create Rule'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
