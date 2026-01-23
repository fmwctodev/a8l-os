import { Plus, Trash2 } from 'lucide-react';
import type { ReportFilter, ReportFilterOperator, ReportDimension } from '../../types';
import { filterOperators } from '../../config/reportingFields';

interface FilterBuilderProps {
  filters: ReportFilter[];
  availableFields: ReportDimension[];
  onAdd: () => void;
  onUpdate: (index: number, filter: ReportFilter) => void;
  onRemove: (index: number) => void;
}

export function FilterBuilder({ filters, availableFields, onAdd, onUpdate, onRemove }: FilterBuilderProps) {
  const getOperatorsForField = (field: ReportDimension | undefined) => {
    if (!field) return filterOperators.string;
    return filterOperators[field.dataType] || filterOperators.string;
  };

  const getFieldByName = (fieldName: string) => availableFields.find((f) => f.field === fieldName);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-slate-700">Filters</label>
        <button
          type="button"
          onClick={onAdd}
          disabled={availableFields.length === 0}
          className="flex items-center gap-1.5 text-sm text-sky-600 hover:text-sky-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" />
          Add Filter
        </button>
      </div>

      {filters.length === 0 ? (
        <div className="text-sm text-slate-400 text-center py-4 border border-dashed border-slate-200 rounded-lg">
          No filters applied
        </div>
      ) : (
        <div className="space-y-2">
          {filters.map((filter, index) => {
            const selectedField = getFieldByName(filter.field);
            const operators = getOperatorsForField(selectedField);

            return (
              <div key={filter.id} className="flex items-start gap-2 p-3 bg-slate-50 rounded-lg">
                <div className="flex-1 grid grid-cols-3 gap-2">
                  <select
                    value={filter.field}
                    onChange={(e) => {
                      const newField = getFieldByName(e.target.value);
                      onUpdate(index, {
                        ...filter,
                        field: e.target.value,
                        dataType: newField?.dataType || 'string',
                        operator: 'equals',
                        value: '',
                      });
                    }}
                    className="text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white"
                  >
                    <option value="">Select field...</option>
                    {availableFields.map((field) => (
                      <option key={field.id} value={field.field}>
                        {field.label}
                      </option>
                    ))}
                  </select>

                  <select
                    value={filter.operator}
                    onChange={(e) =>
                      onUpdate(index, { ...filter, operator: e.target.value as ReportFilterOperator })
                    }
                    disabled={!filter.field}
                    className="text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white disabled:bg-slate-100"
                  >
                    {operators.map((op) => (
                      <option key={op.value} value={op.value}>
                        {op.label}
                      </option>
                    ))}
                  </select>

                  {!['is_empty', 'is_not_empty'].includes(filter.operator) && (
                    <FilterValueInput
                      filter={filter}
                      field={selectedField}
                      onChange={(value) => onUpdate(index, { ...filter, value })}
                    />
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => onRemove(index)}
                  className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface FilterValueInputProps {
  filter: ReportFilter;
  field: ReportDimension | undefined;
  onChange: (value: ReportFilter['value']) => void;
}

function FilterValueInput({ filter, field, onChange }: FilterValueInputProps) {
  const dataType = field?.dataType || 'string';

  if (filter.operator === 'between') {
    const values = Array.isArray(filter.value) ? filter.value : ['', ''];
    return (
      <div className="flex items-center gap-1">
        <input
          type={dataType === 'date' ? 'date' : dataType === 'number' ? 'number' : 'text'}
          value={String(values[0] || '')}
          onChange={(e) => onChange([e.target.value, values[1]])}
          className="flex-1 text-sm border border-slate-300 rounded-lg px-3 py-2"
          placeholder="From"
        />
        <span className="text-slate-400 text-xs">to</span>
        <input
          type={dataType === 'date' ? 'date' : dataType === 'number' ? 'number' : 'text'}
          value={String(values[1] || '')}
          onChange={(e) => onChange([values[0], e.target.value])}
          className="flex-1 text-sm border border-slate-300 rounded-lg px-3 py-2"
          placeholder="To"
        />
      </div>
    );
  }

  if (['in', 'not_in'].includes(filter.operator)) {
    const values = Array.isArray(filter.value) ? filter.value.join(', ') : '';
    return (
      <input
        type="text"
        value={values}
        onChange={(e) => onChange(e.target.value.split(',').map((v) => v.trim()))}
        className="text-sm border border-slate-300 rounded-lg px-3 py-2"
        placeholder="Value1, Value2, ..."
      />
    );
  }

  if (dataType === 'boolean') {
    return (
      <select
        value={String(filter.value)}
        onChange={(e) => onChange(e.target.value === 'true')}
        className="text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white"
      >
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    );
  }

  if (dataType === 'date') {
    return (
      <input
        type="date"
        value={String(filter.value || '')}
        onChange={(e) => onChange(e.target.value)}
        className="text-sm border border-slate-300 rounded-lg px-3 py-2"
      />
    );
  }

  if (dataType === 'number') {
    return (
      <input
        type="number"
        value={String(filter.value || '')}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="text-sm border border-slate-300 rounded-lg px-3 py-2"
        placeholder="Enter value..."
      />
    );
  }

  return (
    <input
      type="text"
      value={String(filter.value || '')}
      onChange={(e) => onChange(e.target.value)}
      className="text-sm border border-slate-300 rounded-lg px-3 py-2"
      placeholder="Enter value..."
    />
  );
}
