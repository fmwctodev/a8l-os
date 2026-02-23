import { MessageSquare, Mic, Activity, Settings, X, Sparkles } from 'lucide-react';
import { useAssistant } from '../../contexts/AssistantContext';
import { AssistantChatView } from './chat/AssistantChatView';
import { AssistantVoiceView } from './voice/AssistantVoiceView';
import { AssistantActivityView } from './activity/AssistantActivityView';
import { AssistantSettingsView } from './settings/AssistantSettingsView';
import type { AssistantPanelTab } from '../../types/assistant';

const TABS: { id: AssistantPanelTab; icon: typeof MessageSquare; label: string }[] = [
  { id: 'chat', icon: MessageSquare, label: 'Chat' },
  { id: 'voice', icon: Mic, label: 'Voice' },
  { id: 'activity', icon: Activity, label: 'Activity' },
  { id: 'settings', icon: Settings, label: 'Settings' },
];

export function AssistantPanel() {
  const { isPanelOpen, closePanel, activeTab, switchTab, profile } = useAssistant();

  if (!isPanelOpen || !profile?.enabled) return null;

  return (
    <div className="fixed bottom-24 right-6 z-50 w-[420px] max-h-[620px] bg-slate-900 border border-slate-700/60 rounded-2xl shadow-2xl shadow-black/40 flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 sm:w-[420px] sm:max-h-[620px] max-sm:inset-0 max-sm:bottom-0 max-sm:right-0 max-sm:w-full max-sm:max-h-full max-sm:rounded-none">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-700/50 bg-slate-900/80 backdrop-blur-sm">
        <div className="flex items-center gap-2 flex-1">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white leading-none">Clara</h3>
            <p className="text-[10px] text-cyan-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              Online
            </p>
          </div>
        </div>
        <button
          onClick={closePanel}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex border-b border-slate-700/50">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => switchTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-medium transition-colors relative ${
                isActive
                  ? 'text-cyan-400'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
              {isActive && (
                <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-cyan-400 rounded-full" />
              )}
            </button>
          );
        })}
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        {activeTab === 'chat' && <AssistantChatView />}
        {activeTab === 'voice' && <AssistantVoiceView />}
        {activeTab === 'activity' && <AssistantActivityView />}
        {activeTab === 'settings' && <AssistantSettingsView />}
      </div>
    </div>
  );
}
