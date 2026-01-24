import { supabase } from '../lib/supabase';
import type { Permission, User } from '../types';
import { logAudit } from './audit';

export interface UserPermissionOverride {
  id: string;
  user_id: string;
  permission_id: string;
  granted: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  notes: string | null;
  permission?: Permission;
}

export interface EffectivePermission {
  permission: Permission;
  granted: boolean;
  source: 'role' | 'override';
  overrideId?: string;
}

export async function getUserPermissionOverrides(userId: string): Promise<UserPermissionOverride[]> {
  const { data, error } = await supabase
    .from('user_permission_overrides')
    .select(`
      *,
      permission:permissions(*)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function setUserPermissionOverride(
  userId: string,
  permissionId: string,
  granted: boolean,
  currentUser: User,
  notes?: string
): Promise<UserPermissionOverride> {
  const { data: existing } = await supabase
    .from('user_permission_overrides')
    .select('*')
    .eq('user_id', userId)
    .eq('permission_id', permissionId)
    .maybeSingle();

  if (existing) {
    const { data, error } = await supabase
      .from('user_permission_overrides')
      .update({
        granted,
        notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) throw error;

    await logAudit({
      userId: currentUser.id,
      action: 'permission_override.update',
      entityType: 'user_permission_override',
      entityId: existing.id,
      beforeState: existing,
      afterState: data,
    });

    return data;
  }

  const { data, error } = await supabase
    .from('user_permission_overrides')
    .insert({
      user_id: userId,
      permission_id: permissionId,
      granted,
      created_by: currentUser.id,
      notes,
    })
    .select()
    .single();

  if (error) throw error;

  await logAudit({
    userId: currentUser.id,
    action: 'permission_override.create',
    entityType: 'user_permission_override',
    entityId: data.id,
    afterState: data,
  });

  return data;
}

export async function removeUserPermissionOverride(
  userId: string,
  permissionId: string,
  currentUser: User
): Promise<void> {
  const { data: existing } = await supabase
    .from('user_permission_overrides')
    .select('*')
    .eq('user_id', userId)
    .eq('permission_id', permissionId)
    .maybeSingle();

  if (!existing) return;

  const { error } = await supabase
    .from('user_permission_overrides')
    .delete()
    .eq('id', existing.id);

  if (error) throw error;

  await logAudit({
    userId: currentUser.id,
    action: 'permission_override.delete',
    entityType: 'user_permission_override',
    entityId: existing.id,
    beforeState: existing,
  });
}

export async function resetUserPermissionsToRole(
  userId: string,
  currentUser: User
): Promise<void> {
  const { data: overrides } = await supabase
    .from('user_permission_overrides')
    .select('*')
    .eq('user_id', userId);

  if (!overrides || overrides.length === 0) return;

  const { error } = await supabase
    .from('user_permission_overrides')
    .delete()
    .eq('user_id', userId);

  if (error) throw error;

  await logAudit({
    userId: currentUser.id,
    action: 'permission_override.reset_all',
    entityType: 'user',
    entityId: userId,
    beforeState: { overrides },
    afterState: { overrides: [] },
  });
}

export async function calculateEffectivePermissions(
  userId: string,
  roleId: string
): Promise<EffectivePermission[]> {
  const [rolePermissionsResult, overridesResult, allPermissionsResult] = await Promise.all([
    supabase
      .from('role_permissions')
      .select('permission_id, permissions(*)')
      .eq('role_id', roleId),
    supabase
      .from('user_permission_overrides')
      .select('*, permission:permissions(*)')
      .eq('user_id', userId),
    supabase
      .from('permissions')
      .select('*')
      .order('module_name, key'),
  ]);

  if (rolePermissionsResult.error) throw rolePermissionsResult.error;
  if (overridesResult.error) throw overridesResult.error;
  if (allPermissionsResult.error) throw allPermissionsResult.error;

  const rolePermissionIds = new Set(
    rolePermissionsResult.data?.map((rp) => rp.permission_id) || []
  );

  const overrideMap = new Map<string, UserPermissionOverride>();
  (overridesResult.data || []).forEach((override) => {
    overrideMap.set(override.permission_id, override);
  });

  const effectivePermissions: EffectivePermission[] = [];

  for (const permission of allPermissionsResult.data || []) {
    const override = overrideMap.get(permission.id);
    const hasRolePermission = rolePermissionIds.has(permission.id);

    if (override) {
      effectivePermissions.push({
        permission,
        granted: override.granted,
        source: 'override',
        overrideId: override.id,
      });
    } else {
      effectivePermissions.push({
        permission,
        granted: hasRolePermission,
        source: 'role',
      });
    }
  }

  return effectivePermissions;
}

export async function bulkSetPermissionOverrides(
  userId: string,
  overrides: Array<{ permissionId: string; granted: boolean }>,
  currentUser: User
): Promise<void> {
  for (const override of overrides) {
    await setUserPermissionOverride(userId, override.permissionId, override.granted, currentUser);
  }
}

export async function getPermissionsByModule(): Promise<Map<string, Permission[]>> {
  const { data, error } = await supabase
    .from('permissions')
    .select('*')
    .order('module_name, key');

  if (error) throw error;

  const moduleMap = new Map<string, Permission[]>();
  for (const permission of data || []) {
    const existing = moduleMap.get(permission.module_name) || [];
    existing.push(permission);
    moduleMap.set(permission.module_name, existing);
  }

  return moduleMap;
}
