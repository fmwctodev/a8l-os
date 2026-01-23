import { useState, useRef, useEffect, type ReactNode } from 'react';
import { Search, Filter, ChevronDown, X } from 'lucide-react';

interface SortOption {
  label: string;
  value: string;
}

interface FilterBarProps {
  searchPlaceholder?: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  filterCount?: number;
  onFilterClick?: () => void;
  sortOptions?: SortOption[];
  sortValue?: string;
  onSortChange?: (value: string) => void;
  children?: ReactNode;
}

export function FilterBar({
  searchPlaceholder = 'Search...',
  searchValue,
  onSearchChange,
  filterCount = 0,
  onFilterClick,
  sortOptions,
  sortValue,
  onSortChange,
  children,
}: FilterBarProps) {
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const sortDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(event.target as Node)) {
        setShowSortDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedSort = sortOptions?.find((opt) => opt.value === sortValue);

  return (
    <div className="flex flex-col sm:flex-row gap-3 mb-4">
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          type="text"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 text-sm"
        />
        {searchValue && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        {onFilterClick && (
          <button
            onClick={onFilterClick}
            className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors flex items-center gap-2 ${
              filterCount > 0
                ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Filter className="w-4 h-4" />
            <span>Filters</span>
            {filterCount > 0 && (
              <span className="min-w-[20px] h-5 px-1.5 bg-cyan-500 text-white text-xs font-semibold rounded-full flex items-center justify-center">
                {filterCount}
              </span>
            )}
          </button>
        )}

        {sortOptions && sortOptions.length > 0 && onSortChange && (
          <div className="relative" ref={sortDropdownRef}>
            <button
              onClick={() => setShowSortDropdown(!showSortDropdown)}
              className="px-3 py-2 bg-slate-800 border border-slate-700 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors flex items-center gap-2 text-sm"
            >
              <span>{selectedSort?.label || 'Sort'}</span>
              <ChevronDown className="w-4 h-4" />
            </button>
            {showSortDropdown && (
              <div className="absolute right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 overflow-hidden">
                {sortOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      onSortChange(option.value);
                      setShowSortDropdown(false);
                    }}
                    className={`w-full px-3 py-2 text-sm text-left transition-colors ${
                      option.value === sortValue
                        ? 'bg-cyan-500/10 text-cyan-400'
                        : 'text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {children}
      </div>
    </div>
  );
}
