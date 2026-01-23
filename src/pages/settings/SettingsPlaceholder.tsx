import { LucideIcon } from 'lucide-react';

interface SettingsPlaceholderProps {
  title: string;
  description: string;
  icon: LucideIcon;
}

export function SettingsPlaceholder({ title, description, icon: Icon }: SettingsPlaceholderProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
      <div className="p-4 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-teal-500/10 border border-cyan-500/20 mb-6">
        <Icon className="w-12 h-12 text-cyan-400" />
      </div>
      <h2 className="text-2xl font-semibold text-white mb-2">{title}</h2>
      <p className="text-slate-400 max-w-md mb-6">{description}</p>
      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 text-slate-400 text-sm">
        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
        Coming Soon
      </div>
    </div>
  );
}
