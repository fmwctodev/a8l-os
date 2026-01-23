import { useState, useEffect } from 'react';
import { Sliders, Shield } from 'lucide-react';
import { getAdjustmentLimits, updateAdjustmentLimits, type AdjustmentLimits } from '../../../services/scoring';

export function SettingsTab() {
  const [limits, setLimits] = useState<AdjustmentLimits | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [maxPositive, setMaxPositive] = useState(100);
  const [maxNegative, setMaxNegative] = useState(100);
  const [requireReason, setRequireReason] = useState(true);

  useEffect(() => {
    loadLimits();
  }, []);

  async function loadLimits() {
    try {
      setLoading(true);
      const data = await getAdjustmentLimits();
      setLimits(data);
      setMaxPositive(data.max_positive_adjustment);
      setMaxNegative(data.max_negative_adjustment);
      setRequireReason(data.require_reason);
    } catch (error) {
      console.error('Failed to load adjustment limits:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    try {
      setSaving(true);
      await updateAdjustmentLimits({
        maxPositiveAdjustment: maxPositive,
        maxNegativeAdjustment: maxNegative,
        requireReason,
      });
      await loadLimits();
    } catch (error) {
      console.error('Failed to save limits:', error);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Sliders className="h-5 w-5 text-teal-600" />
          <h3 className="text-lg font-medium text-gray-900">Manual Adjustment Limits</h3>
        </div>
        <p className="text-sm text-gray-500">
          Configure limits for manual score adjustments to prevent abuse and maintain data integrity.
        </p>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Max Positive Adjustment
            </label>
            <div className="flex items-center gap-2">
              <span className="text-green-600 font-medium">+</span>
              <input
                type="number"
                value={maxPositive}
                onChange={(e) => setMaxPositive(Number(e.target.value))}
                min={1}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
              <span className="text-sm text-gray-500">points</span>
            </div>
            <p className="mt-1 text-xs text-gray-500">Maximum points that can be added in a single adjustment</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Max Negative Adjustment
            </label>
            <div className="flex items-center gap-2">
              <span className="text-red-600 font-medium">-</span>
              <input
                type="number"
                value={maxNegative}
                onChange={(e) => setMaxNegative(Number(e.target.value))}
                min={1}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
              <span className="text-sm text-gray-500">points</span>
            </div>
            <p className="mt-1 text-xs text-gray-500">Maximum points that can be subtracted in a single adjustment</p>
          </div>
        </div>

        <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg cursor-pointer">
          <div>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Require reason for adjustments</span>
            </div>
            <p className="mt-1 text-xs text-gray-500 ml-7">
              Users must provide a reason when manually adjusting scores
            </p>
          </div>
          <button
            type="button"
            onClick={() => setRequireReason(!requireReason)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              requireReason ? 'bg-teal-600' : 'bg-gray-200'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                requireReason ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </label>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
