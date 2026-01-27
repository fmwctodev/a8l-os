import { supabase } from '../lib/supabase';
import type { ReputationSettings, User } from '../types';

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
      yelp_review_url: null,
      brand_name: null,
      brand_logo_url: null,
      brand_primary_color: '#3B82F6',
      review_goal: 20,
      ai_replies_enabled: false,
      spam_keywords: [],
      ai_provider: 'openai',
      brand_voice_description: null,
      response_tone: 'professional',
      auto_analyze_reviews: true,
      negative_review_threshold: 3,
      negative_review_create_task: true,
      negative_review_task_assignee: null,
      negative_review_task_due_hours: 24,
      negative_review_notify_email: true,
      negative_review_notify_sms: false,
      notification_recipients: [],
      response_time_goal_hours: 24,
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

export async function getNotificationRecipients(
  orgId: string
): Promise<Array<{ id: string; name: string; email: string }>> {
  const settings = await getSettings(orgId);

  if (!settings.notification_recipients || settings.notification_recipients.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from('users')
    .select('id, name, email')
    .in('id', settings.notification_recipients);

  if (error) throw error;
  return data || [];
}

export async function getAvailableRecipients(
  orgId: string
): Promise<Array<{ id: string; name: string; email: string; role_name: string }>> {
  const { data, error } = await supabase
    .from('users')
    .select(`
      id,
      name,
      email,
      role:roles(name)
    `)
    .eq('organization_id', orgId)
    .eq('status', 'active')
    .order('name');

  if (error) throw error;

  return (data || []).map(u => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role_name: (u.role as { name: string } | null)?.name || 'User',
  }));
}

export async function updateNotificationRecipients(
  orgId: string,
  recipientIds: string[],
  userId: string
): Promise<void> {
  const { error } = await supabase
    .from('reputation_settings')
    .update({
      notification_recipients: recipientIds,
      updated_at: new Date().toISOString(),
    })
    .eq('organization_id', orgId);

  if (error) throw error;
}

export async function updateAISettings(
  orgId: string,
  settings: {
    ai_provider?: 'openai' | 'anthropic' | 'both';
    ai_replies_enabled?: boolean;
    auto_analyze_reviews?: boolean;
    brand_voice_description?: string | null;
    response_tone?: 'professional' | 'friendly' | 'apologetic' | 'casual';
  },
  userId: string
): Promise<ReputationSettings> {
  const { data, error } = await supabase
    .from('reputation_settings')
    .update({
      ...settings,
      updated_at: new Date().toISOString(),
    })
    .eq('organization_id', orgId)
    .select()
    .single();

  if (error) throw error;
  return data as ReputationSettings;
}

export async function updateNegativeReviewSettings(
  orgId: string,
  settings: {
    negative_review_threshold?: number;
    negative_review_create_task?: boolean;
    negative_review_task_assignee?: string | null;
    negative_review_task_due_hours?: number;
    negative_review_notify_email?: boolean;
    negative_review_notify_sms?: boolean;
  },
  userId: string
): Promise<ReputationSettings> {
  const { data, error } = await supabase
    .from('reputation_settings')
    .update({
      ...settings,
      updated_at: new Date().toISOString(),
    })
    .eq('organization_id', orgId)
    .select()
    .single();

  if (error) throw error;
  return data as ReputationSettings;
}
