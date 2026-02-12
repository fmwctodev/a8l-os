import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2, Calendar as CalendarIcon, Plus } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { getVisibleAppointments, updateAppointment, cancelAppointment } from '../../../services/appointments';
import { getBlockedSlots } from '../../../services/blockedSlots';
import { getCalendars } from '../../../services/calendars';
import { getUsers } from '../../../services/users';
import { getDepartments } from '../../../services/departments';
import type { Appointment, BlockedSlot, Calendar, User, Department, CalendarViewFilter, AppointmentStatus } from '../../../types';
import type { CalendarViewType } from '../../../utils/calendarViewUtils';
import { getDateRangeForView } from '../../../utils/calendarViewUtils';
import { DayView } from './DayView';
import { WeekView } from './WeekView';
import { MonthView } from './MonthView';
import { UnifiedCalendarToolbar } from './UnifiedCalendarToolbar';
import { ManageViewPanel } from './ManageViewPanel';
import { AppointmentDetailsModal } from './AppointmentDetailsModal';
import { NewAppointmentModal } from './NewAppointmentModal';
import { EditAppointmentModal } from './EditAppointmentModal';
import { CreateCalendarModal } from '../CreateCalendarModal';

export function UnifiedCalendarView() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user: currentUser, hasPermission } = useAuth();

  const initialView = (searchParams.get('view') as CalendarViewType) || 'month';
  const initialDateStr = searchParams.get('date');
  const initialDate = initialDateStr ? new Date(initialDateStr) : new Date();
  const initialCalendarIds = searchParams.get('calendars')?.split(',').filter(Boolean) || [];

  const [isLoading, setIsLoading] = useState(true);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>([]);
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isCreateCalendarOpen, setIsCreateCalendarOpen] = useState(false);

  const [viewType, setViewType] = useState<CalendarViewType>(initialView);
  const [currentDate, setCurrentDate] = useState<Date>(initialDate);
  const [isManageViewOpen, setIsManageViewOpen] = useState(false);

  const [viewFilter, setViewFilter] = useState<CalendarViewFilter>('all');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedCalendarIds, setSelectedCalendarIds] = useState<string[]>(initialCalendarIds);

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

  const loadInitialData = useCallback(async () => {
    if (!currentUser?.organization_id) return;

    try {
      setIsLoading(true);
      const [calendarsData, usersData, departmentsData] = await Promise.all([
        getCalendars(currentUser.organization_id),
        getUsers(),
        getDepartments(currentUser.organization_id),
      ]);
      setCalendars(calendarsData);
      setUsers(usersData);
      setDepartments(departmentsData);
    } catch (err) {
      console.error('Failed to load initial data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser?.organization_id]);

  const loadCalendarData = useCallback(async () => {
    if (!currentUser?.organization_id) return;

    try {
      const filters = {
        calendarIds: selectedCalendarIds.length > 0 ? selectedCalendarIds : undefined,
        userIds: selectedUserIds.length > 0 ? selectedUserIds : undefined,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      };

      const [appointmentsData, blockedSlotsData] = await Promise.all([
        getVisibleAppointments(currentUser.organization_id, currentUser, filters),
        getBlockedSlots(currentUser.organization_id, filters),
      ]);

      setAppointments(appointmentsData);
      setBlockedSlots(blockedSlotsData);
    } catch (err) {
      console.error('Failed to load calendar data:', err);
    }
  }, [currentUser, dateRange, selectedCalendarIds, selectedUserIds]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    if (!isLoading) {
      loadCalendarData();
    }
  }, [loadCalendarData, isLoading]);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set('view', viewType);
    params.set('date', currentDate.toISOString().split('T')[0]);
    if (selectedCalendarIds.length > 0) {
      params.set('calendars', selectedCalendarIds.join(','));
    }
    setSearchParams(params, { replace: true });
  }, [viewType, currentDate, selectedCalendarIds, setSearchParams]);

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
      await loadCalendarData();
      setSelectedAppointment(null);
    } catch (err) {
      console.error('Failed to update appointment:', err);
    }
  };

  const handleNewAppointmentSuccess = async () => {
    setIsNewAppointmentOpen(false);
    await loadCalendarData();
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
    await loadCalendarData();
  };

  const filteredAppointments = useMemo(() => {
    if (viewFilter === 'blocked_slots') return [];
    return appointments;
  }, [appointments, viewFilter]);

  const filteredBlockedSlots = useMemo(() => {
    if (viewFilter === 'appointments') return [];
    return blockedSlots;
  }, [blockedSlots, viewFilter]);

  const displayItems = useMemo(() => {
    return [...filteredAppointments];
  }, [filteredAppointments]);

  const handleCreateCalendarSuccess = () => {
    setIsCreateCalendarOpen(false);
    loadInitialData();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  if (calendars.length === 0) {
    return (
      <>
        <div className="flex flex-col items-center justify-center h-full px-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-teal-500/20 flex items-center justify-center mb-6">
            <CalendarIcon className="w-8 h-8 text-cyan-400" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">No calendars set up yet</h3>
          <p className="text-slate-400 text-sm text-center max-w-md mb-6">
            Create your first calendar to start scheduling appointments, managing availability, and booking time with contacts.
          </p>
          <button
            onClick={() => setIsCreateCalendarOpen(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-600 text-white font-medium hover:from-cyan-600 hover:to-teal-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Calendar
          </button>
        </div>
        {isCreateCalendarOpen && (
          <CreateCalendarModal
            departments={departments}
            users={users}
            onClose={() => setIsCreateCalendarOpen(false)}
            onSuccess={handleCreateCalendarSuccess}
          />
        )}
      </>
    );
  }

  const selectedCalendar = calendars.length === 1 ? calendars[0] : calendars.find(c => selectedCalendarIds.includes(c.id));

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col min-w-0">
        <UnifiedCalendarToolbar
          date={currentDate}
          viewType={viewType}
          onDateChange={handleDateChange}
          onViewTypeChange={handleViewTypeChange}
          onNewAppointment={() => {
            if (calendars.length === 0) {
              setIsCreateCalendarOpen(true);
            } else if (canCreate) {
              setIsNewAppointmentOpen(true);
            }
          }}
          onManageViewToggle={() => setIsManageViewOpen(!isManageViewOpen)}
          isManageViewOpen={isManageViewOpen}
        />

        <div className="flex-1 overflow-hidden">
          {viewType === 'day' && (
            <DayView
              date={currentDate}
              appointments={displayItems}
              onAppointmentClick={handleAppointmentClick}
            />
          )}

          {viewType === 'week' && (
            <WeekView
              date={currentDate}
              appointments={displayItems}
              onAppointmentClick={handleAppointmentClick}
              onDayClick={handleDayClick}
            />
          )}

          {viewType === 'month' && (
            <MonthView
              date={currentDate}
              appointments={displayItems}
              onAppointmentClick={handleAppointmentClick}
              onDayClick={handleDayClick}
            />
          )}
        </div>
      </div>

      <ManageViewPanel
        isOpen={isManageViewOpen}
        onClose={() => setIsManageViewOpen(false)}
        viewFilter={viewFilter}
        onViewFilterChange={setViewFilter}
        users={users}
        calendars={calendars}
        selectedUserIds={selectedUserIds}
        selectedCalendarIds={selectedCalendarIds}
        onUserSelectionChange={setSelectedUserIds}
        onCalendarSelectionChange={setSelectedCalendarIds}
      />

      {selectedAppointment && (
        <AppointmentDetailsModal
          appointment={selectedAppointment}
          onClose={() => setSelectedAppointment(null)}
          onStatusChange={handleStatusChange}
          onEdit={handleEditClick}
          canEdit={canEdit}
        />
      )}

      {isNewAppointmentOpen && calendars.length > 0 && (
        <NewAppointmentModal
          calendar={selectedCalendar || calendars[0]}
          calendars={calendars}
          preselectedDate={currentDate}
          onClose={() => setIsNewAppointmentOpen(false)}
          onSuccess={handleNewAppointmentSuccess}
        />
      )}

      {isEditModalOpen && editingAppointment && calendars.length > 0 && (
        <EditAppointmentModal
          calendar={calendars.find(c => c.id === editingAppointment.calendar_id) || calendars[0]}
          appointment={editingAppointment}
          onClose={() => {
            setIsEditModalOpen(false);
            setEditingAppointment(null);
          }}
          onSuccess={handleEditSuccess}
        />
      )}

      {isCreateCalendarOpen && (
        <CreateCalendarModal
          departments={departments}
          users={users}
          onClose={() => setIsCreateCalendarOpen(false)}
          onSuccess={handleCreateCalendarSuccess}
        />
      )}
    </div>
  );
}
