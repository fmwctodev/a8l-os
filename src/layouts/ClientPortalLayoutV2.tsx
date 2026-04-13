import { Outlet, useNavigate, useParams } from 'react-router-dom';
import { LogOut, ChevronLeft, FolderKanban } from 'lucide-react';
import { ClientPortalProviderV2, useClientPortalV2 } from '../contexts/ClientPortalContextV2';

export function ClientPortalLayoutV2() {
  return (
    <ClientPortalProviderV2>
      <LayoutInner />
    </ClientPortalProviderV2>
  );
}

function LayoutInner() {
  const { state, contact, logout } = useClientPortalV2();
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();

  // Loading spinner
  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500" />
      </div>
    );
  }

  if (state === 'unauthenticated' || state === 'needs_code' || state === 'session_expired') {
    return (
      <div className="min-h-screen bg-slate-950">
        <Outlet />
      </div>
    );
  }

  // Authenticated — render full chrome
  const isOnProject = !!projectId;

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 px-4 sm:px-6 h-14 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          {isOnProject && (
            <button
              onClick={() => navigate('/client-portal/dashboard')}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Back to all projects"
            >
              <ChevronLeft size={20} />
            </button>
          )}
          <div className="flex items-center gap-2">
            <FolderKanban size={20} className="text-cyan-400" />
            <span className="text-sm font-semibold text-white">
              {contact?.orgName ?? 'Client Portal'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {contact && (
            <span className="text-sm text-slate-400 hidden sm:inline">
              {contact.contactName}
            </span>
          )}
          <button
            onClick={logout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>

      {/* Footer */}
      {contact?.supportEmail && (
        <footer className="bg-slate-900 border-t border-slate-800 px-6 py-3 text-center flex-shrink-0">
          <p className="text-xs text-slate-500">
            Need help? Contact us at{' '}
            <a href={`mailto:${contact.supportEmail}`} className="text-cyan-400 hover:underline">
              {contact.supportEmail}
            </a>
          </p>
        </footer>
      )}
    </div>
  );
}
