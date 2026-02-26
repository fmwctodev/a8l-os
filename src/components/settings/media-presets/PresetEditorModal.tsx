import { useState } from 'react';
import { X, Loader2, Save } from 'lucide-react';
import { useToast } from '../../../contexts/ToastContext';
import type { MediaStylePreset } from '../../../services/mediaStylePresets';
import { createStylePreset, updateStylePreset } from '../../../services/mediaStylePresets';
import { VALID_RATIOS } from '../../../utils/platformAspectMatrix';

interface PresetEditorModalProps {
  preset: MediaStylePreset | null;
  onClose: () => void;
  onSave: () => void;
}

const EMPTY_FORM = {
  name: '',
  display_name: '',
  description: '',
  camera_style: '',
  lighting: '',
  pacing: '',
  hook_required: false,
  subtitle_style: 'none',
  recommended_duration_min: 5,
  recommended_duration_max: 60,
  recommended_aspect_ratio: null as string | null,
  prompt_template: '{prompt}',
  llm_context_snippet: '',
  enabled: true,
  display_priority: 50,
};

export function PresetEditorModal({ preset, onClose, onSave }: PresetEditorModalProps) {
  const { showToast } = useToast();
  const isEditing = !!preset;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(() => {
    if (preset) {
      return {
        name: preset.name,
        display_name: preset.display_name,
        description: preset.description,
        camera_style: preset.camera_style,
        lighting: preset.lighting,
        pacing: preset.pacing,
        hook_required: preset.hook_required,
        subtitle_style: preset.subtitle_style,
        recommended_duration_min: preset.recommended_duration_min,
        recommended_duration_max: preset.recommended_duration_max,
        recommended_aspect_ratio: preset.recommended_aspect_ratio,
        prompt_template: preset.prompt_template,
        llm_context_snippet: preset.llm_context_snippet,
        enabled: preset.enabled,
        display_priority: preset.display_priority,
      };
    }
    return { ...EMPTY_FORM };
  });

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.display_name || !form.prompt_template) {
      showToast('Name, display name, and prompt template are required', 'error');
      return;
    }
    if (!form.prompt_template.includes('{prompt}')) {
      showToast('Prompt template must include {prompt} placeholder', 'error');
      return;
    }

    setSaving(true);
    try {
      if (isEditing && preset) {
        await updateStylePreset(preset.id, form);
        showToast('Preset updated', 'success');
      } else {
        await createStylePreset(form);
        showToast('Preset created', 'success');
      }
      onSave();
    } catch (err) {
      console.error('Save error:', err);
      showToast('Failed to save preset', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">
            {isEditing ? 'Edit Style Preset' : 'New Style Preset'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Internal Name" required>
              <input
                type="text"
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                placeholder="e.g. ugc, cinematic"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500"
              />
            </Field>
            <Field label="Display Name" required>
              <input
                type="text"
                value={form.display_name}
                onChange={(e) => update('display_name', e.target.value)}
                placeholder="e.g. UGC Creator"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500"
              />
            </Field>
          </div>

          <Field label="Description">
            <textarea
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
              rows={2}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 resize-none"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Camera Style">
              <input
                type="text"
                value={form.camera_style}
                onChange={(e) => update('camera_style', e.target.value)}
                placeholder="e.g. handheld, steadicam"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500"
              />
            </Field>
            <Field label="Lighting">
              <input
                type="text"
                value={form.lighting}
                onChange={(e) => update('lighting', e.target.value)}
                placeholder="e.g. natural, studio"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Pacing">
              <input
                type="text"
                value={form.pacing}
                onChange={(e) => update('pacing', e.target.value)}
                placeholder="e.g. fast cuts, slow"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500"
              />
            </Field>
            <Field label="Subtitle Style">
              <select
                value={form.subtitle_style}
                onChange={(e) => update('subtitle_style', e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500"
              >
                <option value="none">None</option>
                <option value="bold_pop">Bold Pop</option>
                <option value="lower_third">Lower Third</option>
                <option value="cinematic">Cinematic</option>
                <option value="minimal">Minimal</option>
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Field label="Min Duration (s)">
              <input
                type="number"
                value={form.recommended_duration_min}
                onChange={(e) => update('recommended_duration_min', Number(e.target.value))}
                min={1}
                max={300}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500"
              />
            </Field>
            <Field label="Max Duration (s)">
              <input
                type="number"
                value={form.recommended_duration_max}
                onChange={(e) => update('recommended_duration_max', Number(e.target.value))}
                min={1}
                max={600}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500"
              />
            </Field>
            <Field label="Aspect Ratio">
              <select
                value={form.recommended_aspect_ratio || ''}
                onChange={(e) => update('recommended_aspect_ratio', e.target.value || null)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500"
              >
                <option value="">None</option>
                {VALID_RATIOS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </Field>
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.hook_required}
                onChange={(e) => update('hook_required', e.target.checked)}
                className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-cyan-500 focus:ring-cyan-500"
              />
              <span className="text-sm text-slate-300">Hook Required</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) => update('enabled', e.target.checked)}
                className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-cyan-500 focus:ring-cyan-500"
              />
              <span className="text-sm text-slate-300">Enabled</span>
            </label>
            <Field label="Priority" inline>
              <input
                type="number"
                value={form.display_priority}
                onChange={(e) => update('display_priority', Number(e.target.value))}
                min={0}
                max={999}
                className="w-20 px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500"
              />
            </Field>
          </div>

          <Field label="Prompt Template" required>
            <textarea
              value={form.prompt_template}
              onChange={(e) => update('prompt_template', e.target.value)}
              rows={4}
              placeholder="Must include {prompt} placeholder"
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm font-mono focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 resize-none"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Use &#123;prompt&#125; where the user's prompt should be inserted.
            </p>
          </Field>

          <Field label="LLM Context Snippet">
            <textarea
              value={form.llm_context_snippet}
              onChange={(e) => update('llm_context_snippet', e.target.value)}
              rows={3}
              placeholder="Short description injected into LLM system prompt"
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm font-mono focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 resize-none"
            />
          </Field>
        </form>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-700">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white disabled:opacity-50 transition-colors"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {isEditing ? 'Update Preset' : 'Create Preset'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  inline,
  children,
}: {
  label: string;
  required?: boolean;
  inline?: boolean;
  children: React.ReactNode;
}) {
  if (inline) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-400">{label}</span>
        {children}
      </div>
    );
  }

  return (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1.5">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
