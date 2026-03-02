import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { getOrCreateProfile } from '../services/assistantProfile';
import { createThread } from '../services/assistantChat';
import type { AssistantProfile, AssistantPanelTab, ClaraPageContext, VoiceExchange } from '../types/assistant';

interface AssistantContextValue {
  isPanelOpen: boolean;
  activeTab: AssistantPanelTab;
  activeThreadId: string | null;
  profile: AssistantProfile | null;
  isLoading: boolean;
  pageContext: ClaraPageContext;
  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;
  switchTab: (tab: AssistantPanelTab) => void;
  setActiveThread: (threadId: string | null) => void;
  openWithContext: (module: string, recordId: string, prefilledPrompt?: string) => void;
  refreshProfile: () => Promise<void>;
  prefilledPrompt: string | null;
  clearPrefilledPrompt: () => void;
  voiceActive: boolean;
  setVoiceActive: (active: boolean) => void;
  voiceHistory: VoiceExchange[];
  addVoiceExchange: (transcript: string, response: string) => void;
  clearVoiceHistory: () => void;
}

const AssistantContext = createContext<AssistantContextValue | null>(null);

function parsePageContext(pathname: string): ClaraPageContext {
  const segments = pathname.split('/').filter(Boolean);
  let currentModule: string | null = null;
  let currentRecordId: string | null = null;

  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (segments.length >= 1) {
    currentModule = segments[0];
  }

  if (segments.length >= 2 && uuidPattern.test(segments[1])) {
    currentRecordId = segments[1];
  }

  return {
    current_path: pathname,
    current_module: currentModule,
    current_record_id: currentRecordId,
  };
}

export function AssistantProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();

  const [isPanelOpen, setIsPanelOpen] = useState(() => {
    try {
      return localStorage.getItem('clara_panel_open') === 'true';
    } catch {
      return false;
    }
  });

  const [activeTab, setActiveTab] = useState<AssistantPanelTab>(() => {
    try {
      return (localStorage.getItem('clara_active_tab') as AssistantPanelTab) || 'chat';
    } catch {
      return 'chat';
    }
  });

  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [profile, setProfile] = useState<AssistantProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [prefilledPrompt, setPrefilledPrompt] = useState<string | null>(null);
  const [voiceActive, setVoiceActive] = useState(false);
  const [voiceHistory, setVoiceHistory] = useState<VoiceExchange[]>([]);

  const pageContext = useMemo(() => parsePageContext(location.pathname), [location.pathname]);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    getOrCreateProfile(user.id, user.organization_id)
      .then((p) => {
        if (!cancelled) setProfile(p);
      })
      .catch(() => {
        if (!cancelled) setProfile(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    try {
      localStorage.setItem('clara_panel_open', String(isPanelOpen));
    } catch { /* noop */ }
  }, [isPanelOpen]);

  useEffect(() => {
    try {
      localStorage.setItem('clara_active_tab', activeTab);
    } catch { /* noop */ }
  }, [activeTab]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'K') {
        e.preventDefault();
        setIsPanelOpen((prev) => !prev);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const openPanel = useCallback(() => setIsPanelOpen(true), []);
  const closePanel = useCallback(() => setIsPanelOpen(false), []);
  const togglePanel = useCallback(() => setIsPanelOpen((prev) => !prev), []);

  const switchTab = useCallback((tab: AssistantPanelTab) => {
    setActiveTab(tab);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    try {
      const p = await getOrCreateProfile(user.id, user.organization_id);
      setProfile(p);
    } catch { /* noop */ }
  }, [user]);

  const clearPrefilledPrompt = useCallback(() => setPrefilledPrompt(null), []);

  const addVoiceExchange = useCallback((transcript: string, response: string) => {
    setVoiceHistory((prev) => [
      ...prev,
      {
        id: `ve-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        transcript,
        response,
        timestamp: new Date().toISOString(),
      },
    ]);
  }, []);

  const clearVoiceHistory = useCallback(() => setVoiceHistory([]), []);

  const openWithContext = useCallback(
    async (module: string, recordId: string, prompt?: string) => {
      if (!user) return;

      setIsPanelOpen(true);

      if (!voiceActive) {
        setActiveTab('chat');
      }

      if (prompt) {
        setPrefilledPrompt(prompt);
      }

      try {
        const thread = await createThread(user.id, user.organization_id, module, recordId);
        setActiveThreadId(thread.id);
      } catch {
        /* noop */
      }
    },
    [user, voiceActive]
  );

  const value = useMemo<AssistantContextValue>(
    () => ({
      isPanelOpen,
      activeTab,
      activeThreadId,
      profile,
      isLoading,
      pageContext,
      openPanel,
      closePanel,
      togglePanel,
      switchTab,
      setActiveThread: setActiveThreadId,
      openWithContext,
      refreshProfile,
      prefilledPrompt,
      clearPrefilledPrompt,
      voiceActive,
      setVoiceActive,
      voiceHistory,
      addVoiceExchange,
      clearVoiceHistory,
    }),
    [
      isPanelOpen,
      activeTab,
      activeThreadId,
      profile,
      isLoading,
      pageContext,
      openPanel,
      closePanel,
      togglePanel,
      switchTab,
      openWithContext,
      refreshProfile,
      prefilledPrompt,
      clearPrefilledPrompt,
      voiceActive,
      voiceHistory,
      addVoiceExchange,
      clearVoiceHistory,
    ]
  );

  return (
    <AssistantContext.Provider value={value}>
      {children}
    </AssistantContext.Provider>
  );
}

export function useAssistant(): AssistantContextValue {
  const context = useContext(AssistantContext);
  if (!context) {
    throw new Error('useAssistant must be used within an AssistantProvider');
  }
  return context;
}
