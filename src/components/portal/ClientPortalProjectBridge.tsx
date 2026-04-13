/**
 * Bridge between the V2 contact-scoped auth and the old per-project
 * portal pages. Reads projectId from the URL, fetches the project +
 * contact + org data from Supabase, constructs a ClientPortalWithProject
 * object that matches the shape the old pages expect, and wraps the
 * child routes in the old ClientPortalProvider.
 */

import { useEffect, useState } from 'react';
import { Outlet, useParams, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useClientPortalV2 } from '../../contexts/ClientPortalContextV2';
import { ClientPortalProvider } from '../../contexts/ClientPortalContext';
import type { ClientPortalWithProject } from '../../services/projectClientPortals';

export function ClientPortalProjectBridge() {
  const { projectId } = useParams<{ projectId: string }>();
  const { state, contact } = useClientPortalV2();
  const navigate = useNavigate();

  const [portal, setPortal] = useState<ClientPortalWithProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (state !== 'authenticated' || !contact?.contactId || !projectId) return;

    let cancelled = false;

    async function loadProjectPortal() {
      try {
        // Fetch the project with related data
        const { data: project, error: projErr } = await supabase
          .from('projects')
          .select(`
            id, org_id, name, status, description,
            start_date, target_end_date, updated_at, contact_id,
            contact:contacts(id, first_name, last_name, email, phone)
          `)
          .eq('id', projectId!)
          .maybeSingle();

        if (projErr || !project) {
          if (!cancelled) setError('Project not found');
          return;
        }

        // Verify this contact owns this project
        if (project.contact_id !== contact!.contactId) {
          if (!cancelled) setError('Access denied');
          return;
        }

        // Fetch org info
        const { data: org } = await supabase
          .from('organizations')
          .select('id, name, email, phone, website')
          .eq('id', project.org_id)
          .maybeSingle();

        // Get or create a client_portal_accounts row (used as the "portalId" for event logging)
        let accountId: string;
        const { data: existingAccount } = await supabase
          .from('client_portal_accounts')
          .select('id')
          .eq('org_id', project.org_id)
          .eq('contact_id', contact!.contactId)
          .maybeSingle();

        if (existingAccount) {
          accountId = existingAccount.id;
        } else {
          const { data: newAccount } = await supabase
            .from('client_portal_accounts')
            .insert({ org_id: project.org_id, contact_id: contact!.contactId, status: 'active' })
            .select('id')
            .single();
          accountId = newAccount?.id ?? 'unknown';
        }

        // Construct the ClientPortalWithProject object the old pages expect
        const portalObj: ClientPortalWithProject = {
          id: accountId, // Use account ID as the "portal ID" for event logging
          org_id: project.org_id,
          project_id: project.id,
          contact_id: contact!.contactId,
          portal_token_hash: '',
          portal_token: null,
          status: 'active',
          expires_at: null,
          last_accessed_at: new Date().toISOString(),
          created_by_user_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          project: {
            id: project.id,
            name: project.name,
            status: project.status,
            description: project.description,
            start_date: project.start_date,
            target_end_date: project.target_end_date,
            updated_at: project.updated_at,
            org_id: project.org_id,
            contact_id: project.contact_id,
          },
          contact: (Array.isArray(project.contact) ? project.contact[0] : project.contact) as ClientPortalWithProject['contact'],
          organization: org ? {
            id: org.id,
            name: org.name,
            email: org.email,
            phone: org.phone,
            website: org.website,
          } : null,
        };

        if (!cancelled) {
          setPortal(portalObj);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadProjectPortal();
    return () => { cancelled = true; };
  }, [state, contact, projectId]);

  if (state !== 'authenticated') {
    navigate('/client-portal', { replace: true });
    return null;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-cyan-500" />
      </div>
    );
  }

  if (error || !portal) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <p className="text-red-400 mb-2">{error || 'Failed to load project'}</p>
          <button
            onClick={() => navigate('/client-portal/dashboard')}
            className="text-sm text-cyan-400 hover:underline"
          >
            Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <ClientPortalProvider
      portal={portal}
      contactEmail={contact?.contactEmail ?? null}
      lastOtpVerifiedAt={contact?.lastOtpVerifiedAt ?? null}
    >
      <Outlet />
    </ClientPortalProvider>
  );
}
