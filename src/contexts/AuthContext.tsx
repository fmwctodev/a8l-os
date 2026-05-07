import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { UserWithDetails, PermissionKey, FeatureFlag } from '../types';
import * as authService from '../services/auth';
import { getFeatureFlags } from '../services/featureFlags';
import { markSessionRestored, isSessionHealthy } from '../lib/edgeFunction';

function hasOAuthHashTokens(): boolean {
  const hash = window.location.hash;
  return hash.includes('access_token=') || hash.includes('refresh_token=');
}

interface AuthContextValue {
  session: Session | null;
  user: UserWithDetails | null;
  featureFlags: FeatureFlag[];
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithMicrosoft: () => Promise<void>;
  signOut: () => Promise<void>;
  hasPermission: (permission: PermissionKey) => boolean;
  isFeatureEnabled: (featureKey: string) => boolean;
  isSuperAdmin: boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<UserWithDetails | null>(null);
  const [featureFlags, setFeatureFlags] = useState<FeatureFlag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const awaitingOAuth = useRef(hasOAuthHashTokens());

  const loadUser = useCallback(async () => {
    try {
      const currentUser = await authService.getCurrentUser();
      setUser(currentUser);

      if (currentUser) {
        // Load flags scoped to the user's active org (which honors
        // super_admin_active_org_id when applicable). organization is
        // already loaded by getCurrentUser.
        const activeOrgId = currentUser.organization?.id ?? currentUser.organization_id;
        const flags = await getFeatureFlags(activeOrgId);
        setFeatureFlags(flags);
      }
    } catch (error) {
      console.error('Error loading user:', error);
      setUser(null);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    await loadUser();
  }, [loadUser]);

  useEffect(() => {
    let isMounted = true;
    let oauthTimeout: ReturnType<typeof setTimeout> | null = null;

    if (awaitingOAuth.current) {
      oauthTimeout = setTimeout(() => {
        if (isMounted && awaitingOAuth.current) {
          awaitingOAuth.current = false;
          setIsLoading(false);
        }
      }, 8000);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!isMounted) return;

      if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
        setFeatureFlags([]);
        setIsLoading(false);
        awaitingOAuth.current = false;
        return;
      }

      if (event === 'TOKEN_REFRESHED') {
        setSession(newSession);
        if (!isSessionHealthy()) {
          markSessionRestored();
        }
        return;
      }

      setSession(newSession);

      if (newSession) {
        awaitingOAuth.current = false;
        if (oauthTimeout) {
          clearTimeout(oauthTimeout);
          oauthTimeout = null;
        }
        if (!isSessionHealthy() && event === 'SIGNED_IN') {
          markSessionRestored();
        }
        setTimeout(() => {
          if (!isMounted) return;
          loadUser().finally(() => {
            if (isMounted) setIsLoading(false);
          });
        }, 0);
      } else if (event === 'INITIAL_SESSION') {
        if (!awaitingOAuth.current) {
          setIsLoading(false);
        }
      }
    });

    return () => {
      isMounted = false;
      if (oauthTimeout) clearTimeout(oauthTimeout);
      subscription.unsubscribe();
    };
  }, [loadUser]);

  const signIn = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const { session: newSession } = await authService.signIn(email, password);
      setSession(newSession);
      await loadUser();
    } finally {
      setIsLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    await authService.signInWithGoogle();
  };

  const signInWithMicrosoft = async () => {
    await authService.signInWithMicrosoft();
  };

  const signOut = async () => {
    await authService.signOut();
    setSession(null);
    setUser(null);
    setFeatureFlags([]);
  };

  const isSuperAdmin = user?.role?.name === 'SuperAdmin';

  const hasPermission = (permission: PermissionKey): boolean => {
    if (!user) return false;
    if (isSuperAdmin) return true;
    return user.permissions.includes(permission);
  };

  const isFeatureEnabled = (featureKey: string): boolean => {
    const flag = featureFlags.find(f => f.key === featureKey);
    return flag?.enabled ?? false;
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        featureFlags,
        isLoading,
        signIn,
        signInWithGoogle,
        signInWithMicrosoft,
        signOut,
        hasPermission,
        isFeatureEnabled,
        isSuperAdmin,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
