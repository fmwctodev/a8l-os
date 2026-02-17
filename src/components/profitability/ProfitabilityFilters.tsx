import { useState, useEffect } from 'react';
import { Filter, RefreshCw, X } from 'lucide-react';
import type { ProfitabilityFilters as Filters, ProjectPipeline, User } from '../../types';
import { getProjectPipelines } from '../../services/projectPipelines';
import { getUsers } from '../../services/users';

interface Props {
  orgId: string;
  filters: Filters;
  onChange: (f: Filters) => void;
  onRefresh: () => void;
  isLoading: boolean;
}

type DatePreset = '7d' | '30d' | '90d' | 'ytd' | 'all';

const STATUSES = ['active', 'on_hold', 'completed', 'cancelled'];

export function ProfitabilityFilterBar({ orgId, filters, onChange, onRefresh, isLoading }: Props) {
  const [pipelines, setPipelines] = useState<ProjectPipeline[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [activePreset, setActivePreset] = useState<DatePreset>('all');

  useEffect(() => {
    getProjectPipelines(orgId).then(setPipelines).catch(() => {});
    getUsers(orgId).then(setUsers).catch(() => {});
  }, [orgId]);

  function applyPreset(preset: DatePreset) {
    setActivePreset(preset);
    const now = new Date();
    let dateFrom: string | undefined;

    if (preset === '7d') {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      dateFrom = d.toISOString().split('T')[0];
    } else if (preset === '30d') {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      dateFrom = d.toISOString().split('T')[0];
    } else if (preset === '90d') {
      const d = new Date(now);
      d.setDate(d.getDate() - 90);
      dateFrom = d.toISOString().split('T')[0];
    } else if (preset === 'ytd') {
      dateFrom = `${now.getFullYear()}-01-01`;
    }

    onChange({
      ...filters,
      dateFrom,
      dateTo: preset === 'all' ? undefined : now.toISOString().split('T')[0],
    });
  }

  function handleStatusToggle(status: string) {
    const current = filters.statuses ?? [];
    const next = current.includes(status)
      ? current.filter((s) => s !== status)
      : [...current, status];
    onChange({ ...filters, statuses: next.length ? next : undefined });
  }

  function clearAll() {
    setActivePreset('all');
    onChange({});
  }

  const hasFilters = filters.dateFrom || filters.statuses?.length || filters.pipelineId || filters.ownerId;

  const presets: { key: DatePreset; label: string }[] = [
    { key: '7d', label: '7D' },
    { key: '30d', label: '30D' },
    { key: '90d', label: '90D' },
    { key: 'ytd', label: 'YTD' },
    { key: 'all', label: 'All' },
  ];

  return (
    <div className="bg-slate-800/40 rounded-xl border border-slate-700/50 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-slate-400">
          <Filter className="w-4 h-4" />
          <span className="text-sm font-medium">Filters</span>
        </div>

        <div className="flex rounded-lg overflow-hidden border border-slate-600">
          {presets.map((p) => (
            <button
              key={p.key}
              onClick={() => applyPreset(p.key)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                activePreset === p.key
                  ? 'bg-cyan-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex gap-1 flex-wrap">
          {STATUSES.map((s) => {
            const active = filters.statuses?.includes(s);
            return (
              <button
                key={s}
                onClick={() => handleStatusToggle(s)}
                className={`px-2.5 py-1 text-xs rounded-md font-medium capitalize transition-colors ${
                  active
                    ? 'bg-cyan-600/20 text-cyan-300 border border-cyan-500/40'
                    : 'bg-slate-800 text-slate-400 border border-slate-600 hover:text-white hover:bg-slate-700'
                }`}
              >
                {s.replace('_', ' ')}
              </button>
            );
          })}
        </div>

        <select
          value={filters.pipelineId ?? ''}
          onChange={(e) => onChange({ ...filters, pipelineId: e.target.value || undefined })}
          className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-600 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
        >
          <option value="">All Pipelines</option>
          {pipelines.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        <select
          value={filters.ownerId ?? ''}
          onChange={(e) => onChange({ ...filters, ownerId: e.target.value || undefined })}
          className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-600 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
        >
          <option value="">All Owners</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>

        <div className="ml-auto flex items-center gap-2">
          {hasFilters && (
            <button
              onClick={clearAll}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Clear
            </button>
          )}
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-700 text-slate-300 hover:text-white hover:bg-slate-600 text-sm transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>
    </div>
  );
}
