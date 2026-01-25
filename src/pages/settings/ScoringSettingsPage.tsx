import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Target, List, Timer, Sliders, Settings, Plus } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { ModelsTab } from '../../components/settings/scoring/ModelsTab';
import { RulesTab } from '../../components/settings/scoring/RulesTab';
import { DecayTab } from '../../components/settings/scoring/DecayTab';
import { AdjustmentsTab } from '../../components/settings/scoring/AdjustmentsTab';
import { SettingsTab } from '../../components/settings/scoring/SettingsTab';

const TABS = [
  { id: 'models', label: 'Models', icon: Target },
  { id: 'rules', label: 'Rules', icon: List },
  { id: 'decay', label: 'Decay', icon: Timer },
  { id: 'adjustments', label: 'Adjustments', icon: Sliders },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export default function ScoringSettingsPage() {
  const { hasPermission } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'models');
  const [showCreateModel, setShowCreateModel] = useState(false);

  const canEdit = hasPermission('scoring.edit') || hasPermission('scoring.create');

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && TABS.some(t => t.id === tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    setSearchParams({ tab: tabId });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Lead Scoring</h1>
          <p className="mt-1 text-sm text-slate-400">
            Define how leads and deals earn scores based on engagement and behaviors
          </p>
        </div>
        {canEdit && activeTab === 'models' && (
          <button
            onClick={() => setShowCreateModel(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-cyan-500/25 transition-all hover:shadow-cyan-500/40 hover:brightness-110"
          >
            <Plus className="h-4 w-4" />
            Create Scoring Model
          </button>
        )}
      </div>

      <div className="border-b border-slate-700">
        <nav className="-mb-px flex space-x-8">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  isActive
                    ? 'border-cyan-500 text-cyan-400'
                    : 'border-transparent text-slate-400 hover:text-slate-300 hover:border-slate-600'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="min-h-[400px]">
        {activeTab === 'models' && (
          <ModelsTab
            showCreateModal={showCreateModel}
            onCloseCreateModal={() => setShowCreateModel(false)}
          />
        )}
        {activeTab === 'rules' && <RulesTab />}
        {activeTab === 'decay' && <DecayTab />}
        {activeTab === 'adjustments' && <AdjustmentsTab />}
        {activeTab === 'settings' && <SettingsTab />}
      </div>
    </div>
  );
}
