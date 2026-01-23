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
  const [points, setPoints] = useState<number>(rule?.points || 0);
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
        <div className="fixed inset-0 bg-black/50" onClick={onClose} />
        <div className="relative w-full max-w-lg bg-white rounded-xl shadow-xl">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              {rule ? 'Edit Rule' : 'Create Scoring Rule'}
            </h2>
            <button onClick={onClose} className="p-1 rounded hover:bg-gray-100">
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Rule Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Form Submission Bonus"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Trigger Event
              </label>
              <select
                value={triggerType}
                onChange={(e) => setTriggerType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              >
                <option value="">Select a trigger...</option>
                {Object.entries(groupedTriggers).map(([category, triggers]) => (
                  <optgroup key={category} label={category}>
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
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Points
              </label>
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
                  value={Math.abs(points)}
                  onChange={(e) => setPoints(Math.abs(Number(e.target.value)))}
                  min={1}
                  className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
                <span className="text-sm text-gray-500">points</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
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
                    className="text-teal-600 focus:ring-teal-500"
                  />
                  <span className="text-sm text-gray-700">Unlimited - Apply every time event occurs</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="frequency"
                    value="once"
                    checked={frequencyType === 'once'}
                    onChange={() => setFrequencyType('once')}
                    className="text-teal-600 focus:ring-teal-500"
                  />
                  <span className="text-sm text-gray-700">Once - Apply only once per entity</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="frequency"
                    value="interval"
                    checked={frequencyType === 'interval'}
                    onChange={() => setFrequencyType('interval')}
                    className="text-teal-600 focus:ring-teal-500"
                  />
                  <span className="text-sm text-gray-700">Cooldown period</span>
                </label>
                {frequencyType === 'interval' && (
                  <div className="ml-6 flex items-center gap-2">
                    <span className="text-sm text-gray-600">Apply once every</span>
                    <input
                      type="number"
                      value={cooldownInterval}
                      onChange={(e) => setCooldownInterval(Number(e.target.value))}
                      min={1}
                      className="w-20 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    />
                    <select
                      value={cooldownUnit}
                      onChange={(e) => setCooldownUnit(e.target.value as 'minutes' | 'hours' | 'days')}
                      className="px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    >
                      <option value="minutes">minutes</option>
                      <option value="hours">hours</option>
                      <option value="days">days</option>
                    </select>
                  </div>
                )}
              </div>
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
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50"
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
