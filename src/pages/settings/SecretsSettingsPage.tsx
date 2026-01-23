import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Key, FolderKey, History, Shield, LayoutDashboard, Scan } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { SecretsOverviewTab } from '../../components/settings/secrets/SecretsOverviewTab';
import { SecretsListTab } from '../../components/settings/secrets/SecretsListTab';
import { CategoriesTab } from '../../components/settings/secrets/CategoriesTab';
import { UsageLogsTab } from '../../components/settings/secrets/UsageLogsTab';
import { ScanResultsTab } from '../../components/settings/secrets/ScanResultsTab';

type TabId = 'overview' | 'secrets' | 'categories' | 'logs' | 'scan';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ElementType;
  permission?: string;
}

const tabs: Tab[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'secrets', label: 'API Keys & Secrets', icon: Key },
  { id: 'categories', label: 'Categories', icon: FolderKey, permission: 'secrets.categories' },
  { id: 'logs', label: 'Usage Logs', icon: History, permission: 'secrets.logs' },
  { id: 'scan', label: 'Security Scan', icon: Scan, permission: 'secrets.logs' },
];

export function SecretsSettingsPage() {
  const { hasPermission } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [refreshKey, setRefreshKey] = useState(0);

  const visibleTabs = tabs.filter(tab => {
    if (tab.permission && !hasPermission(tab.permission)) return false;
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
        return <SecretsOverviewTab key={refreshKey} onNavigate={handleTabChange} />;
      case 'secrets':
        return <SecretsListTab key={refreshKey} onSuccess={triggerRefresh} />;
      case 'categories':
        return hasPermission('secrets.categories') ? (
          <CategoriesTab key={refreshKey} onSuccess={triggerRefresh} />
        ) : null;
      case 'logs':
        return hasPermission('secrets.logs') ? (
          <UsageLogsTab key={refreshKey} />
        ) : null;
      case 'scan':
        return hasPermission('secrets.logs') ? (
          <ScanResultsTab key={refreshKey} />
        ) : null;
      default:
        return <SecretsOverviewTab key={refreshKey} onNavigate={handleTabChange} />;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">API Keys & Secrets</h1>
        <p className="mt-1 text-sm text-gray-500">
          Securely manage API keys, tokens, and sensitive credentials with encryption
        </p>
      </div>

      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8 overflow-x-auto" aria-label="Tabs">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`
                  flex items-center gap-2 whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium transition-colors
                  ${isActive
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  }
                `}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="min-h-[400px]">
        {renderTabContent()}
      </div>
    </div>
  );
}
