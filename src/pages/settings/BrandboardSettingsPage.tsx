import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Palette, LayoutDashboard, Paintbrush, MessageSquareText, BarChart3, History } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { OverviewTab } from '../../components/settings/brandboard/OverviewTab';
import { BrandKitsTab } from '../../components/settings/brandboard/BrandKitsTab';
import { BrandVoiceTab } from '../../components/settings/brandboard/BrandVoiceTab';
import { UsageTab } from '../../components/settings/brandboard/UsageTab';
import { VersionsTab } from '../../components/settings/brandboard/VersionsTab';

type TabId = 'overview' | 'kits' | 'voice' | 'usage' | 'versions';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ElementType;
  permission?: string;
}

const tabs: Tab[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'kits', label: 'Brand Kits', icon: Paintbrush },
  { id: 'voice', label: 'Brand Voice', icon: MessageSquareText },
  { id: 'usage', label: 'Usage', icon: BarChart3 },
  { id: 'versions', label: 'Versions', icon: History, permission: 'brandboard.manage' },
];

export function BrandboardSettingsPage() {
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
        return <OverviewTab key={refreshKey} onNavigate={handleTabChange} onRefresh={triggerRefresh} />;
      case 'kits':
        return <BrandKitsTab key={refreshKey} onSuccess={triggerRefresh} />;
      case 'voice':
        return <BrandVoiceTab key={refreshKey} onSuccess={triggerRefresh} />;
      case 'usage':
        return <UsageTab key={refreshKey} />;
      case 'versions':
        return hasPermission('brandboard.manage') ? (
          <VersionsTab key={refreshKey} onRollback={triggerRefresh} />
        ) : null;
      default:
        return <OverviewTab key={refreshKey} onNavigate={handleTabChange} onRefresh={triggerRefresh} />;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 rounded-lg">
            <Palette className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Brandboard</h1>
            <p className="text-sm text-gray-500">
              Manage your brand identity and voice settings
            </p>
          </div>
        </div>
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
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      <div>{renderTabContent()}</div>
    </div>
  );
}
