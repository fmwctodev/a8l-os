import { supabase } from '../lib/supabase';
import type { Role, Permission } from '../types';

export async function getRoles() {
  const { data, error } = await supabase
    .from('roles')
    .select('*')
    .order('hierarchy_level');

  if (error) throw error;
  return data as Role[];
}

export async function getRoleById(id: string) {
  const { data, error } = await supabase
    .from('roles')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data as Role | null;
}

export async function getPermissions() {
  const { data, error } = await supabase
    .from('permissions')
    .select('*')
    .order('module_name, key');

  if (error) throw error;
  return data as Permission[];
}

export async function getRolePermissions(roleId: string): Promise<Permission[]> {
  const { data, error } = await supabase
    .from('role_permissions')
    .select('permissions(*)')
    .eq('role_id', roleId);

  if (error) throw error;
  return data?.flatMap((rp: { permissions: Permission | Permission[] }) =>
    Array.isArray(rp.permissions) ? rp.permissions : [rp.permissions]
  ) || [];
}
