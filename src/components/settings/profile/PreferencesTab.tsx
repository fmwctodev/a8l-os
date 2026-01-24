import { useState, useEffect, useCallback } from 'react';
import { Monitor, Moon, Sun, Loader2, Check } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useTheme } from '../../../contexts/ThemeContext';
import { getUserPreferences, upsertUserPreferences } from '../../../services/profile';
import { TimezoneSelect } from './TimezoneSelect';

type Theme = 'light' | 'dark' | 'system';

interface SaveIndicatorProps {
  field: string;
  savingField: string | null;
  savedField: string | null;
}

function SaveIndicator({ field, savingField, savedField }: SaveIndicatorProps) {
  if (savingField === field) {
    return <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />;
  }
  if (savedField === field) {
    return <Check className="w-4 h-4 text-emerald-400" />;
  }
  return null;
}

export function PreferencesTab() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const [isLoading, setIsLoading] = useState(true);
  const [savingField, setSavingField] = useState<string | null>(null);
  const [savedField, setSavedField] = useState<string | null>(null);
  const [preferences, setPreferences] = useState({
    defaultLandingPage: '/dashboard',
    dateFormat: 'MM/DD/YYYY',
    timeFormat: '12h',
    language: 'en',
    timezone: 'America/New_York',
  });

  useEffect(() => {
    async function loadPreferences() {
      if (!user) return;

      try {
        const prefs = await getUserPreferences(user.id);
        if (prefs) {
          setPreferences({
            defaultLandingPage: prefs.default_landing_page || '/dashboard',
            dateFormat: prefs.date_format || 'MM/DD/YYYY',
            timeFormat: prefs.time_format || '12h',
            language: prefs.language || 'en',
            timezone: user.timezone || 'America/New_York',
          });
        }
      } catch (error) {
        console.error('Failed to load preferences:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadPreferences();
  }, [user]);

  const savePreference = useCallback(async (field: string, value: string) => {
    if (!user) return;

    setSavingField(field);
    setSavedField(null);

    try {
      const fieldMap: Record<string, string> = {
        defaultLandingPage: 'default_landing_page',
        dateFormat: 'date_format',
        timeFormat: 'time_format',
        language: 'language',
      };

      await upsertUserPreferences(user.id, {
        [fieldMap[field]]: value,
      });

      setSavedField(field);
      setTimeout(() => setSavedField(null), 2000);
    } catch (error) {
      console.error('Failed to save preference:', error);
    } finally {
      setSavingField(null);
    }
  }, [user]);

  const handleThemeChange = async (newTheme: Theme) => {
    setSavingField('theme');
    setSavedField(null);

    try {
      await setTheme(newTheme);
      setSavedField('theme');
      setTimeout(() => setSavedField(null), 2000);
    } catch (error) {
      console.error('Failed to save theme:', error);
    } finally {
      setSavingField(null);
    }
  };

  const handleChange = (field: string, value: string) => {
    setPreferences(prev => ({ ...prev, [field]: value }));
    savePreference(field, value);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-white mb-4">Appearance</h3>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-slate-300">Theme</label>
              <SaveIndicator field="theme" savingField={savingField} savedField={savedField} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => handleThemeChange('light')}
                className={`
                  flex flex-col items-center gap-2 p-4 rounded-lg border transition-all
                  ${theme === 'light'
                    ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600'
                  }
                `}
              >
                <Sun className="w-6 h-6" />
                <span className="text-sm font-medium">Light</span>
              </button>
              <button
                onClick={() => handleThemeChange('dark')}
                className={`
                  flex flex-col items-center gap-2 p-4 rounded-lg border transition-all
                  ${theme === 'dark'
                    ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600'
                  }
                `}
              >
                <Moon className="w-6 h-6" />
                <span className="text-sm font-medium">Dark</span>
              </button>
              <button
                onClick={() => handleThemeChange('system')}
                className={`
                  flex flex-col items-center gap-2 p-4 rounded-lg border transition-all
                  ${theme === 'system'
                    ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600'
                  }
                `}
              >
                <Monitor className="w-6 h-6" />
                <span className="text-sm font-medium">System</span>
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Choose how the interface should appear
            </p>
          </div>
        </div>

        <div className="border-t border-slate-800 pt-6">
          <h3 className="text-lg font-semibold text-white mb-4">General Preferences</h3>

          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-slate-300">Start Page</label>
                <SaveIndicator field="defaultLandingPage" savingField={savingField} savedField={savedField} />
              </div>
              <select
                value={preferences.defaultLandingPage}
                onChange={(e) => handleChange('defaultLandingPage', e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              >
                <option value="/dashboard">Dashboard</option>
                <option value="/conversations">Conversations</option>
                <option value="/opportunities">Opportunities</option>
              </select>
              <p className="text-xs text-slate-500 mt-1">
                Page you'll see after logging in
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-slate-300">Language</label>
                <SaveIndicator field="language" savingField={savingField} savedField={savedField} />
              </div>
              <select
                value={preferences.language}
                onChange={(e) => handleChange('language', e.target.value)}
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
          <h3 className="text-lg font-semibold text-white mb-4">Date & Time</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-slate-300">Date Format</label>
                <SaveIndicator field="dateFormat" savingField={savingField} savedField={savedField} />
              </div>
              <select
                value={preferences.dateFormat}
                onChange={(e) => handleChange('dateFormat', e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              >
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-slate-300">Time Format</label>
                <SaveIndicator field="timeFormat" savingField={savingField} savedField={savedField} />
              </div>
              <select
                value={preferences.timeFormat}
                onChange={(e) => handleChange('timeFormat', e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              >
                <option value="12h">12-hour (2:30 PM)</option>
                <option value="24h">24-hour (14:30)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <p className="text-sm text-slate-500 text-center">
        Changes are saved automatically
      </p>
    </div>
  );
}
