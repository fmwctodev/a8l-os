import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2, Calendar as CalendarIcon, Plus } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { getVisibleAppointments, updateAppointment, cancelAppointment } from '../../../services/appointments';
import { getBlockedSlots } from '../../../services/blockedSlots';
import { getCalendarEvents } from '../../../services/calendarEvents';
import { getCalendarTasks } from '../../../services/calendarTasks';
import { getCalendars } from '../../../services/calendars';
import { getUsers } from '../../../services/users';
import { getDepartments } from '../../../services/departments';
import {
  getGoogleCalendarEvents,
  getAllOrgGoogleCalendarEvents,
  getTeamGoogleCalendarEvents,
  syncGoogleCalendar,
  hasGoogleCalendarConnection,
} from '../../../services/googleCalendarEvents';
import { mergeDisplayItems } from '../../../utils/calendarDisplayItems';
import type {
  Appointment, BlockedSlot, Calendar, User, Department,
  CalendarViewFilter, AppointmentStatus, GoogleCalendarEvent,
  CalendarDisplayItem, CalendarEvent, CalendarTask,
} from '../../../types';
import type { CalendarViewType } from '../../../utils/calendarViewUtils';
import { getDateRangeForView } from '../../../utils/calendarViewUtils';
import { DayView } from './DayView';
import { WeekView } from './WeekView';
import { MonthView } from './MonthView';
import { UnifiedCalendarToolbar } from './UnifiedCalendarToolbar';
import { ManageViewPanel } from './ManageViewPanel';
import { AppointmentDetailsModal } from './AppointmentDetailsModal';
import { GoogleEventDetailModal } from './GoogleEventDetailModal';
import { NewAppointmentModal } from './NewAppointmentModal';
import { EditAppointmentModal } from './EditAppointmentModal';
import { NewEventModal } from './NewEventModal';
import { NewTaskModal } from './NewTaskModal';
import { EventDetailModal } from './EventDetailModal';
import { TaskDetailModal } from './TaskDetailModal';
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
  const [googleEvents, setGoogleEvents] = useState<GoogleCalendarEvent[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [calendarTasks, setCalendarTasks] = useState<CalendarTask[]>([]);
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isCreateCalendarOpen, setIsCreateCalendarOpen] = useState(false);
  const [hasGoogleConnection, setHasGoogleConnection] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showGoogleEvents, setShowGoogleEvents] = useState(true);

  const [viewType, setViewType] = useState<CalendarViewType>(initialView);
  const [currentDate, setCurrentDate] = useState<Date>(initialDate);
  const [isManageViewOpen, setIsManageViewOpen] = useState(false);

  const [viewFilter, setViewFilter] = useState<CalendarViewFilter>('all');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedCalendarIds, setSelectedCalendarIds] = useState<string[]>(initialCalendarIds);

  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [selectedGoogleEvent, setSelectedGoogleEvent] = useState<GoogleCalendarEvent | null>(null);
  const [selectedCalendarEvent, setSelectedCalendarEvent] = useState<CalendarEvent | null>(null);
  const [selectedCalendarTask, setSelectedCalendarTask] = useState<CalendarTask | null>(null);
  const [isNewAppointmentOpen, setIsNewAppointmentOpen] = useState(false);
  const [isNewEventOpen, setIsNewEventOpen] = useState(false);
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);

  const canEdit = hasPermission('appointments.edit');
  const canCreate = hasPermission('appointments.create');

  const isAdmin = currentUser?.role?.name === 'SuperAdmin' || currentUser?.role?.name === 'Admin';
  const isManager = currentUser?.role?.name === 'Manager';

  const dateRange = useMemo(
    () => getDateRangeForView(currentDate, viewType),
    [currentDate, viewType]
  );

  const handleSyncGoogle = useCallback(async () => {
    if (isSyncing || !hasGoogleConnection) return;
    setIsSyncing(true);
    try {
      const result = await syncGoogleCalendar();
      console.log('Google Calendar sync result:', result);
    } catch (err) {
      console.error('Google sync failed:', err);
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, hasGoogleConnection]);

  const loadInitialData = useCallback(async () => {
    if (!currentUser?.organization_id) return;

    try {
      setIsLoading(true);
      const [calendarsData, usersData, departmentsData, hasConnection] = await Promise.all([
        getCalendars(currentUser.organization_id),
        getUsers(),
        getDepartments(currentUser.organization_id),
        hasGoogleCalendarConnection(currentUser.id),
      ]);
      setCalendars(calendarsData);
      setUsers(usersData);
      setDepartments(departmentsData);
      setHasGoogleConnection(hasConnection);
    } catch (err) {
      console.error('Failed to load initial data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser?.organization_id, currentUser?.id]);

  const loadCalendarData = useCallback(async () => {
    if (!currentUser?.organization_id) return;

    try {
      const filters = {
        calendarIds: selectedCalendarIds.length > 0 ? selectedCalendarIds : undefined,
        userIds: selectedUserIds.length > 0 ? selectedUserIds : undefined,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      };

      const googleFilters = {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        userIds: selectedUserIds.length > 0 ? selectedUserIds : undefined,
      };

      let googleEventsPromise: Promise<GoogleCalendarEvent[]>;
      if (isAdmin) {
        googleEventsPromise = getAllOrgGoogleCalendarEvents(
          currentUser.organization_id,
          googleFilters
        );
      } else if (isManager && currentUser.department_id) {
        const deptUsers = users
          .filter(u => u.department_id === currentUser.department_id)
          .map(u => u.id);
        const userIds = [...new Set([currentUser.id, ...deptUsers])];
        googleEventsPromise = getTeamGoogleCalendarEvents(
          currentUser.organization_id,
          selectedUserIds.length > 0 ? selectedUserIds : userIds,
          googleFilters
        );
      } else {
        googleEventsPromise = getGoogleCalendarEvents(
          currentUser.organization_id,
          currentUser.id,
          googleFilters
        );
      }

      const [appointmentsData, blockedSlotsData, googleEventsData, eventsData, tasksData] = await Promise.all([
        getVisibleAppointments(currentUser.organization_id, currentUser, filters),
        getBlockedSlots(currentUser.organization_id, filters),
        googleEventsPromise,
        getCalendarEvents(currentUser.organization_id, filters),
        getCalendarTasks(currentUser.organization_id, filters),
      ]);

      setAppointments(appointmentsData);
      setBlockedSlots(blockedSlotsData);
      setGoogleEvents(googleEventsData);
      setCalendarEvents(eventsData);
      setCalendarTasks(tasksData);
    } catch (err) {
      console.error('Failed to load calendar data:', err);
    }
  }, [currentUser, dateRange, selectedCalendarIds, selectedUserIds, isAdmin, isManager, users]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    if (!isLoading) {
      loadCalendarData();
    }
  }, [loadCalendarData, isLoading]);

  useEffect(() => {
    if (!isLoading && hasGoogleConnection) {
      handleSyncGoogle().then(() => loadCalendarData());
    }
  }, [hasGoogleConnection, isLoading]);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set('view', viewType);
    params.set('date', currentDate.toISOString().split('T')[0]);
    if (selectedCalendarIds.length > 0) {
      params.set('calendars', selectedCalendarIds.join(','));
    }
    setSearchParams(params, { replace: true });
  }, [viewType, currentDate, selectedCalendarIds, setSearchParams]);

  const displayItems: CalendarDisplayItem[] = useMemo(() => {
    const showAll = viewFilter === 'all';
    const filteredAppointments = showAll || viewFilter === 'appointments' ? appointments : [];
    const filteredBlocked = showAll || viewFilter === 'blocked_slots' ? blockedSlots : [];
    const filteredGoogle = showGoogleEvents && (showAll || viewFilter === 'google_events') ? googleEvents : [];
    const filteredEvents = showAll || viewFilter === 'events' ? calendarEvents : [];
    const filteredTasks = showAll || viewFilter === 'tasks' ? calendarTasks : [];

    return mergeDisplayItems(filteredAppointments, filteredGoogle, filteredBlocked, filteredEvents, filteredTasks);
  }, [appointments, blockedSlots, googleEvents, calendarEvents, calendarTasks, viewFilter, showGoogleEvents]);

  const handleDateChange = (date: Date) => setCurrentDate(date);
  const handleViewTypeChange = (type: CalendarViewType) => setViewType(type);

  const handleDayClick = (date: Date) => {
    setCurrentDate(date);
    setViewType('day');
  };

  const handleDisplayItemClick = (item: CalendarDisplayItem) => {
    if (item.source === 'crm' && item.originalAppointment) {
      setSelectedAppointment(item.originalAppointment);
    } else if (item.source === 'google' && item.originalGoogleEvent) {
      setSelectedGoogleEvent(item.originalGoogleEvent);
    } else if (item.source === 'event' && item.originalCalendarEvent) {
      setSelectedCalendarEvent(item.originalCalendarEvent);
    } else if (item.source === 'task' && item.originalCalendarTask) {
      setSelectedCalendarTask(item.originalCalendarTask);
    }
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

  const handleGoogleEventUpdated = async () => {
    setSelectedGoogleEvent(null);
    await loadCalendarData();
  };

  const handleCalendarEventUpdated = async () => {
    setSelectedCalendarEvent(null);
    await loadCalendarData();
  };

  const handleCalendarTaskUpdated = async () => {
    setSelectedCalendarTask(null);
    await loadCalendarData();
  };

  const handleNewEventSuccess = async () => {
    setIsNewEventOpen(false);
    await loadCalendarData();
  };

  const handleNewTaskSuccess = async () => {
    setIsNewTaskOpen(false);
    await loadCalendarData();
  };

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

  if (calendars.length === 0 && !hasGoogleConnection) {
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
          onNewEvent={() => {
            if (calendars.length === 0) {
              setIsCreateCalendarOpen(true);
            } else {
              setIsNewEventOpen(true);
            }
          }}
          onNewTask={() => {
            if (calendars.length === 0) {
              setIsCreateCalendarOpen(true);
            } else {
              setIsNewTaskOpen(true);
            }
          }}
          onManageViewToggle={() => setIsManageViewOpen(!isManageViewOpen)}
          isManageViewOpen={isManageViewOpen}
          hasGoogleConnection={hasGoogleConnection}
          isSyncing={isSyncing}
          onSyncGoogle={async () => {
            await handleSyncGoogle();
            await loadCalendarData();
          }}
        />

        <div className="flex-1 overflow-hidden">
          {viewType === 'day' && (
            <DayView
              date={currentDate}
              items={displayItems}
              onItemClick={handleDisplayItemClick}
            />
          )}

          {viewType === 'week' && (
            <WeekView
              date={currentDate}
              items={displayItems}
              onItemClick={handleDisplayItemClick}
              onDayClick={handleDayClick}
            />
          )}

          {viewType === 'month' && (
            <MonthView
              date={currentDate}
              items={displayItems}
              onItemClick={handleDisplayItemClick}
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
        showGoogleEvents={showGoogleEvents}
        onShowGoogleEventsChange={setShowGoogleEvents}
        hasGoogleConnection={hasGoogleConnection}
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

      {selectedGoogleEvent && (
        <GoogleEventDetailModal
          event={selectedGoogleEvent}
          onClose={() => setSelectedGoogleEvent(null)}
          onUpdated={handleGoogleEventUpdated}
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

      {selectedCalendarEvent && (
        <EventDetailModal
          event={selectedCalendarEvent}
          onClose={() => setSelectedCalendarEvent(null)}
          onUpdated={handleCalendarEventUpdated}
        />
      )}

      {selectedCalendarTask && (
        <TaskDetailModal
          task={selectedCalendarTask}
          onClose={() => setSelectedCalendarTask(null)}
          onUpdated={handleCalendarTaskUpdated}
        />
      )}

      {isNewEventOpen && calendars.length > 0 && (
        <NewEventModal
          calendar={selectedCalendar || calendars[0]}
          calendars={calendars}
          preselectedDate={currentDate}
          onClose={() => setIsNewEventOpen(false)}
          onSuccess={handleNewEventSuccess}
        />
      )}

      {isNewTaskOpen && calendars.length > 0 && (
        <NewTaskModal
          calendar={selectedCalendar || calendars[0]}
          calendars={calendars}
          preselectedDate={currentDate}
          onClose={() => setIsNewTaskOpen(false)}
          onSuccess={handleNewTaskSuccess}
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
