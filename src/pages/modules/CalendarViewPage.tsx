import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getCalendarById } from '../../services/calendars';
import { getVisibleAppointments, updateAppointment, cancelAppointment } from '../../services/appointments';
import type { Calendar, Appointment, AppointmentStatus } from '../../types';
import type { CalendarViewType } from '../../utils/calendarViewUtils';
import { getDateRangeForView } from '../../utils/calendarViewUtils';
import {
  DayView,
  WeekView,
  MonthView,
  CalendarToolbar,
  AppointmentDetailsModal,
  NewAppointmentModal,
  EditAppointmentModal,
} from '../../components/calendars/views';

export function CalendarViewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user: currentUser, hasPermission } = useAuth();

  const initialView = (searchParams.get('mode') as CalendarViewType) || 'week';
  const initialDateStr = searchParams.get('date');
  const initialDate = initialDateStr ? new Date(initialDateStr) : new Date();

  const [calendar, setCalendar] = useState<Calendar | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [viewType, setViewType] = useState<CalendarViewType>(initialView);
  const [currentDate, setCurrentDate] = useState<Date>(initialDate);

  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [isNewAppointmentOpen, setIsNewAppointmentOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);

  const canEdit = hasPermission('appointments.edit');
  const canCreate = hasPermission('appointments.create');

  const dateRange = useMemo(
    () => getDateRangeForView(currentDate, viewType),
    [currentDate, viewType]
  );

  const loadCalendar = useCallback(async () => {
    if (!id) return;

    try {
      const calendarData = await getCalendarById(id);
      setCalendar(calendarData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load calendar');
    }
  }, [id]);

  const loadAppointments = useCallback(async () => {
    if (!id || !currentUser) return;

    try {
      const appointmentsData = await getVisibleAppointments(
        currentUser.organization_id,
        currentUser,
        {
          calendarId: id,
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
        }
      );
      setAppointments(appointmentsData);
    } catch (err) {
      console.error('Failed to load appointments:', err);
    }
  }, [id, currentUser, dateRange]);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setError(null);
      await loadCalendar();
      await loadAppointments();
      setIsLoading(false);
    };

    loadData();
  }, [loadCalendar, loadAppointments]);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set('mode', viewType);
    params.set('date', currentDate.toISOString().split('T')[0]);
    setSearchParams(params, { replace: true });
  }, [viewType, currentDate, setSearchParams]);

  const handleDateChange = (date: Date) => {
    setCurrentDate(date);
  };

  const handleViewTypeChange = (type: CalendarViewType) => {
    setViewType(type);
  };

  const handleDayClick = (date: Date) => {
    setCurrentDate(date);
    setViewType('day');
  };

  const handleAppointmentClick = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
  };

  const handleStatusChange = async (status: AppointmentStatus) => {
    if (!selectedAppointment || !currentUser) return;

    try {
      if (status === 'canceled') {
        await cancelAppointment(selectedAppointment.id, undefined, currentUser);
      } else {
        await updateAppointment(selectedAppointment.id, { status }, currentUser);
      }
      await loadAppointments();
      setSelectedAppointment(null);
    } catch (err) {
      console.error('Failed to update appointment:', err);
    }
  };

  const handleNewAppointmentSuccess = async () => {
    setIsNewAppointmentOpen(false);
    await loadAppointments();
  };

  const handleEditClick = () => {
    if (selectedAppointment) {
      setEditingAppointment(selectedAppointment);
      setSelectedAppointment(null);
      setIsEditModalOpen(true);
    }
  };

  const handleEditSuccess = async () => {
    setIsEditModalOpen(false);
    setEditingAppointment(null);
    await loadAppointments();
  };

  const handleSettingsClick = () => {
    navigate(`/settings/calendars?calendar=${id}`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  if (error || !calendar) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
        <p className="text-white font-medium">Error loading calendar</p>
        <p className="text-slate-400 text-sm">{error || 'Calendar not found'}</p>
        <button
          onClick={() => navigate('/calendars')}
          className="mt-4 text-cyan-400 hover:text-cyan-300"
        >
          Back to calendars
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex items-center gap-4 mb-4">
        <button
          onClick={() => navigate('/calendars')}
          className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-slate-400" />
        </button>
        <div>
          <h1 className="text-xl font-semibold text-white">{calendar.name}</h1>
          <p className="text-sm text-slate-400">
            {calendar.type === 'user' ? 'Personal Calendar' : 'Team Calendar'}
          </p>
        </div>
      </div>

      <div className="flex-1 bg-slate-900 rounded-xl border border-slate-800 flex flex-col overflow-hidden">
        <CalendarToolbar
          date={currentDate}
          viewType={viewType}
          onDateChange={handleDateChange}
          onViewTypeChange={handleViewTypeChange}
          onNewAppointment={() => canCreate && setIsNewAppointmentOpen(true)}
          onSettingsClick={handleSettingsClick}
          calendarName={calendar.name}
        />

        <div className="flex-1 overflow-hidden">
          {viewType === 'day' && (
            <DayView
              date={currentDate}
              appointments={appointments}
              onAppointmentClick={handleAppointmentClick}
            />
          )}

          {viewType === 'week' && (
            <WeekView
              date={currentDate}
              appointments={appointments}
              onAppointmentClick={handleAppointmentClick}
              onDayClick={handleDayClick}
            />
          )}

          {viewType === 'month' && (
            <MonthView
              date={currentDate}
              appointments={appointments}
              onAppointmentClick={handleAppointmentClick}
              onDayClick={handleDayClick}
            />
          )}
        </div>
      </div>

      {selectedAppointment && (
        <AppointmentDetailsModal
          appointment={selectedAppointment}
          onClose={() => setSelectedAppointment(null)}
          onStatusChange={handleStatusChange}
          onEdit={handleEditClick}
          canEdit={canEdit}
        />
      )}

      {isNewAppointmentOpen && (
        <NewAppointmentModal
          calendar={calendar}
          preselectedDate={currentDate}
          onClose={() => setIsNewAppointmentOpen(false)}
          onSuccess={handleNewAppointmentSuccess}
        />
      )}

      {isEditModalOpen && editingAppointment && (
        <EditAppointmentModal
          calendar={calendar}
          appointment={editingAppointment}
          onClose={() => {
            setIsEditModalOpen(false);
            setEditingAppointment(null);
          }}
          onSuccess={handleEditSuccess}
        />
      )}
    </div>
  );
}
