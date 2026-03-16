import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { verifyPortalToken, logPortalEvent } from '../services/projectClientPortals';
import type { ClientPortalWithProject } from '../services/projectClientPortals';
import {
  validatePortalToken,
  sendVerificationCode,
  verifyCode,
  validateSession,
  logoutSession,
  markStepUpVerified,
  requiresStepUp,
  getStoredSession,
  storeSession,
  clearSession,
  type SendCodeResult,
  type VerifyCodeResult,
} from '../services/portalAuth';

export type PortalState =
  | 'loading'
  | 'invalid'
  | 'expired'
  | 'revoked'
  | 'needs_verification'
  | 'sending_code'
  | 'awaiting_code'
  | 'verifying'
  | 'session_expired'
  | 'authenticated';

export interface AuthInfo {
  portalId: string;
  maskedEmail: string | null;
  contactName: string;
  projectName: string;
  orgName: string;
  supportEmail: string | null;
  hasEmail: boolean;
  codeExpiresAt: string | null;
  sessionToken: string | null;
  lastOtpVerifiedAt: string | null;
}

interface ClientPortalContextValue {
  state: PortalState;
  portal: ClientPortalWithProject | null;
  rawToken: string;
  authInfo: AuthInfo | null;
  sendCode: () => Promise<SendCodeResult>;
  submitCode: (code: string, rememberDevice: boolean) => Promise<VerifyCodeResult>;
  logout: () => Promise<void>;
  logEvent: (eventType: string, metadata?: Record<string, unknown>) => Promise<void>;
  needsStepUp: () => boolean;
  completeStepUp: () => Promise<void>;
}

const ClientPortalContext = createContext<ClientPortalContextValue | null>(null);

export function ClientPortalProvider({ children }: { children: React.ReactNode }) {
  const { portalToken = '' } = useParams<{ portalToken: string }>();
  const [state, setState] = useState<PortalState>('loading');
  const [portal, setPortal] = useState<ClientPortalWithProject | null>(null);
  const [authInfo, setAuthInfo] = useState<AuthInfo | null>(null);

  useEffect(() => {
    if (!portalToken) {
      setState('invalid');
      return;
    }
    initializePortal();
  }, [portalToken]);

  async function initializePortal() {
    setState('loading');
    try {
      const tokenInfo = await validatePortalToken(portalToken);

      if (!tokenInfo.valid) {
        if (tokenInfo.reason === 'expired') { setState('expired'); return; }
        if (tokenInfo.reason === 'revoked') { setState('revoked'); return; }
        setState('invalid');
        return;
      }

      const baseAuthInfo: AuthInfo = {
        portalId: tokenInfo.portalId!,
        maskedEmail: tokenInfo.maskedEmail || null,
        contactName: tokenInfo.contactName || 'Client',
        projectName: tokenInfo.projectName || 'Your Project',
        orgName: tokenInfo.orgName || 'Your Team',
        supportEmail: tokenInfo.supportEmail || null,
        hasEmail: tokenInfo.hasEmail || false,
        codeExpiresAt: null,
        sessionToken: null,
        lastOtpVerifiedAt: null,
      };

      const stored = getStoredSession(portalToken);
      if (stored) {
        const sessionResult = await validateSession(tokenInfo.portalId!, stored.token);
        if (sessionResult.valid) {
          const portalData = await verifyPortalToken(portalToken).catch(() => null);
          setPortal(portalData);
          setAuthInfo({
            ...baseAuthInfo,
            sessionToken: stored.token,
            lastOtpVerifiedAt: sessionResult.lastOtpVerifiedAt || null,
          });
          setState('authenticated');
          return;
        } else {
          clearSession(portalToken);
          if (sessionResult.reason === 'expired') {
            setAuthInfo(baseAuthInfo);
            setState('session_expired');
            return;
          }
        }
      }

      setAuthInfo(baseAuthInfo);
      setState('needs_verification');
    } catch {
      setState('invalid');
    }
  }

  const sendCode = useCallback(async (): Promise<SendCodeResult> => {
    if (!authInfo) return { success: false, error: 'No portal info' };
    setState('sending_code');
    const result = await sendVerificationCode(authInfo.portalId);
    if (result.success) {
      setAuthInfo(prev => prev ? { ...prev, codeExpiresAt: result.expiresAt || null } : prev);
      setState('awaiting_code');
    } else {
      setState('needs_verification');
    }
    return result;
  }, [authInfo]);

  const submitCode = useCallback(async (code: string, rememberDevice: boolean): Promise<VerifyCodeResult> => {
    if (!authInfo) return { success: false, error: 'No portal info' };
    setState('verifying');
    const result = await verifyCode(authInfo.portalId, code, rememberDevice);

    if (result.success && result.sessionToken) {
      storeSession(portalToken, result.sessionToken, result.expiresAt!);
      const portalData = await verifyPortalToken(portalToken).catch(() => null);
      setPortal(portalData);
      setAuthInfo(prev => prev ? {
        ...prev,
        sessionToken: result.sessionToken!,
        lastOtpVerifiedAt: new Date().toISOString(),
      } : prev);
      setState('authenticated');
    } else {
      setState('awaiting_code');
    }
    return result;
  }, [authInfo, portalToken]);

  const logout = useCallback(async () => {
    if (authInfo?.sessionToken) {
      await logoutSession(authInfo.portalId, authInfo.sessionToken).catch(() => {});
    }
    clearSession(portalToken);
    setPortal(null);
    setAuthInfo(prev => prev ? { ...prev, sessionToken: null } : prev);
    setState('needs_verification');
  }, [authInfo, portalToken]);

  const logEvent = useCallback(async (eventType: string, metadata?: Record<string, unknown>) => {
    if (!portal) return;
    await logPortalEvent({
      portalId: portal.id,
      projectId: portal.project_id,
      contactId: portal.contact_id,
      eventType,
      metadata,
      userAgent: navigator.userAgent,
    });
  }, [portal]);

  const needsStepUp = useCallback((): boolean => {
    return requiresStepUp(authInfo?.lastOtpVerifiedAt);
  }, [authInfo]);

  const completeStepUp = useCallback(async () => {
    if (!authInfo?.sessionToken) return;
    await markStepUpVerified(authInfo.portalId, authInfo.sessionToken);
    setAuthInfo(prev => prev ? { ...prev, lastOtpVerifiedAt: new Date().toISOString() } : prev);
  }, [authInfo]);

  return (
    <ClientPortalContext.Provider value={{
      state,
      portal,
      rawToken: portalToken,
      authInfo,
      sendCode,
      submitCode,
      logout,
      logEvent,
      needsStepUp,
      completeStepUp,
    }}>
      {children}
    </ClientPortalContext.Provider>
  );
}

export function useClientPortal(): ClientPortalContextValue {
  const ctx = useContext(ClientPortalContext);
  if (!ctx) throw new Error('useClientPortal must be used within ClientPortalProvider');
  return ctx;
}
