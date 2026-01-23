import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Puzzle, Link2, Users, Webhook, History, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { AllIntegrationsTab } from '../../components/settings/integrations/AllIntegrationsTab';
import { ConnectedIntegrationsTab } from '../../components/settings/integrations/ConnectedIntegrationsTab';
import { UserIntegrationsTab } from '../../components/settings/integrations/UserIntegrationsTab';
import { WebhooksTab } from '../../components/settings/integrations/WebhooksTab';
import { IntegrationLogsTab } from '../../components/settings/integrations/IntegrationLogsTab';

type TabId = 'all' | 'connected' | 'user' | 'webhooks' | 'logs';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ElementType;
  permission?: string;
}

const tabs: Tab[] = [
  { id: 'all', label: 'All Integrations', icon: Puzzle },
  { id: 'connected', label: 'Connected', icon: Link2 },
  { id: 'user', label: 'User Integrations', icon: Users, permission: 'integrations.manage_user' },
  { id: 'webhooks', label: 'Webhooks', icon: Webhook, permission: 'integrations.webhooks.manage' },
  { id: 'logs', label: 'Activity Logs', icon: History, permission: 'integrations.logs.view' },
];

export function IntegrationsSettingsPage() {
  const { hasPermission } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [refreshKey, setRefreshKey] = useState(0);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

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

  const renderTabContent = () => {
    switch (activeTab) {
      case 'all':
        return <AllIntegrationsTab key={refreshKey} onSuccess={triggerRefresh} />;
      case 'connected':
        return <ConnectedIntegrationsTab key={refreshKey} onSuccess={triggerRefresh} />;
      case 'user':
        return hasPermission('integrations.manage_user') ? (
          <UserIntegrationsTab key={refreshKey} />
        ) : null;
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
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Integrations</h1>
        <p className="mt-1 text-sm text-gray-500">
          Connect third-party services, manage OAuth connections, and configure webhooks
        </p>
      </div>

      {notification && (
        <div
          className={`flex items-center gap-3 rounded-lg border p-4 ${
            notification.type === 'success'
              ? 'border-green-200 bg-green-50 text-green-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle className="h-5 w-5 text-green-500" />
          ) : (
            <AlertCircle className="h-5 w-5 text-red-500" />
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

      <div>{renderTabContent()}</div>
    </div>
  );
}
