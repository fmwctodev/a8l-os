import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

interface DashboardSectionProps {
  title: string;
  viewAllLink?: string;
  viewAllLabel?: string;
  children: ReactNode;
  isLoading?: boolean;
  className?: string;
}

export function DashboardSection({
  title,
  viewAllLink,
  viewAllLabel = 'View all',
  children,
  isLoading,
  className = '',
}: DashboardSectionProps) {
  return (
    <div className={`bg-slate-800 rounded-xl border border-slate-700 ${className}`}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {viewAllLink && (
          <Link
            to={viewAllLink}
            className="flex items-center gap-1 text-xs font-medium text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            {viewAllLabel}
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
      <div className="p-5">{isLoading ? <LoadingSkeleton /> : children}</div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="h-10 w-10 bg-slate-700 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-3/4 bg-slate-700 rounded" />
            <div className="h-3 w-1/2 bg-slate-700 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
