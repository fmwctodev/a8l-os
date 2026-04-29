import { useState, useEffect, useMemo } from 'react';
import {
  X,
  User as UserIcon,
  Users,
  Plus,
  Trash2,
  RefreshCw,
  LayoutGrid,
  Check,
  ChevronLeft,
  ChevronRight,
  Search,
  Clock,
  Calendar as CalendarIconLucide,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import {
  createCalendar,
  updateCalendar,
  generateSlug,
  addCalendarMember,
  updateCalendarMember,
  removeCalendarMember,
} from '../../../services/calendars';
import { updateAppointmentType } from '../../../services/appointmentTypes';
import type {
  Calendar,
  Department,
  User as UserType,
  CalendarMember,
  AssignmentMode,
  AppointmentType,
} from '../../../types';

interface CalendarDrawerProps {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  calendar: Calendar | null;
  calendars: Calendar[];
  departments: Department[];
  users: UserType[];
}

type StepId = 'type' | 'basics' | 'team' | 'appointment-types';

interface StepDef {
  id: StepId;
  label: string;
  description: string;
}

const STEPS: StepDef[] = [
  { id: 'type', label: 'Type', description: 'How appointments are routed' },
  { id: 'basics', label: 'Basics', description: 'Name and booking URL' },
  { id: 'team', label: 'Team', description: 'Who takes the bookings' },
  {
    id: 'appointment-types',
    label: 'Appointment Type',
    description: 'What this calendar books',
  },
];

interface CalendarTypeOption {
  id: 'one_on_one' | 'round_robin' | 'collective';
  label: string;
  shortLabel: string;
  description: string;
  icon: typeof UserIcon;
  type: 'user' | 'team';
  assignmentMode: AssignmentMode;
}

const TYPE_OPTIONS: CalendarTypeOption[] = [
  {
    id: 'one_on_one',
    label: 'One-on-One',
    shortLabel: 'One-on-One',
    description:
      'A single host owns the calendar. Every booking goes to them.',
    icon: UserIcon,
    type: 'user',
    assignmentMode: 'round_robin',
  },
  {
    id: 'round_robin',
    label: 'Round Robin',
    shortLabel: 'Round Robin',
    description:
      'Bookings rotate evenly across team members so workload stays balanced.',
    icon: RefreshCw,
    type: 'team',
    assignmentMode: 'round_robin',
  },
  {
    id: 'collective',
    label: 'Collective Booking',
    shortLabel: 'Collective',
    description:
      'Everyone on the team must be free. Useful for panel interviews and group consults.',
    icon: LayoutGrid,
    type: 'team',
    assignmentMode: 'collective',
  },
];

function deriveTypeId(
  type: 'user' | 'team',
  mode: AssignmentMode
): CalendarTypeOption['id'] {
  if (type === 'user') return 'one_on_one';
  if (mode === 'collective') return 'collective';
  return 'round_robin';
}

interface FormState {
  name: string;
  slug: string;
  typeId: CalendarTypeOption['id'];
  department_id: string;
  owner_user_id: string;
}

const EMPTY_FORM: FormState = {
  name: '',
  slug: '',
  typeId: 'one_on_one',
  department_id: '',
  owner_user_id: '',
};

export function CalendarDrawer({
  open,
  onClose,
  onSave,
  calendar,
  calendars,
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

  const [currentStep, setCurrentStep] = useState<StepId>('type');
  const [formData, setFormData] = useState<FormState>(EMPTY_FORM);
  const [members, setMembers] = useState<(CalendarMember & { isNew?: boolean })[]>(
    []
  );
  const [memberSearch, setMemberSearch] = useState('');
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
  const [typeSearch, setTypeSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const initiallyLinkedTypeId = useMemo(() => {
    if (!calendar) return null;
    return calendar.appointment_types?.[0]?.id || null;
  }, [calendar]);

  useEffect(() => {
    if (!open) return;

    if (calendar) {
      const typeId = deriveTypeId(
        calendar.type,
        calendar.settings?.assignment_mode || 'round_robin'
      );
      setFormData({
        name: calendar.name,
        slug: calendar.slug,
        typeId,
        department_id: calendar.department_id || '',
        owner_user_id: calendar.owner_user_id || '',
      });
      setMembers(calendar.members || []);
      setSelectedTypeId(initiallyLinkedTypeId);
      setCurrentStep('basics');
    } else {
      setFormData({
        ...EMPTY_FORM,
        owner_user_id: user?.id || '',
        typeId: canManageTeamCalendars ? 'one_on_one' : 'one_on_one',
      });
      setMembers([]);
      setSelectedTypeId(null);
      setCurrentStep('type');
    }
    setError('');
    setMemberSearch('');
    setTypeSearch('');
  }, [open, calendar, user, canManageTeamCalendars, initiallyLinkedTypeId]);

  const selectedType = TYPE_OPTIONS.find((t) => t.id === formData.typeId)!;
  const isCollective = selectedType.assignmentMode === 'collective';
  const isTeamType = selectedType.type === 'team';

  const orgAppointmentTypes = useMemo(() => {
    const types: AppointmentType[] = [];
    for (const cal of calendars) {
      for (const t of cal.appointment_types || []) {
        types.push({ ...t, calendar: cal });
      }
    }
    return types.sort((a, b) => a.name.localeCompare(b.name));
  }, [calendars]);

  const filteredAppointmentTypes = useMemo(() => {
    const q = typeSearch.trim().toLowerCase();
    if (!q) return orgAppointmentTypes;
    return orgAppointmentTypes.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.calendar?.name.toLowerCase().includes(q)
    );
  }, [orgAppointmentTypes, typeSearch]);

  const availableUsers = useMemo(
    () =>
      users.filter(
        (u) => u.status === 'active' && !members.find((m) => m.user_id === u.id)
      ),
    [users, members]
  );

  const filteredAvailableUsers = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    if (!q) return availableUsers;
    return availableUsers.filter(
      (u) =>
        u.name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q)
    );
  }, [availableUsers, memberSearch]);

  const handleNameChange = (name: string) => {
    setFormData((prev) => ({
      ...prev,
      name,
      slug: isEditing ? prev.slug : generateSlug(name),
    }));
  };

  const handleSelectType = (option: CalendarTypeOption) => {
    if (option.type === 'team' && !canManageTeamCalendars) return;
    setFormData((prev) => ({
      ...prev,
      typeId: option.id,
      owner_user_id: option.type === 'user' ? user?.id || '' : '',
    }));
  };

  const handleAddMember = (userId: string) => {
    if (!userId) return;
    if (members.find((m) => m.user_id === userId)) return;
    const selected = users.find((u) => u.id === userId);
    if (!selected) return;
    setMembers((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        calendar_id: calendar?.id || '',
        user_id: userId,
        weight: 1,
        priority: 5,
        active: true,
        created_at: new Date().toISOString(),
        user: selected,
        isNew: true,
      },
    ]);
    setMemberSearch('');
  };

  const handleUpdateMember = (
    memberId: string,
    updates: Partial<Pick<CalendarMember, 'weight' | 'priority' | 'active'>>
  ) => {
    setMembers((prev) =>
      prev.map((m) => (m.id === memberId ? { ...m, ...updates } : m))
    );
  };

  const handleRemoveMember = (memberId: string) => {
    setMembers((prev) => prev.filter((m) => m.id !== memberId));
  };

  const handleSelectAppointmentType = (typeId: string) => {
    setSelectedTypeId((prev) => (prev === typeId ? null : typeId));
  };

  const validateStep = (step: StepId): string | null => {
    if (step === 'type') {
      if (selectedType.type === 'team' && !canManageTeamCalendars) {
        return 'You do not have permission to create team calendars';
      }
      return null;
    }
    if (step === 'basics') {
      if (!formData.name.trim()) return 'Calendar name is required';
      if (!formData.slug.trim()) return 'URL slug is required';
      if (!/^[a-z0-9-]+$/.test(formData.slug))
        return 'Slug can only contain lowercase letters, numbers, and dashes';
      return null;
    }
    if (step === 'team') {
      if (selectedType.type === 'user' && !formData.owner_user_id) {
        return 'Pick an owner for this calendar';
      }
      if (selectedType.type === 'team' && members.length === 0) {
        return 'Add at least one team member';
      }
      return null;
    }
    return null;
  };

  const goToStep = (step: StepId) => {
    setError('');
    setCurrentStep(step);
  };

  const handleNext = () => {
    const err = validateStep(currentStep);
    if (err) {
      setError(err);
      return;
    }
    setError('');
    const idx = STEPS.findIndex((s) => s.id === currentStep);
    if (idx < STEPS.length - 1) setCurrentStep(STEPS[idx + 1].id);
  };

  const handleBack = () => {
    setError('');
    const idx = STEPS.findIndex((s) => s.id === currentStep);
    if (idx > 0) setCurrentStep(STEPS[idx - 1].id);
  };

  const handleSubmit = async () => {
    if (!user) return;

    for (const step of STEPS) {
      const err = validateStep(step.id);
      if (err) {
        setError(err);
        setCurrentStep(step.id);
        return;
      }
    }

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
            settings: { assignment_mode: selectedType.assignmentMode },
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
            type: selectedType.type,
            name: formData.name,
            slug: formData.slug,
            department_id: formData.department_id || null,
            owner_user_id:
              selectedType.type === 'user' ? formData.owner_user_id : null,
            settings: {
              assignment_mode: selectedType.assignmentMode,
            },
          },
          user
        );
        calendarId = newCalendar.id;

        if (selectedType.type === 'team') {
          for (const member of members) {
            await addCalendarMember(calendarId, member.user_id, {
              weight: member.weight,
              priority: member.priority,
            });
          }
        }
      }

      if (calendarId && selectedTypeId && selectedTypeId !== initiallyLinkedTypeId) {
        await updateAppointmentType(
          selectedTypeId,
          { calendar_id: calendarId },
          user
        );
      }

      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save calendar');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const stepIndex = STEPS.findIndex((s) => s.id === currentStep);
  const isFinalStep = stepIndex === STEPS.length - 1;

  const renderStepNav = () => (
    <div className="px-6 py-4 border-b border-slate-700 bg-slate-900/50">
      <ol className="flex items-center gap-2">
        {STEPS.map((step, idx) => {
          const isActive = step.id === currentStep;
          const isComplete = idx < stepIndex;
          const isClickable =
            isEditing || isComplete || step.id === currentStep;
          return (
            <li key={step.id} className="flex items-center gap-2 flex-1">
              <button
                type="button"
                disabled={!isClickable}
                onClick={() => isClickable && goToStep(step.id)}
                className={`flex items-center gap-2 text-left transition-colors ${
                  isClickable ? 'cursor-pointer' : 'cursor-default'
                }`}
              >
                <span
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                    isActive
                      ? 'bg-cyan-500 text-white'
                      : isComplete
                      ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                      : 'bg-slate-800 text-slate-500 border border-slate-700'
                  }`}
                >
                  {isComplete ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                </span>
                <span
                  className={`text-sm font-medium hidden sm:inline ${
                    isActive
                      ? 'text-white'
                      : isComplete
                      ? 'text-slate-300'
                      : 'text-slate-500'
                  }`}
                >
                  {step.label}
                </span>
              </button>
              {idx < STEPS.length - 1 && (
                <span
                  className={`flex-1 h-px ${
                    idx < stepIndex ? 'bg-cyan-500/40' : 'bg-slate-700'
                  }`}
                />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );

  const renderTypeStep = () => (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-white">
          What kind of calendar is this?
        </h3>
        <p className="text-sm text-slate-400 mt-1">
          You can change settings later, but the routing type is fixed once
          appointments start coming in.
        </p>
      </div>

      <div className="grid gap-3">
        {TYPE_OPTIONS.map((option) => {
          const Icon = option.icon;
          const isSelected = formData.typeId === option.id;
          const disabled = option.type === 'team' && !canManageTeamCalendars;
          const lockedInEdit = isEditing && !isSelected;

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => !disabled && !lockedInEdit && handleSelectType(option)}
              disabled={disabled || lockedInEdit}
              className={`p-4 rounded-xl border-2 transition-all flex items-start gap-4 text-left ${
                isSelected
                  ? 'border-cyan-500 bg-cyan-500/10'
                  : 'border-slate-700 bg-slate-800 hover:border-slate-600'
              } ${disabled || lockedInEdit ? 'opacity-50 cursor-not-allowed hover:border-slate-700' : ''}`}
            >
              <div
                className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${
                  isSelected
                    ? 'bg-cyan-500/20'
                    : 'bg-slate-700/50'
                }`}
              >
                <Icon
                  className={`w-6 h-6 ${
                    isSelected ? 'text-cyan-400' : 'text-slate-400'
                  }`}
                />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h4
                    className={`font-semibold ${
                      isSelected ? 'text-white' : 'text-slate-200'
                    }`}
                  >
                    {option.label}
                  </h4>
                  {isSelected && (
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-cyan-500">
                      <Check className="w-3 h-3 text-white" />
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-400 mt-1">
                  {option.description}
                </p>
                {disabled && (
                  <p className="text-xs text-amber-400 mt-2">
                    Requires admin permissions
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {isEditing && (
        <p className="text-xs text-slate-500 flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5" />
          Calendar type is locked once created. Create a new calendar to switch routing.
        </p>
      )}
    </div>
  );

  const renderBasicsStep = () => (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-white">
          Name your calendar
        </h3>
        <p className="text-sm text-slate-400 mt-1">
          Clients see this on the booking page.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Calendar Name
        </label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder="e.g. Sales Discovery Call"
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          autoFocus
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Booking URL
        </label>
        <div className="flex items-stretch rounded-lg border border-slate-700 bg-slate-800 overflow-hidden focus-within:ring-2 focus-within:ring-cyan-500">
          <span className="px-3 py-2 bg-slate-800/50 border-r border-slate-700 text-slate-500 text-sm font-mono flex items-center">
            {typeof window !== 'undefined' ? window.location.host : 'app'}
            /book/
          </span>
          <input
            type="text"
            value={formData.slug}
            onChange={(e) =>
              setFormData({
                ...formData,
                slug: e.target.value
                  .toLowerCase()
                  .replace(/[^a-z0-9-]/g, '-')
                  .replace(/-+/g, '-')
                  .replace(/^-|-$/g, ''),
              })
            }
            placeholder="my-calendar"
            className="flex-1 px-3 py-2 bg-transparent text-white focus:outline-none font-mono text-sm"
          />
        </div>
        <p className="text-xs text-slate-500 mt-1.5">
          Lowercase letters, numbers and dashes only.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Department <span className="text-slate-500 font-normal">(optional)</span>
        </label>
        <select
          value={formData.department_id}
          onChange={(e) =>
            setFormData({ ...formData, department_id: e.target.value })
          }
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
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
  );

  const renderTeamStep = () => {
    if (!isTeamType) {
      return (
        <div className="space-y-5">
          <div>
            <h3 className="text-base font-semibold text-white">
              Who owns this calendar?
            </h3>
            <p className="text-sm text-slate-400 mt-1">
              All bookings on this calendar will be assigned to this person.
            </p>
          </div>

          {isEditing ? (
            <div className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center text-sm font-semibold text-white">
                {(users.find((u) => u.id === formData.owner_user_id)?.name || 'U')
                  .charAt(0)
                  .toUpperCase()}
              </div>
              <div className="flex-1">
                <p className="text-white font-medium text-sm">
                  {users.find((u) => u.id === formData.owner_user_id)?.name ||
                    'Unknown'}
                </p>
                <p className="text-xs text-slate-500">
                  Owner cannot be changed after creation
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {users
                .filter((u) => u.status === 'active')
                .map((u) => {
                  const isSelected = formData.owner_user_id === u.id;
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() =>
                        setFormData({ ...formData, owner_user_id: u.id })
                      }
                      className={`w-full p-3 rounded-lg border-2 transition-all flex items-center gap-3 text-left ${
                        isSelected
                          ? 'border-cyan-500 bg-cyan-500/10'
                          : 'border-slate-700 bg-slate-800 hover:border-slate-600'
                      }`}
                    >
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center text-sm font-semibold text-white">
                        {(u.name || 'U').charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className={`font-medium text-sm truncate ${
                            isSelected ? 'text-white' : 'text-slate-200'
                          }`}
                        >
                          {u.name}
                        </p>
                        <p className="text-xs text-slate-500 truncate">
                          {u.email}
                        </p>
                      </div>
                      {isSelected && (
                        <Check className="w-4 h-4 text-cyan-400 shrink-0" />
                      )}
                    </button>
                  );
                })}
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-5">
        <div>
          <h3 className="text-base font-semibold text-white">
            Who's on this team?
          </h3>
          <p className="text-sm text-slate-400 mt-1">
            {selectedType.assignmentMode === 'collective'
              ? "Bookings only show times when every member is free."
              : 'Bookings will rotate across these members. Adjust weights to bias the rotation.'}
          </p>
        </div>

        {availableUsers.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Add members
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder="Search teammates..."
                className="w-full pl-10 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
            {memberSearch && filteredAvailableUsers.length > 0 && (
              <div className="mt-2 max-h-48 overflow-y-auto border border-slate-700 rounded-lg bg-slate-800 divide-y divide-slate-700">
                {filteredAvailableUsers.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => handleAddMember(u.id)}
                    className="w-full px-3 py-2 flex items-center gap-3 hover:bg-slate-700 text-left"
                  >
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center text-xs font-semibold text-white">
                      {(u.name || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm truncate">{u.name}</p>
                      <p className="text-xs text-slate-500 truncate">
                        {u.email}
                      </p>
                    </div>
                    <Plus className="w-4 h-4 text-slate-400" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {members.length > 0 ? (
          <div className="space-y-2">
            {members.map((member) => (
              <div
                key={member.id}
                className="p-3 bg-slate-800 border border-slate-700 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center text-xs font-semibold text-white shrink-0">
                    {(member.user?.name || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">
                      {member.user?.name || 'Unknown user'}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {member.user?.email}
                    </p>
                  </div>
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
                    aria-label="Remove member"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {!isCollective && (
                  <div className="mt-3 pl-11">
                    <label className="flex items-center gap-3">
                      <span className="text-xs text-slate-400 w-16">
                        Weight
                      </span>
                      <input
                        type="range"
                        min="1"
                        max="10"
                        value={member.weight}
                        onChange={(e) =>
                          handleUpdateMember(member.id, {
                            weight: parseInt(e.target.value) || 1,
                          })
                        }
                        className="flex-1 accent-cyan-500"
                      />
                      <span className="text-xs text-white font-mono w-6 text-right">
                        {member.weight}
                      </span>
                    </label>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 border-2 border-dashed border-slate-700 rounded-lg">
            <Users className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-400">No team members yet</p>
            <p className="text-xs text-slate-500 mt-1">
              Search above to add the first one.
            </p>
          </div>
        )}
      </div>
    );
  };

  const renderAppointmentTypesStep = () => (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-white">
          What does this calendar book?
        </h3>
        <p className="text-sm text-slate-400 mt-1">
          Pick the appointment type clients see when they land on this
          calendar's booking page. They won't be asked to choose — they go
          straight to picking a time.
        </p>
      </div>

      {orgAppointmentTypes.length === 0 ? (
        <div className="text-center py-10 border-2 border-dashed border-slate-700 rounded-lg">
          <Clock className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <p className="text-sm text-slate-300 font-medium">
            No appointment types yet
          </p>
          <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
            After saving this calendar, head to the Appointment Types tab to
            create one. Set the duration, location, and intake questions
            there.
          </p>
        </div>
      ) : (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={typeSearch}
              onChange={(e) => setTypeSearch(e.target.value)}
              placeholder="Search appointment types..."
              className="w-full pl-10 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          <div
            role="radiogroup"
            aria-label="Appointment type"
            className="space-y-2 max-h-[420px] overflow-y-auto pr-1"
          >
            {filteredAppointmentTypes.map((type) => {
              const isSelected = selectedTypeId === type.id;
              const currentCalendar = type.calendar;
              const isOnAnotherCalendar =
                currentCalendar && currentCalendar.id !== calendar?.id;
              const wasInitiallyLinked = initiallyLinkedTypeId === type.id;
              return (
                <button
                  key={type.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => handleSelectAppointmentType(type.id)}
                  className={`w-full flex items-start gap-3 p-3 rounded-lg border-2 text-left transition-all ${
                    isSelected
                      ? 'border-cyan-500 bg-cyan-500/10'
                      : 'border-slate-700 bg-slate-800 hover:border-slate-600'
                  }`}
                >
                  <span
                    className={`mt-1 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      isSelected
                        ? 'border-cyan-500'
                        : 'border-slate-600'
                    }`}
                  >
                    {isSelected && (
                      <span className="w-2 h-2 rounded-full bg-cyan-500" />
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p
                        className={`font-medium text-sm ${
                          isSelected ? 'text-white' : 'text-slate-200'
                        }`}
                      >
                        {type.name}
                      </p>
                      {!type.active && (
                        <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-700 text-slate-400">
                          Inactive
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {type.duration_minutes} min
                      </span>
                      {currentCalendar && (
                        <span className="flex items-center gap-1">
                          <CalendarIconLucide className="w-3 h-3" />
                          {currentCalendar.name}
                        </span>
                      )}
                    </div>
                    {isSelected &&
                      isOnAnotherCalendar &&
                      !wasInitiallyLinked && (
                        <p className="text-xs text-amber-400 mt-1.5 flex items-center gap-1">
                          <ArrowRight className="w-3 h-3" />
                          Will move from {currentCalendar?.name} to this
                          calendar
                        </p>
                      )}
                  </div>
                </button>
              );
            })}
            {filteredAppointmentTypes.length === 0 && (
              <p className="text-center text-sm text-slate-500 py-6">
                No appointment types match "{typeSearch}"
              </p>
            )}
          </div>

          <p className="text-xs text-slate-500">
            {selectedTypeId
              ? 'Clients booking on this calendar will go straight to picking a time.'
              : 'Pick one type so this calendar has something bookable.'}
          </p>
        </>
      )}
    </div>
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case 'type':
        return renderTypeStep();
      case 'basics':
        return renderBasicsStep();
      case 'team':
        return renderTeamStep();
      case 'appointment-types':
        return renderAppointmentTypesStep();
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-3xl bg-slate-900 border-l border-slate-700 z-50 flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div>
            <h2 className="text-lg font-semibold text-white">
              {isEditing ? 'Edit Calendar' : 'Create Calendar'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {STEPS[stepIndex].description}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {renderStepNav()}

        <div className="flex-1 overflow-y-auto">
          <div className="p-6">
            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {renderStepContent()}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-700 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={stepIndex === 0 ? onClose : handleBack}
            disabled={saving}
            className="inline-flex items-center gap-1 px-4 py-2 text-slate-300 hover:text-white transition-colors disabled:opacity-50"
          >
            {stepIndex === 0 ? (
              'Cancel'
            ) : (
              <>
                <ChevronLeft className="w-4 h-4" />
                Back
              </>
            )}
          </button>

          <div className="flex items-center gap-2">
            {isEditing && (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving}
                className="px-4 py-2 text-cyan-400 hover:text-cyan-300 text-sm font-medium transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            )}
            {!isFinalStep ? (
              <button
                type="button"
                onClick={handleNext}
                disabled={saving}
                className="inline-flex items-center gap-1 px-4 py-2 bg-gradient-to-r from-cyan-500 to-teal-500 text-white rounded-lg font-medium hover:from-cyan-600 hover:to-teal-600 transition-all disabled:opacity-50"
              >
                Continue
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-teal-500 text-white rounded-lg font-medium hover:from-cyan-600 hover:to-teal-600 transition-all disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Saving...
                  </>
                ) : isEditing ? (
                  'Save Changes'
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Create Calendar
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
