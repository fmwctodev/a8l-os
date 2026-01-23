import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Clock, Mail, Users } from 'lucide-react';
import type { ReportSchedule, ReportScheduleCadence, ReportScheduleRecipients, User } from '../../types';
import {
  scheduleCadenceOptions,
  weekdayOptions,
  commonTimezones,
} from '../../config/reportingFields';
import { createSchedule, updateSchedule, deleteSchedule } from '../../services/reportSchedules';
import { getUsers } from '../../services/users';
import { useAuth } from '../../contexts/AuthContext';

interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportId: string;
  reportName: string;
  organizationId: string;
  existingSchedule?: ReportSchedule | null;
  onSave: (schedule: ReportSchedule) => void;
  onDelete?: () => void;
}

export function ScheduleModal({
  isOpen,
  onClose,
  reportId,
  reportName,
  organizationId,
  existingSchedule,
  onSave,
  onDelete,
}: ScheduleModalProps) {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);

  const [cadence, setCadence] = useState<ReportScheduleCadence>(
    existingSchedule?.cadence || 'weekly'
  );
  const [dayOfWeek, setDayOfWeek] = useState<number>(
    existingSchedule?.day_of_week ?? 1
  );
  const [dayOfMonth, setDayOfMonth] = useState<number>(
    existingSchedule?.day_of_month ?? 1
  );
  const [timeOfDay, setTimeOfDay] = useState(
    existingSchedule?.time_of_day || '09:00'
  );
  const [timezone, setTimezone] = useState(
    existingSchedule?.timezone || 'America/New_York'
  );
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>(
    existingSchedule?.recipients.user_ids || []
  );
  const [externalEmails, setExternalEmails] = useState<string[]>(
    existingSchedule?.recipients.emails || []
  );
  const [newEmail, setNewEmail] = useState('');
  const [enabled, setEnabled] = useState(existingSchedule?.enabled ?? true);

  useEffect(() => {
    if (isOpen) {
      loadUsers();
    }
  }, [isOpen, organizationId]);

  const loadUsers = async () => {
    try {
      const data = await getUsers(organizationId);
      setUsers(data);
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  };

  const handleAddEmail = () => {
    const email = newEmail.trim().toLowerCase();
    if (email && email.includes('@') && !externalEmails.includes(email)) {
      setExternalEmails([...externalEmails, email]);
      setNewEmail('');
    }
  };

  const handleRemoveEmail = (email: string) => {
    setExternalEmails(externalEmails.filter((e) => e !== email));
  };

  const toggleUser = (userId: string) => {
    if (selectedUserIds.includes(userId)) {
      setSelectedUserIds(selectedUserIds.filter((id) => id !== userId));
    } else {
      setSelectedUserIds([...selectedUserIds, userId]);
    }
  };

  const handleSave = async () => {
    if (selectedUserIds.length === 0 && externalEmails.length === 0) {
      alert('Please add at least one recipient');
      return;
    }

    setIsLoading(true);
    try {
      const recipients: ReportScheduleRecipients = {
        user_ids: selectedUserIds,
        emails: externalEmails,
      };

      let schedule: ReportSchedule;

      if (existingSchedule) {
        schedule = await updateSchedule(existingSchedule.id, {
          cadence,
          day_of_week: cadence === 'weekly' ? dayOfWeek : null,
          day_of_month: cadence === 'monthly' ? dayOfMonth : null,
          time_of_day: timeOfDay,
          timezone,
          recipients,
          enabled,
        });
      } else {
        schedule = await createSchedule(organizationId, reportId, user!.id, {
          cadence,
          day_of_week: cadence === 'weekly' ? dayOfWeek : undefined,
          day_of_month: cadence === 'monthly' ? dayOfMonth : undefined,
          time_of_day: timeOfDay,
          timezone,
          recipients,
          enabled,
        });
      }

      onSave(schedule);
      onClose();
    } catch (err) {
      console.error('Failed to save schedule:', err);
      alert('Failed to save schedule');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!existingSchedule) return;

    if (!confirm('Are you sure you want to delete this schedule?')) return;

    setIsLoading(true);
    try {
      await deleteSchedule(existingSchedule.id);
      if (onDelete) onDelete();
      onClose();
    } catch (err) {
      console.error('Failed to delete schedule:', err);
      alert('Failed to delete schedule');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {existingSchedule ? 'Edit Schedule' : 'Schedule Report'}
            </h2>
            <p className="text-sm text-slate-500">{reportName}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)] space-y-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-slate-700">
              <Clock className="w-5 h-5" />
              <span className="font-medium">Frequency</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {scheduleCadenceOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setCadence(option.value)}
                  className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
                    cadence === option.value
                      ? 'border-sky-500 bg-sky-50 text-sky-700'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {cadence === 'weekly' && (
              <div>
                <label className="block text-sm text-slate-600 mb-1">Day of Week</label>
                <select
                  value={dayOfWeek}
                  onChange={(e) => setDayOfWeek(Number(e.target.value))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                >
                  {weekdayOptions.map((day) => (
                    <option key={day.value} value={day.value}>
                      {day.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {cadence === 'monthly' && (
              <div>
                <label className="block text-sm text-slate-600 mb-1">Day of Month</label>
                <select
                  value={dayOfMonth}
                  onChange={(e) => setDayOfMonth(Number(e.target.value))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                >
                  {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                    <option key={day} value={day}>
                      {day}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-600 mb-1">Time</label>
                <input
                  type="time"
                  value={timeOfDay}
                  onChange={(e) => setTimeOfDay(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">Timezone</label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                >
                  {commonTimezones.map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-6 space-y-4">
            <div className="flex items-center gap-2 text-slate-700">
              <Users className="w-5 h-5" />
              <span className="font-medium">Recipients</span>
            </div>

            <div>
              <label className="block text-sm text-slate-600 mb-2">Team Members</label>
              <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                {users.map((u) => (
                  <label
                    key={u.id}
                    className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedUserIds.includes(u.id)}
                      onChange={() => toggleUser(u.id)}
                      className="w-4 h-4 text-sky-500 rounded border-slate-300"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-700 truncate">
                        {u.name}
                      </div>
                      <div className="text-xs text-slate-400 truncate">{u.email}</div>
                    </div>
                  </label>
                ))}
                {users.length === 0 && (
                  <div className="px-3 py-4 text-center text-sm text-slate-400">
                    No team members found
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm text-slate-600 mb-2">External Emails</label>
              <div className="flex gap-2 mb-2">
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddEmail()}
                  placeholder="email@example.com"
                  className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={handleAddEmail}
                  className="px-3 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              {externalEmails.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {externalEmails.map((email) => (
                    <span
                      key={email}
                      className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full text-sm"
                    >
                      <Mail className="w-3 h-3" />
                      {email}
                      <button
                        type="button"
                        onClick={() => handleRemoveEmail(email)}
                        className="text-slate-400 hover:text-red-500"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {existingSchedule && (
            <div className="border-t border-slate-200 pt-6">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  className="w-4 h-4 text-sky-500 rounded border-slate-300"
                />
                <span className="text-sm text-slate-700">Schedule is active</span>
              </label>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50">
          {existingSchedule ? (
            <button
              onClick={handleDelete}
              disabled={isLoading}
              className="text-sm text-red-600 hover:text-red-700"
            >
              Delete Schedule
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isLoading}
              className="px-4 py-2 bg-sky-500 text-white rounded-lg hover:bg-sky-600 text-sm font-medium disabled:opacity-50"
            >
              {isLoading ? 'Saving...' : existingSchedule ? 'Update Schedule' : 'Create Schedule'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
