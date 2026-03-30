import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';

interface SidebarState {
  isExpanded: boolean;
  collapsedGroups: Set<string>;
  isMobileOpen: boolean;
  isMobile: boolean;
}

interface SidebarContextValue extends SidebarState {
  toggleSidebar: () => void;
  toggleGroup: (groupId: string) => void;
  isGroupCollapsed: (groupId: string) => boolean;
  expandSidebar: () => void;
  collapseSidebar: () => void;
  toggleMobileSidebar: () => void;
  closeMobileSidebar: () => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 1023px)');
    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsMobile(e.matches);
      if (e.matches) {
        setIsMobileOpen(false);
      }
    };
    handleChange(mediaQuery);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const toggleSidebar = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  const expandSidebar = useCallback(() => {
    setIsExpanded(true);
  }, []);

  const collapseSidebar = useCallback(() => {
    setIsExpanded(false);
  }, []);

  const toggleMobileSidebar = useCallback(() => {
    setIsMobileOpen((prev) => !prev);
  }, []);

  const closeMobileSidebar = useCallback(() => {
    setIsMobileOpen(false);
  }, []);

  const toggleGroup = useCallback((groupId: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }, []);

  const isGroupCollapsed = useCallback(
    (groupId: string) => collapsedGroups.has(groupId),
    [collapsedGroups]
  );

  return (
    <SidebarContext.Provider
      value={{
        isExpanded,
        collapsedGroups,
        isMobileOpen,
        isMobile,
        toggleSidebar,
        toggleGroup,
        isGroupCollapsed,
        expandSidebar,
        collapseSidebar,
        toggleMobileSidebar,
        closeMobileSidebar,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
}
