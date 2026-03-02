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

  const { data: permissions } = await supabase
    .from('role_permissions')
    .select('permissions(key)')
    .eq('role_id', user.role_id);

  const permissionKeys = permissions?.flatMap((p: { permissions: { key: string }[] | { key: string } }) =>
    Array.isArray(p.permissions) ? p.permissions.map(perm => perm.key) : [p.permissions.key]
  ) || [];

  return {
    ...user,
    permissions: permissionKeys,
  } as UserWithDetails;
}

export async function signInWithGoogle(redirectTo?: string) {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectTo || window.location.href,
    },
  });
  if (error) throw error;
}

export function onAuthStateChange(callback: (event: string, session: unknown) => void) {
  return supabase.auth.onAuthStateChange(callback);
}
