import { supabase } from '../lib/supabase';
import type { ReputationSettings } from '../types';

export async function getSettings(orgId: string): Promise<ReputationSettings> {
  const { data, error } = await supabase
    .from('reputation_settings')
    .select('*')
    .eq('organization_id', orgId)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    const defaultSettings: Omit<ReputationSettings, 'created_at' | 'updated_at'> = {
      organization_id: orgId,
      smart_threshold: 4,
      default_channel: 'sms',
      default_sms_template: 'Hi {first_name}, how was your experience with {company_name}? Please share your feedback: {review_link}',
      default_email_template: 'Hi {first_name},\n\nThank you for choosing {company_name}. We\'d love to hear about your experience.\n\nPlease take a moment to share your feedback:\n{review_link}\n\nThank you!',
      default_email_subject: 'How was your experience with {company_name}?',
      google_review_url: null,
      facebook_review_url: null,
      brand_name: null,
      brand_logo_url: null,
      brand_primary_color: '#3B82F6',
    };

    const { data: created, error: createError } = await supabase
      .from('reputation_settings')
      .insert(defaultSettings)
      .select()
      .single();

    if (createError) throw createError;
    return created as ReputationSettings;
  }

  return data as ReputationSettings;
}

export async function updateSettings(
  orgId: string,
  updates: Partial<Omit<ReputationSettings, 'organization_id' | 'created_at' | 'updated_at'>>,
  userId: string
): Promise<ReputationSettings> {
  const { data, error } = await supabase
    .from('reputation_settings')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('organization_id', orgId)
    .select()
    .single();

  if (error) throw error;
  return data as ReputationSettings;
}
