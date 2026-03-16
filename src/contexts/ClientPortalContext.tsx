import { createContext, useContext, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { verifyPortalToken, logPortalEvent } from '../services/projectClientPortals';
import type { ClientPortalWithProject } from '../services/projectClientPortals';

type PortalState = 'loading' | 'invalid' | 'expired' | 'revoked' | 'ready';

interface ClientPortalContextValue {
  state: PortalState;
  portal: ClientPortalWithProject | null;
  rawToken: string;
  logEvent: (eventType: string, metadata?: Record<string, unknown>) => Promise<void>;
}

const ClientPortalContext = createContext<ClientPortalContextValue | null>(null);

export function ClientPortalProvider({ children }: { children: React.ReactNode }) {
  const { portalToken = '' } = useParams<{ portalToken: string }>();
  const [state, setState] = useState<PortalState>('loading');
  const [portal, setPortal] = useState<ClientPortalWithProject | null>(null);

  useEffect(() => {
    if (!portalToken) {
      setState('invalid');
      return;
    }

    verifyPortalToken(portalToken).then((result) => {
      if (!result) {
        setState('invalid');
        return;
      }
      setPortal(result);
      setState('ready');
    }).catch(() => setState('invalid'));
  }, [portalToken]);

  async function logEvent(eventType: string, metadata?: Record<string, unknown>) {
    if (!portal) return;
    await logPortalEvent({
      portalId: portal.id,
      projectId: portal.project_id,
      contactId: portal.contact_id,
      eventType,
      metadata,
      userAgent: navigator.userAgent,
    });
  }

  return (
    <ClientPortalContext.Provider value={{ state, portal, rawToken: portalToken, logEvent }}>
      {children}
    </ClientPortalContext.Provider>
  );
}

export function useClientPortal(): ClientPortalContextValue {
  const ctx = useContext(ClientPortalContext);
  if (!ctx) throw new Error('useClientPortal must be used within ClientPortalProvider');
  return ctx;
}
