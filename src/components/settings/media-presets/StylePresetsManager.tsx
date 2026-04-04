import { useState } from 'react';
import { Plus, Pencil, Trash2, GripVertical, ToggleLeft, ToggleRight, ChevronDown, ChevronUp, Film, Camera, Sun, Timer, Files as Subtitles, Sparkles, AlertTriangle } from 'lucide-react';
import { useToast } from '../../../contexts/ToastContext';
import type { MediaStylePreset } from '../../../services/mediaStylePresets';
import {
  updateStylePreset,
  deleteStylePreset,
} from '../../../services/mediaStylePresets';
import { PresetEditorModal } from './PresetEditorModal';

interface StylePresetsManagerProps {
  presets: MediaStylePreset[];
  onRefresh: () => void;
}

export function StylePresetsManager({ presets, onRefresh }: StylePresetsManagerProps) {
  const { showToast } = useToast();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editorPreset, setEditorPreset] = useState<MediaStylePreset | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  async function handleToggleEnabled(preset: MediaStylePreset) {
    setToggling(preset.id);
    try {
      await updateStylePreset(preset.id, { enabled: !preset.enabled });
      showToast('success', `${preset.display_name} ${preset.enabled ? 'disabled' : 'enabled'}`);
      onRefresh();
    } catch (err) {
      console.error('Toggle error:', err);
      showToast('error', 'Failed to toggle preset');
    } finally {
      setToggling(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this style preset? This cannot be undone.')) return;
    setDeleting(id);
    try {
      await deleteStylePreset(id);
      showToast('success', 'Preset deleted');
      onRefresh();
    } catch (err) {
      console.error('Delete error:', err);
      showToast('error', 'Failed to delete preset');
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">
          {presets.length} preset{presets.length !== 1 ? 's' : ''} configured
        </p>
        <button
          onClick={() => setIsCreating(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Preset
        </button>
      </div>

      <div className="space-y-2">
        {presets.map((preset) => {
          const isExpanded = expandedId === preset.id;

          return (
            <div
              key={preset.id}
              className={`border rounded-xl transition-all ${
                preset.enabled
                  ? 'border-slate-700 bg-slate-800/50'
                  : 'border-slate-800 bg-slate-900/50 opacity-60'
              }`}
            >
              <div className="flex items-center gap-3 px-4 py-3">
                <GripVertical className="w-4 h-4 text-slate-600 flex-shrink-0 cursor-grab" />

                <div className="w-9 h-9 rounded-lg bg-slate-700/50 flex items-center justify-center flex-shrink-0">
                  <Film className="w-4.5 h-4.5 text-slate-300" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">{preset.display_name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-400">
                      {preset.name}
                    </span>
                    {preset.recommended_aspect_ratio && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-900/30 text-teal-400">
                        {preset.recommended_aspect_ratio}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 truncate">{preset.description}</p>
                </div>

                <button
                  onClick={() => handleToggleEnabled(preset)}
                  disabled={toggling === preset.id}
                  className="flex-shrink-0"
                  title={preset.enabled ? 'Disable' : 'Enable'}
                >
                  {preset.enabled ? (
                    <ToggleRight className="w-6 h-6 text-cyan-400" />
                  ) : (
                    <ToggleLeft className="w-6 h-6 text-slate-600" />
                  )}
                </button>

                <button
                  onClick={() => setEditorPreset(preset)}
                  className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors flex-shrink-0"
                  title="Edit"
                >
                  <Pencil className="w-4 h-4" />
                </button>

                <button
                  onClick={() => handleDelete(preset.id)}
                  disabled={deleting === preset.id}
                  className="p-1.5 rounded-lg hover:bg-red-900/30 text-slate-500 hover:text-red-400 transition-colors flex-shrink-0"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>

                <button
                  onClick={() => setExpandedId(isExpanded ? null : preset.id)}
                  className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 transition-colors flex-shrink-0"
                >
                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>

              {isExpanded && (
                <div className="px-4 pb-4 border-t border-slate-700/50 pt-3 space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <DetailChip icon={Camera} label="Camera" value={preset.camera_style} />
                    <DetailChip icon={Sun} label="Lighting" value={preset.lighting} />
                    <DetailChip icon={Timer} label="Pacing" value={preset.pacing} />
                    <DetailChip icon={Subtitles} label="Subtitles" value={preset.subtitle_style} />
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-slate-900/50 rounded-lg p-3">
                      <span className="text-slate-500">Duration Range</span>
                      <p className="text-slate-300 mt-0.5">
                        {preset.recommended_duration_min}s - {preset.recommended_duration_max}s
                      </p>
                    </div>
                    <div className="bg-slate-900/50 rounded-lg p-3">
                      <span className="text-slate-500">Hook Required</span>
                      <p className="text-slate-300 mt-0.5">{preset.hook_required ? 'Yes' : 'No'}</p>
                    </div>
                  </div>

                  <div className="bg-slate-900/50 rounded-lg p-3">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                      <span className="text-xs text-slate-500">Prompt Template</span>
                    </div>
                    <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono leading-relaxed">
                      {preset.prompt_template}
                    </pre>
                  </div>

                  {preset.llm_context_snippet && (
                    <div className="bg-slate-900/50 rounded-lg p-3">
                      <span className="text-xs text-slate-500 block mb-1.5">LLM Context Snippet</span>
                      <pre className="text-xs text-slate-400 whitespace-pre-wrap font-mono leading-relaxed">
                        {preset.llm_context_snippet}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {presets.length === 0 && (
          <div className="text-center py-12 border border-dashed border-slate-700 rounded-xl">
            <AlertTriangle className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-400">No style presets configured.</p>
            <button
              onClick={() => setIsCreating(true)}
              className="mt-3 text-sm text-cyan-400 hover:text-cyan-300"
            >
              Create your first preset
            </button>
          </div>
        )}
      </div>

      {(editorPreset || isCreating) && (
        <PresetEditorModal
          preset={isCreating ? null : editorPreset}
          onClose={() => {
            setEditorPreset(null);
            setIsCreating(false);
          }}
          onSave={() => {
            setEditorPreset(null);
            setIsCreating(false);
            onRefresh();
          }}
        />
      )}
    </div>
  );
}

function DetailChip({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Camera;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-slate-900/50 rounded-lg p-2.5">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="w-3 h-3 text-slate-500" />
        <span className="text-[10px] text-slate-500">{label}</span>
      </div>
      <p className="text-xs text-slate-300 leading-tight">{value}</p>
    </div>
  );
}
