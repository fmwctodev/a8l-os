export interface FormTheme {
  id: string;
  name: string;
  description: string;
  pageBg: string;
  cardBg: string;
  cardBorder: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  inputBg: string;
  inputBorder: string;
  inputText: string;
  inputPlaceholder: string;
  accentFrom: string;
  accentTo: string;
  accentSolid: string;
  accentText: string;
  selectedBg: string;
  selectedBorder: string;
  errorBg: string;
  errorBorder: string;
  errorText: string;
  successBg: string;
  successText: string;
}

export const FORM_THEMES: FormTheme[] = [
  {
    id: 'calendar-dark',
    name: 'Calendar Dark',
    description: 'Matches the default booking calendar (slate + cyan).',
    pageBg: '#020617',
    cardBg: '#0f172a',
    cardBorder: '#1e293b',
    textPrimary: '#ffffff',
    textSecondary: '#cbd5e1',
    textMuted: '#94a3b8',
    inputBg: '#1e293b',
    inputBorder: '#334155',
    inputText: '#ffffff',
    inputPlaceholder: '#64748b',
    accentFrom: '#06b6d4',
    accentTo: '#0d9488',
    accentSolid: '#06b6d4',
    accentText: '#ffffff',
    selectedBg: 'rgba(6, 182, 212, 0.20)',
    selectedBorder: '#06b6d4',
    errorBg: 'rgba(239, 68, 68, 0.10)',
    errorBorder: 'rgba(239, 68, 68, 0.30)',
    errorText: '#fca5a5',
    successBg: 'rgba(16, 185, 129, 0.15)',
    successText: '#34d399',
  },
  {
    id: 'light',
    name: 'Light',
    description: 'Bright white card on a soft gray background. Classic look.',
    pageBg: '#f8fafc',
    cardBg: '#ffffff',
    cardBorder: '#e5e7eb',
    textPrimary: '#0f172a',
    textSecondary: '#334155',
    textMuted: '#64748b',
    inputBg: '#ffffff',
    inputBorder: '#d1d5db',
    inputText: '#0f172a',
    inputPlaceholder: '#9ca3af',
    accentFrom: '#2563eb',
    accentTo: '#1d4ed8',
    accentSolid: '#2563eb',
    accentText: '#ffffff',
    selectedBg: '#eff6ff',
    selectedBorder: '#2563eb',
    errorBg: '#fef2f2',
    errorBorder: '#fecaca',
    errorText: '#dc2626',
    successBg: '#ecfdf5',
    successText: '#059669',
  },
  {
    id: 'minimal-slate',
    name: 'Minimal Slate',
    description: 'Light slate background with a subtle indigo accent.',
    pageBg: '#f1f5f9',
    cardBg: '#ffffff',
    cardBorder: '#cbd5e1',
    textPrimary: '#0f172a',
    textSecondary: '#475569',
    textMuted: '#64748b',
    inputBg: '#f8fafc',
    inputBorder: '#cbd5e1',
    inputText: '#0f172a',
    inputPlaceholder: '#94a3b8',
    accentFrom: '#6366f1',
    accentTo: '#4f46e5',
    accentSolid: '#6366f1',
    accentText: '#ffffff',
    selectedBg: '#eef2ff',
    selectedBorder: '#6366f1',
    errorBg: '#fef2f2',
    errorBorder: '#fecaca',
    errorText: '#dc2626',
    successBg: '#ecfdf5',
    successText: '#059669',
  },
  {
    id: 'midnight-violet',
    name: 'Midnight Violet',
    description: 'Deep navy with violet/purple accents. High contrast.',
    pageBg: '#0b0820',
    cardBg: '#171238',
    cardBorder: '#2c2456',
    textPrimary: '#ffffff',
    textSecondary: '#d8d4f0',
    textMuted: '#9c95c8',
    inputBg: '#231b4d',
    inputBorder: '#3a3070',
    inputText: '#ffffff',
    inputPlaceholder: '#7e76ad',
    accentFrom: '#a855f7',
    accentTo: '#7c3aed',
    accentSolid: '#a855f7',
    accentText: '#ffffff',
    selectedBg: 'rgba(168, 85, 247, 0.20)',
    selectedBorder: '#a855f7',
    errorBg: 'rgba(239, 68, 68, 0.10)',
    errorBorder: 'rgba(239, 68, 68, 0.30)',
    errorText: '#fca5a5',
    successBg: 'rgba(16, 185, 129, 0.15)',
    successText: '#34d399',
  },
];

export function getTheme(themeId: string | undefined): FormTheme {
  if (!themeId) return FORM_THEMES[0];
  return FORM_THEMES.find((t) => t.id === themeId) || FORM_THEMES[0];
}

export function themeStyleVars(theme: FormTheme): React.CSSProperties {
  return {
    '--form-page-bg': theme.pageBg,
    '--form-card-bg': theme.cardBg,
    '--form-card-border': theme.cardBorder,
    '--form-text-primary': theme.textPrimary,
    '--form-text-secondary': theme.textSecondary,
    '--form-text-muted': theme.textMuted,
    '--form-input-bg': theme.inputBg,
    '--form-input-border': theme.inputBorder,
    '--form-input-text': theme.inputText,
    '--form-input-placeholder': theme.inputPlaceholder,
    '--form-accent-from': theme.accentFrom,
    '--form-accent-to': theme.accentTo,
    '--form-accent-solid': theme.accentSolid,
    '--form-accent-text': theme.accentText,
    '--form-selected-bg': theme.selectedBg,
    '--form-selected-border': theme.selectedBorder,
    '--form-error-bg': theme.errorBg,
    '--form-error-border': theme.errorBorder,
    '--form-error-text': theme.errorText,
    '--form-success-bg': theme.successBg,
    '--form-success-text': theme.successText,
  } as React.CSSProperties;
}
