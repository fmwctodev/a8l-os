import { useState, useEffect } from 'react';
import { Save, Loader2, CheckCircle2 } from 'lucide-react';

export function PreferencesTab() {
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [preferences, setPreferences] = useState({
    defaultLandingPage: '/dashboard',
    calendarDefaultView: 'week',
    inboxBehavior: 'auto_select_first',
    dateFormat: 'MM/DD/YYYY',
    timeFormat: '12h',
    language: 'en',
  });

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      // TODO: Implement preferences update service
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to save preferences:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-white mb-4">General Preferences</h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Default Landing Page
              </label>
              <select
                value={preferences.defaultLandingPage}
                onChange={(e) =>
                  setPreferences({ ...preferences, defaultLandingPage: e.target.value })
                }
                className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              >
                <option value="/dashboard">Dashboard</option>
                <option value="/conversations">Conversations</option>
                <option value="/contacts">Contacts</option>
                <option value="/calendars">Calendars</option>
                <option value="/opportunities">Opportunities</option>
              </select>
              <p className="text-xs text-slate-500 mt-1">
                Page you'll see after logging in
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Language
              </label>
              <select
                value={preferences.language}
                onChange={(e) => setPreferences({ ...preferences, language: e.target.value })}
                className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              >
                <option value="en">English</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="de">German</option>
              </select>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-800 pt-6">
          <h3 className="text-lg font-semibold text-white mb-4">Calendar Preferences</h3>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Default Calendar View
            </label>
            <select
              value={preferences.calendarDefaultView}
              onChange={(e) =>
                setPreferences({ ...preferences, calendarDefaultView: e.target.value })
              }
              className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            >
              <option value="day">Day View</option>
              <option value="week">Week View</option>
              <option value="month">Month View</option>
            </select>
          </div>
        </div>

        <div className="border-t border-slate-800 pt-6">
          <h3 className="text-lg font-semibold text-white mb-4">Inbox Preferences</h3>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Inbox Behavior
            </label>
            <select
              value={preferences.inboxBehavior}
              onChange={(e) =>
                setPreferences({ ...preferences, inboxBehavior: e.target.value })
              }
              className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            >
              <option value="auto_select_first">Auto-select first conversation</option>
              <option value="stay_on_list">Stay on conversation list</option>
            </select>
            <p className="text-xs text-slate-500 mt-1">
              What happens when you open the inbox
            </p>
          </div>
        </div>

        <div className="border-t border-slate-800 pt-6">
          <h3 className="text-lg font-semibold text-white mb-4">Date & Time Format</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Date Format
              </label>
              <select
                value={preferences.dateFormat}
                onChange={(e) =>
                  setPreferences({ ...preferences, dateFormat: e.target.value })
                }
                className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              >
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Time Format
              </label>
              <select
                value={preferences.timeFormat}
                onChange={(e) =>
                  setPreferences({ ...preferences, timeFormat: e.target.value })
                }
                className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              >
                <option value="12h">12-hour (2:30 PM)</option>
                <option value="24h">24-hour (14:30)</option>
              </select>
            </div>
          </div>
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
