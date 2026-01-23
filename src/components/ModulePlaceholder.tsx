import type { LucideIcon } from 'lucide-react';

interface ModulePlaceholderProps {
  icon: LucideIcon;
  name: string;
  description?: string;
}

export function ModulePlaceholder({ icon: Icon, name, description }: ModulePlaceholderProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <div className="w-20 h-20 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mb-6">
        <Icon className="w-10 h-10 text-slate-500" />
      </div>
      <h1 className="text-2xl font-semibold text-white mb-2">{name}</h1>
      <p className="text-slate-400 text-center max-w-md">
        {description || 'This module is not yet implemented. Check back later for updates.'}
      </p>
      <div className="mt-6 px-4 py-2 rounded-full bg-slate-800 border border-slate-700">
        <span className="text-xs font-medium text-slate-400">Coming Soon</span>
      </div>
    </div>
  );
}
