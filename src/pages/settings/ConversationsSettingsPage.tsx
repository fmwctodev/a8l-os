import { useState } from 'react';
import { FileText, Zap } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { SnippetsSettingsTab, RulesSettingsTab } from '../../components/settings/conversations';

type Tab = 'snippets' | 'rules';

export function ConversationsSettingsPage() {
  const { hasPermission, isFeatureEnabled } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('snippets');

  const canViewSnippets = hasPermission('snippets.view') && isFeatureEnabled('snippets');
  const canViewRules = hasPermission('conversation_rules.view') && isFeatureEnabled('conversation_rules');

  const tabs: { id: Tab; label: string; icon: typeof FileText; enabled: boolean }[] = [
    { id: 'snippets', label: 'Snippets', icon: FileText, enabled: canViewSnippets },
    { id: 'rules', label: 'Rules', icon: Zap, enabled: canViewRules },
  ];

  const availableTabs = tabs.filter((t) => t.enabled);

  if (availableTabs.length === 0) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-slate-400">You do not have permission to access conversation settings.</p>
        </div>
      </div>
    );
  }

  if (!availableTabs.find((t) => t.id === activeTab)) {
    setActiveTab(availableTabs[0].id);
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Conversation Settings</h1>
        <p className="text-slate-400 mt-1">Manage snippets and automation rules for conversations</p>
      </div>

      <div className="border-b border-slate-700 mb-6">
        <nav className="flex gap-1">
          {availableTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'text-cyan-400 border-cyan-400'
                  : 'text-slate-400 border-transparent hover:text-slate-300'
              }`}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'snippets' && canViewSnippets && <SnippetsSettingsTab />}
      {activeTab === 'rules' && canViewRules && <RulesSettingsTab />}
    </div>
  );
}
