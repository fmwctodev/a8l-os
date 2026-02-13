import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Loader2,
  ChevronUp,
  ChevronDown,
  Calendar as CalendarIcon,
  Clock,
  User as UserIcon,
  SlidersHorizontal,
  MoreVertical,
  Eye,
  Edit3,
  XCircle,
  Plus,
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { getVisibleAppointments, updateAppointment, cancelAppointment } from '../../../services/appointments';
import { getCalendars } from '../../../services/calendars';
import { getUsers } from '../../../services/users';
import { getDepartments } from '../../../services/departments';
import type { Appointment, Calendar, User, Department, CalendarViewFilter, AppointmentStatus } from '../../../types';
import { ManageViewPanel } from './ManageViewPanel';
import { AppointmentDetailsModal } from './AppointmentDetailsModal';
import { EditAppointmentModal } from './EditAppointmentModal';
import { CreateCalendarModal } from '../CreateCalendarModal';

type SortField = 'start_at_utc' | 'contact' | 'calendar' | 'type' | 'assigned_user' | 'status';
type SortDirection = 'asc' | 'desc';

const PAGE_SIZE = 20;

export function AppointmentListView() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user: currentUser, hasPermission } = useAuth();

  const initialCalendarIds = searchParams.get('calendars')?.split(',').filter(Boolean) || [];

  const [isLoading, setIsLoading] = useState(true);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isCreateCalendarOpen, setIsCreateCalendarOpen] = useState(false);

  const [isManageViewOpen, setIsManageViewOpen] = useState(false);
  const [viewFilter, setViewFilter] = useState<CalendarViewFilter>('all');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedCalendarIds, setSelectedCalendarIds] = useState<string[]>(initialCalendarIds);

  const [sortField, setSortField] = useState<SortField>('start_at_utc');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [currentPage, setCurrentPage] = useState(1);

  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const canEdit = hasPermission('appointments.edit');
  const canCancel = hasPermission('appointments.cancel');

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

  const loadAppointments = useCallback(async () => {
    if (!currentUser?.organization_id) return;

    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const ninetyDaysFromNow = new Date();
      ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90);

      const filters = {
        calendarIds: selectedCalendarIds.length > 0 ? selectedCalendarIds : undefined,
        userIds: selectedUserIds.length > 0 ? selectedUserIds : undefined,
        startDate: thirtyDaysAgo.toISOString(),
        endDate: ninetyDaysFromNow.toISOString(),
      };

      const appointmentsData = await getVisibleAppointments(
        currentUser.organization_id,
        currentUser,
        filters
      );

      setAppointments(appointmentsData);
    } catch (err) {
      console.error('Failed to load appointments:', err);
    }
  }, [currentUser, selectedCalendarIds, selectedUserIds]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    if (!isLoading) {
      loadAppointments();
    }
  }, [loadAppointments, isLoading]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedCalendarIds.length > 0) {
      params.set('calendars', selectedCalendarIds.join(','));
    }
    setSearchParams(params, { replace: true });
  }, [selectedCalendarIds, setSearchParams]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  const sortedAppointments = useMemo(() => {
    const sorted = [...appointments].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'start_at_utc':
          comparison = new Date(a.start_at_utc).getTime() - new Date(b.start_at_utc).getTime();
          break;
        case 'contact':
          const contactA = a.contact ? `${a.contact.first_name} ${a.contact.last_name}` : '';
          const contactB = b.contact ? `${b.contact.first_name} ${b.contact.last_name}` : '';
          comparison = contactA.localeCompare(contactB);
          break;
        case 'calendar':
          const calA = (a.calendar as { name?: string })?.name || '';
          const calB = (b.calendar as { name?: string })?.name || '';
          comparison = calA.localeCompare(calB);
          break;
        case 'type':
          const typeA = (a.appointment_type as { name?: string })?.name || '';
          const typeB = (b.appointment_type as { name?: string })?.name || '';
          comparison = typeA.localeCompare(typeB);
          break;
        case 'assigned_user':
          const userA = a.assigned_user?.name || '';
          const userB = b.assigned_user?.name || '';
          comparison = userA.localeCompare(userB);
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [appointments, sortField, sortDirection]);

  const paginatedAppointments = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return sortedAppointments.slice(startIndex, startIndex + PAGE_SIZE);
  }, [sortedAppointments, currentPage]);

  const totalPages = Math.ceil(sortedAppointments.length / PAGE_SIZE);

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

  const handleEditClick = (appointment: Appointment) => {
    setEditingAppointment(appointment);
    setMenuOpenId(null);
    setIsEditModalOpen(true);
  };

  const handleCancelClick = async (appointment: Appointment) => {
    if (!currentUser) return;
    if (!confirm('Are you sure you want to cancel this appointment?')) return;

    try {
      await cancelAppointment(appointment.id, undefined, currentUser);
      await loadAppointments();
    } catch (err) {
      console.error('Failed to cancel appointment:', err);
    }
    setMenuOpenId(null);
  };

  const handleEditSuccess = async () => {
    setIsEditModalOpen(false);
    setEditingAppointment(null);
    await loadAppointments();
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return {
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      time: date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
    };
  };

  const getStatusBadgeClasses = (status: AppointmentStatus) => {
    switch (status) {
      case 'scheduled':
        return 'bg-cyan-500/20 text-cyan-400';
      case 'completed':
        return 'bg-emerald-500/20 text-emerald-400';
      case 'canceled':
        return 'bg-slate-500/20 text-slate-400';
      case 'no_show':
        return 'bg-red-500/20 text-red-400';
      default:
        return 'bg-slate-500/20 text-slate-400';
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? (
      <ChevronUp className="w-4 h-4" />
    ) : (
      <ChevronDown className="w-4 h-4" />
    );
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

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <CalendarIcon className="w-4 h-4" />
            <span>{sortedAppointments.length} appointments</span>
          </div>
          <button
            onClick={() => setIsManageViewOpen(!isManageViewOpen)}
            className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
              isManageViewOpen
                ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50'
                : 'text-slate-300 border-slate-600 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Manage View
          </button>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="w-full">
            <thead className="sticky top-0 bg-slate-900 z-10">
              <tr className="border-b border-slate-800">
                <th className="px-4 py-3 text-left">
                  <button
                    onClick={() => handleSort('start_at_utc')}
                    className="flex items-center gap-1 text-sm font-medium text-slate-400 hover:text-white transition-colors"
                  >
                    <Clock className="w-4 h-4" />
                    Date/Time
                    <SortIcon field="start_at_utc" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left">
                  <button
                    onClick={() => handleSort('contact')}
                    className="flex items-center gap-1 text-sm font-medium text-slate-400 hover:text-white transition-colors"
                  >
                    Contact
                    <SortIcon field="contact" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left">
                  <button
                    onClick={() => handleSort('calendar')}
                    className="flex items-center gap-1 text-sm font-medium text-slate-400 hover:text-white transition-colors"
                  >
                    Calendar
                    <SortIcon field="calendar" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left">
                  <button
                    onClick={() => handleSort('type')}
                    className="flex items-center gap-1 text-sm font-medium text-slate-400 hover:text-white transition-colors"
                  >
                    Type
                    <SortIcon field="type" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left">
                  <button
                    onClick={() => handleSort('assigned_user')}
                    className="flex items-center gap-1 text-sm font-medium text-slate-400 hover:text-white transition-colors"
                  >
                    <UserIcon className="w-4 h-4" />
                    Assigned To
                    <SortIcon field="assigned_user" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left">
                  <button
                    onClick={() => handleSort('status')}
                    className="flex items-center gap-1 text-sm font-medium text-slate-400 hover:text-white transition-colors"
                  >
                    Status
                    <SortIcon field="status" />
                  </button>
                </th>
                <th className="px-4 py-3 text-right">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedAppointments.map((appointment) => {
                const { date, time } = formatDateTime(appointment.start_at_utc);
                const contact = appointment.contact;
                const calendar = appointment.calendar as { name?: string } | null;
                const appointmentType = appointment.appointment_type as { name?: string } | null;
                const isMenuOpen = menuOpenId === appointment.id;

                return (
                  <tr
                    key={appointment.id}
                    className="border-b border-slate-800 hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm text-white">{date}</p>
                        <p className="text-xs text-slate-400">{time}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {contact ? (
                        <div>
                          <p className="text-sm text-white">
                            {contact.first_name} {contact.last_name}
                          </p>
                          {contact.email && (
                            <p className="text-xs text-slate-400 truncate max-w-[200px]">
                              {contact.email}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-slate-500 italic">No contact</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-slate-300">{calendar?.name || '-'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-slate-300">{appointmentType?.name || '-'}</span>
                    </td>
                    <td className="px-4 py-3">
                      {appointment.assigned_user ? (
                        <div className="flex items-center gap-2">
                          {appointment.assigned_user.avatar_url ? (
                            <img
                              src={appointment.assigned_user.avatar_url}
                              alt=""
                              className="w-6 h-6 rounded-full"
                            />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center">
                              <span className="text-xs text-slate-400">
                                {appointment.assigned_user.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          )}
                          <span className="text-sm text-slate-300">
                            {appointment.assigned_user.name}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-slate-500">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-1 rounded text-xs font-medium capitalize ${getStatusBadgeClasses(
                          appointment.status
                        )}`}
                      >
                        {appointment.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="relative">
                        <button
                          onClick={() => setMenuOpenId(isMenuOpen ? null : appointment.id)}
                          className="p-1.5 rounded-lg hover:bg-slate-700 transition-colors"
                        >
                          <MoreVertical className="w-4 h-4 text-slate-400" />
                        </button>
                        {isMenuOpen && (
                          <div className="absolute right-0 top-8 w-40 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-20">
                            <button
                              onClick={() => {
                                setSelectedAppointment(appointment);
                                setMenuOpenId(null);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors rounded-t-lg"
                            >
                              <Eye className="w-4 h-4" />
                              View Details
                            </button>
                            {canEdit && appointment.status === 'scheduled' && (
                              <button
                                onClick={() => handleEditClick(appointment)}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors"
                              >
                                <Edit3 className="w-4 h-4" />
                                Edit
                              </button>
                            )}
                            {canCancel && appointment.status === 'scheduled' && (
                              <button
                                onClick={() => handleCancelClick(appointment)}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-slate-700 transition-colors rounded-b-lg"
                              >
                                <XCircle className="w-4 h-4" />
                                Cancel
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {paginatedAppointments.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <CalendarIcon className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                    <p className="text-white font-medium mb-1">No appointments found</p>
                    <p className="text-slate-400 text-sm">
                      Try adjusting your filters or date range
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800">
            <p className="text-sm text-slate-400">
              Showing {(currentPage - 1) * PAGE_SIZE + 1} to{' '}
              {Math.min(currentPage * PAGE_SIZE, sortedAppointments.length)} of{' '}
              {sortedAppointments.length} appointments
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 text-sm rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-sm text-slate-400">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 text-sm rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
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
        showGoogleEvents={false}
        onShowGoogleEventsChange={() => {}}
        hasGoogleConnection={false}
      />

      {selectedAppointment && (
        <AppointmentDetailsModal
          appointment={selectedAppointment}
          onClose={() => setSelectedAppointment(null)}
          onStatusChange={handleStatusChange}
          onEdit={() => {
            setEditingAppointment(selectedAppointment);
            setSelectedAppointment(null);
            setIsEditModalOpen(true);
          }}
          canEdit={canEdit}
        />
      )}

      {isEditModalOpen && editingAppointment && calendars.length > 0 && (
        <EditAppointmentModal
          calendar={calendars.find((c) => c.id === editingAppointment.calendar_id) || calendars[0]}
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
