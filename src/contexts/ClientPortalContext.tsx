/**
 * ClientPortalContext — provides the old per-project portal object shape
 * that the portal child pages (home, change requests, support tickets,
 * documents) expect. This context is populated by the
 * ClientPortalProjectBridge component which sits between the V2
 * contact-scoped auth and the old project-scoped pages.
 *
 * NOTE: This context no longer manages authentication. Auth is handled
 * by ClientPortalContextV2 and the V2 layout. This context only holds
 * portal data for a single selected project.
 */

import { createContext, useContext, useCallback, useState } from 'react';
import type { ClientPortalWithProject } from '../services/projectClientPortals';
import { logPortalEvent } from '../services/projectClientPortals';
import { sendLoginCode, verifyLoginCode } from '../services/clientPortal';
import type { SendCodeResult, VerifyCodeResult } from '../services/clientPortal';

export type PortalState =
  | 'loading'
  | 'authenticated'
  | 'needs_verification'
  | 'sending_code'
  | 'awaiting_code'
  | 'verifying'
  | 'session_expired';

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

export function useClientPortal(): ClientPortalContextValue {
  const ctx = useContext(ClientPortalContext);
  if (!ctx) throw new Error('useClientPortal must be used within ClientPortalProvider');
  return ctx;
}

/**
 * Simplified provider that holds a pre-loaded portal object.
 * Used by ClientPortalProjectBridge to wrap old portal pages.
 */
export function ClientPortalProvider({
  portal,
  contactEmail,
  lastOtpVerifiedAt,
  children,
}: {
  portal: ClientPortalWithProject;
  contactEmail: string | null;
  lastOtpVerifiedAt: string | null;
  children: React.ReactNode;
}) {
  const [otpVerifiedAt, setOtpVerifiedAt] = useState(lastOtpVerifiedAt);

  const logEvent = useCallback(
    async (eventType: string, metadata?: Record<string, unknown>) => {
      try {
        await logPortalEvent({
          portalId: portal.id,
          projectId: portal.project_id,
          contactId: portal.contact_id,
          eventType,
          metadata,
        });
      } catch (err) {
        console.error('[ClientPortalContext] logEvent failed:', err);
      }
    },
    [portal.id, portal.project_id, portal.contact_id]
  );

  const needsStepUp = useCallback(() => {
    if (!otpVerifiedAt) return true;
    return Date.now() - new Date(otpVerifiedAt).getTime() > 10 * 60 * 1000;
  }, [otpVerifiedAt]);

  const completeStepUp = useCallback(async () => {
    setOtpVerifiedAt(new Date().toISOString());
  }, []);

  const sendCode = useCallback(async (): Promise<SendCodeResult> => {
    if (!contactEmail) return { success: false, error: 'No email' };
    return sendLoginCode(contactEmail);
  }, [contactEmail]);

  const submitCode = useCallback(
    async (code: string, rememberDevice: boolean): Promise<VerifyCodeResult> => {
      if (!contactEmail) return { success: false, error: 'No email' };
      const result = await verifyLoginCode(contactEmail, code, rememberDevice);
      if (result.success) {
        setOtpVerifiedAt(new Date().toISOString());
      }
      return result;
    },
    [contactEmail]
  );

  const authInfo: AuthInfo = {
    portalId: portal.id,
    maskedEmail: contactEmail ? contactEmail.replace(/(.{2}).*(@.*)/, '$1***$2') : null,
    contactName: portal.contact
      ? [portal.contact.first_name, portal.contact.last_name].filter(Boolean).join(' ') || 'Client'
      : 'Client',
    projectName: portal.project?.name ?? '',
    orgName: portal.organization?.name ?? '',
    supportEmail: portal.organization?.email ?? null,
    hasEmail: !!contactEmail,
    codeExpiresAt: null,
    sessionToken: null,
    lastOtpVerifiedAt: otpVerifiedAt,
  };

  const value: ClientPortalContextValue = {
    state: 'authenticated',
    portal,
    rawToken: '',
    authInfo,
    sendCode,
    submitCode,
    logout: async () => {},
    logEvent,
    needsStepUp,
    completeStepUp,
  };

  return <ClientPortalContext.Provider value={value}>{children}</ClientPortalContext.Provider>;
}
