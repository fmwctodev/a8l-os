import { useState, useEffect, useCallback } from 'react';
import { Loader2, Check } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { getNotificationPreferences, upsertNotificationPreference } from '../../../services/profile';

interface NotificationPreferenceUI {
  eventType: string;
  label: string;
  description: string;
  email: boolean;
  push: boolean;
  inApp: boolean;
}

const notificationEvents = [
  {
    eventType: 'conversation_assigned',
    label: 'New Conversation Assigned',
    description: 'When a conversation is assigned to you',
  },
  {
    eventType: 'task_assigned',
    label: 'New Task Assigned',
    description: 'When a task is assigned to you',
  },
  {
    eventType: 'appointment_booked',
    label: 'Appointment Booked',
    description: 'When someone books an appointment with you',
  },
  {
    eventType: 'review_received',
    label: 'Review Received',
    description: 'When a new review is submitted',
  },
  {
    eventType: 'ai_draft_ready',
    label: 'AI Draft Ready',
    description: 'When an AI agent completes a draft response',
  },
  {
    eventType: 'system_alert',
    label: 'System Alerts',
    description: 'Important system notifications and updates',
  },
];

const defaultValues: Omit<NotificationPreferenceUI, 'eventType' | 'label' | 'description'> = {
  email: true,
  push: true,
  inApp: true,
};

interface ToggleProps {
  checked: boolean;
  onChange: () => void;
  saving: boolean;
  saved: boolean;
}

function NotificationToggle({ checked, onChange, saving, saved }: ToggleProps) {
  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onClick={onChange}
        disabled={saving}
        className={`
          relative inline-flex h-6 w-11 items-center rounded-full transition-colors
          ${checked ? 'bg-cyan-500' : 'bg-slate-700'}
          ${saving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
      >
        <span
          className={`
            inline-block h-4 w-4 transform rounded-full bg-white transition-transform
            ${checked ? 'translate-x-6' : 'translate-x-1'}
          `}
        />
      </button>
      {saving && (
        <Loader2 className="w-3 h-3 text-slate-400 animate-spin absolute -right-5" />
      )}
      {saved && (
        <Check className="w-3 h-3 text-emerald-400 absolute -right-5" />
      )}
    </div>
  );
}

export function NotificationsTab() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [savingCell, setSavingCell] = useState<string | null>(null);
  const [savedCell, setSavedCell] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<NotificationPreferenceUI[]>([]);

  useEffect(() => {
    async function loadPreferences() {
      if (!user) return;

      try {
        const dbPrefs = await getNotificationPreferences(user.id);

        const merged = notificationEvents.map(event => {
          const existing = dbPrefs.find(p => p.event_type === event.eventType);
          return {
            ...event,
            email: existing?.email_enabled ?? defaultValues.email,
            push: existing?.push_enabled ?? defaultValues.push,
            inApp: existing?.in_app_enabled ?? defaultValues.inApp,
          };
        });

        setPreferences(merged);
      } catch (error) {
        console.error('Failed to load notification preferences:', error);
        setPreferences(notificationEvents.map(e => ({ ...e, ...defaultValues })));
      } finally {
        setIsLoading(false);
      }
    }

    loadPreferences();
  }, [user]);

  const handleToggle = useCallback(async (
    eventType: string,
    channel: 'email' | 'push' | 'inApp'
  ) => {
    if (!user) return;

    const cellKey = `${eventType}-${channel}`;
    const prefIndex = preferences.findIndex(p => p.eventType === eventType);
    if (prefIndex === -1) return;

    const pref = preferences[prefIndex];
    const newValue = !pref[channel];

    setPreferences(prev => {
      const updated = [...prev];
      updated[prefIndex] = { ...pref, [channel]: newValue };
      return updated;
    });

    setSavingCell(cellKey);
    setSavedCell(null);

    try {
      await upsertNotificationPreference(user.id, eventType, {
        email_enabled: channel === 'email' ? newValue : pref.email,
        push_enabled: channel === 'push' ? newValue : pref.push,
        sms_enabled: false,
        in_app_enabled: channel === 'inApp' ? newValue : pref.inApp,
      });

      setSavedCell(cellKey);
      setTimeout(() => setSavedCell(null), 1500);
    } catch (error) {
      console.error('Failed to save notification preference:', error);
      setPreferences(prev => {
        const updated = [...prev];
        updated[prefIndex] = { ...pref, [channel]: !newValue };
        return updated;
      });
    } finally {
      setSavingCell(null);
    }
  }, [user, preferences]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left p-4 text-sm font-semibold text-white">
                  Notification Type
                </th>
                <th className="text-center p-4 text-sm font-semibold text-white w-28">
                  Email
                </th>
                <th className="text-center p-4 text-sm font-semibold text-white w-28">
                  Push
                </th>
                <th className="text-center p-4 text-sm font-semibold text-white w-28">
                  In-App
                </th>
              </tr>
            </thead>
            <tbody>
              {preferences.map((pref) => (
                <tr key={pref.eventType} className="border-b border-slate-800 last:border-0">
                  <td className="p-4">
                    <div>
                      <p className="text-sm font-medium text-white">{pref.label}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{pref.description}</p>
                    </div>
                  </td>
                  <td className="text-center p-4">
                    <div className="flex justify-center">
                      <NotificationToggle
                        checked={pref.email}
                        onChange={() => handleToggle(pref.eventType, 'email')}
                        saving={savingCell === `${pref.eventType}-email`}
                        saved={savedCell === `${pref.eventType}-email`}
                      />
                    </div>
                  </td>
                  <td className="text-center p-4">
                    <div className="flex justify-center">
                      <NotificationToggle
                        checked={pref.push}
                        onChange={() => handleToggle(pref.eventType, 'push')}
                        saving={savingCell === `${pref.eventType}-push`}
                        saved={savedCell === `${pref.eventType}-push`}
                      />
                    </div>
                  </td>
                  <td className="text-center p-4">
                    <div className="flex justify-center">
                      <NotificationToggle
                        checked={pref.inApp}
                        onChange={() => handleToggle(pref.eventType, 'inApp')}
                        saving={savingCell === `${pref.eventType}-inApp`}
                        saved={savedCell === `${pref.eventType}-inApp`}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-sm text-slate-500 text-center">
        Changes are saved automatically
      </p>
    </div>
  );
}
