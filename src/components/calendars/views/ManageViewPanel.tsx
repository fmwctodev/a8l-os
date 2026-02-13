import { useState } from 'react';
import { X, Search, ChevronDown, ChevronRight, Check, Calendar as CalendarIcon } from 'lucide-react';
import type { Calendar, User, CalendarViewFilter } from '../../../types';

interface ManageViewPanelProps {
  isOpen: boolean;
  onClose: () => void;
  viewFilter: CalendarViewFilter;
  onViewFilterChange: (filter: CalendarViewFilter) => void;
  users: User[];
  calendars: Calendar[];
  selectedUserIds: string[];
  selectedCalendarIds: string[];
  onUserSelectionChange: (userIds: string[]) => void;
  onCalendarSelectionChange: (calendarIds: string[]) => void;
  showGoogleEvents: boolean;
  onShowGoogleEventsChange: (show: boolean) => void;
  hasGoogleConnection: boolean;
}

const MAX_VISIBLE_ITEMS = 5;

const VIEW_FILTER_OPTIONS: { value: CalendarViewFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'appointments', label: 'Appointments' },
  { value: 'google_events', label: 'Google Events' },
  { value: 'blocked_slots', label: 'Blocked Slots' },
];

export function ManageViewPanel({
  isOpen,
  onClose,
  viewFilter,
  onViewFilterChange,
  users,
  calendars,
  selectedUserIds,
  selectedCalendarIds,
  onUserSelectionChange,
  onCalendarSelectionChange,
  showGoogleEvents,
  onShowGoogleEventsChange,
  hasGoogleConnection,
}: ManageViewPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [usersExpanded, setUsersExpanded] = useState(true);
  const [calendarsExpanded, setCalendarsExpanded] = useState(true);
  const [showAllUsers, setShowAllUsers] = useState(false);
  const [showAllCalendars, setShowAllCalendars] = useState(false);

  const filteredUsers = users.filter(
    (user) =>
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredCalendars = calendars.filter((calendar) =>
    calendar.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const visibleUsers = showAllUsers ? filteredUsers : filteredUsers.slice(0, MAX_VISIBLE_ITEMS);
  const visibleCalendars = showAllCalendars ? filteredCalendars : filteredCalendars.slice(0, MAX_VISIBLE_ITEMS);

  const hiddenUsersCount = filteredUsers.length - MAX_VISIBLE_ITEMS;
  const hiddenCalendarsCount = filteredCalendars.length - MAX_VISIBLE_ITEMS;

  const toggleUser = (userId: string) => {
    if (selectedUserIds.includes(userId)) {
      onUserSelectionChange(selectedUserIds.filter((id) => id !== userId));
    } else {
      onUserSelectionChange([...selectedUserIds, userId]);
    }
  };

  const toggleCalendar = (calendarId: string) => {
    if (selectedCalendarIds.includes(calendarId)) {
      onCalendarSelectionChange(selectedCalendarIds.filter((id) => id !== calendarId));
    } else {
      onCalendarSelectionChange([...selectedCalendarIds, calendarId]);
    }
  };

  const selectAllUsers = () => onUserSelectionChange(filteredUsers.map((u) => u.id));
  const clearAllUsers = () => onUserSelectionChange([]);
  const selectAllCalendars = () => onCalendarSelectionChange(filteredCalendars.map((c) => c.id));
  const clearAllCalendars = () => onCalendarSelectionChange([]);

  if (!isOpen) return null;

  return (
    <div className="w-80 border-l border-slate-700 bg-slate-900 flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
        <h3 className="font-semibold text-white">Manage View</h3>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5 text-slate-400" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4 border-b border-slate-800">
          <h4 className="text-sm font-medium text-slate-300 mb-3">View By Type</h4>
          <div className="space-y-2">
            {VIEW_FILTER_OPTIONS.map(({ value, label }) => (
              <label key={value} className="flex items-center gap-3 cursor-pointer group">
                <div
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                    viewFilter === value
                      ? 'border-cyan-500 bg-cyan-500'
                      : 'border-slate-500 group-hover:border-slate-400'
                  }`}
                  onClick={() => onViewFilterChange(value)}
                >
                  {viewFilter === value && (
                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                  )}
                </div>
                <span className="text-sm text-slate-300 group-hover:text-white transition-colors">
                  {label}
                </span>
              </label>
            ))}
          </div>
        </div>

        {hasGoogleConnection && (
          <div className="p-4 border-b border-slate-800">
            <h4 className="text-sm font-medium text-slate-300 mb-3">Google Calendar</h4>
            <label className="flex items-center justify-between cursor-pointer group">
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-teal-400" />
                <span className="text-sm text-slate-300 group-hover:text-white transition-colors">
                  Show Google Events
                </span>
              </div>
              <button
                onClick={() => onShowGoogleEventsChange(!showGoogleEvents)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  showGoogleEvents ? 'bg-teal-500' : 'bg-slate-600'
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                    showGoogleEvents ? 'translate-x-4.5' : 'translate-x-0.5'
                  }`}
                  style={{ transform: showGoogleEvents ? 'translateX(18px)' : 'translateX(2px)' }}
                />
              </button>
            </label>
          </div>
        )}

        <div className="p-4">
          <h4 className="text-sm font-medium text-slate-300 mb-3">Filters</h4>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search Users, Calendars or Groups"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            />
          </div>

          <div className="space-y-4">
            <div>
              <button
                onClick={() => setUsersExpanded(!usersExpanded)}
                className="flex items-center justify-between w-full py-2 text-left group"
              >
                <div className="flex items-center gap-2">
                  {usersExpanded ? (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  )}
                  <span className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors">
                    Users
                  </span>
                  {selectedUserIds.length > 0 && (
                    <span className="text-xs bg-cyan-500/20 text-cyan-400 px-1.5 py-0.5 rounded">
                      {selectedUserIds.length}
                    </span>
                  )}
                </div>
                {usersExpanded && (
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      onClick={(e) => { e.stopPropagation(); selectAllUsers(); }}
                      className="text-cyan-400 hover:text-cyan-300"
                    >
                      All
                    </button>
                    <span className="text-slate-600">|</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); clearAllUsers(); }}
                      className="text-slate-400 hover:text-slate-300"
                    >
                      None
                    </button>
                  </div>
                )}
              </button>
              {usersExpanded && (
                <div className="ml-6 space-y-1">
                  {visibleUsers.map((user) => (
                    <label
                      key={user.id}
                      className="flex items-center gap-3 py-1.5 cursor-pointer group"
                    >
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                          selectedUserIds.includes(user.id)
                            ? 'bg-cyan-500 border-cyan-500'
                            : 'border-slate-500 group-hover:border-slate-400'
                        }`}
                        onClick={() => toggleUser(user.id)}
                      >
                        {selectedUserIds.includes(user.id) && (
                          <Check className="w-3 h-3 text-white" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 min-w-0">
                        {user.avatar_url ? (
                          <img
                            src={user.avatar_url}
                            alt={user.name}
                            className="w-6 h-6 rounded-full"
                          />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center">
                            <span className="text-xs text-slate-400">
                              {user.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                        <span className="text-sm text-slate-300 truncate group-hover:text-white transition-colors">
                          {user.name}
                        </span>
                      </div>
                    </label>
                  ))}
                  {hiddenUsersCount > 0 && !showAllUsers && (
                    <button
                      onClick={() => setShowAllUsers(true)}
                      className="text-xs text-cyan-400 hover:text-cyan-300 py-1"
                    >
                      See More (+{hiddenUsersCount})
                    </button>
                  )}
                  {showAllUsers && filteredUsers.length > MAX_VISIBLE_ITEMS && (
                    <button
                      onClick={() => setShowAllUsers(false)}
                      className="text-xs text-slate-400 hover:text-slate-300 py-1"
                    >
                      Show Less
                    </button>
                  )}
                </div>
              )}
            </div>

            <div>
              <button
                onClick={() => setCalendarsExpanded(!calendarsExpanded)}
                className="flex items-center justify-between w-full py-2 text-left group"
              >
                <div className="flex items-center gap-2">
                  {calendarsExpanded ? (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  )}
                  <span className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors">
                    Calendars
                  </span>
                  {selectedCalendarIds.length > 0 && (
                    <span className="text-xs bg-cyan-500/20 text-cyan-400 px-1.5 py-0.5 rounded">
                      {selectedCalendarIds.length}
                    </span>
                  )}
                </div>
                {calendarsExpanded && (
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      onClick={(e) => { e.stopPropagation(); selectAllCalendars(); }}
                      className="text-cyan-400 hover:text-cyan-300"
                    >
                      All
                    </button>
                    <span className="text-slate-600">|</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); clearAllCalendars(); }}
                      className="text-slate-400 hover:text-slate-300"
                    >
                      None
                    </button>
                  </div>
                )}
              </button>
              {calendarsExpanded && (
                <div className="ml-6 space-y-1">
                  {visibleCalendars.map((calendar) => (
                    <label
                      key={calendar.id}
                      className="flex items-center gap-3 py-1.5 cursor-pointer group"
                    >
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                          selectedCalendarIds.includes(calendar.id)
                            ? 'bg-cyan-500 border-cyan-500'
                            : 'border-slate-500 group-hover:border-slate-400'
                        }`}
                        onClick={() => toggleCalendar(calendar.id)}
                      >
                        {selectedCalendarIds.includes(calendar.id) && (
                          <Check className="w-3 h-3 text-white" />
                        )}
                      </div>
                      <span className="text-sm text-slate-300 truncate group-hover:text-white transition-colors">
                        {calendar.name}
                      </span>
                    </label>
                  ))}
                  {hiddenCalendarsCount > 0 && !showAllCalendars && (
                    <button
                      onClick={() => setShowAllCalendars(true)}
                      className="text-xs text-cyan-400 hover:text-cyan-300 py-1"
                    >
                      See More (+{hiddenCalendarsCount})
                    </button>
                  )}
                  {showAllCalendars && filteredCalendars.length > MAX_VISIBLE_ITEMS && (
                    <button
                      onClick={() => setShowAllCalendars(false)}
                      className="text-xs text-slate-400 hover:text-slate-300 py-1"
                    >
                      Show Less
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
