import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { UserWithDetails, PermissionKey, FeatureFlag } from '../types';
import * as authService from '../services/auth';
import { getFeatureFlags } from '../services/featureFlags';

interface AuthContextValue {
  session: Session | null;
  user: UserWithDetails | null;
  featureFlags: FeatureFlag[];
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
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
  const [isInitialized, setIsInitialized] = useState(false);

  const loadUser = useCallback(async () => {
    try {
      const currentUser = await authService.getCurrentUser();
      setUser(currentUser);

      if (currentUser) {
        const flags = await getFeatureFlags();
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

    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      if (!isMounted) return;
      setSession(currentSession);
      if (currentSession) {
        loadUser().finally(() => {
          if (isMounted) {
            setIsLoading(false);
            setIsInitialized(true);
          }
        });
      } else {
        setIsLoading(false);
        setIsInitialized(true);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!isMounted) return;

      if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
        setFeatureFlags([]);
        return;
      }

      setSession(newSession);
      if (newSession && isInitialized) {
        setIsLoading(true);
        loadUser().finally(() => {
          if (isMounted) setIsLoading(false);
        });
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [loadUser, isInitialized]);

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
