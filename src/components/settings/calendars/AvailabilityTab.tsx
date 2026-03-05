import { useState, useEffect } from 'react';
import { CalendarDays, Plus, Trash2, Copy, Clock, X, Check, Users, User } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { getCalendars } from '../../../services/calendars';
import {
  getAvailabilityRule,
  upsertAvailabilityRule,
  getDefaultSchedule,
  getCommonTimezones,
} from '../../../services/availabilityRules';
import type { Calendar, DaySchedule, DateOverride, TimeRange, AvailabilityRule } from '../../../types';
import { canManageAvailability } from '../../../utils/calendarPermissions';

const DAYS = [
  { key: 'monday' as const, label: 'Monday' },
  { key: 'tuesday' as const, label: 'Tuesday' },
  { key: 'wednesday' as const, label: 'Wednesday' },
  { key: 'thursday' as const, label: 'Thursday' },
  { key: 'friday' as const, label: 'Friday' },
  { key: 'saturday' as const, label: 'Saturday' },
  { key: 'sunday' as const, label: 'Sunday' },
];

const TIME_OPTIONS = generateTimeOptions();

function generateTimeOptions(): string[] {
  const options: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      options.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
    }
  }
  return options;
}

function formatTime(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

interface MemberScheduleSelector {
  userId: string | null;
  name: string;
}

export function AvailabilityTab() {
  const { user } = useAuth();
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [selectedCalendarId, setSelectedCalendarId] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rule, setRule] = useState<AvailabilityRule | null>(null);
  const [timezone, setTimezone] = useState('America/New_York');
  const [schedule, setSchedule] = useState<DaySchedule>(getDefaultSchedule());
  const [overrides, setOverrides] = useState<DateOverride[]>([]);
  const [showAddOverride, setShowAddOverride] = useState(false);
  const [newOverride, setNewOverride] = useState({ date: '', available: false, ranges: [] as TimeRange[] });
  const [hasChanges, setHasChanges] = useState(false);
  const [memberRuleStatus, setMemberRuleStatus] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadCalendars();
  }, [user]);

  useEffect(() => {
    if (selectedCalendarId) {
      const calendar = calendars.find((c) => c.id === selectedCalendarId);
      const isTeam = calendar?.type === 'team';
      if (!isTeam) {
        setSelectedMemberId(null);
      }
      loadAvailability(selectedCalendarId, isTeam ? selectedMemberId : null);
    }
  }, [selectedCalendarId, selectedMemberId]);

  useEffect(() => {
    if (selectedCalendarId) {
      checkMemberRuleStatuses();
    }
  }, [selectedCalendarId]);

  const loadCalendars = async () => {
    if (!user?.organization_id) return;

    try {
      setLoading(true);
      const calendarsData = await getCalendars(user.organization_id);
      const manageableCalendars = calendarsData.filter((cal) => canManageAvailability(user, cal));
      setCalendars(manageableCalendars);
      if (manageableCalendars.length > 0 && !selectedCalendarId) {
        setSelectedCalendarId(manageableCalendars[0].id);
      }
    } catch (error) {
      console.error('Failed to load calendars:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkMemberRuleStatuses = async () => {
    const calendar = calendars.find((c) => c.id === selectedCalendarId);
    if (!calendar?.members?.length) return;

    const statuses: Record<string, boolean> = {};
    for (const member of calendar.members) {
      const r = await getAvailabilityRule(selectedCalendarId, member.user_id);
      statuses[member.user_id] = !!r;
    }
    setMemberRuleStatus(statuses);
  };

  const loadAvailability = async (calendarId: string, userId: string | null) => {
    try {
      const ruleData = await getAvailabilityRule(calendarId, userId);
      if (ruleData) {
        setRule(ruleData);
        setTimezone(ruleData.timezone);
        setSchedule(ruleData.rules as DaySchedule);
        setOverrides((ruleData.overrides as DateOverride[]) || []);
      } else {
        setRule(null);
        setTimezone('America/New_York');
        setSchedule(getDefaultSchedule());
        setOverrides([]);
      }
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to load availability:', error);
    }
  };

  const handleDayToggle = (day: keyof DaySchedule) => {
    const currentRanges = schedule[day];
    setSchedule({
      ...schedule,
      [day]: currentRanges.length > 0 ? [] : [{ start: '09:00', end: '17:00' }],
    });
    setHasChanges(true);
  };

  const handleAddTimeRange = (day: keyof DaySchedule) => {
    const currentRanges = schedule[day];
    const lastRange = currentRanges[currentRanges.length - 1];
    const newStart = lastRange ? lastRange.end : '09:00';
    const newEnd = '17:00';

    setSchedule({
      ...schedule,
      [day]: [...currentRanges, { start: newStart, end: newEnd }],
    });
    setHasChanges(true);
  };

  const handleRemoveTimeRange = (day: keyof DaySchedule, index: number) => {
    setSchedule({
      ...schedule,
      [day]: schedule[day].filter((_, i) => i !== index),
    });
    setHasChanges(true);
  };

  const handleTimeChange = (
    day: keyof DaySchedule,
    index: number,
    field: 'start' | 'end',
    value: string
  ) => {
    setSchedule({
      ...schedule,
      [day]: schedule[day].map((range, i) =>
        i === index ? { ...range, [field]: value } : range
      ),
    });
    setHasChanges(true);
  };

  const handleCopyToWeekdays = () => {
    const mondaySchedule = schedule.monday;
    setSchedule({
      ...schedule,
      monday: mondaySchedule,
      tuesday: [...mondaySchedule],
      wednesday: [...mondaySchedule],
      thursday: [...mondaySchedule],
      friday: [...mondaySchedule],
    });
    setHasChanges(true);
  };

  const handleAddOverride = () => {
    if (!newOverride.date) return;

    const override: DateOverride = {
      date: newOverride.date,
      available: newOverride.available,
      ranges: newOverride.available ? newOverride.ranges : undefined,
    };

    setOverrides([...overrides.filter((o) => o.date !== override.date), override]);
    setNewOverride({ date: '', available: false, ranges: [] });
    setShowAddOverride(false);
    setHasChanges(true);
  };

  const handleRemoveOverride = (date: string) => {
    setOverrides(overrides.filter((o) => o.date !== date));
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!user || !selectedCalendarId) return;

    setSaving(true);
    try {
      await upsertAvailabilityRule(user.organization_id, {
        calendar_id: selectedCalendarId,
        user_id: selectedMemberId || null,
        timezone,
        rules: schedule,
        overrides,
      });
      setHasChanges(false);

      if (selectedMemberId) {
        setMemberRuleStatus((prev) => ({ ...prev, [selectedMemberId]: true }));
      }
    } catch (error) {
      console.error('Failed to save availability:', error);
    } finally {
      setSaving(false);
    }
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
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4">
          <CalendarDays className="w-8 h-8 text-slate-500" />
        </div>
        <h3 className="text-lg font-medium text-white mb-2">No calendars to manage</h3>
        <p className="text-slate-400 max-w-md">
          You don't have permission to manage availability for any calendars.
        </p>
      </div>
    );
  }

  const selectedCalendar = calendars.find((c) => c.id === selectedCalendarId);
  const isTeamCalendar = selectedCalendar?.type === 'team';
  const isCollective = selectedCalendar?.settings?.assignment_mode === 'collective';
  const members = selectedCalendar?.members || [];

  const memberScheduleOptions: MemberScheduleSelector[] = [
    { userId: null, name: isCollective ? 'Default (fallback schedule)' : 'Calendar Schedule' },
    ...members.map((m) => ({
      userId: m.user_id,
      name: m.user?.name || `Member ${m.user_id.slice(0, 6)}`,
    })),
  ];

  const scheduleSectionTitle = selectedMemberId
    ? `${memberScheduleOptions.find((o) => o.userId === selectedMemberId)?.name || 'Member'} Schedule`
    : isTeamCalendar
    ? isCollective
      ? 'Default Schedule (fallback if no individual schedule set)'
      : 'Team Schedule'
    : 'Weekly Schedule';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={selectedCalendarId}
            onChange={(e) => {
              setSelectedCalendarId(e.target.value);
              setSelectedMemberId(null);
            }}
            className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
          >
            {calendars.map((cal) => (
              <option key={cal.id} value={cal.id}>
                {cal.name}
              </option>
            ))}
          </select>

          {selectedCalendar && (
            <span className="text-sm text-slate-400 flex items-center gap-1">
              {selectedCalendar.type === 'user' ? (
                <><User className="w-3.5 h-3.5" /> User Calendar</>
              ) : (
                <><Users className="w-3.5 h-3.5" /> Team Calendar{isCollective ? ' · Collective' : ''}</>
              )}
            </span>
          )}
        </div>

        {hasChanges && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-teal-500 text-white rounded-lg font-medium hover:from-cyan-600 hover:to-teal-600 transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Save Changes
              </>
            )}
          </button>
        )}
      </div>

      {isTeamCalendar && members.length > 0 && (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-slate-400" />
            <h3 className="text-sm font-medium text-white">
              {isCollective ? 'Per-Member Schedules' : 'Member Schedules'}
            </h3>
            {isCollective && (
              <span className="text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-full ml-auto">
                Availability is intersected — all must be free
              </span>
            )}
          </div>

          <p className="text-xs text-slate-400 mb-3">
            {isCollective
              ? 'Set individual schedules for each member. A booking slot only appears when every active member is available.'
              : 'Optionally set per-member schedules. Members without individual schedules use the team calendar schedule.'}
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedMemberId(null)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all border ${
                selectedMemberId === null
                  ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400'
                  : 'bg-slate-700 border-slate-600 text-slate-300 hover:border-slate-500'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              {isCollective ? 'Default' : 'Team Default'}
            </button>

            {members.map((member) => {
              const hasRule = memberRuleStatus[member.user_id];
              const isSelected = selectedMemberId === member.user_id;
              return (
                <button
                  key={member.user_id}
                  onClick={() => setSelectedMemberId(member.user_id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all border ${
                    isSelected
                      ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400'
                      : 'bg-slate-700 border-slate-600 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  <div className="w-5 h-5 rounded-full bg-slate-500 flex items-center justify-center text-xs text-white shrink-0">
                    {(member.user?.name || 'U').charAt(0).toUpperCase()}
                  </div>
                  <span>{member.user?.name || 'Member'}</span>
                  {hasRule && !isSelected && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-medium">{scheduleSectionTitle}</h3>
              <div className="flex items-center gap-3">
                <select
                  value={timezone}
                  onChange={(e) => {
                    setTimezone(e.target.value);
                    setHasChanges(true);
                  }}
                  className="px-3 py-1.5 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                >
                  {getCommonTimezones().map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleCopyToWeekdays}
                  className="text-cyan-400 hover:text-cyan-300 text-sm flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" />
                  Copy Mon to Weekdays
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {DAYS.map((day) => {
                const dayRanges = schedule[day.key];
                const isAvailable = dayRanges.length > 0;

                return (
                  <div key={day.key} className="flex items-start gap-4 py-2 border-b border-slate-700/50 last:border-0">
                    <div className="w-24 pt-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isAvailable}
                          onChange={() => handleDayToggle(day.key)}
                          className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-cyan-500 focus:ring-cyan-500"
                        />
                        <span className={`text-sm font-medium ${isAvailable ? 'text-white' : 'text-slate-500'}`}>
                          {day.label}
                        </span>
                      </label>
                    </div>

                    <div className="flex-1">
                      {!isAvailable ? (
                        <span className="text-slate-500 text-sm pt-2 block">Unavailable</span>
                      ) : (
                        <div className="space-y-2">
                          {dayRanges.map((range, index) => (
                            <div key={index} className="flex items-center gap-2">
                              <select
                                value={range.start}
                                onChange={(e) => handleTimeChange(day.key, index, 'start', e.target.value)}
                                className="px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                              >
                                {TIME_OPTIONS.map((time) => (
                                  <option key={time} value={time}>
                                    {formatTime(time)}
                                  </option>
                                ))}
                              </select>
                              <span className="text-slate-400">to</span>
                              <select
                                value={range.end}
                                onChange={(e) => handleTimeChange(day.key, index, 'end', e.target.value)}
                                className="px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                              >
                                {TIME_OPTIONS.map((time) => (
                                  <option key={time} value={time}>
                                    {formatTime(time)}
                                  </option>
                                ))}
                              </select>
                              <button
                                onClick={() => handleRemoveTimeRange(day.key, index)}
                                className="p-1 text-slate-400 hover:text-red-400"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                          <button
                            onClick={() => handleAddTimeRange(day.key)}
                            className="text-cyan-400 hover:text-cyan-300 text-sm flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" />
                            Add hours
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-medium">Date Overrides</h3>
              <button
                onClick={() => setShowAddOverride(true)}
                className="text-cyan-400 hover:text-cyan-300 text-sm flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>

            {overrides.length === 0 ? (
              <p className="text-slate-500 text-sm">No date overrides configured</p>
            ) : (
              <div className="space-y-2">
                {overrides
                  .sort((a, b) => a.date.localeCompare(b.date))
                  .map((override) => (
                    <div
                      key={override.date}
                      className="flex items-center justify-between p-2 bg-slate-700/50 rounded"
                    >
                      <div>
                        <span className="text-white text-sm">
                          {new Date(override.date + 'T00:00:00').toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                        <span
                          className={`ml-2 text-xs px-1.5 py-0.5 rounded ${
                            override.available
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-red-500/20 text-red-400'
                          }`}
                        >
                          {override.available ? 'Custom Hours' : 'Closed'}
                        </span>
                      </div>
                      <button
                        onClick={() => handleRemoveOverride(override.date)}
                        className="p-1 text-slate-400 hover:text-red-400"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {!hasChanges && (
            <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4">
              <p className="text-xs text-slate-500">
                {isTeamCalendar && isCollective
                  ? 'For collective calendars, set individual schedules per member. Slots appear only when all active members are free simultaneously.'
                  : isTeamCalendar
                  ? 'Members without individual schedules inherit this team schedule.'
                  : 'Changes are applied immediately after saving.'}
              </p>
            </div>
          )}
        </div>
      </div>

      {showAddOverride && (
        <>
          <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setShowAddOverride(false)} />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <div
              className="bg-slate-900 rounded-xl border border-slate-700 w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
                <h2 className="text-lg font-semibold text-white">Add Date Override</h2>
                <button
                  onClick={() => setShowAddOverride(false)}
                  className="p-1 text-slate-400 hover:text-white rounded"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Date</label>
                  <input
                    type="date"
                    value={newOverride.date}
                    onChange={(e) => setNewOverride({ ...newOverride, date: e.target.value })}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Type</label>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setNewOverride({ ...newOverride, available: false, ranges: [] })}
                      className={`flex-1 p-3 rounded-lg border-2 transition-all ${
                        !newOverride.available
                          ? 'border-red-500 bg-red-500/10'
                          : 'border-slate-700 bg-slate-800'
                      }`}
                    >
                      <X className={`w-5 h-5 mx-auto mb-1 ${!newOverride.available ? 'text-red-400' : 'text-slate-400'}`} />
                      <span className={`text-sm ${!newOverride.available ? 'text-red-400' : 'text-slate-400'}`}>
                        Closed
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setNewOverride({
                          ...newOverride,
                          available: true,
                          ranges: [{ start: '09:00', end: '17:00' }],
                        })
                      }
                      className={`flex-1 p-3 rounded-lg border-2 transition-all ${
                        newOverride.available
                          ? 'border-cyan-500 bg-cyan-500/10'
                          : 'border-slate-700 bg-slate-800'
                      }`}
                    >
                      <Clock className={`w-5 h-5 mx-auto mb-1 ${newOverride.available ? 'text-cyan-400' : 'text-slate-400'}`} />
                      <span className={`text-sm ${newOverride.available ? 'text-cyan-400' : 'text-slate-400'}`}>
                        Custom Hours
                      </span>
                    </button>
                  </div>
                </div>

                {newOverride.available && (
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Hours</label>
                    {newOverride.ranges.map((range, index) => (
                      <div key={index} className="flex items-center gap-2 mb-2">
                        <select
                          value={range.start}
                          onChange={(e) => {
                            const newRanges = [...newOverride.ranges];
                            newRanges[index] = { ...newRanges[index], start: e.target.value };
                            setNewOverride({ ...newOverride, ranges: newRanges });
                          }}
                          className="flex-1 px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                        >
                          {TIME_OPTIONS.map((time) => (
                            <option key={time} value={time}>
                              {formatTime(time)}
                            </option>
                          ))}
                        </select>
                        <span className="text-slate-400">to</span>
                        <select
                          value={range.end}
                          onChange={(e) => {
                            const newRanges = [...newOverride.ranges];
                            newRanges[index] = { ...newRanges[index], end: e.target.value };
                            setNewOverride({ ...newOverride, ranges: newRanges });
                          }}
                          className="flex-1 px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                        >
                          {TIME_OPTIONS.map((time) => (
                            <option key={time} value={time}>
                              {formatTime(time)}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="px-6 py-4 border-t border-slate-700 flex justify-end gap-3">
                <button
                  onClick={() => setShowAddOverride(false)}
                  className="px-4 py-2 text-slate-300 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddOverride}
                  disabled={!newOverride.date}
                  className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-teal-500 text-white rounded-lg font-medium hover:from-cyan-600 hover:to-teal-600 transition-all disabled:opacity-50"
                >
                  Add Override
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
