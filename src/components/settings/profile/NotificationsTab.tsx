import { useState, useEffect } from 'react';
import { Save, Loader2, CheckCircle2 } from 'lucide-react';

interface NotificationPreference {
  eventType: string;
  label: string;
  description: string;
  email: boolean;
  push: boolean;
  sms: boolean;
  inApp: boolean;
}

const defaultPreferences: NotificationPreference[] = [
  {
    eventType: 'new_message',
    label: 'New Messages',
    description: 'When you receive a new message from a contact',
    email: true,
    push: true,
    sms: false,
    inApp: true,
  },
  {
    eventType: 'new_contact',
    label: 'New Contacts',
    description: 'When a new contact is created',
    email: true,
    push: false,
    sms: false,
    inApp: true,
  },
  {
    eventType: 'appointment_reminder',
    label: 'Appointment Reminders',
    description: 'Reminders for upcoming appointments',
    email: true,
    push: true,
    sms: true,
    inApp: true,
  },
  {
    eventType: 'task_assigned',
    label: 'Task Assignments',
    description: 'When a task is assigned to you',
    email: true,
    push: true,
    sms: false,
    inApp: true,
  },
  {
    eventType: 'mention',
    label: 'Mentions',
    description: 'When someone mentions you in a note or comment',
    email: true,
    push: true,
    sms: false,
    inApp: true,
  },
  {
    eventType: 'workflow_complete',
    label: 'Workflow Completion',
    description: 'When an automation workflow completes',
    email: false,
    push: false,
    sms: false,
    inApp: true,
  },
];

export function NotificationsTab() {
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreference[]>(defaultPreferences);

  const handleToggle = (index: number, channel: 'email' | 'push' | 'sms' | 'inApp') => {
    const updated = [...preferences];
    updated[index][channel] = !updated[index][channel];
    setPreferences(updated);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      // TODO: Implement notification preferences update service
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to save notification preferences:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left p-4 text-sm font-semibold text-white">
                  Event Type
                </th>
                <th className="text-center p-4 text-sm font-semibold text-white w-24">
                  Email
                </th>
                <th className="text-center p-4 text-sm font-semibold text-white w-24">
                  Push
                </th>
                <th className="text-center p-4 text-sm font-semibold text-white w-24">
                  SMS
                </th>
                <th className="text-center p-4 text-sm font-semibold text-white w-24">
                  In-App
                </th>
              </tr>
            </thead>
            <tbody>
              {preferences.map((pref, index) => (
                <tr key={pref.eventType} className="border-b border-slate-800 last:border-0">
                  <td className="p-4">
                    <div>
                      <p className="text-sm font-medium text-white">{pref.label}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{pref.description}</p>
                    </div>
                  </td>
                  <td className="text-center p-4">
                    <label className="inline-flex items-center justify-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={pref.email}
                        onChange={() => handleToggle(index, 'email')}
                        className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-2 focus:ring-cyan-500 focus:ring-offset-0 cursor-pointer"
                      />
                    </label>
                  </td>
                  <td className="text-center p-4">
                    <label className="inline-flex items-center justify-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={pref.push}
                        onChange={() => handleToggle(index, 'push')}
                        className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-2 focus:ring-cyan-500 focus:ring-offset-0 cursor-pointer"
                      />
                    </label>
                  </td>
                  <td className="text-center p-4">
                    <label className="inline-flex items-center justify-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={pref.sms}
                        onChange={() => handleToggle(index, 'sms')}
                        className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-2 focus:ring-cyan-500 focus:ring-offset-0 cursor-pointer"
                      />
                    </label>
                  </td>
                  <td className="text-center p-4">
                    <label className="inline-flex items-center justify-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={pref.inApp}
                        onChange={() => handleToggle(index, 'inApp')}
                        className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-2 focus:ring-cyan-500 focus:ring-offset-0 cursor-pointer"
                      />
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-600 text-white font-medium hover:from-cyan-600 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSaving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : saveSuccess ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saveSuccess ? 'Saved' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
