import { useState, useEffect, useRef } from 'react';
import { Plus, Search, User, Users, MoreVertical, CreditCard as Edit2, Share2, Trash2, ToggleLeft, ToggleRight, Calendar, Check, X } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { getCalendars, enableCalendar, disableCalendar } from '../../../services/calendars';
import { getDepartments } from '../../../services/departments';
import { getUsers } from '../../../services/users';
import type { Calendar as CalendarType, Department, User as UserType, CalendarFilters } from '../../../types';
import { canManageCalendar, canDeleteCalendar } from '../../../utils/calendarPermissions';
import { CalendarDrawer } from './CalendarDrawer';
import { DeleteCalendarModal } from './DeleteCalendarModal';
import { ShareCalendarModal } from './ShareCalendarModal';

export function CalendarsTab() {
  const { user } = useAuth();
  const [calendars, setCalendars] = useState<CalendarType[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<CalendarFilters & { ownerId?: string; connectionStatus?: string }>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingCalendar, setEditingCalendar] = useState<CalendarType | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingCalendar, setDeletingCalendar] = useState<CalendarType | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [sharingCalendar, setSharingCalendar] = useState<CalendarType | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; right: number } | null>(null);
  const menuButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const userRole = user?.role?.name;
  const canToggleStatus = userRole === 'SuperAdmin' || userRole === 'Admin';

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user?.organization_id) return;

    try {
      setLoading(true);
      const [calendarsData, departmentsData, usersData] = await Promise.all([
        getCalendars(user.organization_id),
        getDepartments(user.organization_id),
        getUsers(user.organization_id),
      ]);
      setCalendars(calendarsData);
      setDepartments(departmentsData);
      setUsers(usersData);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCalendars = calendars.filter((calendar) => {
    if (searchQuery && !calendar.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (filters.type && calendar.type !== filters.type) {
      return false;
    }
    if (filters.departmentId && calendar.department_id !== filters.departmentId) {
      return false;
    }
    if (filters.ownerId && calendar.owner_user_id !== filters.ownerId) {
      return false;
    }
    return true;
  });

  const handleCreateCalendar = () => {
    setEditingCalendar(null);
    setDrawerOpen(true);
  };

  const handleEditCalendar = (calendar: CalendarType) => {
    setEditingCalendar(calendar);
    setDrawerOpen(true);
    setActiveMenu(null);
  };

  const handleDeleteCalendar = (calendar: CalendarType) => {
    setDeletingCalendar(calendar);
    setDeleteModalOpen(true);
    setActiveMenu(null);
  };

  const handleShareCalendar = (calendar: CalendarType) => {
    setSharingCalendar(calendar);
    setShareModalOpen(true);
    setActiveMenu(null);
  };

  const handleToggleStatus = async (calendar: CalendarType) => {
    if (!user || !canToggleStatus) return;

    const isActive = (calendar as CalendarType & { active?: boolean }).active !== false;
    setTogglingId(calendar.id);
    setActiveMenu(null);

    try {
      if (isActive) {
        await disableCalendar(calendar.id, user);
      } else {
        await enableCalendar(calendar.id, user);
      }
      await loadData();
    } catch (error) {
      console.error('Failed to toggle calendar status:', error);
    } finally {
      setTogglingId(null);
    }
  };

  const handleDrawerClose = () => {
    setDrawerOpen(false);
    setEditingCalendar(null);
  };

  const handleDrawerSave = () => {
    loadData();
    handleDrawerClose();
  };

  const handleDeleteConfirm = () => {
    loadData();
    setDeleteModalOpen(false);
    setDeletingCalendar(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (calendars.length === 0) {
    return (
      <>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4">
            <Calendar className="w-8 h-8 text-slate-500" />
          </div>
          <h3 className="text-lg font-medium text-white mb-2">No calendars yet</h3>
          <p className="text-slate-400 mb-6 max-w-md">
            Create your first calendar to start accepting bookings from clients and customers.
          </p>
          <button
            onClick={handleCreateCalendar}
            className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-teal-500 text-white rounded-lg font-medium hover:from-cyan-600 hover:to-teal-600 transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create Calendar
          </button>
        </div>

        <CalendarDrawer
          open={drawerOpen}
          onClose={handleDrawerClose}
          onSave={handleDrawerSave}
          calendar={editingCalendar}
          departments={departments}
          users={users}
        />
      </>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="flex flex-wrap gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search calendars..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent w-64"
              />
            </div>

            <select
              value={filters.type || ''}
              onChange={(e) => setFilters({ ...filters, type: e.target.value as CalendarType['type'] || undefined })}
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="">All Types</option>
              <option value="user">User</option>
              <option value="team">Team</option>
            </select>

            <select
              value={filters.departmentId || ''}
              onChange={(e) => setFilters({ ...filters, departmentId: e.target.value || undefined })}
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="">All Departments</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleCreateCalendar}
            className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-teal-500 text-white rounded-lg font-medium hover:from-cyan-600 hover:to-teal-600 transition-all flex items-center gap-2 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Create Calendar
          </button>
        </div>

        <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left px-4 py-3 text-slate-400 font-medium text-sm">Name</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium text-sm">Type</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium text-sm">Department</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium text-sm">Owner/Members</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium text-sm">Status</th>
                <th className="text-right px-4 py-3 text-slate-400 font-medium text-sm">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCalendars.map((calendar) => {
                const canManage = canManageCalendar(user, calendar);
                const canDelete = canDeleteCalendar(user, calendar);

                return (
                  <tr key={calendar.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            calendar.type === 'user'
                              ? 'bg-blue-500/20 text-blue-400'
                              : 'bg-emerald-500/20 text-emerald-400'
                          }`}
                        >
                          {calendar.type === 'user' ? (
                            <User className="w-4 h-4" />
                          ) : (
                            <Users className="w-4 h-4" />
                          )}
                        </div>
                        <span className="text-white font-medium">{calendar.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <span
                          className={`inline-flex px-2 py-1 rounded text-xs font-medium w-fit ${
                            calendar.type === 'user'
                              ? 'bg-blue-500/20 text-blue-400'
                              : 'bg-emerald-500/20 text-emerald-400'
                          }`}
                        >
                          {calendar.type === 'user' ? 'User' : 'Team'}
                        </span>
                        {calendar.type === 'team' && calendar.settings?.assignment_mode && (
                          <span className="inline-flex px-1.5 py-0.5 rounded text-xs font-medium w-fit bg-slate-700 text-slate-400">
                            {calendar.settings.assignment_mode === 'round_robin' ? 'Round Robin' :
                             calendar.settings.assignment_mode === 'priority' ? 'Priority' :
                             calendar.settings.assignment_mode === 'collective' ? 'Collective' : ''}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {calendar.department?.name || '-'}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {calendar.type === 'user'
                        ? calendar.owner?.name || '-'
                        : `${calendar.members?.length || 0} members`}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                          (calendar as CalendarType & { active?: boolean }).active !== false
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-slate-500/20 text-slate-400'
                        }`}
                      >
                        {(calendar as CalendarType & { active?: boolean }).active !== false ? (
                          <>
                            <Check className="w-3 h-3" />
                            Active
                          </>
                        ) : (
                          <>
                            <X className="w-3 h-3" />
                            Disabled
                          </>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <div className="relative">
                          <button
                            ref={(el) => { menuButtonRefs.current[calendar.id] = el; }}
                            onClick={() => {
                              if (activeMenu === calendar.id) {
                                setActiveMenu(null);
                                setMenuPosition(null);
                              } else {
                                const btn = menuButtonRefs.current[calendar.id];
                                if (btn) {
                                  const rect = btn.getBoundingClientRect();
                                  setMenuPosition({
                                    top: rect.bottom + window.scrollY + 4,
                                    right: window.innerWidth - rect.right,
                                  });
                                }
                                setActiveMenu(calendar.id);
                              }
                            }}
                            className="p-1 text-slate-400 hover:text-white rounded"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {activeMenu === calendar.id && menuPosition && (
                            <>
                              <div
                                className="fixed inset-0 z-40"
                                onClick={() => { setActiveMenu(null); setMenuPosition(null); }}
                              />
                              <div
                                className="fixed w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 py-1"
                                style={{ top: menuPosition.top, right: menuPosition.right }}
                              >
                                {canManage && (
                                  <button
                                    onClick={() => handleEditCalendar(calendar)}
                                    className="w-full px-4 py-2 text-left text-slate-300 hover:bg-slate-700 flex items-center gap-2"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                    Edit
                                  </button>
                                )}
                                <button
                                  onClick={() => handleShareCalendar(calendar)}
                                  className="w-full px-4 py-2 text-left text-slate-300 hover:bg-slate-700 flex items-center gap-2"
                                >
                                  <Share2 className="w-4 h-4" />
                                  Share
                                </button>
                                {canToggleStatus && (
                                  <button
                                    onClick={() => handleToggleStatus(calendar)}
                                    disabled={togglingId === calendar.id}
                                    className="w-full px-4 py-2 text-left text-slate-300 hover:bg-slate-700 flex items-center gap-2 disabled:opacity-50"
                                  >
                                    {togglingId === calendar.id ? (
                                      <>
                                        <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                                        Updating...
                                      </>
                                    ) : (calendar as CalendarType & { active?: boolean }).active !== false ? (
                                      <>
                                        <ToggleLeft className="w-4 h-4" />
                                        Disable
                                      </>
                                    ) : (
                                      <>
                                        <ToggleRight className="w-4 h-4" />
                                        Enable
                                      </>
                                    )}
                                  </button>
                                )}
                                {canDelete && (
                                  <button
                                    onClick={() => handleDeleteCalendar(calendar)}
                                    className="w-full px-4 py-2 text-left text-red-400 hover:bg-slate-700 flex items-center gap-2"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                    Delete
                                  </button>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredCalendars.length === 0 && (
            <div className="text-center py-8 text-slate-400">
              No calendars match your filters
            </div>
          )}
        </div>
      </div>

      <CalendarDrawer
        open={drawerOpen}
        onClose={handleDrawerClose}
        onSave={handleDrawerSave}
        calendar={editingCalendar}
        departments={departments}
        users={users}
      />

      <DeleteCalendarModal
        open={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setDeletingCalendar(null);
        }}
        onConfirm={handleDeleteConfirm}
        calendar={deletingCalendar}
      />

      <ShareCalendarModal
        open={shareModalOpen}
        onClose={() => {
          setShareModalOpen(false);
          setSharingCalendar(null);
        }}
        calendarName={sharingCalendar?.name || ''}
        calendarSlug={sharingCalendar?.slug || ''}
      />
    </>
  );
}
