import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Braces, FolderOpen, Plus } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { CustomValuesListTab } from '../../components/settings/custom-values/CustomValuesListTab';
import { CustomValueCategoriesTab } from '../../components/settings/custom-values/CustomValueCategoriesTab';
import { CustomValueDrawer } from '../../components/settings/custom-values/CustomValueDrawer';

type TabId = 'values' | 'categories';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ElementType;
  permission?: string;
}

const tabs: Tab[] = [
  { id: 'values', label: 'Values', icon: Braces },
  { id: 'categories', label: 'Categories', icon: FolderOpen, permission: 'custom_values.categories' },
];

export function CustomValuesSettingsPage() {
  const { hasPermission } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [refreshKey, setRefreshKey] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingValueId, setEditingValueId] = useState<string | null>(null);

  const canCreate = hasPermission('custom_values.create');

  const visibleTabs = tabs.filter(tab => {
    if (tab.permission && !hasPermission(tab.permission)) return false;
    return true;
  });

  const tabParam = searchParams.get('tab') as TabId | null;
  const [activeTab, setActiveTab] = useState<TabId>(
    tabParam && visibleTabs.some(t => t.id === tabParam) ? tabParam : 'values'
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

  const handleCreateValue = () => {
    setEditingValueId(null);
    setDrawerOpen(true);
  };

  const handleEditValue = (valueId: string) => {
    setEditingValueId(valueId);
    setDrawerOpen(true);
  };

  const handleDrawerClose = () => {
    setDrawerOpen(false);
    setEditingValueId(null);
  };

  const handleDrawerSuccess = () => {
    handleDrawerClose();
    triggerRefresh();
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'values':
        return (
          <CustomValuesListTab
            key={refreshKey}
            onEdit={handleEditValue}
            onSuccess={triggerRefresh}
          />
        );
      case 'categories':
        return hasPermission('custom_values.categories') ? (
          <CustomValueCategoriesTab key={refreshKey} onSuccess={triggerRefresh} />
        ) : null;
      default:
        return (
          <CustomValuesListTab
            key={refreshKey}
            onEdit={handleEditValue}
            onSuccess={triggerRefresh}
          />
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Custom Values</h1>
          <p className="mt-1 text-sm text-slate-400">
            Create reusable variables for use across emails, SMS, automations, and more
          </p>
        </div>
        {canCreate && activeTab === 'values' && (
          <button
            onClick={handleCreateValue}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-cyan-500/25 transition-all hover:shadow-cyan-500/40 hover:brightness-110"
          >
            <Plus className="h-4 w-4" />
            Add Custom Value
          </button>
        )}
      </div>

      <div className="border-b border-slate-700">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
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
                    ? 'border-cyan-500 text-cyan-400'
                    : 'border-transparent text-slate-400 hover:border-slate-600 hover:text-slate-300'
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

      <CustomValueDrawer
        isOpen={drawerOpen}
        onClose={handleDrawerClose}
        onSuccess={handleDrawerSuccess}
        valueId={editingValueId}
      />
    </div>
  );
}
