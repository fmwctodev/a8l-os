import { useState } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from 'lucide-react';
import type { ReportQueryResult, ReportSorting } from '../../types';

interface ReportTableProps {
  data: ReportQueryResult;
  sorting: ReportSorting[];
  onSortChange: (sorting: ReportSorting[]) => void;
  pageSize?: number;
}

export function ReportTable({ data, sorting, onSortChange, pageSize = 25 }: ReportTableProps) {
  const [currentPage, setCurrentPage] = useState(0);

  const totalPages = Math.ceil(data.rows.length / pageSize);
  const startIndex = currentPage * pageSize;
  const endIndex = Math.min(startIndex + pageSize, data.rows.length);
  const visibleRows = data.rows.slice(startIndex, endIndex);

  const handleSort = (columnKey: string) => {
    const existingSort = sorting.find((s) => s.field === columnKey);

    if (!existingSort) {
      onSortChange([{ field: columnKey, direction: 'asc' }]);
    } else if (existingSort.direction === 'asc') {
      onSortChange([{ field: columnKey, direction: 'desc' }]);
    } else {
      onSortChange([]);
    }
  };

  const getSortIcon = (columnKey: string) => {
    const sort = sorting.find((s) => s.field === columnKey);
    if (!sort) return <ArrowUpDown className="w-4 h-4 text-slate-300" />;
    if (sort.direction === 'asc') return <ArrowUp className="w-4 h-4 text-sky-500" />;
    return <ArrowDown className="w-4 h-4 text-sky-500" />;
  };

  const formatCellValue = (value: unknown, column: ReportQueryResult['columns'][0]) => {
    if (value === null || value === undefined) return '-';

    if (column.type === 'metric') {
      const numValue = Number(value);
      if (column.format === 'percentage') {
        return `${(numValue * 100).toFixed(1)}%`;
      }
      if (column.format === 'currency') {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(numValue);
      }
      if (column.format === 'duration') {
        const hours = Math.floor(numValue / 3600);
        const minutes = Math.floor((numValue % 3600) / 60);
        return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
      }
      return numValue.toLocaleString(undefined, { maximumFractionDigits: 2 });
    }

    if (column.dataType === 'date' || (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/))) {
      return new Date(String(value)).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    }

    return String(value);
  };

  if (data.rows.length === 0) {
    return (
      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <div className="p-12 text-center">
          <div className="text-slate-400 text-sm">No data to display</div>
          <div className="text-slate-300 text-xs mt-1">Try adjusting your filters or time range</div>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              {data.columns.map((column) => (
                <th
                  key={column.key}
                  className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors"
                  onClick={() => handleSort(column.key)}
                >
                  <div className="flex items-center gap-2">
                    <span>{column.label}</span>
                    {getSortIcon(column.key)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visibleRows.map((row, rowIndex) => (
              <tr key={rowIndex} className="hover:bg-slate-50 transition-colors">
                {data.columns.map((column) => (
                  <td key={column.key} className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">
                    {formatCellValue(row[column.key], column)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-t border-slate-200">
          <div className="text-sm text-slate-500">
            Showing {startIndex + 1} to {endIndex} of {data.rows.length} results
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
              disabled={currentPage === 0}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i;
                } else if (currentPage < 3) {
                  pageNum = i;
                } else if (currentPage > totalPages - 4) {
                  pageNum = totalPages - 5 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }

                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-8 h-8 text-sm rounded-lg transition-colors ${
                      currentPage === pageNum
                        ? 'bg-sky-500 text-white'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {pageNum + 1}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
              disabled={currentPage === totalPages - 1}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
