import { supabase } from '../lib/supabase';
import type { Department, User } from '../types';
import { logAudit } from './audit';

export async function getDepartments(organizationId: string, includeDisabled = false) {
  let query = supabase
    .from('departments')
    .select('*')
    .eq('organization_id', organizationId)
    .order('name');

  if (!includeDisabled) {
    query = query.eq('status', 'active');
  }

  const { data, error } = await query;

  if (error) throw error;
  return data as Department[];
}

export async function getDepartmentById(id: string) {
  const { data, error } = await supabase
    .from('departments')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data as Department | null;
}

export async function getDepartmentWithUserCount(organizationId: string, includeDisabled = false) {
  let query = supabase
    .from('departments')
    .select(`
      *,
      users:users(count)
    `)
    .eq('organization_id', organizationId)
    .order('name');

  if (!includeDisabled) {
    query = query.eq('status', 'active');
  }

  const { data, error } = await query;

  if (error) throw error;

  return data.map(dept => ({
    ...dept,
    user_count: (dept.users as unknown as { count: number }[])?.[0]?.count || 0,
  }));
}

export async function createDepartment(
  name: string,
  organizationId: string,
  currentUser: User
) {
  const { data: existing } = await supabase
    .from('departments')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('name', name)
    .maybeSingle();

  if (existing) {
    throw new Error('A department with this name already exists');
  }

  const { data, error } = await supabase
    .from('departments')
    .insert({
      name,
      organization_id: organizationId,
      status: 'active',
    })
    .select()
    .single();

  if (error) throw error;

  await logAudit({
    userId: currentUser.id,
    action: 'create',
    entityType: 'department',
    entityId: data.id,
    afterState: data,
  });

  return data as Department;
}

export async function updateDepartment(
  id: string,
  updates: Partial<Department>,
  currentUser: User
) {
  const { data: before } = await supabase
    .from('departments')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  const { data, error } = await supabase
    .from('departments')
    .update(updates)
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) throw error;

  await logAudit({
    userId: currentUser.id,
    action: 'update',
    entityType: 'department',
    entityId: id,
    beforeState: before,
    afterState: data,
  });

  return data as Department | null;
}

export async function disableDepartment(id: string, currentUser: User) {
  const { data: before } = await supabase
    .from('departments')
    .select('*')
    .eq('id', id)
    .single();

  if (!before) {
    throw new Error('Department not found');
  }

  const { count } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true })
    .eq('department_id', id)
    .neq('status', 'disabled');

  if (count && count > 0) {
    throw new Error(`Cannot disable department with ${count} active user(s). Please reassign users first.`);
  }

  const { data, error } = await supabase
    .from('departments')
    .update({ status: 'disabled' })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  await logAudit({
    userId: currentUser.id,
    action: 'department.disable',
    entityType: 'department',
    entityId: id,
    beforeState: before,
    afterState: data,
  });

  return data as Department;
}

export async function enableDepartment(id: string, currentUser: User) {
  const { data: before } = await supabase
    .from('departments')
    .select('*')
    .eq('id', id)
    .single();

  if (!before) {
    throw new Error('Department not found');
  }

  const { data, error } = await supabase
    .from('departments')
    .update({ status: 'active' })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  await logAudit({
    userId: currentUser.id,
    action: 'department.enable',
    entityType: 'department',
    entityId: id,
    beforeState: before,
    afterState: data,
  });

  return data as Department;
}

export async function deleteDepartment(id: string, currentUser: User) {
  const { data: before } = await supabase
    .from('departments')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  const { error } = await supabase
    .from('departments')
    .delete()
    .eq('id', id);

  if (error) throw error;

  await logAudit({
    userId: currentUser.id,
    action: 'delete',
    entityType: 'department',
    entityId: id,
    beforeState: before,
  });
}
