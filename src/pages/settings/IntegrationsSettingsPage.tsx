import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Puzzle, Link2, Users, Webhook, History, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { AllIntegrationsTab } from '../../components/settings/integrations/AllIntegrationsTab';
import { ConnectedIntegrationsTab } from '../../components/settings/integrations/ConnectedIntegrationsTab';
import { UserIntegrationsTab } from '../../components/settings/integrations/UserIntegrationsTab';
import { WebhooksTab } from '../../components/settings/integrations/WebhooksTab';
import { IntegrationLogsTab } from '../../components/settings/integrations/IntegrationLogsTab';

type TabId = 'all' | 'connected' | 'user-integrations' | 'webhooks' | 'logs';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ElementType;
  permission?: string;
  requiresSuperAdmin?: boolean;
}

const tabs: Tab[] = [
  { id: 'all', label: 'All Integrations', icon: Puzzle },
  { id: 'connected', label: 'Connected', icon: Link2 },
  { id: 'user-integrations', label: 'User Integrations', icon: Users },
  { id: 'webhooks', label: 'Webhooks', icon: Webhook, permission: 'integrations.webhooks.manage' },
  { id: 'logs', label: 'Activity Logs', icon: History, permission: 'integrations.logs.view' },
];

export function IntegrationsSettingsPage() {
  const { hasPermission } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [refreshKey, setRefreshKey] = useState(0);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const isAdmin = hasPermission('integrations.manage');

  const successParam = searchParams.get('success');
  const errorParam = searchParams.get('error');
  const integrationParam = searchParams.get('integration');

  useEffect(() => {
    if (successParam === 'true' && integrationParam) {
      setNotification({
        type: 'success',
        message: `Successfully connected ${integrationParam.replace(/_/g, ' ')}`,
      });
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('success');
      newParams.delete('integration');
      setSearchParams(newParams, { replace: true });
      triggerRefresh();
    } else if (errorParam) {
      setNotification({
        type: 'error',
        message: errorParam,
      });
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('error');
      setSearchParams(newParams, { replace: true });
    }
  }, [successParam, errorParam, integrationParam, searchParams, setSearchParams]);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const visibleTabs = tabs.filter(tab => {
    if (tab.requiresSuperAdmin && !hasPermission('settings.manage')) return false;
    if (tab.permission && !hasPermission(tab.permission)) return false;
    return true;
  });

  const tabParam = searchParams.get('tab') as TabId | null;
  const [activeTab, setActiveTab] = useState<TabId>(
    tabParam && visibleTabs.some(t => t.id === tabParam) ? tabParam : 'all'
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

  const handleBrowseIntegrations = () => {
    setActiveTab('all');
    setSearchParams({ tab: 'all' });
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'all':
        return <AllIntegrationsTab key={refreshKey} onSuccess={triggerRefresh} />;
      case 'connected':
        return <ConnectedIntegrationsTab key={refreshKey} onSuccess={triggerRefresh} />;
      case 'user-integrations':
        return <UserIntegrationsTab key={refreshKey} />;
      case 'webhooks':
        return hasPermission('integrations.webhooks.manage') ? (
          <WebhooksTab key={refreshKey} onSuccess={triggerRefresh} />
        ) : null;
      case 'logs':
        return hasPermission('integrations.logs.view') ? (
          <IntegrationLogsTab key={refreshKey} />
        ) : null;
      default:
        return <AllIntegrationsTab key={refreshKey} onSuccess={triggerRefresh} />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Integrations</h1>
          <p className="mt-1 text-sm text-slate-400">
            Connect third-party tools and services
          </p>
        </div>
        {isAdmin && activeTab !== 'all' && (
          <button
            onClick={handleBrowseIntegrations}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-cyan-500/25 transition-all hover:shadow-cyan-500/40"
          >
            <ExternalLink className="h-4 w-4" />
            Browse Integrations
          </button>
        )}
      </div>

      {notification && (
        <div
          className={`flex items-center gap-3 rounded-lg border p-4 ${
            notification.type === 'success'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
              : 'border-red-500/30 bg-red-500/10 text-red-400'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle className="h-5 w-5" />
          ) : (
            <AlertCircle className="h-5 w-5" />
          )}
          <p className="text-sm font-medium">{notification.message}</p>
          <button
            onClick={() => setNotification(null)}
            className="ml-auto text-current opacity-70 hover:opacity-100"
          >
            &times;
          </button>
        </div>
      )}

      <div className="border-b border-slate-700">
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

      <div>{renderTabContent()}</div>
    </div>
  );
}
