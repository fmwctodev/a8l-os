import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getCalendarById, updateCalendar } from '../../services/calendars';
import { getAppointmentTypes, deleteAppointmentType } from '../../services/appointmentTypes';
import { getAvailabilityRule, upsertAvailabilityRule } from '../../services/availabilityRules';
import { getAppointments } from '../../services/appointments';
import type { Calendar, AppointmentType, AvailabilityRule, Appointment, DaySchedule } from '../../types';
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  Plus,
  Clock,
  Users,
  User as UserIcon,
  Settings,
  Calendar as CalendarIcon,
  Link as LinkIcon,
  Copy,
  Check,
  Trash2,
  Edit,
  ExternalLink,
  Video,
  Phone,
  MapPin,
} from 'lucide-react';
import { AppointmentTypeModal } from '../../components/calendars/AppointmentTypeModal';
import { AvailabilityEditor } from '../../components/calendars/AvailabilityEditor';
import { CalendarSettingsModal } from '../../components/calendars/CalendarSettingsModal';

export function CalendarDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: currentUser, hasPermission } = useAuth();

  const [calendar, setCalendar] = useState<Calendar | null>(null);
  const [appointmentTypes, setAppointmentTypes] = useState<AppointmentType[]>([]);
  const [availability, setAvailability] = useState<AvailabilityRule | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'types' | 'availability' | 'bookings' | 'settings'>('types');
  const [isTypeModalOpen, setIsTypeModalOpen] = useState(false);
  const [editingType, setEditingType] = useState<AppointmentType | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  const canManage = hasPermission('calendars.manage');

  const loadData = useCallback(async () => {
    if (!id || !currentUser?.organization_id) return;

    try {
      setIsLoading(true);
      setError(null);

      const [calendarData, typesData, availabilityData, appointmentsData] = await Promise.all([
        getCalendarById(id),
        getAppointmentTypes(id),
        getAvailabilityRule(id),
        getAppointments(currentUser.organization_id, {
          calendarId: id,
          startDate: new Date().toISOString(),
        }),
      ]);

      setCalendar(calendarData);
      setAppointmentTypes(typesData);
      setAvailability(availabilityData);
      setAppointments(appointmentsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load calendar');
    } finally {
      setIsLoading(false);
    }
  }, [id, currentUser?.organization_id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSaveAvailability = async (rules: DaySchedule, timezone: string) => {
    if (!id || !currentUser?.organization_id) return;

    try {
      await upsertAvailabilityRule(currentUser.organization_id, {
        calendar_id: id,
        timezone,
        rules,
      });
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save availability');
    }
  };

  const handleDeleteType = async (typeId: string) => {
    if (!currentUser) return;
    if (!confirm('Are you sure you want to delete this appointment type?')) return;

    try {
      await deleteAppointmentType(typeId, currentUser);
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete appointment type');
    }
  };

  const copyBookingLink = (type: AppointmentType) => {
    if (!calendar) return;
    const baseUrl = window.location.origin;
    const link = `${baseUrl}/book/${calendar.slug}/${type.slug}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(type.id);
    setTimeout(() => setCopiedLink(null), 2000);
  };

  const getLocationIcon = (locationType: string) => {
    switch (locationType) {
      case 'google_meet':
      case 'zoom':
        return <Video className="w-4 h-4" />;
      case 'phone':
        return <Phone className="w-4 h-4" />;
      case 'in_person':
        return <MapPin className="w-4 h-4" />;
      default:
        return <LinkIcon className="w-4 h-4" />;
    }
  };

  const getLocationLabel = (locationType: string) => {
    switch (locationType) {
      case 'google_meet':
        return 'Google Meet';
      case 'zoom':
        return 'Zoom';
      case 'phone':
        return 'Phone Call';
      case 'in_person':
        return 'In Person';
      default:
        return 'Custom';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  if (error || !calendar) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
        <p className="text-white font-medium">Error loading calendar</p>
        <p className="text-slate-400 text-sm">{error || 'Calendar not found'}</p>
        <button
          onClick={() => navigate('/calendars')}
          className="mt-4 text-cyan-400 hover:text-cyan-300"
        >
          Back to calendars
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/calendars')}
          className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-slate-400" />
        </button>
        <div className="flex-1">
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
              <h1 className="text-2xl font-semibold text-white">{calendar.name}</h1>
              <p className="text-slate-400 text-sm">
                {calendar.type === 'user'
                  ? `Personal calendar for ${calendar.owner?.name || 'Unknown'}`
                  : `Team calendar with ${calendar.members?.length || 0} members`}
              </p>
            </div>
          </div>
        </div>
        {canManage && (
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <Settings className="w-5 h-5 text-slate-400" />
          </button>
        )}
      </div>

      <div className="bg-slate-900 rounded-xl border border-slate-800">
        <div className="border-b border-slate-800">
          <nav className="flex">
            {(['types', 'availability', 'bookings', 'settings'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${
                  activeTab === tab
                    ? 'border-cyan-500 text-cyan-400'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                {tab === 'types' && 'Appointment Types'}
                {tab === 'availability' && 'Availability'}
                {tab === 'bookings' && `Upcoming (${appointments.length})`}
                {tab === 'settings' && 'Settings'}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'types' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-slate-400 text-sm">
                  Define the types of appointments that can be booked
                </p>
                {canManage && (
                  <button
                    onClick={() => {
                      setEditingType(null);
                      setIsTypeModalOpen(true);
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-600 text-white font-medium hover:from-cyan-600 hover:to-teal-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add Type
                  </button>
                )}
              </div>

              {appointmentTypes.length === 0 ? (
                <div className="text-center py-12">
                  <Clock className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                  <p className="text-white font-medium mb-1">No appointment types</p>
                  <p className="text-slate-400 text-sm mb-4">
                    Create appointment types to start accepting bookings
                  </p>
                  {canManage && (
                    <button
                      onClick={() => setIsTypeModalOpen(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-600 text-white font-medium hover:from-cyan-600 hover:to-teal-700 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Add Type
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid gap-4">
                  {appointmentTypes.map((type) => (
                    <div
                      key={type.id}
                      className={`p-4 rounded-lg border ${
                        type.active
                          ? 'bg-slate-800/50 border-slate-700'
                          : 'bg-slate-800/30 border-slate-700/50 opacity-60'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium text-white">{type.name}</h3>
                            {!type.active && (
                              <span className="px-2 py-0.5 rounded text-xs bg-slate-700 text-slate-400">
                                Inactive
                              </span>
                            )}
                          </div>
                          {type.description && (
                            <p className="text-sm text-slate-400 mb-2">{type.description}</p>
                          )}
                          <div className="flex items-center gap-4 text-sm text-slate-400">
                            <span className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              {type.duration_minutes} min
                            </span>
                            <span className="flex items-center gap-1">
                              {getLocationIcon(type.location_type)}
                              {getLocationLabel(type.location_type)}
                            </span>
                            {type.generate_google_meet && type.location_type === 'google_meet' && (
                              <span className="text-cyan-400">Auto-generates Meet link</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => copyBookingLink(type)}
                            className={`p-2 rounded-lg transition-colors ${
                              copiedLink === type.id
                                ? 'bg-cyan-500/20 text-cyan-400'
                                : 'hover:bg-slate-700 text-slate-400'
                            }`}
                            title="Copy booking link"
                          >
                            {copiedLink === type.id ? (
                              <Check className="w-4 h-4" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                          <a
                            href={`/book/${calendar.slug}/${type.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 transition-colors"
                            title="Preview booking page"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                          {canManage && (
                            <>
                              <button
                                onClick={() => {
                                  setEditingType(type);
                                  setIsTypeModalOpen(true);
                                }}
                                className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 transition-colors"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteType(type.id)}
                                className="p-2 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'availability' && (
            <AvailabilityEditor
              availability={availability}
              onSave={handleSaveAvailability}
              canEdit={canManage}
            />
          )}

          {activeTab === 'bookings' && (
            <div className="space-y-4">
              {appointments.length === 0 ? (
                <div className="text-center py-12">
                  <CalendarIcon className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                  <p className="text-white font-medium mb-1">No upcoming appointments</p>
                  <p className="text-slate-400 text-sm">
                    Appointments will appear here once booked
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {appointments.map((apt) => (
                    <div
                      key={apt.id}
                      className="flex items-center justify-between p-4 rounded-lg bg-slate-800/50 border border-slate-700"
                    >
                      <div>
                        <p className="text-white font-medium">
                          {apt.contact
                            ? `${apt.contact.first_name} ${apt.contact.last_name}`
                            : apt.answers.name || 'Guest'}
                        </p>
                        <p className="text-sm text-slate-400">
                          {apt.appointment_type?.name} - {apt.appointment_type?.duration_minutes} min
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-white">
                          {new Date(apt.start_at_utc).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </p>
                        <p className="text-sm text-slate-400">
                          {new Date(apt.start_at_utc).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-white font-medium mb-2">Calendar Details</h3>
                <div className="space-y-2 text-sm">
                  <p className="text-slate-400">
                    <span className="text-slate-500">Type:</span>{' '}
                    {calendar.type === 'user' ? 'User Calendar' : 'Team Calendar'}
                  </p>
                  <p className="text-slate-400">
                    <span className="text-slate-500">Slug:</span> {calendar.slug}
                  </p>
                  {calendar.department && (
                    <p className="text-slate-400">
                      <span className="text-slate-500">Department:</span> {calendar.department.name}
                    </p>
                  )}
                  <p className="text-slate-400">
                    <span className="text-slate-500">Assignment Mode:</span>{' '}
                    {calendar.settings.assignment_mode === 'priority'
                      ? 'Priority-based'
                      : 'Weighted Round-robin'}
                  </p>
                </div>
              </div>

              {calendar.type === 'team' && calendar.members && calendar.members.length > 0 && (
                <div>
                  <h3 className="text-white font-medium mb-2">Team Members</h3>
                  <div className="space-y-2">
                    {calendar.members.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center text-white text-sm font-medium">
                            {member.user?.name?.[0] || '?'}
                          </div>
                          <div>
                            <p className="text-white text-sm">{member.user?.name}</p>
                            <p className="text-xs text-slate-400">{member.user?.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-slate-400">
                          <span>Weight: {member.weight}</span>
                          <span>Priority: {member.priority}</span>
                          {!member.active && (
                            <span className="px-2 py-0.5 rounded bg-slate-700 text-slate-500">
                              Inactive
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {isTypeModalOpen && (
        <AppointmentTypeModal
          calendarId={calendar.id}
          appointmentType={editingType}
          onClose={() => {
            setIsTypeModalOpen(false);
            setEditingType(null);
          }}
          onSuccess={() => {
            setIsTypeModalOpen(false);
            setEditingType(null);
            loadData();
          }}
        />
      )}

      {isSettingsOpen && (
        <CalendarSettingsModal
          calendar={calendar}
          onClose={() => setIsSettingsOpen(false)}
          onSuccess={() => {
            setIsSettingsOpen(false);
            loadData();
          }}
        />
      )}
    </div>
  );
}
