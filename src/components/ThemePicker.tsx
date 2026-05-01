import { Check } from 'lucide-react';
import { FORM_THEMES } from '../constants/formThemes';

interface ThemePickerProps {
  value: string | undefined;
  onChange: (themeId: string) => void;
}

export function ThemePicker({ value, onChange }: ThemePickerProps) {
  const selectedId = value || FORM_THEMES[0].id;

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500">
        Pick a theme for the public form/survey page. Embed widget and link share both pick this up.
      </p>
      <div className="space-y-2">
        {FORM_THEMES.map((theme) => {
          const isSelected = theme.id === selectedId;
          return (
            <button
              key={theme.id}
              type="button"
              onClick={() => onChange(theme.id)}
              className={`w-full text-left rounded-lg border-2 p-3 transition-colors ${
                isSelected
                  ? 'border-blue-500 ring-2 ring-blue-100'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-md border border-black/10 shrink-0 overflow-hidden"
                  style={{ background: theme.pageBg }}
                >
                  <div
                    className="m-1.5 h-9 rounded"
                    style={{ background: theme.cardBg, border: `1px solid ${theme.cardBorder}` }}
                  >
                    <div
                      className="m-1 h-1.5 rounded"
                      style={{ background: `linear-gradient(90deg, ${theme.accentFrom}, ${theme.accentTo})` }}
                    />
                    <div
                      className="ml-1 mt-1 h-1 rounded"
                      style={{ background: theme.textMuted, opacity: 0.5, width: '60%' }}
                    />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 text-sm">{theme.name}</span>
                    {isSelected && <Check className="w-4 h-4 text-blue-600" />}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{theme.description}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
