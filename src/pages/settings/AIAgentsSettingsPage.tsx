import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bot, Cpu, Mic, BookOpen, FileText, Shield } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { AgentsSettingsTab } from '../../components/settings/ai-agents/AgentsSettingsTab';
import { ModelsSettingsTab } from '../../components/settings/ai-agents/ModelsSettingsTab';
import { VoicesSettingsTab } from '../../components/settings/ai-agents/VoicesSettingsTab';
import { KnowledgeSettingsTab } from '../../components/settings/ai-agents/KnowledgeSettingsTab';
import { PromptsSettingsTab } from '../../components/settings/ai-agents/PromptsSettingsTab';
import { ToolsSettingsTab } from '../../components/settings/ai-agents/ToolsSettingsTab';

type TabId = 'agents' | 'models' | 'voices' | 'knowledge' | 'prompts' | 'tools';

interface Tab {
  id: TabId;
  name: string;
  icon: typeof Bot;
  adminOnly?: boolean;
}

const tabs: Tab[] = [
  { id: 'agents', name: 'Agents', icon: Bot },
  { id: 'models', name: 'Models', icon: Cpu, adminOnly: true },
  { id: 'voices', name: 'Voices', icon: Mic, adminOnly: true },
  { id: 'knowledge', name: 'Knowledge', icon: BookOpen },
  { id: 'prompts', name: 'Prompts', icon: FileText },
  { id: 'tools', name: 'Tools & Defaults', icon: Shield },
];

export function AIAgentsSettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabId>('agents');
  const { user } = useAuth();

  const isAdmin = user?.role?.name === 'SuperAdmin' || user?.role?.name === 'Admin';

  const visibleTabs = tabs.filter((tab) => !tab.adminOnly || isAdmin);

  useEffect(() => {
    const tab = searchParams.get('tab') as TabId;
    if (tab && visibleTabs.some((t) => t.id === tab)) {
      setActiveTab(tab);
    }
  }, [searchParams, visibleTabs]);

  const handleTabChange = (tabId: TabId) => {
    setActiveTab(tabId);
    setSearchParams({ tab: tabId });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">AI Agents Settings</h1>
        <p className="text-slate-400 mt-1">
          Configure AI agents, LLM providers, voice synthesis, knowledge bases, and prompt templates
        </p>
      </div>

      <div className="border-b border-slate-700">
        <nav className="flex gap-6 overflow-x-auto" aria-label="Tabs">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex items-center gap-2 py-3 px-1 border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? 'border-cyan-500 text-cyan-400'
                    : 'border-transparent text-slate-400 hover:text-white hover:border-slate-600'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="font-medium">{tab.name}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <div>
        {activeTab === 'agents' && <AgentsSettingsTab />}
        {activeTab === 'models' && isAdmin && <ModelsSettingsTab />}
        {activeTab === 'voices' && isAdmin && <VoicesSettingsTab />}
        {activeTab === 'knowledge' && <KnowledgeSettingsTab />}
        {activeTab === 'prompts' && <PromptsSettingsTab />}
        {activeTab === 'tools' && <ToolsSettingsTab />}
      </div>
    </div>
  );
}
