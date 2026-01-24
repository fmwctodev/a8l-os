import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Calendar, Clock, CalendarDays, Link2, ShieldOff, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { CalendarsTab } from '../../components/settings/calendars/CalendarsTab';
import { AppointmentTypesTab } from '../../components/settings/calendars/AppointmentTypesTab';
import { AvailabilityTab } from '../../components/settings/calendars/AvailabilityTab';
import { ConnectionsTab } from '../../components/settings/calendars/ConnectionsTab';

type TabId = 'calendars' | 'appointment-types' | 'availability' | 'connections';

interface Tab {
  id: TabId;
  name: string;
  icon: typeof Calendar;
}

const tabs: Tab[] = [
  { id: 'calendars', name: 'Calendars', icon: Calendar },
  { id: 'appointment-types', name: 'Appointment Types', icon: Clock },
  { id: 'availability', name: 'Availability', icon: CalendarDays },
  { id: 'connections', name: 'Connections', icon: Link2 },
];

export function CalendarsSettingsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabId>('calendars');

  const userRole = user?.role?.name;
  const isAgent = userRole === 'Agent';

  useEffect(() => {
    const tab = searchParams.get('tab') as TabId;
    if (tab && tabs.some((t) => t.id === tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const handleTabChange = (tabId: TabId) => {
    setActiveTab(tabId);
    setSearchParams({ tab: tabId });
  };

  if (isAgent) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-6">
          <ShieldOff className="w-8 h-8 text-red-400" />
        </div>
        <h2 className="text-xl font-semibold text-white mb-2">Access Restricted</h2>
        <p className="text-slate-400 max-w-md mb-6">
          Calendar settings are not available for your role. Contact an administrator for access.
        </p>
        <button
          onClick={() => navigate('/settings')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Settings
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Calendar Settings</h1>
        <p className="text-slate-400 mt-1">
          Manage your calendars, appointment types, availability, and Google Calendar connections
        </p>
      </div>

      <div className="border-b border-slate-700">
        <nav className="flex gap-6" aria-label="Tabs">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex items-center gap-2 py-3 px-1 border-b-2 transition-colors ${
                  isActive
                    ? 'border-cyan-500 text-cyan-400'
                    : 'border-transparent text-slate-400 hover:text-white hover:border-slate-600'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="font-medium">{tab.name}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <div>
        {activeTab === 'calendars' && <CalendarsTab />}
        {activeTab === 'appointment-types' && <AppointmentTypesTab />}
        {activeTab === 'availability' && <AvailabilityTab />}
        {activeTab === 'connections' && <ConnectionsTab />}
      </div>
    </div>
  );
}
