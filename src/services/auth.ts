import { supabase } from '../lib/supabase';
import type { UserWithDetails } from '../types';

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  return session;
}

export async function getCurrentUser(): Promise<UserWithDetails | null> {
  const { data: { user: authUser } } = await supabase.auth.getUser();

  if (!authUser) return null;

  const { data: user, error } = await supabase
    .from('users')
    .select(`
      *,
      role:roles(*),
      department:departments(*)
    `)
    .eq('id', authUser.id)
    .maybeSingle();

  if (error || !user) return null;

  // Load the user's *active* organization. For SuperAdmin with a
  // super_admin_active_org_id set, that overrides; otherwise the
  // home organization_id wins. Mirrors the get_user_org_id() SQL fn.
  const isSuperAdmin = user.role?.name === 'SuperAdmin';
  const activeOrgId =
    (isSuperAdmin && user.super_admin_active_org_id) || user.organization_id;

  const { data: organization } = await supabase
    .from('organizations')
    .select('id, name, slug, display_name, logo_url, created_at')
    .eq('id', activeOrgId)
    .maybeSingle();

  const { data: permissions } = await supabase
    .from('role_permissions')
    .select('permissions(key)')
    .eq('role_id', user.role_id);

  const permissionKeys = permissions?.flatMap((p: { permissions: { key: string }[] | { key: string } }) =>
    Array.isArray(p.permissions) ? p.permissions.map(perm => perm.key) : [p.permissions.key]
  ) || [];

  return {
    ...user,
    organization: organization ?? null,
    permissions: permissionKeys,
  } as UserWithDetails;
}

export async function signInWithGoogle(redirectTo?: string) {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectTo || window.location.origin,
    },
  });
  if (error) throw error;
}

export async function signInWithMicrosoft(redirectTo?: string) {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'azure',
    options: {
      scopes: 'openid profile email offline_access User.Read Mail.ReadWrite Mail.Send Calendars.ReadWrite Files.ReadWrite.All Chat.ReadWrite OnlineMeetings.ReadWrite',
      redirectTo: redirectTo || window.location.origin,
    },
  });
  if (error) throw error;
}

export function onAuthStateChange(callback: (event: string, session: unknown) => void) {
  return supabase.auth.onAuthStateChange(callback);
}
