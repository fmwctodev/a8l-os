import { useState } from 'react';
import { Search, Filter, X, ChevronDown } from 'lucide-react';
import type { OpportunityFilters, User, Department, OpportunityStatus } from '../../types';

interface BoardFiltersProps {
  filters: OpportunityFilters;
  users: User[];
  departments: Department[];
  onFilterChange: (filters: OpportunityFilters) => void;
}

export function BoardFilters({ filters, users, departments, onFilterChange }: BoardFiltersProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const statusOptions: { value: OpportunityStatus; label: string }[] = [
    { value: 'open', label: 'Open' },
    { value: 'won', label: 'Won' },
    { value: 'lost', label: 'Lost' }
  ];

  const handleStatusToggle = (status: OpportunityStatus) => {
    const current = filters.status || [];
    const updated = current.includes(status)
      ? current.filter(s => s !== status)
      : [...current, status];
    onFilterChange({ ...filters, status: updated.length > 0 ? updated : undefined });
  };

  const activeFilterCount = [
    filters.status?.length,
    filters.assignedUserId !== undefined ? 1 : 0,
    filters.departmentId ? 1 : 0,
    filters.minValue !== undefined ? 1 : 0,
    filters.maxValue !== undefined ? 1 : 0
  ].reduce((a, b) => a + (b || 0), 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={filters.search || ''}
            onChange={(e) => onFilterChange({ ...filters, search: e.target.value || undefined })}
            placeholder="Search by contact name, email, or phone..."
            className="w-full pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400"
          />
        </div>

        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
            showAdvanced || activeFilterCount > 0
              ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400'
              : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'
          }`}
        >
          <Filter className="w-4 h-4" />
          Filters
          {activeFilterCount > 0 && (
            <span className="px-1.5 py-0.5 bg-cyan-500 text-white text-xs rounded-full">
              {activeFilterCount}
            </span>
          )}
          <ChevronDown className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
        </button>

        {activeFilterCount > 0 && (
          <button
            onClick={() => onFilterChange({})}
            className="flex items-center gap-1 px-3 py-2 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
            Clear all
          </button>
        )}
      </div>

      {showAdvanced && (
        <div className="p-4 bg-slate-700/50 rounded-lg space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Status</label>
              <div className="flex flex-wrap gap-2">
                {statusOptions.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => handleStatusToggle(opt.value)}
                    className={`px-2 py-1 rounded text-sm ${
                      filters.status?.includes(opt.value)
                        ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50'
                        : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">Assigned To</label>
              <select
                value={filters.assignedUserId === null ? 'unassigned' : filters.assignedUserId || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  onFilterChange({
                    ...filters,
                    assignedUserId: val === '' ? undefined : val === 'unassigned' ? null : val
                  });
                }}
                className="w-full px-3 py-1.5 bg-slate-600 border border-slate-500 rounded text-white text-sm"
              >
                <option value="">All users</option>
                <option value="unassigned">Unassigned</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">Department</label>
              <select
                value={filters.departmentId || ''}
                onChange={(e) => onFilterChange({ ...filters, departmentId: e.target.value || undefined })}
                className="w-full px-3 py-1.5 bg-slate-600 border border-slate-500 rounded text-white text-sm"
              >
                <option value="">All departments</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">Value Range</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={filters.minValue ?? ''}
                  onChange={(e) => onFilterChange({
                    ...filters,
                    minValue: e.target.value ? parseFloat(e.target.value) : undefined
                  })}
                  placeholder="Min"
                  className="w-full px-2 py-1.5 bg-slate-600 border border-slate-500 rounded text-white text-sm"
                />
                <span className="text-slate-400">-</span>
                <input
                  type="number"
                  value={filters.maxValue ?? ''}
                  onChange={(e) => onFilterChange({
                    ...filters,
                    maxValue: e.target.value ? parseFloat(e.target.value) : undefined
                  })}
                  placeholder="Max"
                  className="w-full px-2 py-1.5 bg-slate-600 border border-slate-500 rounded text-white text-sm"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
