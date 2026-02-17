import { useState } from 'react';
import { ArrowUpDown, Download, Layers, Users, GitBranch } from 'lucide-react';
import type {
  ProjectProfitabilityRow,
  OwnerProfitabilityRow,
  StageProfitabilityRow,
} from '../../types';
import { exportToCsv } from '../../services/projectProfitability';

interface Props {
  projectRows: ProjectProfitabilityRow[];
  ownerRows: OwnerProfitabilityRow[];
  stageRows: StageProfitabilityRow[];
  isLoading: boolean;
}

type Tab = 'projects' | 'owners' | 'stages';
type SortDir = 'asc' | 'desc';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);

const statusColors: Record<string, string> = {
  active: 'bg-emerald-500/20 text-emerald-400',
  on_hold: 'bg-amber-500/20 text-amber-400',
  completed: 'bg-blue-500/20 text-blue-400',
  cancelled: 'bg-slate-500/20 text-slate-400',
};

function marginColor(m: number) {
  if (m >= 40) return 'text-emerald-400';
  if (m >= 20) return 'text-amber-400';
  if (m >= 0) return 'text-orange-400';
  return 'text-red-400';
}

function SortHeader({
  label,
  field,
  currentField,
  currentDir,
  onSort,
}: {
  label: string;
  field: string;
  currentField: string;
  currentDir: SortDir;
  onSort: (f: string) => void;
}) {
  const active = currentField === field;
  return (
    <button
      onClick={() => onSort(field)}
      className="flex items-center gap-1 text-left hover:text-white transition-colors group"
    >
      {label}
      <ArrowUpDown
        className={`w-3 h-3 ${active ? 'text-cyan-400' : 'text-slate-600 group-hover:text-slate-400'}`}
      />
      {active && (
        <span className="text-[10px] text-cyan-500">{currentDir === 'asc' ? 'ASC' : 'DESC'}</span>
      )}
    </button>
  );
}

export function ProfitabilityTables({ projectRows, ownerRows, stageRows, isLoading }: Props) {
  const [tab, setTab] = useState<Tab>('projects');
  const [sortField, setSortField] = useState('gross_profit');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  function toggleSort(field: string) {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  }

  function sortedProjects() {
    return [...projectRows].sort((a, b) => {
      const va = Number((a as Record<string, unknown>)[sortField] ?? 0);
      const vb = Number((b as Record<string, unknown>)[sortField] ?? 0);
      return sortDir === 'asc' ? va - vb : vb - va;
    });
  }

  function sortedOwners() {
    return [...ownerRows].sort((a, b) => {
      const va = Number((a as Record<string, unknown>)[sortField] ?? 0);
      const vb = Number((b as Record<string, unknown>)[sortField] ?? 0);
      return sortDir === 'asc' ? va - vb : vb - va;
    });
  }

  function sortedStages() {
    return [...stageRows].sort((a, b) => {
      const va = Number((a as Record<string, unknown>)[sortField] ?? 0);
      const vb = Number((b as Record<string, unknown>)[sortField] ?? 0);
      return sortDir === 'asc' ? va - vb : vb - va;
    });
  }

  function handleExport() {
    if (tab === 'projects') {
      exportToCsv(
        ['project_name', 'project_status', 'owner_name', 'pipeline_name', 'stage_name', 'total_invoiced', 'total_costs', 'gross_profit', 'margin_percent', 'total_collected'],
        projectRows.map((r) => ({ ...r })),
        'project-profitability'
      );
    } else if (tab === 'owners') {
      exportToCsv(
        ['user_name', 'project_count', 'total_revenue', 'total_costs', 'total_profit', 'avg_margin'],
        ownerRows.map((r) => ({ ...r })),
        'profitability-by-owner'
      );
    } else {
      exportToCsv(
        ['stage_name', 'pipeline_name', 'project_count', 'avg_revenue', 'avg_cost', 'avg_margin'],
        stageRows.map((r) => ({ ...r })),
        'profitability-by-stage'
      );
    }
  }

  const tabs: { key: Tab; label: string; icon: typeof Layers }[] = [
    { key: 'projects', label: 'By Project', icon: Layers },
    { key: 'owners', label: 'By Owner', icon: Users },
    { key: 'stages', label: 'By Stage', icon: GitBranch },
  ];

  if (isLoading) {
    return (
      <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-6 animate-pulse">
        <div className="h-5 w-32 bg-slate-700 rounded mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 bg-slate-700/40 rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/30 rounded-xl border border-slate-700/50">
      <div className="flex items-center justify-between px-6 pt-5 pb-3">
        <div className="flex gap-1">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => {
                  setTab(t.key);
                  setSortField(t.key === 'projects' ? 'gross_profit' : t.key === 'owners' ? 'total_profit' : 'avg_margin');
                  setSortDir('desc');
                }}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            );
          })}
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-700 text-slate-300 hover:text-white hover:bg-slate-600 text-sm transition-colors"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      <div className="overflow-x-auto">
        {tab === 'projects' && (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 text-xs uppercase tracking-wider border-b border-slate-700/50">
                <th className="text-left px-6 py-3 font-medium">Project</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Owner</th>
                <th className="text-left px-4 py-3 font-medium">Pipeline / Stage</th>
                <th className="text-right px-4 py-3 font-medium">
                  <SortHeader label="Revenue" field="total_invoiced" currentField={sortField} currentDir={sortDir} onSort={toggleSort} />
                </th>
                <th className="text-right px-4 py-3 font-medium">
                  <SortHeader label="Costs" field="total_costs" currentField={sortField} currentDir={sortDir} onSort={toggleSort} />
                </th>
                <th className="text-right px-4 py-3 font-medium">
                  <SortHeader label="Profit" field="gross_profit" currentField={sortField} currentDir={sortDir} onSort={toggleSort} />
                </th>
                <th className="text-right px-6 py-3 font-medium">
                  <SortHeader label="Margin" field="margin_percent" currentField={sortField} currentDir={sortDir} onSort={toggleSort} />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/30">
              {sortedProjects().map((r) => (
                <tr key={r.project_id} className="hover:bg-slate-700/20 transition-colors">
                  <td className="px-6 py-3 text-white font-medium max-w-[200px] truncate">{r.project_name}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium capitalize ${statusColors[r.project_status] || statusColors.active}`}>
                      {r.project_status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-300">{r.owner_name}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">
                    {r.pipeline_name}{r.stage_name ? ` / ${r.stage_name}` : ''}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-300 tabular-nums">{fmt(Number(r.total_invoiced))}</td>
                  <td className="px-4 py-3 text-right text-slate-300 tabular-nums">{fmt(Number(r.total_costs))}</td>
                  <td className={`px-4 py-3 text-right font-medium tabular-nums ${Number(r.gross_profit) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {fmt(Number(r.gross_profit))}
                  </td>
                  <td className={`px-6 py-3 text-right font-medium tabular-nums ${marginColor(Number(r.margin_percent))}`}>
                    {Number(r.margin_percent)}%
                  </td>
                </tr>
              ))}
              {projectRows.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-500">No projects found</td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {tab === 'owners' && (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 text-xs uppercase tracking-wider border-b border-slate-700/50">
                <th className="text-left px-6 py-3 font-medium">Owner</th>
                <th className="text-right px-4 py-3 font-medium">
                  <SortHeader label="Projects" field="project_count" currentField={sortField} currentDir={sortDir} onSort={toggleSort} />
                </th>
                <th className="text-right px-4 py-3 font-medium">
                  <SortHeader label="Revenue" field="total_revenue" currentField={sortField} currentDir={sortDir} onSort={toggleSort} />
                </th>
                <th className="text-right px-4 py-3 font-medium">
                  <SortHeader label="Costs" field="total_costs" currentField={sortField} currentDir={sortDir} onSort={toggleSort} />
                </th>
                <th className="text-right px-4 py-3 font-medium">
                  <SortHeader label="Profit" field="total_profit" currentField={sortField} currentDir={sortDir} onSort={toggleSort} />
                </th>
                <th className="text-right px-6 py-3 font-medium">
                  <SortHeader label="Avg Margin" field="avg_margin" currentField={sortField} currentDir={sortDir} onSort={toggleSort} />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/30">
              {sortedOwners().map((r) => (
                <tr key={r.user_id} className="hover:bg-slate-700/20 transition-colors">
                  <td className="px-6 py-3 text-white font-medium">{r.user_name}</td>
                  <td className="px-4 py-3 text-right text-slate-300 tabular-nums">{r.project_count}</td>
                  <td className="px-4 py-3 text-right text-slate-300 tabular-nums">{fmt(Number(r.total_revenue))}</td>
                  <td className="px-4 py-3 text-right text-slate-300 tabular-nums">{fmt(Number(r.total_costs))}</td>
                  <td className={`px-4 py-3 text-right font-medium tabular-nums ${Number(r.total_profit) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {fmt(Number(r.total_profit))}
                  </td>
                  <td className={`px-6 py-3 text-right font-medium tabular-nums ${marginColor(Number(r.avg_margin))}`}>
                    {Number(r.avg_margin)}%
                  </td>
                </tr>
              ))}
              {ownerRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-500">No owner data available</td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {tab === 'stages' && (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 text-xs uppercase tracking-wider border-b border-slate-700/50">
                <th className="text-left px-6 py-3 font-medium">Stage</th>
                <th className="text-left px-4 py-3 font-medium">Pipeline</th>
                <th className="text-right px-4 py-3 font-medium">
                  <SortHeader label="Projects" field="project_count" currentField={sortField} currentDir={sortDir} onSort={toggleSort} />
                </th>
                <th className="text-right px-4 py-3 font-medium">
                  <SortHeader label="Avg Revenue" field="avg_revenue" currentField={sortField} currentDir={sortDir} onSort={toggleSort} />
                </th>
                <th className="text-right px-4 py-3 font-medium">
                  <SortHeader label="Avg Cost" field="avg_cost" currentField={sortField} currentDir={sortDir} onSort={toggleSort} />
                </th>
                <th className="text-right px-6 py-3 font-medium">
                  <SortHeader label="Avg Margin" field="avg_margin" currentField={sortField} currentDir={sortDir} onSort={toggleSort} />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/30">
              {sortedStages().map((r) => (
                <tr key={r.stage_id} className="hover:bg-slate-700/20 transition-colors">
                  <td className="px-6 py-3 text-white font-medium">{r.stage_name}</td>
                  <td className="px-4 py-3 text-slate-400">{r.pipeline_name}</td>
                  <td className="px-4 py-3 text-right text-slate-300 tabular-nums">{r.project_count}</td>
                  <td className="px-4 py-3 text-right text-slate-300 tabular-nums">{fmt(Number(r.avg_revenue))}</td>
                  <td className="px-4 py-3 text-right text-slate-300 tabular-nums">{fmt(Number(r.avg_cost))}</td>
                  <td className={`px-6 py-3 text-right font-medium tabular-nums ${marginColor(Number(r.avg_margin))}`}>
                    {Number(r.avg_margin)}%
                  </td>
                </tr>
              ))}
              {stageRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-500">No stage data available</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
