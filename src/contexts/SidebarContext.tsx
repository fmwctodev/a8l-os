import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface SidebarState {
  isExpanded: boolean;
  collapsedGroups: Set<string>;
}

interface SidebarContextValue extends SidebarState {
  toggleSidebar: () => void;
  toggleGroup: (groupId: string) => void;
  isGroupCollapsed: (groupId: string) => boolean;
  expandSidebar: () => void;
  collapseSidebar: () => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const toggleSidebar = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  const expandSidebar = useCallback(() => {
    setIsExpanded(true);
  }, []);

  const collapseSidebar = useCallback(() => {
    setIsExpanded(false);
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
        toggleSidebar,
        toggleGroup,
        isGroupCollapsed,
        expandSidebar,
        collapseSidebar,
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
