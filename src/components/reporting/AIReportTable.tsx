import type { ReportComposeTable } from '../../types/aiReports';

interface AIReportTableProps {
  table: ReportComposeTable;
}

function formatCellValue(value: unknown, format?: string): string {
  if (value == null) return '-';
  if (typeof value === 'number') {
    if (format === 'currency') {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
    }
    if (format === 'percentage') {
      return `${(value * 100).toFixed(1)}%`;
    }
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
  }
  return String(value);
}

export function AIReportTable({ table }: AIReportTableProps) {
  const { title, columns, rows } = table;

  if (!rows || rows.length === 0) {
    return (
      <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 p-6">
        <h3 className="text-sm font-semibold text-white mb-4">{title}</h3>
        <div className="text-sm text-slate-500 text-center py-8">No data available</div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-700/50">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-700/40">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/30">
            {rows.slice(0, 25).map((row, rowIdx) => (
              <tr key={rowIdx} className="hover:bg-slate-700/20 transition-colors">
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3 text-sm text-slate-300 whitespace-nowrap">
                    {formatCellValue(row[col.key], col.format)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > 25 && (
        <div className="px-6 py-3 border-t border-slate-700/40 text-xs text-slate-500">
          Showing 25 of {rows.length} rows
        </div>
      )}
    </div>
  );
}

interface AIReportTableListProps {
  tables: ReportComposeTable[];
}

export function AIReportTableList({ tables }: AIReportTableListProps) {
  if (!tables || tables.length === 0) return null;

  return (
    <div className="space-y-6">
      {tables.map((table) => (
        <AIReportTable key={table.table_id} table={table} />
      ))}
    </div>
  );
}
