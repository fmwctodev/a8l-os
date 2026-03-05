import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Calendar as CalendarIcon, List, Settings } from 'lucide-react';
import { UnifiedCalendarView, AppointmentListView } from '../../components/calendars/views';

type CalendarTab = 'calendar' | 'list';

export function Calendars() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialAppointmentId = searchParams.get('appointmentId') || undefined;
  const initialTab = initialAppointmentId
    ? 'list'
    : (searchParams.get('tab') as CalendarTab) || 'calendar';
  const [activeTab, setActiveTab] = useState<CalendarTab>(initialTab);

  const handleTabChange = (tab: CalendarTab) => {
    setActiveTab(tab);
    const newParams = new URLSearchParams(searchParams);
    newParams.set('tab', tab);
    setSearchParams(newParams, { replace: true });
  };

  const handleSettingsClick = () => {
    navigate('/settings/calendars');
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold text-white">Calendars</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleTabChange('calendar')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'calendar'
                ? 'bg-cyan-500 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
            }`}
          >
            <CalendarIcon className="w-4 h-4" />
            Calendar View
          </button>
          <button
            onClick={() => handleTabChange('list')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'list'
                ? 'bg-cyan-500 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
            }`}
          >
            <List className="w-4 h-4" />
            Appointment List View
          </button>
          <button
            onClick={handleSettingsClick}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
          >
            <Settings className="w-4 h-4" />
            Calendar Settings
          </button>
        </div>
      </div>

      <div className="flex-1 bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
        {activeTab === 'calendar' && <UnifiedCalendarView />}
        {activeTab === 'list' && <AppointmentListView initialAppointmentId={initialAppointmentId} />}
      </div>
    </div>
  );
}
