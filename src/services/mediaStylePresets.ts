import { supabase } from '../lib/supabase';

export interface MediaStylePreset {
  id: string;
  name: string;
  display_name: string;
  description: string;
  camera_style: string;
  lighting: string;
  pacing: string;
  hook_required: boolean;
  subtitle_style: string;
  recommended_duration_min: number;
  recommended_duration_max: number;
  recommended_aspect_ratio: string | null;
  prompt_template: string;
  llm_context_snippet: string;
  enabled: boolean;
  display_priority: number;
  created_at: string;
  updated_at: string;
}

export async function getStylePresets(enabledOnly = true): Promise<MediaStylePreset[]> {
  let query = supabase
    .from('media_style_presets')
    .select('*')
    .order('display_priority', { ascending: true });

  if (enabledOnly) {
    query = query.eq('enabled', true);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getStylePresetById(id: string): Promise<MediaStylePreset | null> {
  const { data, error } = await supabase
    .from('media_style_presets')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function updateStylePreset(
  id: string,
  updates: Partial<Omit<MediaStylePreset, 'id' | 'created_at' | 'updated_at'>>
): Promise<MediaStylePreset> {
  const { data, error } = await supabase
    .from('media_style_presets')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function createStylePreset(
  preset: Omit<MediaStylePreset, 'id' | 'created_at' | 'updated_at'>
): Promise<MediaStylePreset> {
  const { data, error } = await supabase
    .from('media_style_presets')
    .insert(preset)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteStylePreset(id: string): Promise<void> {
  const { error } = await supabase
    .from('media_style_presets')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export function getPresetIcon(name: string): string {
  const icons: Record<string, string> = {
    ugc: 'smartphone',
    cinematic: 'film',
    product_demo: 'package',
    testimonial: 'quote',
    explainer: 'presentation',
    hype_trailer: 'zap',
    educational: 'graduation-cap',
    corporate_clean: 'building-2',
  };
  return icons[name] || 'sparkles';
}
