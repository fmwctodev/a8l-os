import { Outlet, NavLink, useParams } from 'react-router-dom';
import { AlertCircle, Clock, Building2, ExternalLink } from 'lucide-react';
import { ClientPortalProvider, useClientPortal } from '../contexts/ClientPortalContext';

function InvalidState({ message, subtext }: { message: string; subtext: string }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-7 h-7 text-red-500" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">{message}</h1>
        <p className="text-gray-500 text-sm leading-relaxed">{subtext}</p>
      </div>
    </div>
  );
}

function ExpiredState() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Clock className="w-7 h-7 text-amber-600" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Portal Link Expired</h1>
        <p className="text-gray-500 text-sm leading-relaxed">
          This portal link has expired. Please contact your project manager to receive a new access link.
        </p>
      </div>
    </div>
  );
}

function PortalContent() {
  const { state, portal } = useClientPortal();
  const { portalToken } = useParams<{ portalToken: string }>();

  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          <p className="text-sm text-gray-500">Loading your portal...</p>
        </div>
      </div>
    );
  }

  if (state === 'revoked') {
    return (
      <InvalidState
        message="Access Revoked"
        subtext="Your access to this portal has been revoked. Please contact your project manager for assistance."
      />
    );
  }

  if (state === 'expired') {
    return <ExpiredState />;
  }

  if (state === 'invalid' || !portal) {
    return (
      <InvalidState
        message="Invalid or Expired Link"
        subtext="This portal link is invalid or has already expired. Please contact your project team for a new link."
      />
    );
  }

  const project = portal.project;
  const org = portal.organization;
  const contact = portal.contact;
  const base = `/portal/project/${portalToken}`;

  const contactName = contact
    ? [contact.first_name, contact.last_name].filter(Boolean).join(' ') || 'Client'
    : 'Client';

  const statusColors: Record<string, string> = {
    active: 'bg-emerald-100 text-emerald-700',
    planning: 'bg-blue-100 text-blue-700',
    on_hold: 'bg-amber-100 text-amber-700',
    completed: 'bg-gray-100 text-gray-600',
    cancelled: 'bg-red-100 text-red-600',
  };

  const statusColor = statusColors[project?.status ?? ''] ?? 'bg-gray-100 text-gray-600';

  return (
    <div className="min-h-screen bg-gray-50">
      <meta name="robots" content="noindex, nofollow" />

      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Building2 className="w-4 h-4 text-white" />
              </div>
              <div>
                <div className="text-sm font-semibold text-gray-900">{org?.name ?? 'Project Portal'}</div>
                {org?.website && (
                  <a
                    href={org.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-gray-400 hover:text-blue-600 flex items-center gap-1 transition-colors"
                  >
                    {org.website.replace(/^https?:\/\//, '')}
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                )}
              </div>
            </div>
            <div className="text-right hidden sm:block">
              <div className="text-sm text-gray-500">Welcome back,</div>
              <div className="text-sm font-medium text-gray-900">{contactName}</div>
            </div>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 border-t border-gray-100">
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <h1 className="text-base font-bold text-gray-900">{project?.name ?? 'Your Project'}</h1>
              {project?.status && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusColor}`}>
                  {project.status.replace(/_/g, ' ')}
                </span>
              )}
            </div>
          </div>

          <nav className="flex gap-1 -mb-px">
            {[
              { to: base, label: 'Overview', end: true },
              { to: `${base}/change-requests`, label: 'Change Requests', end: false },
              { to: `${base}/documents`, label: 'Documents', end: false },
            ].map(({ to, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    isActive
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <Outlet />
      </main>

      <footer className="border-t border-gray-200 bg-white mt-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="text-xs text-gray-400">
              Secure client portal &mdash; {org?.name}
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              {org?.email && (
                <a href={`mailto:${org.email}`} className="hover:text-blue-600 transition-colors">
                  {org.email}
                </a>
              )}
              {org?.phone && (
                <a href={`tel:${org.phone}`} className="hover:text-blue-600 transition-colors">
                  {org.phone}
                </a>
              )}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function ClientPortalLayout() {
  return (
    <ClientPortalProvider>
      <PortalContent />
    </ClientPortalProvider>
  );
}
