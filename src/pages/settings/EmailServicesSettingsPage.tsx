import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Mail, Globe, AtSign, Bell, Settings, Send, LayoutDashboard, Flame } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { OverviewTab } from '../../components/settings/email/OverviewTab';
import { ProvidersTab } from '../../components/settings/email/ProvidersTab';
import { DomainsTab } from '../../components/settings/email/DomainsTab';
import { FromAddressesTab } from '../../components/settings/email/FromAddressesTab';
import { UnsubscribeGroupsTab } from '../../components/settings/email/UnsubscribeGroupsTab';
import { DefaultsTab } from '../../components/settings/email/DefaultsTab';
import { TestTab } from '../../components/settings/email/TestTab';
import { CampaignDomainsTab } from '../../components/settings/email/CampaignDomainsTab';

type TabId = 'overview' | 'providers' | 'domains' | 'from-addresses' | 'campaign-domains' | 'unsubscribe-groups' | 'defaults' | 'test';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ElementType;
  adminOnly?: boolean;
}

const tabs: Tab[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'providers', label: 'Provider', icon: Mail, adminOnly: true },
  { id: 'domains', label: 'Domains', icon: Globe },
  { id: 'from-addresses', label: 'From Addresses', icon: AtSign },
  { id: 'campaign-domains', label: 'Campaign Domains', icon: Flame, adminOnly: true },
  { id: 'unsubscribe-groups', label: 'Unsubscribe Groups', icon: Bell },
  { id: 'defaults', label: 'Defaults', icon: Settings },
  { id: 'test', label: 'Test Email', icon: Send },
];

export function EmailServicesSettingsPage() {
  const { user, hasPermission } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [refreshKey, setRefreshKey] = useState(0);

  const isAdmin = hasPermission('email.settings.manage');
  const canTest = hasPermission('email.send.test');

  const visibleTabs = tabs.filter(tab => {
    if (tab.adminOnly && !isAdmin) return false;
    if (tab.id === 'test' && !canTest) return false;
    return true;
  });

  const tabParam = searchParams.get('tab') as TabId | null;
  const [activeTab, setActiveTab] = useState<TabId>(
    tabParam && visibleTabs.some(t => t.id === tabParam) ? tabParam : 'overview'
  );

  useEffect(() => {
    if (tabParam && visibleTabs.some(t => t.id === tabParam)) {
      setActiveTab(tabParam);
    }
  }, [tabParam, visibleTabs]);

  const handleTabChange = (tabId: TabId) => {
    setActiveTab(tabId);
    setSearchParams({ tab: tabId });
  };

  const triggerRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewTab key={refreshKey} onNavigate={handleTabChange} />;
      case 'providers':
        return isAdmin ? <ProvidersTab key={refreshKey} onSuccess={triggerRefresh} /> : null;
      case 'domains':
        return <DomainsTab key={refreshKey} />;
      case 'from-addresses':
        return <FromAddressesTab key={refreshKey} />;
      case 'campaign-domains':
        return isAdmin ? <CampaignDomainsTab key={refreshKey} /> : null;
      case 'unsubscribe-groups':
        return <UnsubscribeGroupsTab key={refreshKey} />;
      case 'defaults':
        return <DefaultsTab key={refreshKey} />;
      case 'test':
        return canTest ? <TestTab key={refreshKey} /> : null;
      default:
        return <OverviewTab key={refreshKey} onNavigate={handleTabChange} />;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Email Services</h1>
        <p className="mt-1 text-sm text-slate-400">
          Configure SendGrid integration for transactional and marketing emails
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
                className={`
                  flex items-center gap-2 py-3 px-1 border-b-2 transition-colors whitespace-nowrap
                  ${isActive
                    ? 'border-cyan-500 text-cyan-400'
                    : 'border-transparent text-slate-400 hover:text-white hover:border-slate-600'
                  }
                `}
              >
                <Icon className="w-4 h-4" />
                <span className="font-medium">{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <div>{renderTabContent()}</div>
    </div>
  );
}
