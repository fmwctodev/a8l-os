import { type ReactNode } from 'react';
import { ChevronDown, type LucideIcon } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

interface SecondaryAction {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  variant?: 'default' | 'danger';
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  primaryAction?: {
    label: string;
    icon?: LucideIcon;
    onClick: () => void;
  };
  secondaryActions?: SecondaryAction[];
  children?: ReactNode;
}

export function PageHeader({
  title,
  subtitle,
  icon: Icon,
  primaryAction,
  secondaryActions,
  children,
}: PageHeaderProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-500/10 to-teal-500/10 border border-cyan-500/20">
            <Icon className="w-6 h-6 text-cyan-400" />
          </div>
        )}
        <div>
          <h1 className="text-2xl font-semibold text-white">{title}</h1>
          {subtitle && <p className="text-sm text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {children}

        {secondaryActions && secondaryActions.length > 0 && (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="px-3 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors flex items-center gap-2"
            >
              <span className="text-sm font-medium">More</span>
              <ChevronDown className="w-4 h-4" />
            </button>
            {showDropdown && (
              <div className="absolute right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 overflow-hidden">
                {secondaryActions.map((action, index) => {
                  const ActionIcon = action.icon;
                  return (
                    <button
                      key={index}
                      onClick={() => {
                        action.onClick();
                        setShowDropdown(false);
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                        action.variant === 'danger'
                          ? 'text-red-400 hover:bg-red-500/10'
                          : 'text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {ActionIcon && <ActionIcon className="w-4 h-4" />}
                      {action.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {primaryAction && (
          <button
            onClick={primaryAction.onClick}
            className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-teal-500 text-white rounded-lg hover:from-cyan-600 hover:to-teal-600 transition-all flex items-center gap-2 font-medium text-sm shadow-lg shadow-cyan-500/25"
          >
            {primaryAction.icon && <primaryAction.icon className="w-4 h-4" />}
            {primaryAction.label}
          </button>
        )}
      </div>
    </div>
  );
}
