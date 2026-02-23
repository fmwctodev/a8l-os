import { supabase } from '../lib/supabase';
import type { AssistantUserMemory, MemoryCategory } from '../types/assistant';

export async function getMemories(userId: string): Promise<AssistantUserMemory[]> {
  const { data, error } = await supabase
    .from('assistant_user_memory')
    .select('*')
    .eq('user_id', userId)
    .order('category')
    .order('memory_key');

  if (error) throw error;
  return (data || []) as AssistantUserMemory[];
}

export async function getMemoriesByCategory(
  userId: string,
  category: MemoryCategory
): Promise<AssistantUserMemory[]> {
  const { data, error } = await supabase
    .from('assistant_user_memory')
    .select('*')
    .eq('user_id', userId)
    .eq('category', category)
    .order('memory_key');

  if (error) throw error;
  return (data || []) as AssistantUserMemory[];
}

export async function setMemory(
  userId: string,
  orgId: string,
  key: string,
  value: unknown,
  category: MemoryCategory = 'general'
): Promise<AssistantUserMemory> {
  const { data, error } = await supabase
    .from('assistant_user_memory')
    .upsert(
      {
        user_id: userId,
        org_id: orgId,
        memory_key: key,
        memory_value: value,
        category,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,memory_key' }
    )
    .select('*')
    .single();

  if (error) throw error;
  return data as AssistantUserMemory;
}

export async function deleteMemory(memoryId: string): Promise<void> {
  const { error } = await supabase
    .from('assistant_user_memory')
    .delete()
    .eq('id', memoryId);

  if (error) throw error;
}

export async function clearAllMemories(userId: string): Promise<void> {
  const { error } = await supabase
    .from('assistant_user_memory')
    .delete()
    .eq('user_id', userId);

  if (error) throw error;
}
