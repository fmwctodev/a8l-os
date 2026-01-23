import { useState } from 'react';
import { Check, ChevronDown, ChevronRight, GripVertical } from 'lucide-react';
import type { ReportDimension, ReportMetric, ReportDateGrouping } from '../../types';
import { dateGroupingOptions } from '../../config/reportingFields';

interface FieldPickerProps {
  title: string;
  availableFields: Array<ReportDimension | ReportMetric>;
  selectedFields: Array<ReportDimension | ReportMetric>;
  onToggle: (field: ReportDimension | ReportMetric) => void;
  onUpdateDateGrouping?: (fieldId: string, grouping: ReportDateGrouping) => void;
  type: 'dimension' | 'metric';
}

export function FieldPicker({
  title,
  availableFields,
  selectedFields,
  onToggle,
  onUpdateDateGrouping,
  type,
}: FieldPickerProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const isSelected = (field: ReportDimension | ReportMetric) =>
    selectedFields.some((f) => f.id === field.id);

  const getSelectedField = (fieldId: string) =>
    selectedFields.find((f) => f.id === fieldId);

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-slate-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-500" />
          )}
          <span className="font-medium text-slate-700">{title}</span>
          <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">
            {selectedFields.length} selected
          </span>
        </div>
      </button>

      {isExpanded && (
        <div className="divide-y divide-slate-100">
          {availableFields.map((field) => {
            const selected = isSelected(field);
            const selectedField = selected ? getSelectedField(field.id) : null;
            const isDimension = type === 'dimension';
            const dimension = field as ReportDimension;
            const showDateGrouping =
              isDimension && dimension.dataType === 'date' && selected && onUpdateDateGrouping;

            return (
              <div
                key={field.id}
                className={`transition-colors ${selected ? 'bg-sky-50' : 'hover:bg-slate-50'}`}
              >
                <button
                  type="button"
                  onClick={() => onToggle(field)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left"
                >
                  <div
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                      selected
                        ? 'bg-sky-500 border-sky-500'
                        : 'border-slate-300 hover:border-slate-400'
                    }`}
                  >
                    {selected && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <span className={`text-sm ${selected ? 'text-sky-700 font-medium' : 'text-slate-600'}`}>
                    {field.label}
                  </span>
                </button>

                {showDateGrouping && (
                  <div className="px-4 pb-2.5 pl-12">
                    <select
                      value={(selectedField as ReportDimension)?.dateGrouping || 'day'}
                      onChange={(e) => onUpdateDateGrouping(field.id, e.target.value as ReportDateGrouping)}
                      className="text-xs border border-slate-300 rounded px-2 py-1 bg-white text-slate-600"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {dateGroupingOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          Group by {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            );
          })}

          {availableFields.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-slate-400">
              No fields available
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface SelectedFieldsListProps {
  fields: Array<ReportDimension | ReportMetric>;
  onRemove: (field: ReportDimension | ReportMetric) => void;
  onReorder?: (fields: Array<ReportDimension | ReportMetric>) => void;
  emptyMessage?: string;
}

export function SelectedFieldsList({ fields, onRemove, emptyMessage = 'No fields selected' }: SelectedFieldsListProps) {
  if (fields.length === 0) {
    return (
      <div className="text-sm text-slate-400 text-center py-4 border border-dashed border-slate-200 rounded-lg">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {fields.map((field, index) => (
        <div
          key={field.id}
          className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg group"
        >
          <GripVertical className="w-4 h-4 text-slate-300 cursor-grab" />
          <span className="flex-1 text-sm text-slate-700">{field.label}</span>
          <button
            type="button"
            onClick={() => onRemove(field)}
            className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            &times;
          </button>
        </div>
      ))}
    </div>
  );
}
