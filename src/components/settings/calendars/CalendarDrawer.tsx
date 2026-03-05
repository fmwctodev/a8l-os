import { useState, useEffect } from 'react';
import { X, User, Users, Plus, Trash2, RefreshCw, Star, LayoutGrid } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import {
  createCalendar,
  updateCalendar,
  generateSlug,
  addCalendarMember,
  updateCalendarMember,
  removeCalendarMember,
} from '../../../services/calendars';
import type { Calendar, Department, User as UserType, CalendarMember, AssignmentMode } from '../../../types';

interface CalendarDrawerProps {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  calendar: Calendar | null;
  departments: Department[];
  users: UserType[];
}

const ASSIGNMENT_MODES: { value: AssignmentMode; label: string; description: string; icon: typeof RefreshCw }[] = [
  {
    value: 'round_robin',
    label: 'Round Robin',
    description: 'Appointments rotate evenly across team members by weight',
    icon: RefreshCw,
  },
  {
    value: 'priority',
    label: 'Priority',
    description: 'Always assigned to the highest priority available member',
    icon: Star,
  },
  {
    value: 'collective',
    label: 'Collective',
    description: 'All members must be free — everyone meets with the visitor together',
    icon: LayoutGrid,
  },
];

export function CalendarDrawer({
  open,
  onClose,
  onSave,
  calendar,
  departments,
  users,
}: CalendarDrawerProps) {
  const { user } = useAuth();
  const isEditing = !!calendar;

  const userRole = user?.role?.name;
  const canManageTeamCalendars =
    userRole === 'SuperAdmin' ||
    userRole === 'Admin' ||
    user?.permissions?.includes('calendars.manage_all');

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    type: 'user' as 'user' | 'team',
    department_id: '',
    owner_user_id: '',
    assignment_mode: 'round_robin' as AssignmentMode,
  });

  const [members, setMembers] = useState<(CalendarMember & { isNew?: boolean })[]>([]);
  const [newMemberUserId, setNewMemberUserId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      if (calendar) {
        setFormData({
          name: calendar.name,
          slug: calendar.slug,
          type: calendar.type,
          department_id: calendar.department_id || '',
          owner_user_id: calendar.owner_user_id || '',
          assignment_mode: calendar.settings?.assignment_mode || 'round_robin',
        });
        setMembers(calendar.members || []);
      } else {
        setFormData({
          name: '',
          slug: '',
          type: canManageTeamCalendars ? 'user' : 'user',
          department_id: '',
          owner_user_id: user?.id || '',
          assignment_mode: 'round_robin',
        });
        setMembers([]);
      }
      setError('');
    }
  }, [open, calendar, user]);

  const handleNameChange = (name: string) => {
    setFormData({
      ...formData,
      name,
      slug: isEditing ? formData.slug : generateSlug(name),
    });
  };

  const handleAddMember = () => {
    if (!newMemberUserId) return;

    const existingMember = members.find((m) => m.user_id === newMemberUserId);
    if (existingMember) return;

    const selectedUser = users.find((u) => u.id === newMemberUserId);
    if (!selectedUser) return;

    setMembers([
      ...members,
      {
        id: `new-${Date.now()}`,
        calendar_id: calendar?.id || '',
        user_id: newMemberUserId,
        weight: 1,
        priority: 5,
        active: true,
        created_at: new Date().toISOString(),
        user: selectedUser,
        isNew: true,
      },
    ]);
    setNewMemberUserId('');
  };

  const handleUpdateMember = (
    memberId: string,
    updates: Partial<Pick<CalendarMember, 'weight' | 'priority' | 'active'>>
  ) => {
    setMembers(
      members.map((m) => (m.id === memberId ? { ...m, ...updates } : m))
    );
  };

  const handleRemoveMember = (memberId: string) => {
    setMembers(members.filter((m) => m.id !== memberId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setError('');
    setSaving(true);

    try {
      let calendarId = calendar?.id;

      if (isEditing && calendar) {
        await updateCalendar(
          calendar.id,
          {
            name: formData.name,
            slug: formData.slug,
            department_id: formData.department_id || null,
            settings: { assignment_mode: formData.assignment_mode },
          },
          user
        );

        const originalMembers = calendar.members || [];
        for (const member of members) {
          if (member.isNew) {
            await addCalendarMember(calendar.id, member.user_id, {
              weight: member.weight,
              priority: member.priority,
            });
          } else {
            const original = originalMembers.find((m) => m.id === member.id);
            if (
              original &&
              (original.weight !== member.weight ||
                original.priority !== member.priority ||
                original.active !== member.active)
            ) {
              await updateCalendarMember(member.id, {
                weight: member.weight,
                priority: member.priority,
                active: member.active,
              });
            }
          }
        }

        for (const original of originalMembers) {
          if (!members.find((m) => m.id === original.id)) {
            await removeCalendarMember(original.id);
          }
        }
      } else {
        const newCalendar = await createCalendar(
          user.organization_id,
          {
            type: formData.type,
            name: formData.name,
            slug: formData.slug,
            department_id: formData.department_id || null,
            owner_user_id: formData.type === 'user' ? formData.owner_user_id : null,
            settings: {
              assignment_mode: formData.assignment_mode,
            },
          },
          user
        );
        calendarId = newCalendar.id;

        if (formData.type === 'team') {
          for (const member of members) {
            await addCalendarMember(calendarId, member.user_id, {
              weight: member.weight,
              priority: member.priority,
            });
          }
        }
      }

      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save calendar');
    } finally {
      setSaving(false);
    }
  };

  const availableUsers = users.filter(
    (u) =>
      u.status === 'active' &&
      !members.find((m) => m.user_id === u.id)
  );

  const isCollective = formData.assignment_mode === 'collective';

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-lg bg-slate-900 border-l border-slate-700 z-50 flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">
            {isEditing ? 'Edit Calendar' : 'Create Calendar'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {error && (
              <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Calendar Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleNameChange(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                URL Slug
              </label>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 text-sm">/book/</span>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={(e) =>
                    setFormData({ ...formData, slug: e.target.value })
                  }
                  className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  required
                />
              </div>
            </div>

            {!isEditing && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-3">
                  Calendar Type
                </label>
                <div className={`grid gap-3 ${canManageTeamCalendars ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({ ...formData, type: 'user', owner_user_id: user?.id || '', assignment_mode: 'round_robin' })
                    }
                    className={`p-4 rounded-lg border-2 transition-all flex flex-col items-center gap-2 ${
                      formData.type === 'user'
                        ? 'border-cyan-500 bg-cyan-500/10'
                        : 'border-slate-700 bg-slate-800 hover:border-slate-600'
                    }`}
                  >
                    <User
                      className={`w-6 h-6 ${
                        formData.type === 'user' ? 'text-cyan-400' : 'text-slate-400'
                      }`}
                    />
                    <span
                      className={`font-medium ${
                        formData.type === 'user' ? 'text-cyan-400' : 'text-slate-300'
                      }`}
                    >
                      User Calendar
                    </span>
                    <span className="text-xs text-slate-500">
                      Assigned to one person
                    </span>
                  </button>

                  {canManageTeamCalendars && (
                    <button
                      type="button"
                      onClick={() =>
                        setFormData({ ...formData, type: 'team', owner_user_id: '' })
                      }
                      className={`p-4 rounded-lg border-2 transition-all flex flex-col items-center gap-2 ${
                        formData.type === 'team'
                          ? 'border-cyan-500 bg-cyan-500/10'
                          : 'border-slate-700 bg-slate-800 hover:border-slate-600'
                      }`}
                    >
                      <Users
                        className={`w-6 h-6 ${
                          formData.type === 'team' ? 'text-cyan-400' : 'text-slate-400'
                        }`}
                      />
                      <span
                        className={`font-medium ${
                          formData.type === 'team' ? 'text-cyan-400' : 'text-slate-300'
                        }`}
                      >
                        Team Calendar
                      </span>
                      <span className="text-xs text-slate-500">
                        Multi-member routing
                      </span>
                    </button>
                  )}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Department
              </label>
              <select
                value={formData.department_id}
                onChange={(e) =>
                  setFormData({ ...formData, department_id: e.target.value })
                }
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="">No Department</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>

            {formData.type === 'user' && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Owner
                </label>
                {isEditing ? (
                  <div className="px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-400 text-sm">
                    {users.find((u) => u.id === formData.owner_user_id)?.name || 'Unknown'}
                    <span className="ml-2 text-xs text-slate-500">(cannot be changed)</span>
                  </div>
                ) : (
                  <select
                    value={formData.owner_user_id}
                    onChange={(e) =>
                      setFormData({ ...formData, owner_user_id: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    required
                  >
                    <option value="">Select Owner</option>
                    {users
                      .filter((u) => u.status === 'active')
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                  </select>
                )}
              </div>
            )}

            {formData.type === 'team' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-3">
                    Assignment Mode
                  </label>
                  <div className="space-y-2">
                    {ASSIGNMENT_MODES.map((mode) => {
                      const Icon = mode.icon;
                      const isSelected = formData.assignment_mode === mode.value;
                      return (
                        <button
                          key={mode.value}
                          type="button"
                          onClick={() =>
                            setFormData({
                              ...formData,
                              assignment_mode: mode.value,
                            })
                          }
                          className={`w-full p-3 rounded-lg border-2 transition-all flex items-start gap-3 text-left ${
                            isSelected
                              ? 'border-cyan-500 bg-cyan-500/10'
                              : 'border-slate-700 bg-slate-800 hover:border-slate-600'
                          }`}
                        >
                          <Icon
                            className={`w-5 h-5 mt-0.5 shrink-0 ${
                              isSelected ? 'text-cyan-400' : 'text-slate-400'
                            }`}
                          />
                          <div>
                            <p className={`font-medium text-sm ${isSelected ? 'text-cyan-400' : 'text-slate-300'}`}>
                              {mode.label}
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5">{mode.description}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium text-slate-300">
                      Team Members
                    </label>
                    {isCollective && (
                      <span className="text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-full">
                        All must be free for a slot to appear
                      </span>
                    )}
                  </div>

                  <div className="flex gap-2 mb-3">
                    <select
                      value={newMemberUserId}
                      onChange={(e) => setNewMemberUserId(e.target.value)}
                      className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    >
                      <option value="">Select team member...</option>
                      {availableUsers.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleAddMember}
                      disabled={!newMemberUserId}
                      className="px-3 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {members.length > 0 ? (
                    <div className="space-y-2">
                      {members.map((member) => (
                        <div
                          key={member.id}
                          className="p-3 bg-slate-800 rounded-lg border border-slate-700"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-slate-600 flex items-center justify-center text-xs font-medium text-white">
                                {(member.user?.name || 'U').charAt(0).toUpperCase()}
                              </div>
                              <span className="text-white font-medium text-sm">
                                {member.user?.name || 'Unknown User'}
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <label className="flex items-center gap-1.5 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={member.active}
                                  onChange={(e) =>
                                    handleUpdateMember(member.id, {
                                      active: e.target.checked,
                                    })
                                  }
                                  className="w-3.5 h-3.5 rounded border-slate-600 bg-slate-700 text-cyan-500 focus:ring-cyan-500"
                                />
                                <span className="text-xs text-slate-400">Active</span>
                              </label>
                              <button
                                type="button"
                                onClick={() => handleRemoveMember(member.id)}
                                className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {!isCollective && (
                            <div className="grid grid-cols-2 gap-3 mt-3">
                              {formData.assignment_mode === 'round_robin' && (
                                <div>
                                  <label className="block text-xs text-slate-400 mb-1">
                                    Weight (1–10)
                                  </label>
                                  <input
                                    type="number"
                                    min="1"
                                    max="10"
                                    value={member.weight}
                                    onChange={(e) =>
                                      handleUpdateMember(member.id, {
                                        weight: parseInt(e.target.value) || 1,
                                      })
                                    }
                                    className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                                  />
                                </div>
                              )}
                              {formData.assignment_mode === 'priority' && (
                                <div>
                                  <label className="block text-xs text-slate-400 mb-1">
                                    Priority (1–10)
                                  </label>
                                  <input
                                    type="number"
                                    min="1"
                                    max="10"
                                    value={member.priority}
                                    onChange={(e) =>
                                      handleUpdateMember(member.id, {
                                        priority: parseInt(e.target.value) || 5,
                                      })
                                    }
                                    className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                                  />
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 border border-dashed border-slate-700 rounded-lg text-slate-500 text-sm">
                      No team members added yet
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </form>

        <div className="px-6 py-4 border-t border-slate-700 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-slate-300 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-teal-500 text-white rounded-lg font-medium hover:from-cyan-600 hover:to-teal-600 transition-all disabled:opacity-50"
          >
            {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Calendar'}
          </button>
        </div>
      </div>
    </>
  );
}
