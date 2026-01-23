import { useSearchParams } from 'react-router-dom';
import { User, Settings, Shield, Bell, Link2 } from 'lucide-react';
import { PersonalInfoTab } from '../../components/settings/profile/PersonalInfoTab';
import { PreferencesTab } from '../../components/settings/profile/PreferencesTab';
import { SecurityTab } from '../../components/settings/profile/SecurityTab';
import { NotificationsTab } from '../../components/settings/profile/NotificationsTab';
import { ConnectedAccountsTab } from '../../components/settings/profile/ConnectedAccountsTab';

type TabType = 'personal-info' | 'preferences' | 'security' | 'notifications' | 'connected-accounts';

interface Tab {
  id: TabType;
  name: string;
  icon: typeof User;
}

const tabs: Tab[] = [
  { id: 'personal-info', name: 'Personal Info', icon: User },
  { id: 'preferences', name: 'Preferences', icon: Settings },
  { id: 'security', name: 'Security', icon: Shield },
  { id: 'notifications', name: 'Notifications', icon: Bell },
  { id: 'connected-accounts', name: 'Connected Accounts', icon: Link2 },
];

export function MyProfilePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get('tab') as TabType) || 'personal-info';

  const setActiveTab = (tab: TabType) => {
    setSearchParams({ tab });
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'personal-info':
        return <PersonalInfoTab />;
      case 'preferences':
        return <PreferencesTab />;
      case 'security':
        return <SecurityTab />;
      case 'notifications':
        return <NotificationsTab />;
      case 'connected-accounts':
        return <ConnectedAccountsTab />;
      default:
        return <PersonalInfoTab />;
    }
  };

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-white">My Profile</h2>
        <p className="text-slate-400 mt-1">Manage your personal information and preferences</p>
      </div>

      <div className="border-b border-slate-800 mb-6">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap
                  ${
                    activeTab === tab.id
                      ? 'border-cyan-500 text-cyan-400'
                      : 'border-transparent text-slate-400 hover:text-white'
                  }
                `}
              >
                <Icon className="w-4 h-4" />
                <span className="font-medium">{tab.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div>{renderTabContent()}</div>
    </div>
  );
}
