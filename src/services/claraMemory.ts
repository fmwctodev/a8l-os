import { supabase } from '../lib/supabase';
import type { ClaraMemory, ClaraMemoryType } from '../types/assistant';

export async function getClaraMemories(userId: string): Promise<ClaraMemory[]> {
  const { data, error } = await supabase
    .from('clara_memories')
    .select('*')
    .eq('user_id', userId)
    .order('importance_score', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as ClaraMemory[];
}

export async function getClaraMemoriesByType(
  userId: string,
  memoryType: ClaraMemoryType
): Promise<ClaraMemory[]> {
  const { data, error } = await supabase
    .from('clara_memories')
    .select('*')
    .eq('user_id', userId)
    .eq('memory_type', memoryType)
    .order('importance_score', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as ClaraMemory[];
}

export async function deleteClaraMemory(memoryId: string): Promise<void> {
  const { error } = await supabase
    .from('clara_memories')
    .delete()
    .eq('id', memoryId);

  if (error) throw error;
}

export async function clearAllClaraMemories(userId: string): Promise<void> {
  const { error } = await supabase
    .from('clara_memories')
    .delete()
    .eq('user_id', userId);

  if (error) throw error;
}
