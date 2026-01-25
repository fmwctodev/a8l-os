import { useState } from 'react';
import { Plus, X, Save, ThumbsUp, ThumbsDown } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import { updateBrandKitVoice } from '../../../../services/brandboard';
import type { BrandKitWithVersion, ToneSettings, VoiceTrainingExamples, VoiceTrainingExample } from '../../../../types';

interface BrandVoiceTabNewProps {
  kit: BrandKitWithVersion;
  onUpdate: () => void;
  canManage: boolean;
}

interface ToneSliderProps {
  label: string;
  lowLabel: string;
  highLabel: string;
  value: number;
  onChange: (value: number) => void;
  disabled: boolean;
}

function ToneSlider({ label, lowLabel, highLabel, value, onChange, disabled }: ToneSliderProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-slate-300">{label}</label>
        <span className="text-xs text-slate-400">{value}%</span>
      </div>
      <div className="relative">
        <input
          type="range"
          min="0"
          max="100"
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value))}
          disabled={disabled}
          className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-60
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:w-4
            [&::-webkit-slider-thumb]:h-4
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-cyan-500
            [&::-webkit-slider-thumb]:shadow-lg
            [&::-webkit-slider-thumb]:cursor-pointer
            [&::-moz-range-thumb]:w-4
            [&::-moz-range-thumb]:h-4
            [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:bg-cyan-500
            [&::-moz-range-thumb]:border-0
            [&::-moz-range-thumb]:cursor-pointer"
          style={{
            background: `linear-gradient(to right, #06b6d4 0%, #06b6d4 ${value}%, #334155 ${value}%, #334155 100%)`,
          }}
        />
      </div>
      <div className="flex justify-between text-xs text-slate-500">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
    </div>
  );
}

export function BrandVoiceTabNew({ kit, onUpdate, canManage }: BrandVoiceTabNewProps) {
  const { user } = useAuth();
  const v = kit.latest_version;

  const [toneSettings, setToneSettings] = useState<ToneSettings>(
    v?.tone_settings || { formality: 50, friendliness: 50, energy: 50, confidence: 50 }
  );
  const [voiceDescriptors, setVoiceDescriptors] = useState<string[]>(v?.voice_descriptors || []);
  const [voiceExamples, setVoiceExamples] = useState<VoiceTrainingExamples>(
    v?.voice_examples || { good: [], bad: [] }
  );
  const [dos, setDos] = useState<string[]>(v?.dos || []);
  const [donts, setDonts] = useState<string[]>(v?.donts || []);
  const [newDescriptor, setNewDescriptor] = useState('');
  const [newDo, setNewDo] = useState('');
  const [newDont, setNewDont] = useState('');
  const [newGoodExample, setNewGoodExample] = useState('');
  const [newBadExample, setNewBadExample] = useState('');
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const isEditable = kit.status === 'draft' && canManage;

  const handleToneChange = (key: keyof ToneSettings, value: number) => {
    setToneSettings((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleAddDescriptor = () => {
    if (!newDescriptor.trim()) return;
    setVoiceDescriptors((prev) => [...prev, newDescriptor.trim()]);
    setNewDescriptor('');
    setHasChanges(true);
  };

  const handleRemoveDescriptor = (index: number) => {
    setVoiceDescriptors((prev) => prev.filter((_, i) => i !== index));
    setHasChanges(true);
  };

  const handleAddDo = () => {
    if (!newDo.trim()) return;
    setDos((prev) => [...prev, newDo.trim()]);
    setNewDo('');
    setHasChanges(true);
  };

  const handleRemoveDo = (index: number) => {
    setDos((prev) => prev.filter((_, i) => i !== index));
    setHasChanges(true);
  };

  const handleAddDont = () => {
    if (!newDont.trim()) return;
    setDonts((prev) => [...prev, newDont.trim()]);
    setNewDont('');
    setHasChanges(true);
  };

  const handleRemoveDont = (index: number) => {
    setDonts((prev) => prev.filter((_, i) => i !== index));
    setHasChanges(true);
  };

  const handleAddGoodExample = () => {
    if (!newGoodExample.trim()) return;
    setVoiceExamples((prev) => ({
      ...prev,
      good: [...prev.good, { text: newGoodExample.trim() }],
    }));
    setNewGoodExample('');
    setHasChanges(true);
  };

  const handleRemoveGoodExample = (index: number) => {
    setVoiceExamples((prev) => ({
      ...prev,
      good: prev.good.filter((_, i) => i !== index),
    }));
    setHasChanges(true);
  };

  const handleAddBadExample = () => {
    if (!newBadExample.trim()) return;
    setVoiceExamples((prev) => ({
      ...prev,
      bad: [...prev.bad, { text: newBadExample.trim() }],
    }));
    setNewBadExample('');
    setHasChanges(true);
  };

  const handleRemoveBadExample = (index: number) => {
    setVoiceExamples((prev) => ({
      ...prev,
      bad: prev.bad.filter((_, i) => i !== index),
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!user?.id) return;
    setSaving(true);
    try {
      await updateBrandKitVoice(kit.id, {
        tone_settings: toneSettings,
        voice_descriptors: voiceDescriptors,
        voice_examples: voiceExamples,
        dos,
        donts,
      }, user.id);
      setHasChanges(false);
      onUpdate();
    } catch (error) {
      console.error('Failed to save:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-white">Tone Settings</h2>
          <p className="text-sm text-slate-400 mt-1">Adjust sliders to define your brand's voice characteristics</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <ToneSlider
            label="Formality"
            lowLabel="Casual"
            highLabel="Formal"
            value={toneSettings.formality}
            onChange={(v) => handleToneChange('formality', v)}
            disabled={!isEditable}
          />
          <ToneSlider
            label="Friendliness"
            lowLabel="Direct"
            highLabel="Warm"
            value={toneSettings.friendliness}
            onChange={(v) => handleToneChange('friendliness', v)}
            disabled={!isEditable}
          />
          <ToneSlider
            label="Energy"
            lowLabel="Calm"
            highLabel="Energetic"
            value={toneSettings.energy}
            onChange={(v) => handleToneChange('energy', v)}
            disabled={!isEditable}
          />
          <ToneSlider
            label="Confidence"
            lowLabel="Humble"
            highLabel="Assertive"
            value={toneSettings.confidence}
            onChange={(v) => handleToneChange('confidence', v)}
            disabled={!isEditable}
          />
        </div>
      </div>

      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-white">Voice Descriptors</h2>
          <p className="text-sm text-slate-400 mt-1">Tags that describe your brand voice</p>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {voiceDescriptors.map((descriptor, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 text-slate-300 rounded-full text-sm"
            >
              {descriptor}
              {isEditable && (
                <button onClick={() => handleRemoveDescriptor(idx)} className="hover:text-red-400">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </span>
          ))}
        </div>

        {isEditable && (
          <div className="flex gap-2">
            <input
              type="text"
              value={newDescriptor}
              onChange={(e) => setNewDescriptor(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddDescriptor()}
              placeholder="e.g., Professional, Friendly, Authoritative"
              className="flex-1 px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-500"
            />
            <button
              onClick={handleAddDescriptor}
              className="px-4 py-2 bg-slate-700 text-white text-sm font-medium rounded-lg hover:bg-slate-600 transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 bg-emerald-500/20 rounded-lg">
              <ThumbsUp className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Do's</h2>
              <p className="text-xs text-slate-400">Guidelines to follow</p>
            </div>
          </div>

          <ul className="space-y-2 mb-4">
            {dos.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-slate-300">
                <span className="text-emerald-400 mt-0.5">+</span>
                <span className="flex-1">{item}</span>
                {isEditable && (
                  <button onClick={() => handleRemoveDo(idx)} className="text-slate-500 hover:text-red-400">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>

          {isEditable && (
            <div className="flex gap-2">
              <input
                type="text"
                value={newDo}
                onChange={(e) => setNewDo(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddDo()}
                placeholder="Add a guideline..."
                className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-500"
              />
              <button
                onClick={handleAddDo}
                className="px-3 py-2 bg-emerald-600/20 text-emerald-400 text-sm font-medium rounded-lg hover:bg-emerald-600/30 transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 bg-red-500/20 rounded-lg">
              <ThumbsDown className="w-4 h-4 text-red-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Don'ts</h2>
              <p className="text-xs text-slate-400">Guidelines to avoid</p>
            </div>
          </div>

          <ul className="space-y-2 mb-4">
            {donts.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-slate-300">
                <span className="text-red-400 mt-0.5">-</span>
                <span className="flex-1">{item}</span>
                {isEditable && (
                  <button onClick={() => handleRemoveDont(idx)} className="text-slate-500 hover:text-red-400">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>

          {isEditable && (
            <div className="flex gap-2">
              <input
                type="text"
                value={newDont}
                onChange={(e) => setNewDont(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddDont()}
                placeholder="Add a restriction..."
                className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-500"
              />
              <button
                onClick={handleAddDont}
                className="px-3 py-2 bg-red-600/20 text-red-400 text-sm font-medium rounded-lg hover:bg-red-600/30 transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-white">Training Examples</h2>
          <p className="text-sm text-slate-400 mt-1">Provide examples to help AI understand your voice</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <ThumbsUp className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-medium text-emerald-400">Good Examples</span>
            </div>
            <div className="space-y-3">
              {voiceExamples.good.map((example, idx) => (
                <div key={idx} className="relative p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                  <p className="text-sm text-slate-300 pr-6">{example.text}</p>
                  {isEditable && (
                    <button
                      onClick={() => handleRemoveGoodExample(idx)}
                      className="absolute top-2 right-2 text-slate-500 hover:text-red-400"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              {isEditable && (
                <div className="flex gap-2">
                  <textarea
                    value={newGoodExample}
                    onChange={(e) => setNewGoodExample(e.target.value)}
                    placeholder="Add a good example..."
                    rows={2}
                    className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-500 resize-none"
                  />
                  <button
                    onClick={handleAddGoodExample}
                    className="px-3 py-2 bg-emerald-600/20 text-emerald-400 text-sm font-medium rounded-lg hover:bg-emerald-600/30 transition-colors self-end"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <ThumbsDown className="w-4 h-4 text-red-400" />
              <span className="text-sm font-medium text-red-400">Bad Examples</span>
            </div>
            <div className="space-y-3">
              {voiceExamples.bad.map((example, idx) => (
                <div key={idx} className="relative p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <p className="text-sm text-slate-300 pr-6">{example.text}</p>
                  {isEditable && (
                    <button
                      onClick={() => handleRemoveBadExample(idx)}
                      className="absolute top-2 right-2 text-slate-500 hover:text-red-400"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              {isEditable && (
                <div className="flex gap-2">
                  <textarea
                    value={newBadExample}
                    onChange={(e) => setNewBadExample(e.target.value)}
                    placeholder="Add a bad example..."
                    rows={2}
                    className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-500 resize-none"
                  />
                  <button
                    onClick={handleAddBadExample}
                    className="px-3 py-2 bg-red-600/20 text-red-400 text-sm font-medium rounded-lg hover:bg-red-600/30 transition-colors self-end"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {hasChanges && isEditable && (
        <div className="flex justify-end sticky bottom-6">
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-teal-600 text-white text-sm font-medium rounded-lg hover:from-cyan-600 hover:to-teal-700 transition-all disabled:opacity-50 shadow-lg shadow-cyan-500/20"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Brand Voice'}
          </button>
        </div>
      )}
    </div>
  );
}
