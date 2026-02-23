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
  const { isExpanded } = useSidebar();
  const { isOpen: isCommandPaletteOpen, close: closeCommandPalette } = useCommandPalette();

  const sidebarWidth = isExpanded ? 'ml-64' : 'ml-16';

  return (
    <AssistantProvider>
      <div className="min-h-screen bg-slate-950 flex">
        <Sidebar />
        <div className={`flex-1 flex flex-col ${sidebarWidth} transition-all duration-200`}>
          <Header />
          <main className="flex-1 p-6 overflow-auto">
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
