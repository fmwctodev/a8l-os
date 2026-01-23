import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Phone, Link2, Hash, MessageSquare, PhoneCall, Mic, Shield, TestTube2 } from 'lucide-react';
import { usePermission } from '../../hooks/usePermission';
import {
  OverviewTab,
  ConnectionTab,
  NumbersTab,
  MessagingTab,
  VoiceRoutingTab,
  RecordingTab,
  ComplianceTab,
  TestToolsTab,
} from '../../components/settings/phone';

type TabId = 'overview' | 'connection' | 'numbers' | 'messaging' | 'routing' | 'recording' | 'compliance' | 'test';

interface TabConfig {
  id: TabId;
  label: string;
  icon: React.ReactNode;
  permission?: string;
}

const tabs: TabConfig[] = [
  { id: 'overview', label: 'Overview', icon: <Phone className="w-4 h-4" /> },
  { id: 'connection', label: 'Connection', icon: <Link2 className="w-4 h-4" />, permission: 'phone.settings.manage' },
  { id: 'numbers', label: 'Numbers', icon: <Hash className="w-4 h-4" /> },
  { id: 'messaging', label: 'Messaging', icon: <MessageSquare className="w-4 h-4" /> },
  { id: 'routing', label: 'Voice Routing', icon: <PhoneCall className="w-4 h-4" /> },
  { id: 'recording', label: 'Recording', icon: <Mic className="w-4 h-4" /> },
  { id: 'compliance', label: 'Compliance', icon: <Shield className="w-4 h-4" /> },
  { id: 'test', label: 'Test Tools', icon: <TestTube2 className="w-4 h-4" /> },
];

export default function PhoneSystemSettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [refreshKey, setRefreshKey] = useState(0);
  const canManage = usePermission('phone.settings.manage');

  const currentTab = (searchParams.get('tab') as TabId) || 'overview';

  const visibleTabs = tabs.filter(tab => {
    if (!tab.permission) return true;
    if (tab.permission === 'phone.settings.manage') return canManage;
    return true;
  });

  const setCurrentTab = (tab: TabId) => {
    setSearchParams({ tab });
  };

  const handleRefresh = () => {
    setRefreshKey(k => k + 1);
  };

  useEffect(() => {
    if (!visibleTabs.find(t => t.id === currentTab)) {
      setCurrentTab('overview');
    }
  }, [currentTab, visibleTabs]);

  const renderTabContent = () => {
    switch (currentTab) {
      case 'overview':
        return <OverviewTab key={refreshKey} onNavigate={setCurrentTab} />;
      case 'connection':
        return <ConnectionTab key={refreshKey} onRefresh={handleRefresh} />;
      case 'numbers':
        return <NumbersTab key={refreshKey} />;
      case 'messaging':
        return <MessagingTab key={refreshKey} />;
      case 'routing':
        return <VoiceRoutingTab key={refreshKey} />;
      case 'recording':
        return <RecordingTab key={refreshKey} />;
      case 'compliance':
        return <ComplianceTab key={refreshKey} />;
      case 'test':
        return <TestToolsTab key={refreshKey} />;
      default:
        return <OverviewTab key={refreshKey} onNavigate={setCurrentTab} />;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Phone System</h1>
        <p className="text-sm text-gray-500 mt-1">
          Configure Twilio SMS and Voice telephony integration
        </p>
      </div>

      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8 overflow-x-auto">
          {visibleTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setCurrentTab(tab.id)}
              className={`
                flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap
                ${currentTab === tab.id
                  ? 'border-sky-500 text-sky-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="mt-6">
        {renderTabContent()}
      </div>
    </div>
  );
}
