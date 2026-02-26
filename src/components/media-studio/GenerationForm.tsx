import { useState, useRef, useEffect } from 'react';
import {
  Wand2,
  Upload,
  X,
  Image as ImageIcon,
  Loader2,
  Ratio,
  Clock,
  Monitor,
  Type,
  Palette,
  Smartphone,
  Film,
  Presentation,
} from 'lucide-react';
import type { KieModel, CreateJobParams, JobType } from '../../services/mediaGeneration';
import { getStylePresets } from '../../services/mediaStylePresets';
import type { MediaStylePreset } from '../../services/mediaStylePresets';

interface GenerationFormProps {
  model: KieModel | null;
  onSubmit: (params: CreateJobParams) => void;
  isSubmitting: boolean;
  brandKitId?: string | null;
  postId?: string | null;
  defaultPromptSuffix?: string;
}

const ASPECT_RATIO_LABELS: Record<string, string> = {
  '1:1': 'Square',
  '16:9': 'Landscape',
  '9:16': 'Portrait',
  '4:3': 'Standard',
  '3:4': 'Tall',
  '3:2': 'Photo',
  '2:3': 'Photo Tall',
  '10:16': 'Narrow',
  '16:10': 'Wide',
};

const JOB_TYPE_OPTIONS: { value: JobType; label: string; icon: typeof Film; desc: string }[] = [
  { value: 'text_to_video', label: 'Text to Video', icon: Film, desc: 'Generate from a prompt' },
  { value: 'text_to_image', label: 'Text to Image', icon: ImageIcon, desc: 'Generate a still image' },
  { value: 'image_to_video', label: 'Image to Video', icon: ImageIcon, desc: 'Animate a reference image' },
  { value: 'ugc_short_video', label: 'UGC Short', icon: Smartphone, desc: '9:16, up to 30s' },
  { value: 'explainer_long_video', label: 'Explainer', icon: Presentation, desc: '16:9, up to 60s' },
];

export default function GenerationForm({
  model,
  onSubmit,
  isSubmitting,
  brandKitId,
  postId,
  defaultPromptSuffix,
}: GenerationFormProps) {
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState(
    (model?.default_params?.aspect_ratio as string) || '16:9'
  );
  const [resolution, setResolution] = useState(
    (model?.default_params?.resolution as string) || ''
  );
  const [duration, setDuration] = useState<number>(
    (model?.default_params?.duration as number) || 5
  );
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [sourcePreview, setSourcePreview] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [jobType, setJobType] = useState<JobType | undefined>(undefined);
  const [stylePresets, setStylePresets] = useState<MediaStylePreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getStylePresets().then(setStylePresets).catch(() => {});
  }, []);

  useEffect(() => {
    if (model) {
      setAspectRatio((model.default_params?.aspect_ratio as string) || '16:9');
      setDuration((model.default_params?.duration as number) || 5);
      setResolution((model.default_params?.resolution as string) || '');
    }
  }, [model?.id]);

  const selectedPreset = stylePresets.find(p => p.id === selectedPresetId);

  function handlePresetSelect(presetId: string) {
    if (selectedPresetId === presetId) {
      setSelectedPresetId(undefined);
      return;
    }
    setSelectedPresetId(presetId);
    const preset = stylePresets.find(p => p.id === presetId);
    if (preset?.recommended_aspect_ratio) {
      setAspectRatio(preset.recommended_aspect_ratio);
    }
  }

  function handleJobTypeSelect(type: JobType) {
    setJobType(type === jobType ? undefined : type);
    if (type === 'ugc_short_video') {
      setAspectRatio('9:16');
      if (duration > 30) setDuration(30);
    } else if (type === 'explainer_long_video') {
      setAspectRatio('16:9');
      if (duration > 60) setDuration(60);
    }
  }

  if (!model) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-400">
        <Wand2 className="w-10 h-10 mb-3 opacity-40" />
        <p className="text-sm">Select a model to start generating</p>
      </div>
    );
  }

  const supportedRatios = (model.supports_aspect_ratios || []) as string[];
  const supportedDurations = (model.supports_durations || []) as number[];
  const supportedResolutions = (model.supports_resolutions || []) as string[];
  const availableJobTypes = JOB_TYPE_OPTIONS.filter(jt => {
    if (model.type === 'image') return jt.value === 'text_to_image';
    return jt.value !== 'text_to_image';
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSourceFile(file);
    const reader = new FileReader();
    reader.onload = () => setSourcePreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  function handleRemoveFile() {
    setSourceFile(null);
    setSourcePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleSubmit() {
    if (!prompt.trim() || !model) return;

    const finalPrompt = defaultPromptSuffix
      ? `${prompt.trim()} ${defaultPromptSuffix}`
      : prompt.trim();

    const params: CreateJobParams = {
      model_id: model.id,
      prompt: finalPrompt,
      aspect_ratio: aspectRatio,
    };

    if (negativePrompt.trim() && model.supports_negative_prompt) {
      params.negative_prompt = negativePrompt.trim();
    }

    if (resolution) params.resolution = resolution;
    if (model.type === 'video' && duration) params.duration = duration;
    if (brandKitId) params.brand_kit_id = brandKitId;
    if (postId) params.post_id = postId;
    if (jobType) params.job_type = jobType;
    if (selectedPresetId) params.style_preset_id = selectedPresetId;

    onSubmit(params);
  }

  return (
    <div className="space-y-4">
      {availableJobTypes.length > 1 && (
        <div>
          <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            <Film className="w-3.5 h-3.5" />
            Generation Type
          </label>
          <div className="flex flex-wrap gap-1.5">
            {availableJobTypes.map((jt) => {
              const Icon = jt.icon;
              return (
                <button
                  key={jt.value}
                  onClick={() => handleJobTypeSelect(jt.value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    jobType === jt.value
                      ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
                  }`}
                  title={jt.desc}
                >
                  <Icon className="w-3 h-3" />
                  {jt.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {stylePresets.length > 0 && model.type === 'video' && (
        <div>
          <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            <Palette className="w-3.5 h-3.5" />
            Style Preset
          </label>
          <div className="flex flex-wrap gap-1.5">
            {stylePresets.map((preset) => (
              <button
                key={preset.id}
                onClick={() => handlePresetSelect(preset.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  selectedPresetId === preset.id
                    ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900 ring-1 ring-gray-400 dark:ring-gray-500'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
                }`}
                title={preset.description}
              >
                {preset.display_name}
              </button>
            ))}
          </div>
          {selectedPreset && (
            <p className="text-xs text-gray-500 mt-1.5">
              {selectedPreset.description}
            </p>
          )}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          Prompt
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={
            model.type === 'image'
              ? 'Describe the image you want to create...'
              : 'Describe the video scene you want to generate...'
          }
          rows={3}
          className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 dark:focus:ring-gray-600 resize-none"
        />
        {defaultPromptSuffix && (
          <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
            <Palette className="w-3 h-3" />
            Platform style hint will be appended automatically
          </p>
        )}
      </div>

      {supportedRatios.length > 0 && (
        <div>
          <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            <Ratio className="w-3.5 h-3.5" />
            Aspect Ratio
          </label>
          <div className="flex flex-wrap gap-1.5">
            {supportedRatios.map((ratio) => (
              <button
                key={ratio}
                onClick={() => setAspectRatio(ratio)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  aspectRatio === ratio
                    ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
                }`}
              >
                {ratio}
                {ASPECT_RATIO_LABELS[ratio] && (
                  <span className="ml-1 opacity-60">
                    {ASPECT_RATIO_LABELS[ratio]}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {model.type === 'video' && supportedDurations.length > 0 && (
        <div>
          <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            <Clock className="w-3.5 h-3.5" />
            Duration
          </label>
          <div className="flex flex-wrap gap-1.5">
            {supportedDurations.map((d) => (
              <button
                key={d}
                onClick={() => setDuration(d)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  duration === d
                    ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
                }`}
              >
                {d}s
              </button>
            ))}
          </div>
        </div>
      )}

      {supportedResolutions.length > 0 && (
        <div>
          <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            <Monitor className="w-3.5 h-3.5" />
            Resolution
          </label>
          <div className="flex flex-wrap gap-1.5">
            {supportedResolutions.map((res) => (
              <button
                key={res}
                onClick={() => setResolution(res)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  resolution === res
                    ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
                }`}
              >
                {res}
              </button>
            ))}
          </div>
        </div>
      )}

      {model.supports_reference_images && (
        <div>
          <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            <Upload className="w-3.5 h-3.5" />
            Reference Image
          </label>
          {sourcePreview ? (
            <div className="relative w-24 h-24 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
              <img
                src={sourcePreview}
                alt="Reference"
                className="w-full h-full object-cover"
              />
              <button
                onClick={handleRemoveFile}
                className="absolute top-1 right-1 p-0.5 bg-black/60 rounded-full text-white hover:bg-black/80"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-3 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-500 hover:border-gray-300 dark:hover:border-gray-600 hover:text-gray-700 dark:hover:text-gray-300 transition-colors w-full"
            >
              <ImageIcon className="w-4 h-4" />
              Upload reference image
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      )}

      {model.supports_negative_prompt && (
        <div>
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            {showAdvanced ? 'Hide' : 'Show'} advanced options
          </button>
          {showAdvanced && (
            <div className="mt-2">
              <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                <Type className="w-3.5 h-3.5" />
                Negative Prompt
              </label>
              <textarea
                value={negativePrompt}
                onChange={(e) => setNegativePrompt(e.target.value)}
                placeholder="Things to avoid in the generation..."
                rows={2}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 dark:focus:ring-gray-600 resize-none"
              />
            </div>
          )}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={!prompt.trim() || isSubmitting}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Submitting...
          </>
        ) : (
          <>
            <Wand2 className="w-4 h-4" />
            Generate {model.type === 'image' ? 'Image' : 'Video'}
          </>
        )}
      </button>
    </div>
  );
}
