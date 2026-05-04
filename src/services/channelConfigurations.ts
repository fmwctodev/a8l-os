import { supabase } from '../lib/supabase';
import type { ChannelConfiguration, GmailConfig, WebchatConfig } from '../types';

type ChannelType = 'gmail' | 'webchat';

export async function getChannelConfiguration(
  orgId: string,
  channelType: ChannelType
): Promise<ChannelConfiguration | null> {
  const { data, error } = await supabase
    .from('channel_configurations')
    .select('*')
    .eq('organization_id', orgId)
    .eq('channel_type', channelType)
    .maybeSingle();

  if (error) throw error;
  return data as ChannelConfiguration | null;
}

export async function getAllChannelConfigurations(
  orgId: string
): Promise<ChannelConfiguration[]> {
  const { data, error } = await supabase
    .from('channel_configurations')
    .select('*')
    .eq('organization_id', orgId);

  if (error) throw error;
  return data as ChannelConfiguration[];
}

export async function saveChannelConfiguration(
  orgId: string,
  channelType: ChannelType,
  config: GmailConfig | WebchatConfig,
  isActive: boolean
): Promise<ChannelConfiguration> {
  const { data, error } = await supabase
    .from('channel_configurations')
    .upsert({
      organization_id: orgId,
      channel_type: channelType,
      config,
      is_active: isActive,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'organization_id,channel_type'
    })
    .select()
    .single();

  if (error) throw error;
  return data as ChannelConfiguration;
}

export async function toggleChannelActive(
  orgId: string,
  channelType: ChannelType,
  isActive: boolean
): Promise<void> {
  const { error } = await supabase
    .from('channel_configurations')
    .update({
      is_active: isActive,
      updated_at: new Date().toISOString()
    })
    .eq('organization_id', orgId)
    .eq('channel_type', channelType);

  if (error) throw error;
}

export async function deleteChannelConfiguration(
  orgId: string,
  channelType: ChannelType
): Promise<void> {
  const { error } = await supabase
    .from('channel_configurations')
    .delete()
    .eq('organization_id', orgId)
    .eq('channel_type', channelType);

  if (error) throw error;
}

export async function getActiveChannels(orgId: string): Promise<ChannelType[]> {
  const { data, error } = await supabase
    .from('channel_configurations')
    .select('channel_type')
    .eq('organization_id', orgId)
    .eq('is_active', true);

  if (error) throw error;
  return data?.map(c => c.channel_type as ChannelType) || [];
}
