import { supabase } from '../lib/supabase';
import type { SocialGuideline } from '../types';

export async function getGuidelines(
  orgId: string
): Promise<SocialGuideline | null> {
  const { data, error } = await supabase
    .from('social_guidelines')
    .select('*')
    .eq('organization_id', orgId)
    .is('user_id', null)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function upsertGuidelines(
  orgId: string,
  updates: Partial<Pick<SocialGuideline,
    'content_themes' | 'image_style' | 'writing_style' |
    'tone_preferences' | 'words_to_avoid' | 'hashtag_preferences' |
    'cta_rules' | 'emoji_rules' | 'industry_positioning' |
    'visual_style_rules' | 'platform_tweaks'
  >>
): Promise<SocialGuideline> {
  const existing = await getGuidelines(orgId);

  if (existing) {
    const { data, error } = await supabase
      .from('social_guidelines')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from('social_guidelines')
    .insert({
      organization_id: orgId,
      user_id: null,
      ...updates,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function mergeGuidelineFromChat(
  orgId: string,
  partialUpdate: Partial<Pick<SocialGuideline,
    'words_to_avoid' | 'cta_rules' | 'tone_preferences'
  >>
): Promise<SocialGuideline> {
  const existing = await getGuidelines(orgId);

  if (existing) {
    const merged: Record<string, unknown> = {};

    if (partialUpdate.words_to_avoid) {
      merged.words_to_avoid = [
        ...new Set([...existing.words_to_avoid, ...partialUpdate.words_to_avoid]),
      ];
    }
    if (partialUpdate.cta_rules) {
      merged.cta_rules = [
        ...new Set([...existing.cta_rules, ...partialUpdate.cta_rules]),
      ];
    }
    if (partialUpdate.tone_preferences) {
      merged.tone_preferences = {
        ...existing.tone_preferences,
        ...partialUpdate.tone_preferences,
      };
    }

    return upsertGuidelines(orgId, merged);
  }

  return upsertGuidelines(orgId, partialUpdate);
}
