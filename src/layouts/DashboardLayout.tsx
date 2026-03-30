import { Outlet } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { Header } from '../components/Header';
import { CommandPalette } from '../components/CommandPalette';
import { ReAuthModal } from '../components/ReAuthModal';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { AssistantProvider } from '../contexts/AssistantContext';
import { AssistantFAB } from '../components/assistant/AssistantFAB';
import { AssistantPanel } from '../components/assistant/AssistantPanel';
import { useSidebar } from '../contexts/SidebarContext';
import { useCommandPalette } from '../hooks/useCommandPalette';

export function DashboardLayout() {
  const { isExpanded, isMobile } = useSidebar();
  const { isOpen: isCommandPaletteOpen, close: closeCommandPalette } = useCommandPalette();

  const sidebarWidth = isMobile ? 'ml-0' : isExpanded ? 'ml-64' : 'ml-16';

  return (
    <AssistantProvider>
      <div className="min-h-screen bg-slate-950 flex">
        <Sidebar />
        <div className={`flex-1 min-w-0 flex flex-col ${sidebarWidth} transition-all duration-200`}>
          <Header />
          <main className="flex-1 p-3 sm:p-4 md:p-6 overflow-y-auto overflow-x-hidden">
            <ErrorBoundary>
              <Outlet />
            </ErrorBoundary>
          </main>
        </div>
        <CommandPalette isOpen={isCommandPaletteOpen} onClose={closeCommandPalette} />
        <ReAuthModal />
        <AssistantFAB />
        <AssistantPanel />
      </div>
    </AssistantProvider>
  );
}
