import { supabase } from '../lib/supabase';
import type { User } from '../types';

export interface UserPreferences {
  id: string;
  user_id: string;
  default_landing_page: string;
  calendar_default_view: string;
  inbox_behavior: string;
  date_format: string;
  time_format: string;
  language: string;
  created_at: string;
  updated_at: string;
}

export interface NotificationPreference {
  id: string;
  user_id: string;
  event_type: string;
  email_enabled: boolean;
  push_enabled: boolean;
  sms_enabled: boolean;
  in_app_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface ConnectedAccount {
  id: string;
  user_id: string;
  provider: string;
  provider_account_id: string;
  provider_account_email: string | null;
  scopes: string[];
  connected_at: string;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function updateUserProfile(
  userId: string,
  updates: Partial<{
    name: string;
    phone: string;
    timezone: string;
    title: string;
    email_signature: string;
    profile_photo: string;
  }>,
  user: User
): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    })
    .eq('id', userId);

  if (error) throw error;
}

export async function getUserPreferences(userId: string): Promise<UserPreferences | null> {
  const { data, error } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function upsertUserPreferences(
  userId: string,
  preferences: Partial<Omit<UserPreferences, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
): Promise<UserPreferences> {
  const { data, error } = await supabase
    .from('user_preferences')
    .upsert(
      {
        user_id: userId,
        ...preferences,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getNotificationPreferences(
  userId: string
): Promise<NotificationPreference[]> {
  const { data, error } = await supabase
    .from('user_notification_preferences')
    .select('*')
    .eq('user_id', userId);

  if (error) throw error;
  return data || [];
}

export async function upsertNotificationPreference(
  userId: string,
  eventType: string,
  preferences: {
    email_enabled: boolean;
    push_enabled: boolean;
    sms_enabled: boolean;
    in_app_enabled: boolean;
  }
): Promise<NotificationPreference> {
  const { data, error } = await supabase
    .from('user_notification_preferences')
    .upsert(
      {
        user_id: userId,
        event_type: eventType,
        ...preferences,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,event_type' }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function batchUpsertNotificationPreferences(
  userId: string,
  preferences: Array<{
    event_type: string;
    email_enabled: boolean;
    push_enabled: boolean;
    sms_enabled: boolean;
    in_app_enabled: boolean;
  }>
): Promise<void> {
  const records = preferences.map((pref) => ({
    user_id: userId,
    ...pref,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from('user_notification_preferences')
    .upsert(records, { onConflict: 'user_id,event_type' });

  if (error) throw error;
}

export async function getConnectedAccounts(userId: string): Promise<ConnectedAccount[]> {
  const { data, error } = await supabase
    .from('user_connected_accounts')
    .select('id, user_id, provider, provider_account_id, provider_account_email, scopes, connected_at, last_synced_at, created_at, updated_at')
    .eq('user_id', userId);

  if (error) throw error;
  return data || [];
}

export async function disconnectAccount(
  userId: string,
  provider: string
): Promise<void> {
  const { error } = await supabase
    .from('user_connected_accounts')
    .delete()
    .eq('user_id', userId)
    .eq('provider', provider);

  if (error) throw error;
}

export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) throw error;
}
