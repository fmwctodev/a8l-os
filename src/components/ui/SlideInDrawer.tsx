import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface SlideInDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  icon?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
}

const widthClasses = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-xl',
  xl: 'max-w-2xl',
  '2xl': 'max-w-4xl',
  '3xl': 'max-w-6xl',
};

export function SlideInDrawer({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  children,
  footer,
  width = 'lg',
}: SlideInDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen && drawerRef.current) {
      drawerRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="fixed inset-y-0 right-0 flex max-w-full pl-10">
        <div
          ref={drawerRef}
          tabIndex={-1}
          className={`w-screen ${widthClasses[width]} transform transition-transform duration-300 ease-out`}
          style={{ transform: isOpen ? 'translateX(0)' : 'translateX(100%)' }}
        >
          <div className="flex h-full flex-col bg-slate-900 border-l border-slate-800 shadow-xl">
            {(title || icon) && (
              <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  {icon && (
                    <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400">
                      {icon}
                    </div>
                  )}
                  <div>
                    {title && <h2 className="text-lg font-semibold text-white">{title}</h2>}
                    {subtitle && <p className="text-sm text-slate-400 mt-0.5">{subtitle}</p>}
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
                  aria-label="Close drawer"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto">{children}</div>

            {footer && (
              <div className="border-t border-slate-800 px-6 py-4 bg-slate-900">{footer}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
