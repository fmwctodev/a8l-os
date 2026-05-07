import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Loader2, Shield } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { Organization } from '../types';

interface OrgSwitcherProps {
  isCompact: boolean;
}

/**
 * Visible only to SuperAdmins. Lets the SuperAdmin switch the "active"
 * organization that all RLS-scoped queries pivot on. Writes to
 * users.super_admin_active_org_id; the get_user_org_id() SQL function
 * returns this column for SuperAdmins.
 *
 * Reload after switching so all caches refresh and new RLS scope kicks in.
 */
export function OrgSwitcher({ isCompact }: OrgSwitcherProps) {
  const { user, isSuperAdmin } = useAuth();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isSuperAdmin) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('organizations')
        .select('id, name, slug, display_name, logo_url, created_at')
        .order('display_name', { ascending: true, nullsFirst: false });
      if (!cancelled && data) setOrgs(data as Organization[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [isSuperAdmin]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', onClick);
      return () => document.removeEventListener('mousedown', onClick);
    }
  }, [open]);

  if (!isSuperAdmin || !user) return null;

  const activeOrgId = user.organization?.id ?? user.organization_id;

  const handleSwitch = async (orgId: string) => {
    if (orgId === activeOrgId) {
      setOpen(false);
      return;
    }
    setSwitching(orgId);
    try {
      // For the home org, NULL the override so the user reverts to their
      // baseline organization_id. For any other org, set the override.
      // user.organization_id is the *active* org now (rebound in
      // getCurrentUser), so compare against home_organization_id.
      const homeOrgId = user.home_organization_id ?? user.organization_id;
      const newValue = orgId === homeOrgId ? null : orgId;
      const { error } = await supabase
        .from('users')
        .update({ super_admin_active_org_id: newValue })
        .eq('id', user.id);
      if (error) throw error;
      // Hard reload so RLS-scoped caches & feature flags fully reset.
      window.location.assign('/');
    } catch (err) {
      console.error('Failed to switch org:', err);
      setSwitching(null);
    }
  };

  if (isCompact) {
    return (
      <div ref={containerRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-label="Switch organization"
          className="w-full flex items-center justify-center p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors"
        >
          <Shield className="w-4 h-4" />
        </button>
        {open && (
          <OrgList
            orgs={orgs}
            activeOrgId={activeOrgId}
            switching={switching}
            onSwitch={handleSwitch}
            position="left-full ml-2 top-0"
          />
        )}
      </div>
    );
  }

  const activeOrg = orgs.find((o) => o.id === activeOrgId);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors text-sm"
      >
        <Shield className="w-4 h-4 text-cyan-400 flex-shrink-0" />
        <span className="flex-1 truncate text-left">
          {activeOrg?.display_name || activeOrg?.name || 'Switch org'}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <OrgList
          orgs={orgs}
          activeOrgId={activeOrgId}
          switching={switching}
          onSwitch={handleSwitch}
          position="left-0 right-0 top-full mt-1"
        />
      )}
    </div>
  );
}

function OrgList({
  orgs,
  activeOrgId,
  switching,
  onSwitch,
  position,
}: {
  orgs: Organization[];
  activeOrgId: string;
  switching: string | null;
  onSwitch: (id: string) => void;
  position: string;
}) {
  return (
    <div
      className={`absolute ${position} z-50 min-w-[12rem] bg-slate-900 border border-slate-700 rounded-lg shadow-2xl overflow-hidden`}
    >
      <div className="px-3 py-2 border-b border-slate-700 text-xs font-semibold uppercase tracking-wider text-slate-500">
        Switch Organization
      </div>
      <div className="py-1 max-h-72 overflow-y-auto">
        {orgs.map((org) => {
          const isActive = org.id === activeOrgId;
          const isSwitching = switching === org.id;
          return (
            <button
              key={org.id}
              type="button"
              disabled={!!switching}
              onClick={() => onSwitch(org.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors disabled:opacity-50 ${
                isActive ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <span className="flex-1 truncate">{org.display_name || org.name}</span>
              {isSwitching && <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />}
              {isActive && !isSwitching && <Check className="w-3.5 h-3.5 text-cyan-400" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
