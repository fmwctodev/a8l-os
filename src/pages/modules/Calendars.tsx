import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getCalendars, deleteCalendar } from '../../services/calendars';
import { getDepartments } from '../../services/departments';
import { getUsers } from '../../services/users';
import type { Calendar, CalendarFilters, Department, User } from '../../types';
import {
  Search,
  Plus,
  Loader2,
  AlertCircle,
  Calendar as CalendarIcon,
  Users,
  User as UserIcon,
  Clock,
  Link as LinkIcon,
  MoreVertical,
  Trash2,
  Settings,
  Check,
} from 'lucide-react';
import { CreateCalendarModal } from '../../components/calendars/CreateCalendarModal';

export function Calendars() {
  const { user: currentUser, hasPermission } = useAuth();
  const navigate = useNavigate();
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'user' | 'team'>('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  const canManage = hasPermission('calendars.manage');

  const loadData = useCallback(async () => {
    if (!currentUser?.organization_id) return;

    try {
      setIsLoading(true);
      setError(null);

      const filters: CalendarFilters = {
        search: searchQuery || undefined,
        type: typeFilter === 'all' ? undefined : typeFilter,
      };

      const [calendarsData, departmentsData, usersData] = await Promise.all([
        getCalendars(currentUser.organization_id, filters),
        getDepartments(currentUser.organization_id),
        getUsers(),
      ]);

      setCalendars(calendarsData);
      setDepartments(departmentsData);
      setUsers(usersData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load calendars');
    } finally {
      setIsLoading(false);
    }
  }, [currentUser?.organization_id, searchQuery, typeFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDelete = async (calendarId: string) => {
    if (!currentUser) return;
    if (!confirm('Are you sure you want to delete this calendar? All appointments will be removed.')) {
      return;
    }

    try {
      await deleteCalendar(calendarId, currentUser);
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete calendar');
    }
  };

  const copyBookingLink = (calendar: Calendar) => {
    const firstType = calendar.appointment_types?.[0];
    if (!firstType) return;

    const baseUrl = window.location.origin;
    const link = `${baseUrl}/book/${calendar.slug}/${firstType.slug}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(calendar.id);
    setTimeout(() => setCopiedLink(null), 2000);
  };

  const filteredCalendars = calendars.filter((cal) => {
    if (searchQuery) {
      const search = searchQuery.toLowerCase();
      if (!cal.name.toLowerCase().includes(search)) {
        return false;
      }
    }
    return true;
  });

  const userCalendars = filteredCalendars.filter((c) => c.type === 'user');
  const teamCalendars = filteredCalendars.filter((c) => c.type === 'team');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
        <p className="text-white font-medium">Error loading calendars</p>
        <p className="text-slate-400 text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Calendars</h1>
          <p className="text-slate-400 mt-1">
            Manage booking calendars and appointment types
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-600 text-white font-medium hover:from-cyan-600 hover:to-teal-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Calendar
          </button>
        )}
      </div>

      <div className="bg-slate-900 rounded-xl border border-slate-800">
        <div className="p-4 border-b border-slate-800">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search calendars..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              />
            </div>
            <div className="flex items-center bg-slate-800 rounded-lg border border-slate-700 p-1">
              <button
                onClick={() => setTypeFilter('all')}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  typeFilter === 'all'
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setTypeFilter('user')}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  typeFilter === 'user'
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <UserIcon className="w-4 h-4 inline mr-1" />
                User
              </button>
              <button
                onClick={() => setTypeFilter('team')}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  typeFilter === 'team'
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Users className="w-4 h-4 inline mr-1" />
                Team
              </button>
            </div>
          </div>
        </div>

        {filteredCalendars.length === 0 ? (
          <div className="p-12 text-center">
            <CalendarIcon className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-white font-medium mb-1">No calendars found</p>
            <p className="text-slate-400 text-sm mb-6">
              {searchQuery
                ? 'Try adjusting your search'
                : 'Get started by creating your first calendar'}
            </p>
            {canManage && !searchQuery && (
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-600 text-white font-medium hover:from-cyan-600 hover:to-teal-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Create Calendar
              </button>
            )}
          </div>
        ) : (
          <div className="p-4 space-y-8">
            {(typeFilter === 'all' || typeFilter === 'user') && userCalendars.length > 0 && (
              <div>
                <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <UserIcon className="w-4 h-4" />
                  User Calendars
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {userCalendars.map((calendar) => (
                    <CalendarCard
                      key={calendar.id}
                      calendar={calendar}
                      onNavigate={() => navigate(`/calendars/${calendar.id}`)}
                      onDelete={() => handleDelete(calendar.id)}
                      onCopyLink={() => copyBookingLink(calendar)}
                      canManage={canManage}
                      menuOpenId={menuOpenId}
                      setMenuOpenId={setMenuOpenId}
                      copiedLink={copiedLink}
                    />
                  ))}
                </div>
              </div>
            )}

            {(typeFilter === 'all' || typeFilter === 'team') && teamCalendars.length > 0 && (
              <div>
                <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Team Calendars
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {teamCalendars.map((calendar) => (
                    <CalendarCard
                      key={calendar.id}
                      calendar={calendar}
                      onNavigate={() => navigate(`/calendars/${calendar.id}`)}
                      onDelete={() => handleDelete(calendar.id)}
                      onCopyLink={() => copyBookingLink(calendar)}
                      canManage={canManage}
                      menuOpenId={menuOpenId}
                      setMenuOpenId={setMenuOpenId}
                      copiedLink={copiedLink}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {isCreateModalOpen && (
        <CreateCalendarModal
          departments={departments}
          users={users}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={() => {
            setIsCreateModalOpen(false);
            loadData();
          }}
        />
      )}
    </div>
  );
}

interface CalendarCardProps {
  calendar: Calendar;
  onNavigate: () => void;
  onDelete: () => void;
  onCopyLink: () => void;
  canManage: boolean;
  menuOpenId: string | null;
  setMenuOpenId: (id: string | null) => void;
  copiedLink: string | null;
}

function CalendarCard({
  calendar,
  onNavigate,
  onDelete,
  onCopyLink,
  canManage,
  menuOpenId,
  setMenuOpenId,
  copiedLink,
}: CalendarCardProps) {
  const isMenuOpen = menuOpenId === calendar.id;
  const appointmentTypeCount = calendar.appointment_types?.length || 0;
  const memberCount = calendar.members?.length || 0;

  return (
    <div
      className="bg-slate-800/50 rounded-lg border border-slate-700 hover:border-slate-600 transition-colors cursor-pointer group"
      onClick={onNavigate}
    >
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                calendar.type === 'user'
                  ? 'bg-cyan-500/20 text-cyan-400'
                  : 'bg-teal-500/20 text-teal-400'
              }`}
            >
              {calendar.type === 'user' ? (
                <UserIcon className="w-5 h-5" />
              ) : (
                <Users className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 className="font-medium text-white group-hover:text-cyan-400 transition-colors">
                {calendar.name}
              </h3>
              <p className="text-xs text-slate-400">
                {calendar.type === 'user'
                  ? calendar.owner?.name || 'No owner'
                  : `${memberCount} member${memberCount !== 1 ? 's' : ''}`}
              </p>
            </div>
          </div>
          {canManage && (
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setMenuOpenId(isMenuOpen ? null : calendar.id)}
                className="p-1.5 rounded-lg hover:bg-slate-700 transition-colors opacity-0 group-hover:opacity-100"
              >
                <MoreVertical className="w-4 h-4 text-slate-400" />
              </button>
              {isMenuOpen && (
                <div className="absolute right-0 top-8 w-44 bg-slate-800 rounded-lg border border-slate-700 shadow-xl z-10">
                  <button
                    onClick={() => {
                      setMenuOpenId(null);
                      onNavigate();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors"
                  >
                    <Settings className="w-4 h-4" />
                    Manage
                  </button>
                  <button
                    onClick={() => {
                      setMenuOpenId(null);
                      onCopyLink();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors"
                  >
                    <LinkIcon className="w-4 h-4" />
                    Copy Booking Link
                  </button>
                  <button
                    onClick={() => {
                      setMenuOpenId(null);
                      onDelete();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-slate-700 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {appointmentTypeCount} type{appointmentTypeCount !== 1 ? 's' : ''}
          </span>
          {calendar.department && (
            <span className="truncate">{calendar.department.name}</span>
          )}
        </div>

        {calendar.appointment_types && calendar.appointment_types.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-700">
            <div className="flex flex-wrap gap-1.5">
              {calendar.appointment_types.slice(0, 3).map((type) => (
                <span
                  key={type.id}
                  className={`inline-flex items-center px-2 py-1 rounded text-xs ${
                    type.active
                      ? 'bg-slate-700 text-slate-300'
                      : 'bg-slate-700/50 text-slate-500'
                  }`}
                >
                  {type.name}
                  <span className="ml-1.5 text-slate-500">{type.duration_minutes}m</span>
                </span>
              ))}
              {calendar.appointment_types.length > 3 && (
                <span className="text-xs text-slate-500">
                  +{calendar.appointment_types.length - 3} more
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {copiedLink === calendar.id && (
        <div className="px-4 py-2 bg-cyan-500/10 border-t border-cyan-500/20 flex items-center gap-2 text-xs text-cyan-400">
          <Check className="w-3.5 h-3.5" />
          Link copied to clipboard
        </div>
      )}
    </div>
  );
}
