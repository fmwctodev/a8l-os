import { useState, useEffect } from 'react';
import type { PlatformMediaDefault, KieModel } from '../services/mediaGeneration';
import { getPlatformDefaults, getKieModels } from '../services/mediaGeneration';

interface PlatformPreset {
  platform: string;
  contentFormat: string;
  model: KieModel | null;
  aspectRatio: string | null;
  resolution: string | null;
  duration: number | null;
  maxDuration: number | null;
  promptSuffix: string | null;
}

export function usePlatformMediaDefaults(platforms: string[]) {
  const [defaults, setDefaults] = useState<PlatformMediaDefault[]>([]);
  const [models, setModels] = useState<KieModel[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (platforms.length > 0) {
      loadDefaults();
    }
  }, [platforms.join(',')]);

  async function loadDefaults() {
    try {
      setLoading(true);
      const [defaultsData, modelsData] = await Promise.all([
        getPlatformDefaults(),
        getKieModels(),
      ]);
      setDefaults(defaultsData);
      setModels(modelsData);
    } catch (err) {
      console.error('Failed to load platform defaults:', err);
    } finally {
      setLoading(false);
    }
  }

  function getPresetForPlatform(
    platform: string,
    contentFormat = 'feed_post'
  ): PlatformPreset | null {
    const def = defaults.find(
      (d) => d.platform === platform && d.content_format === contentFormat
    );
    if (!def) return null;

    const model = def.recommended_model_id
      ? models.find((m) => m.id === def.recommended_model_id) || null
      : null;

    return {
      platform: def.platform,
      contentFormat: def.content_format,
      model,
      aspectRatio: def.default_aspect_ratio,
      resolution: def.default_resolution,
      duration: def.default_duration,
      maxDuration: def.max_duration,
      promptSuffix: def.prompt_suffix,
    };
  }

  function getPresetsForPlatforms(
    contentFormat = 'feed_post'
  ): PlatformPreset[] {
    return platforms
      .map((p) => getPresetForPlatform(p, contentFormat))
      .filter((p): p is PlatformPreset => p !== null);
  }

  return {
    defaults,
    models,
    loading,
    getPresetForPlatform,
    getPresetsForPlatforms,
  };
}
