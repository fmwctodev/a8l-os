import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { createCalendar, addCalendarMember, generateSlug } from '../../services/calendars';
import { createAvailabilityRule, getDefaultSchedule } from '../../services/availabilityRules';
import type { Department, User, CalendarType } from '../../types';
import { X, Users, User as UserIcon, ChevronRight, Loader2 } from 'lucide-react';

interface CreateCalendarModalProps {
  departments: Department[];
  users: User[];
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateCalendarModal({
  departments,
  users,
  onClose,
  onSuccess,
}: CreateCalendarModalProps) {
  const { user: currentUser } = useAuth();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [calendarType, setCalendarType] = useState<CalendarType | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [ownerUserId, setOwnerUserId] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<
    Array<{ userId: string; weight: number; priority: number }>
  >([]);

  const handleNameChange = (value: string) => {
    setName(value);
    setSlug(generateSlug(value));
  };

  const handleSelectType = (type: CalendarType) => {
    setCalendarType(type);
    setStep(2);
  };

  const handleAddMember = (userId: string) => {
    if (selectedMembers.some((m) => m.userId === userId)) return;
    setSelectedMembers([...selectedMembers, { userId, weight: 1, priority: 5 }]);
  };

  const handleRemoveMember = (userId: string) => {
    setSelectedMembers(selectedMembers.filter((m) => m.userId !== userId));
  };

  const handleUpdateMember = (
    userId: string,
    field: 'weight' | 'priority',
    value: number
  ) => {
    setSelectedMembers(
      selectedMembers.map((m) =>
        m.userId === userId ? { ...m, [field]: value } : m
      )
    );
  };

  const handleSubmit = async () => {
    if (!currentUser?.organization_id || !calendarType || !name || !slug) return;

    if (calendarType === 'user' && !ownerUserId) {
      setError('Please select an owner for this calendar');
      return;
    }

    if (calendarType === 'team' && selectedMembers.length === 0) {
      setError('Please add at least one team member');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const calendar = await createCalendar(
        currentUser.organization_id,
        {
          type: calendarType,
          name,
          slug,
          department_id: departmentId || null,
          owner_user_id: calendarType === 'user' ? ownerUserId : null,
        },
        currentUser
      );

      if (calendarType === 'team') {
        for (const member of selectedMembers) {
          await addCalendarMember(calendar.id, member.userId, {
            weight: member.weight,
            priority: member.priority,
          });
        }
      }

      await createAvailabilityRule(currentUser.organization_id, {
        calendar_id: calendar.id,
        timezone: 'America/New_York',
        rules: getDefaultSchedule(),
      });

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create calendar');
    } finally {
      setIsLoading(false);
    }
  };

  const activeUsers = users.filter((u) => u.status === 'active');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-slate-900 rounded-xl border border-slate-800 w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <h2 className="text-lg font-semibold text-white">Create Calendar</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="p-4">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <p className="text-slate-400 text-sm">
                Choose the type of calendar you want to create
              </p>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => handleSelectType('user')}
                  className="p-4 rounded-lg border border-slate-700 hover:border-cyan-500 hover:bg-cyan-500/5 transition-colors text-left group"
                >
                  <div className="w-10 h-10 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center mb-3 group-hover:bg-cyan-500/30">
                    <UserIcon className="w-5 h-5" />
                  </div>
                  <h3 className="font-medium text-white mb-1">User Calendar</h3>
                  <p className="text-xs text-slate-400">
                    Personal calendar for one user with their availability
                  </p>
                </button>
                <button
                  onClick={() => handleSelectType('team')}
                  className="p-4 rounded-lg border border-slate-700 hover:border-teal-500 hover:bg-teal-500/5 transition-colors text-left group"
                >
                  <div className="w-10 h-10 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center mb-3 group-hover:bg-teal-500/30">
                    <Users className="w-5 h-5" />
                  </div>
                  <h3 className="font-medium text-white mb-1">Team Calendar</h3>
                  <p className="text-xs text-slate-400">
                    Round-robin or priority assignment across team members
                  </p>
                </button>
              </div>
            </div>
          )}

          {step === 2 && calendarType === 'user' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Calendar Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g., John's Calendar"
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Booking URL Slug
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 text-sm">/book/</span>
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    className="flex-1 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Calendar Owner *
                </label>
                <select
                  value={ownerUserId}
                  onChange={(e) => setOwnerUserId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                >
                  <option value="">Select owner</option>
                  {activeUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name} ({user.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Department (optional)
                </label>
                <select
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                >
                  <option value="">No department</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {step === 2 && calendarType === 'team' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Calendar Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g., Sales Team"
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Booking URL Slug
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 text-sm">/book/</span>
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    className="flex-1 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Department (optional)
                </label>
                <select
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                >
                  <option value="">No department</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Add Team Members *
                </label>
                <select
                  value=""
                  onChange={(e) => handleAddMember(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                >
                  <option value="">Select member to add</option>
                  {activeUsers
                    .filter((u) => !selectedMembers.some((m) => m.userId === u.id))
                    .map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name}
                      </option>
                    ))}
                </select>
              </div>

              {selectedMembers.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-slate-400">
                    Set weight (for round-robin) and priority (for priority assignment)
                  </p>
                  {selectedMembers.map((member) => {
                    const user = users.find((u) => u.id === member.userId);
                    return (
                      <div
                        key={member.userId}
                        className="flex items-center gap-3 p-3 rounded-lg bg-slate-800 border border-slate-700"
                      >
                        <div className="flex-1">
                          <p className="text-sm text-white">{user?.name}</p>
                          <p className="text-xs text-slate-400">{user?.email}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div>
                            <label className="text-xs text-slate-400">Weight</label>
                            <input
                              type="number"
                              min="1"
                              max="10"
                              value={member.weight}
                              onChange={(e) =>
                                handleUpdateMember(
                                  member.userId,
                                  'weight',
                                  parseInt(e.target.value) || 1
                                )
                              }
                              className="w-14 px-2 py-1 rounded bg-slate-700 border border-slate-600 text-white text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-slate-400">Priority</label>
                            <input
                              type="number"
                              min="1"
                              max="10"
                              value={member.priority}
                              onChange={(e) =>
                                handleUpdateMember(
                                  member.userId,
                                  'priority',
                                  parseInt(e.target.value) || 5
                                )
                              }
                              className="w-14 px-2 py-1 rounded bg-slate-700 border border-slate-600 text-white text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                            />
                          </div>
                          <button
                            onClick={() => handleRemoveMember(member.userId)}
                            className="p-1 rounded hover:bg-slate-700 transition-colors"
                          >
                            <X className="w-4 h-4 text-slate-400" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between p-4 border-t border-slate-800">
          {step > 1 ? (
            <button
              onClick={() => setStep(1)}
              className="px-4 py-2 rounded-lg text-slate-300 hover:bg-slate-800 transition-colors"
            >
              Back
            </button>
          ) : (
            <div />
          )}
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-slate-300 hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            {step === 2 && (
              <button
                onClick={handleSubmit}
                disabled={isLoading || !name || !slug}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-600 text-white font-medium hover:from-cyan-600 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    Create Calendar
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
