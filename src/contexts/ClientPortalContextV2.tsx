import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  validateSession,
  getStoredSession,
  storeSession,
  storeOrgId,
  clearSession,
  logoutSession,
  markStepUpVerified as apiMarkStepUp,
  fetchProject,
  type ValidateSessionResult,
  type ClientPortalProjectDetail,
} from '../services/clientPortal';

// ─── State machine ───────────────────────────────────────────────

export type PortalState =
  | 'loading'
  | 'unauthenticated'
  | 'needs_code'
  | 'authenticated'
  | 'session_expired';

export interface ContactInfo {
  contactId: string;
  contactName: string;
  contactEmail: string | null;
  orgId: string;
  orgName: string;
  supportEmail: string;
  lastOtpVerifiedAt: string | null;
}

export interface ClientPortalContextValue {
  state: PortalState;
  setState: (s: PortalState) => void;
  contact: ContactInfo | null;
  sessionToken: string | null;
  inviteToken: string | null;
  pendingEmail: string | null;
  setPendingEmail: (e: string | null) => void;
  authenticate: (token: string, info: ValidateSessionResult) => void;
  logout: () => Promise<void>;
  needsStepUp: () => boolean;
  completeStepUp: () => Promise<void>;
}

const ClientPortalContext = createContext<ClientPortalContextValue | null>(null);

export function useClientPortalV2(): ClientPortalContextValue {
  const ctx = useContext(ClientPortalContext);
  if (!ctx) throw new Error('useClientPortalV2 must be used within ClientPortalProviderV2');
  return ctx;
}

// ─── Project hook (used by child pages) ──────────────────────────

export function useClientPortalProject(projectId: string): {
  project: ClientPortalProjectDetail | null;
  loading: boolean;
  error: string | null;
} {
  const { sessionToken } = useClientPortalV2();
  const [project, setProject] = useState<ClientPortalProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionToken || !projectId) return;
    let cancelled = false;
    setLoading(true);
    fetchProject(sessionToken, projectId)
      .then((p) => {
        if (!cancelled) {
          if (p) { setProject(p); setError(null); }
          else setError('Project not found');
        }
      })
      .catch((err) => { if (!cancelled) setError(String(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [sessionToken, projectId]);

  return { project, loading, error };
}

// ─── Provider ────────────────────────────────────────────────────

export function ClientPortalProviderV2({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('invite');

  const [state, setState] = useState<PortalState>('loading');
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [contact, setContact] = useState<ContactInfo | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  // On mount: try to restore session from localStorage
  useEffect(() => {
    const stored = getStoredSession();
    if (!stored) {
      setState('unauthenticated');
      return;
    }

    validateSession(stored)
      .then((result) => {
        if (result.valid && result.contactId) {
          setSessionToken(stored);
          setContact({
            contactId: result.contactId!,
            contactName: result.contactName ?? '',
            contactEmail: result.contactEmail ?? null,
            orgId: result.orgId!,
            orgName: result.orgName ?? '',
            supportEmail: result.supportEmail ?? '',
            lastOtpVerifiedAt: result.lastOtpVerifiedAt ?? null,
          });
          if (result.orgId) storeOrgId(result.orgId);
          setState('authenticated');
        } else {
          clearSession();
          setState('unauthenticated');
        }
      })
      .catch(() => {
        clearSession();
        setState('unauthenticated');
      });
  }, []);

  const authenticate = useCallback(
    (token: string, info: ValidateSessionResult) => {
      storeSession(token);
      if (info.orgId) storeOrgId(info.orgId);
      setSessionToken(token);
      setContact({
        contactId: info.contactId!,
        contactName: info.contactName ?? '',
        contactEmail: info.contactEmail ?? null,
        orgId: info.orgId!,
        orgName: info.orgName ?? '',
        supportEmail: info.supportEmail ?? '',
        lastOtpVerifiedAt: info.lastOtpVerifiedAt ?? null,
      });
      setState('authenticated');
      navigate('/client-portal/dashboard');
    },
    [navigate]
  );

  const handleLogout = useCallback(async () => {
    if (sessionToken) {
      try {
        await logoutSession(sessionToken);
      } catch {}
    }
    clearSession();
    setSessionToken(null);
    setContact(null);
    setState('unauthenticated');
    navigate('/client-portal');
  }, [sessionToken, navigate]);

  const needsStepUp = useCallback(() => {
    if (!contact?.lastOtpVerifiedAt) return true;
    const elapsed = Date.now() - new Date(contact.lastOtpVerifiedAt).getTime();
    return elapsed > 10 * 60 * 1000; // 10 minutes
  }, [contact?.lastOtpVerifiedAt]);

  const completeStepUp = useCallback(async () => {
    if (!sessionToken) return;
    await apiMarkStepUp(sessionToken);
    setContact((prev) =>
      prev ? { ...prev, lastOtpVerifiedAt: new Date().toISOString() } : prev
    );
  }, [sessionToken]);

  const value = useMemo<ClientPortalContextValue>(
    () => ({
      state,
      setState,
      contact,
      sessionToken,
      inviteToken,
      pendingEmail,
      setPendingEmail,
      authenticate,
      logout: handleLogout,
      needsStepUp,
      completeStepUp,
    }),
    [state, contact, sessionToken, inviteToken, pendingEmail, authenticate, handleLogout, needsStepUp, completeStepUp]
  );

  return <ClientPortalContext.Provider value={value}>{children}</ClientPortalContext.Provider>;
}
