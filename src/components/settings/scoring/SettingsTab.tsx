import { useState, useEffect } from 'react';
import { Sliders, Shield, Palette, Plus, Trash2, GripVertical } from 'lucide-react';
import { getAdjustmentLimits, updateAdjustmentLimits, type AdjustmentLimits } from '../../../services/scoring';

interface ScoreBand {
  id: string;
  label: string;
  minScore: number;
  maxScore: number | null;
  color: string;
}

const DEFAULT_BANDS: ScoreBand[] = [
  { id: '1', label: 'Cold', minScore: 0, maxScore: 29, color: '#64748b' },
  { id: '2', label: 'Warm', minScore: 30, maxScore: 69, color: '#f59e0b' },
  { id: '3', label: 'Hot', minScore: 70, maxScore: null, color: '#ef4444' },
];

const BAND_COLORS = [
  { value: '#64748b', label: 'Slate' },
  { value: '#3b82f6', label: 'Blue' },
  { value: '#06b6d4', label: 'Cyan' },
  { value: '#10b981', label: 'Emerald' },
  { value: '#f59e0b', label: 'Amber' },
  { value: '#f97316', label: 'Orange' },
  { value: '#ef4444', label: 'Red' },
  { value: '#ec4899', label: 'Pink' },
];

export function SettingsTab() {
  const [limits, setLimits] = useState<AdjustmentLimits | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [maxPositive, setMaxPositive] = useState(100);
  const [maxNegative, setMaxNegative] = useState(100);
  const [requireReason, setRequireReason] = useState(true);
  const [scoreBands, setScoreBands] = useState<ScoreBand[]>(DEFAULT_BANDS);

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

  function addBand() {
    const lastBand = scoreBands[scoreBands.length - 1];
    const newMinScore = lastBand?.maxScore ? lastBand.maxScore + 1 : 0;
    const newBand: ScoreBand = {
      id: Date.now().toString(),
      label: 'New Band',
      minScore: newMinScore,
      maxScore: null,
      color: '#64748b',
    };
    if (lastBand) {
      lastBand.maxScore = newMinScore - 1;
    }
    setScoreBands([...scoreBands.slice(0, -1), { ...lastBand! }, newBand]);
  }

  function removeBand(id: string) {
    if (scoreBands.length <= 1) return;
    const index = scoreBands.findIndex(b => b.id === id);
    if (index === -1) return;
    const newBands = [...scoreBands];
    newBands.splice(index, 1);
    if (index === newBands.length && newBands.length > 0) {
      newBands[newBands.length - 1].maxScore = null;
    }
    setScoreBands(newBands);
  }

  function updateBand(id: string, updates: Partial<ScoreBand>) {
    setScoreBands(bands => bands.map(band =>
      band.id === id ? { ...band, ...updates } : band
    ));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Sliders className="h-5 w-5 text-cyan-400" />
          <h3 className="text-lg font-medium text-white">Manual Adjustment Limits</h3>
        </div>
        <p className="text-sm text-slate-400">
          Configure limits for manual score adjustments to prevent abuse and maintain data integrity.
        </p>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Max Positive Adjustment
            </label>
            <div className="flex items-center gap-2">
              <span className="text-emerald-400 font-medium">+</span>
              <input
                type="number"
                value={maxPositive}
                onChange={(e) => setMaxPositive(Number(e.target.value))}
                min={1}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
              />
              <span className="text-sm text-slate-400">points</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">Maximum points that can be added in a single adjustment</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Max Negative Adjustment
            </label>
            <div className="flex items-center gap-2">
              <span className="text-red-400 font-medium">-</span>
              <input
                type="number"
                value={maxNegative}
                onChange={(e) => setMaxNegative(Number(e.target.value))}
                min={1}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
              />
              <span className="text-sm text-slate-400">points</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">Maximum points that can be subtracted in a single adjustment</p>
          </div>
        </div>

        <label className="flex items-center justify-between p-4 bg-slate-900 rounded-lg cursor-pointer border border-slate-700">
          <div>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-slate-400" />
              <span className="text-sm font-medium text-slate-300">Require reason for adjustments</span>
            </div>
            <p className="mt-1 text-xs text-slate-500 ml-7">
              Users must provide a reason when manually adjusting scores
            </p>
          </div>
          <button
            type="button"
            onClick={() => setRequireReason(!requireReason)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              requireReason ? 'bg-cyan-500' : 'bg-slate-600'
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

      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Palette className="h-5 w-5 text-cyan-400" />
            <h3 className="text-lg font-medium text-white">Score Bands</h3>
          </div>
          <button
            onClick={addBand}
            className="flex items-center gap-1 px-3 py-1.5 text-sm text-cyan-400 hover:text-cyan-300 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Band
          </button>
        </div>
        <p className="text-sm text-slate-400">
          Define score ranges and labels for quick lead qualification (e.g., Cold, Warm, Hot).
        </p>

        <div className="space-y-3">
          {scoreBands.map((band, index) => (
            <div
              key={band.id}
              className="flex items-center gap-3 p-3 bg-slate-900 rounded-lg border border-slate-700"
            >
              <GripVertical className="h-4 w-4 text-slate-600 cursor-grab" />
              <div
                className="w-4 h-4 rounded-full flex-shrink-0"
                style={{ backgroundColor: band.color }}
              />
              <input
                type="text"
                value={band.label}
                onChange={(e) => updateBand(band.id, { label: e.target.value })}
                className="w-28 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-white text-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
              />
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <input
                  type="number"
                  value={band.minScore}
                  onChange={(e) => updateBand(band.id, { minScore: Number(e.target.value) })}
                  className="w-16 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-white text-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                  min={0}
                />
                <span>to</span>
                {band.maxScore !== null ? (
                  <input
                    type="number"
                    value={band.maxScore}
                    onChange={(e) => updateBand(band.id, { maxScore: Number(e.target.value) })}
                    className="w-16 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-white text-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                    min={band.minScore}
                  />
                ) : (
                  <span className="w-16 text-center text-slate-500">No max</span>
                )}
              </div>
              <select
                value={band.color}
                onChange={(e) => updateBand(band.id, { color: e.target.value })}
                className="px-2 py-1 bg-slate-800 border border-slate-700 rounded text-white text-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
              >
                {BAND_COLORS.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
              <button
                onClick={() => removeBand(band.id)}
                disabled={scoreBands.length <= 1}
                className="p-1 text-slate-500 hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-slate-400">Preview:</span>
          {scoreBands.map((band) => (
            <span
              key={band.id}
              className="px-2 py-0.5 rounded-full text-xs font-medium text-white"
              style={{ backgroundColor: band.color }}
            >
              {band.label}: {band.minScore}{band.maxScore !== null ? `-${band.maxScore}` : '+'}
            </span>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-gradient-to-r from-cyan-500 to-teal-600 text-white rounded-lg shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 hover:brightness-110 disabled:opacity-50 transition-all"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
