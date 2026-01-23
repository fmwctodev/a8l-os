import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  createAppointmentType,
  updateAppointmentType,
  generateAppointmentTypeSlug,
  getDefaultQuestions,
} from '../../services/appointmentTypes';
import type { AppointmentType, LocationType, AppointmentTypeQuestion } from '../../types';
import { X, Loader2, Plus, Trash2, GripVertical } from 'lucide-react';

interface AppointmentTypeModalProps {
  calendarId: string;
  appointmentType: AppointmentType | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function AppointmentTypeModal({
  calendarId,
  appointmentType,
  onClose,
  onSuccess,
}: AppointmentTypeModalProps) {
  const { user: currentUser } = useAuth();
  const isEditing = !!appointmentType;

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(appointmentType?.name || '');
  const [slug, setSlug] = useState(appointmentType?.slug || '');
  const [description, setDescription] = useState(appointmentType?.description || '');
  const [durationMinutes, setDurationMinutes] = useState(appointmentType?.duration_minutes || 30);
  const [locationType, setLocationType] = useState<LocationType>(
    appointmentType?.location_type || 'google_meet'
  );
  const [generateGoogleMeet, setGenerateGoogleMeet] = useState(
    appointmentType?.generate_google_meet ?? true
  );
  const [slotIntervalMinutes, setSlotIntervalMinutes] = useState(
    appointmentType?.slot_interval_minutes || 15
  );
  const [bufferBeforeMinutes, setBufferBeforeMinutes] = useState(
    appointmentType?.buffer_before_minutes || 0
  );
  const [bufferAfterMinutes, setBufferAfterMinutes] = useState(
    appointmentType?.buffer_after_minutes || 0
  );
  const [minNoticeMinutes, setMinNoticeMinutes] = useState(
    appointmentType?.min_notice_minutes || 60
  );
  const [bookingWindowDays, setBookingWindowDays] = useState(
    appointmentType?.booking_window_days || 30
  );
  const [maxPerDay, setMaxPerDay] = useState<number | ''>(
    appointmentType?.max_per_day || ''
  );
  const [questions, setQuestions] = useState<AppointmentTypeQuestion[]>(
    appointmentType?.questions || getDefaultQuestions()
  );
  const [active, setActive] = useState(appointmentType?.active ?? true);

  const handleNameChange = (value: string) => {
    setName(value);
    if (!isEditing) {
      setSlug(generateAppointmentTypeSlug(value));
    }
  };

  const handleAddQuestion = () => {
    const newQuestion: AppointmentTypeQuestion = {
      id: `q_${Date.now()}`,
      label: '',
      type: 'text',
      required: false,
    };
    setQuestions([...questions, newQuestion]);
  };

  const handleUpdateQuestion = (id: string, updates: Partial<AppointmentTypeQuestion>) => {
    setQuestions(questions.map((q) => (q.id === id ? { ...q, ...updates } : q)));
  };

  const handleRemoveQuestion = (id: string) => {
    if (['name', 'email', 'phone'].includes(id)) return;
    setQuestions(questions.filter((q) => q.id !== id));
  };

  const handleSubmit = async () => {
    if (!currentUser?.organization_id || !name || !slug) return;

    try {
      setIsLoading(true);
      setError(null);

      const data = {
        calendar_id: calendarId,
        name,
        slug,
        description: description || null,
        duration_minutes: durationMinutes,
        location_type: locationType,
        location_value: {},
        questions,
        slot_interval_minutes: slotIntervalMinutes,
        buffer_before_minutes: bufferBeforeMinutes,
        buffer_after_minutes: bufferAfterMinutes,
        min_notice_minutes: minNoticeMinutes,
        booking_window_days: bookingWindowDays,
        max_per_day: maxPerDay || null,
        generate_google_meet: locationType === 'google_meet' ? generateGoogleMeet : false,
        active,
      };

      if (isEditing) {
        await updateAppointmentType(appointmentType.id, data, currentUser);
      } else {
        await createAppointmentType(currentUser.organization_id, data, currentUser);
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save appointment type');
    } finally {
      setIsLoading(false);
    }
  };

  const durationOptions = [15, 30, 45, 60, 90, 120];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-slate-900 rounded-xl border border-slate-800 w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-800 flex-shrink-0">
          <h2 className="text-lg font-semibold text-white">
            {isEditing ? 'Edit Appointment Type' : 'Create Appointment Type'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1 space-y-6">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <h3 className="text-sm font-medium text-slate-300">Basic Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g., 30 Minute Consultation"
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  URL Slug *
                </label>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Brief description shown on booking page"
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent resize-none"
              />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-medium text-slate-300">Duration & Location</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Duration
                </label>
                <select
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(parseInt(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                >
                  {durationOptions.map((d) => (
                    <option key={d} value={d}>
                      {d} minutes
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Location Type
                </label>
                <select
                  value={locationType}
                  onChange={(e) => setLocationType(e.target.value as LocationType)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                >
                  <option value="google_meet">Google Meet</option>
                  <option value="phone">Phone Call</option>
                  <option value="in_person">In Person</option>
                  <option value="zoom">Zoom</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
            </div>
            {locationType === 'google_meet' && (
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={generateGoogleMeet}
                  onChange={(e) => setGenerateGoogleMeet(e.target.checked)}
                  className="rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-cyan-500"
                />
                <span className="text-sm text-slate-300">
                  Automatically generate Google Meet link
                </span>
              </label>
            )}
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-medium text-slate-300">Scheduling Settings</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Slot Interval
                </label>
                <select
                  value={slotIntervalMinutes}
                  onChange={(e) => setSlotIntervalMinutes(parseInt(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                >
                  <option value={15}>Every 15 minutes</option>
                  <option value={30}>Every 30 minutes</option>
                  <option value={60}>Every hour</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Minimum Notice
                </label>
                <select
                  value={minNoticeMinutes}
                  onChange={(e) => setMinNoticeMinutes(parseInt(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                >
                  <option value={0}>No minimum</option>
                  <option value={60}>1 hour</option>
                  <option value={120}>2 hours</option>
                  <option value={240}>4 hours</option>
                  <option value={1440}>24 hours</option>
                  <option value={2880}>48 hours</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Buffer Before
                </label>
                <select
                  value={bufferBeforeMinutes}
                  onChange={(e) => setBufferBeforeMinutes(parseInt(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                >
                  <option value={0}>No buffer</option>
                  <option value={5}>5 minutes</option>
                  <option value={10}>10 minutes</option>
                  <option value={15}>15 minutes</option>
                  <option value={30}>30 minutes</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Buffer After
                </label>
                <select
                  value={bufferAfterMinutes}
                  onChange={(e) => setBufferAfterMinutes(parseInt(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                >
                  <option value={0}>No buffer</option>
                  <option value={5}>5 minutes</option>
                  <option value={10}>10 minutes</option>
                  <option value={15}>15 minutes</option>
                  <option value={30}>30 minutes</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Booking Window
                </label>
                <select
                  value={bookingWindowDays}
                  onChange={(e) => setBookingWindowDays(parseInt(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                >
                  <option value={7}>7 days</option>
                  <option value={14}>14 days</option>
                  <option value={30}>30 days</option>
                  <option value={60}>60 days</option>
                  <option value={90}>90 days</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Max Per Day (per rep)
                </label>
                <input
                  type="number"
                  value={maxPerDay}
                  onChange={(e) => setMaxPerDay(e.target.value ? parseInt(e.target.value) : '')}
                  placeholder="Unlimited"
                  min={1}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-slate-300">Booking Form Questions</h3>
              <button
                onClick={handleAddQuestion}
                className="inline-flex items-center gap-1 text-sm text-cyan-400 hover:text-cyan-300"
              >
                <Plus className="w-4 h-4" />
                Add Question
              </button>
            </div>
            <div className="space-y-2">
              {questions.map((q) => (
                <div
                  key={q.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-slate-800 border border-slate-700"
                >
                  <GripVertical className="w-4 h-4 text-slate-500 cursor-grab" />
                  <input
                    type="text"
                    value={q.label}
                    onChange={(e) => handleUpdateQuestion(q.id, { label: e.target.value })}
                    placeholder="Question label"
                    disabled={['name', 'email', 'phone'].includes(q.id)}
                    className="flex-1 px-3 py-1.5 rounded bg-slate-700 border border-slate-600 text-white text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500 disabled:opacity-50"
                  />
                  <select
                    value={q.type}
                    onChange={(e) =>
                      handleUpdateQuestion(q.id, {
                        type: e.target.value as AppointmentTypeQuestion['type'],
                      })
                    }
                    disabled={['name', 'email', 'phone'].includes(q.id)}
                    className="px-3 py-1.5 rounded bg-slate-700 border border-slate-600 text-white text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500 disabled:opacity-50"
                  >
                    <option value="text">Text</option>
                    <option value="textarea">Long Text</option>
                    <option value="select">Select</option>
                    <option value="checkbox">Checkbox</option>
                  </select>
                  <label className="flex items-center gap-1.5 text-sm text-slate-400">
                    <input
                      type="checkbox"
                      checked={q.required}
                      onChange={(e) => handleUpdateQuestion(q.id, { required: e.target.checked })}
                      className="rounded border-slate-600 bg-slate-700 text-cyan-500 focus:ring-cyan-500"
                    />
                    Required
                  </label>
                  {!['name', 'email', 'phone'].includes(q.id) && (
                    <button
                      onClick={() => handleRemoveQuestion(q.id)}
                      className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {isEditing && (
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-cyan-500"
              />
              <span className="text-sm text-slate-300">Active (accepting bookings)</span>
            </label>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 p-4 border-t border-slate-800 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-slate-300 hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading || !name || !slug}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-600 text-white font-medium hover:from-cyan-600 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEditing ? 'Save Changes' : 'Create Type'}
          </button>
        </div>
      </div>
    </div>
  );
}
