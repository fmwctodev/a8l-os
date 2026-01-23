import { supabase } from '../lib/supabase';
import type { User, InviteStaffInput, StaffFilters, Role } from '../types';
import { logAudit, getAuditLogs } from './audit';

export async function getUsers(organizationId?: string, filters?: StaffFilters) {
  let query = supabase
    .from('users')
    .select(`
      *,
      role:roles(*),
      department:departments(*)
    `)
    .order('created_at', { ascending: false });

  if (organizationId) {
    query = query.eq('organization_id', organizationId);
  }

  if (filters?.search) {
    query = query.or(`name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`);
  }

  if (filters?.status && filters.status.length > 0) {
    query = query.in('status', filters.status);
  }

  if (filters?.role_id) {
    query = query.eq('role_id', filters.role_id);
  }

  if (filters?.department_id) {
    query = query.eq('department_id', filters.department_id);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data as User[];
}

export async function getUsersByDepartment(organizationId: string, departmentId: string) {
  const { data, error } = await supabase
    .from('users')
    .select(`
      *,
      role:roles(*),
      department:departments(*)
    `)
    .eq('organization_id', organizationId)
    .eq('department_id', departmentId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as User[];
}

export async function getUserById(id: string) {
  const { data, error } = await supabase
    .from('users')
    .select(`
      *,
      role:roles(*),
      department:departments(*)
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data as User | null;
}

export async function updateUser(id: string, updates: Partial<User>, currentUser: User) {
  const { data: before } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  const { data, error } = await supabase
    .from('users')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) throw error;

  await logAudit({
    userId: currentUser.id,
    action: 'update',
    entityType: 'user',
    entityId: id,
    beforeState: before,
    afterState: data,
  });

  return data;
}

export async function canAssignRole(currentUserRole: Role, targetRole: Role): Promise<boolean> {
  if (currentUserRole.name === 'SuperAdmin') {
    return true;
  }
  return targetRole.hierarchy_level > currentUserRole.hierarchy_level;
}

export async function inviteStaff(
  input: InviteStaffInput,
  organizationId: string,
  currentUser: User
) {
  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .eq('email', input.email)
    .maybeSingle();

  if (existingUser) {
    throw new Error('A user with this email already exists');
  }

  const { data: targetRole } = await supabase
    .from('roles')
    .select('*')
    .eq('id', input.role_id)
    .single();

  if (!targetRole) {
    throw new Error('Invalid role selected');
  }

  if (currentUser.role && !await canAssignRole(currentUser.role, targetRole)) {
    throw new Error('You cannot assign a role with higher privileges than your own');
  }

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: input.email,
    email_confirm: false,
    password: Math.random().toString(36).slice(-12) + 'Aa1!',
    user_metadata: {
      name: `${input.first_name} ${input.last_name}`,
    },
  });

  if (authError) throw authError;

  const { data, error } = await supabase
    .from('users')
    .insert({
      id: authData.user.id,
      email: input.email,
      name: `${input.first_name} ${input.last_name}`,
      role_id: input.role_id,
      organization_id: organizationId,
      department_id: input.department_id,
      phone: input.phone || null,
      timezone: input.timezone,
      status: 'invited',
      invited_by: currentUser.id,
    })
    .select(`
      *,
      role:roles(*),
      department:departments(*)
    `)
    .single();

  if (error) throw error;

  await logAudit({
    userId: currentUser.id,
    action: 'staff.invite',
    entityType: 'user',
    entityId: data.id,
    afterState: data,
  });

  const { error: resetError } = await supabase.auth.resetPasswordForEmail(input.email, {
    redirectTo: `${window.location.origin}/login`,
  });

  if (resetError) {
    console.error('Failed to send invite email:', resetError);
  }

  return data as User;
}

export async function inviteUser(
  email: string,
  name: string,
  roleId: string,
  organizationId: string,
  departmentId: string | null,
  currentUser: User
) {
  return inviteStaff(
    {
      first_name: name.split(' ')[0] || name,
      last_name: name.split(' ').slice(1).join(' ') || '',
      email,
      role_id: roleId,
      department_id: departmentId,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    organizationId,
    currentUser
  );
}

export async function disableUser(userId: string, currentUser: User) {
  const { data: targetUser } = await supabase
    .from('users')
    .select(`*, role:roles(*)`)
    .eq('id', userId)
    .single();

  if (!targetUser) {
    throw new Error('User not found');
  }

  if (targetUser.role?.name === 'SuperAdmin' && currentUser.role?.name !== 'SuperAdmin') {
    throw new Error('Only SuperAdmin can disable another SuperAdmin');
  }

  if (userId === currentUser.id) {
    throw new Error('You cannot disable your own account');
  }

  const { data: before } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  const { data, error } = await supabase
    .from('users')
    .update({
      status: 'disabled',
      disabled_at: new Date().toISOString(),
      disabled_by: currentUser.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
    .select()
    .single();

  if (error) throw error;

  await logAudit({
    userId: currentUser.id,
    action: 'staff.disable',
    entityType: 'user',
    entityId: userId,
    beforeState: before,
    afterState: data,
  });

  return data as User;
}

export async function enableUser(userId: string, currentUser: User) {
  const { data: before } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (!before) {
    throw new Error('User not found');
  }

  const { data, error } = await supabase
    .from('users')
    .update({
      status: 'active',
      disabled_at: null,
      disabled_by: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
    .select()
    .single();

  if (error) throw error;

  await logAudit({
    userId: currentUser.id,
    action: 'staff.enable',
    entityType: 'user',
    entityId: userId,
    beforeState: before,
    afterState: data,
  });

  return data as User;
}

export async function resetUserPassword(userId: string, currentUser: User) {
  const { data: targetUser } = await supabase
    .from('users')
    .select(`*, role:roles(*)`)
    .eq('id', userId)
    .single();

  if (!targetUser) {
    throw new Error('User not found');
  }

  if (targetUser.role?.name === 'SuperAdmin' && currentUser.role?.name !== 'SuperAdmin') {
    throw new Error('Only SuperAdmin can reset password for another SuperAdmin');
  }

  const { error } = await supabase.auth.resetPasswordForEmail(targetUser.email, {
    redirectTo: `${window.location.origin}/login`,
  });

  if (error) throw error;

  await logAudit({
    userId: currentUser.id,
    action: 'staff.password_reset.initiated',
    entityType: 'user',
    entityId: userId,
    afterState: { email: targetUser.email },
  });

  return true;
}

export async function resendInvite(userId: string, currentUser: User) {
  const { data: targetUser } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (!targetUser) {
    throw new Error('User not found');
  }

  if (targetUser.status !== 'invited') {
    throw new Error('User is not in invited status');
  }

  const { error } = await supabase.auth.resetPasswordForEmail(targetUser.email, {
    redirectTo: `${window.location.origin}/login`,
  });

  if (error) throw error;

  await logAudit({
    userId: currentUser.id,
    action: 'staff.invite.resend',
    entityType: 'user',
    entityId: userId,
    afterState: { email: targetUser.email },
  });

  return true;
}

export async function getUserActivity(
  userId: string,
  options?: {
    limit?: number;
    offset?: number;
    startDate?: string;
    endDate?: string;
    entityType?: string;
    action?: string;
  }
) {
  return getAuditLogs({
    userId,
    limit: options?.limit || 50,
    offset: options?.offset,
    startDate: options?.startDate,
    endDate: options?.endDate,
    entityType: options?.entityType,
    action: options?.action,
  });
}

export async function getStaffStats(organizationId: string) {
  const { data, error } = await supabase
    .from('users')
    .select('status')
    .eq('organization_id', organizationId);

  if (error) throw error;

  const stats = {
    total: data.length,
    active: data.filter(u => u.status === 'active').length,
    invited: data.filter(u => u.status === 'invited').length,
    disabled: data.filter(u => u.status === 'disabled').length,
  };

  return stats;
}
