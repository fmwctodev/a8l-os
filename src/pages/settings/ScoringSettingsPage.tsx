import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Target, List, Timer, Sliders, Settings } from 'lucide-react';
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
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'models');

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
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Lead Scoring</h1>
        <p className="mt-1 text-sm text-gray-500">
          Configure scoring models, rules, and decay settings to track contact and opportunity engagement.
        </p>
      </div>

      <div className="border-b border-gray-200">
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
                    ? 'border-teal-500 text-teal-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      <div>
        {activeTab === 'models' && <ModelsTab />}
        {activeTab === 'rules' && <RulesTab />}
        {activeTab === 'decay' && <DecayTab />}
        {activeTab === 'adjustments' && <AdjustmentsTab />}
        {activeTab === 'settings' && <SettingsTab />}
      </div>
    </div>
  );
}
