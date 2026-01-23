import type { LucideIcon } from 'lucide-react';

interface QuickActionButtonProps {
  icon: LucideIcon;
  label: string;
  sublabel?: string;
  onClick: () => void;
  disabled?: boolean;
  iconColor?: string;
}

export function QuickActionButton({
  icon: Icon,
  label,
  sublabel,
  onClick,
  disabled,
  iconColor = 'text-cyan-400',
}: QuickActionButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center justify-center p-4 bg-slate-800 border border-slate-700 rounded-xl transition-all min-w-[120px] ${
        disabled
          ? 'opacity-50 cursor-not-allowed'
          : 'hover:bg-slate-700 hover:border-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/40'
      }`}
    >
      <Icon className={`h-6 w-6 ${iconColor} mb-2`} />
      <span className="text-sm font-medium text-white">{label}</span>
      {sublabel && <span className="text-xs text-slate-500 mt-0.5">{sublabel}</span>}
    </button>
  );
}
