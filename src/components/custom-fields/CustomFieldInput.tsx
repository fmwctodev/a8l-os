import { HelpCircle } from 'lucide-react';
import type { CustomField } from '../../types';

interface CustomFieldInputProps {
  field: CustomField;
  value: unknown;
  onChange: (value: unknown) => void;
  disabled?: boolean;
  error?: string;
}

export function CustomFieldInput({
  field,
  value,
  onChange,
  disabled = false,
  error,
}: CustomFieldInputProps) {
  const baseInputClass = `w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent disabled:bg-slate-100 disabled:cursor-not-allowed ${
    error ? 'border-red-300' : 'border-slate-300'
  }`;

  function renderInput() {
    switch (field.field_type) {
      case 'text':
      case 'phone':
      case 'email':
      case 'url':
        return (
          <input
            type={field.field_type === 'email' ? 'email' : field.field_type === 'url' ? 'url' : 'text'}
            value={(value as string) || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder || undefined}
            disabled={disabled}
            className={baseInputClass}
          />
        );

      case 'textarea':
        return (
          <textarea
            value={(value as string) || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder || undefined}
            disabled={disabled}
            rows={3}
            className={baseInputClass}
          />
        );

      case 'number':
        return (
          <input
            type="number"
            value={value !== null && value !== undefined ? String(value) : ''}
            onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
            placeholder={field.placeholder || undefined}
            disabled={disabled}
            className={baseInputClass}
          />
        );

      case 'currency':
        return (
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
            <input
              type="number"
              step="0.01"
              value={value !== null && value !== undefined ? String(value) : ''}
              onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
              placeholder={field.placeholder || '0.00'}
              disabled={disabled}
              className={`${baseInputClass} pl-7`}
            />
          </div>
        );

      case 'date':
        return (
          <input
            type="date"
            value={(value as string) || ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className={baseInputClass}
          />
        );

      case 'datetime':
        return (
          <input
            type="datetime-local"
            value={(value as string) || ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className={baseInputClass}
          />
        );

      case 'select':
        return (
          <select
            value={(value as string) || ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className={baseInputClass}
          >
            <option value="">{field.placeholder || 'Select...'}</option>
            {(field.options || []).map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        );

      case 'multi_select':
        const selectedValues = Array.isArray(value) ? value : [];
        return (
          <div className="space-y-2">
            {(field.options || []).map((opt) => (
              <label key={opt} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedValues.includes(opt)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      onChange([...selectedValues, opt]);
                    } else {
                      onChange(selectedValues.filter((v) => v !== opt));
                    }
                  }}
                  disabled={disabled}
                  className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                />
                <span className="text-sm text-slate-700">{opt}</span>
              </label>
            ))}
          </div>
        );

      case 'radio':
        return (
          <div className="space-y-2">
            {(field.options || []).map((opt) => (
              <label key={opt} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name={`field_${field.id}`}
                  checked={value === opt}
                  onChange={() => onChange(opt)}
                  disabled={disabled}
                  className="w-4 h-4 border-slate-300 text-slate-900 focus:ring-slate-900"
                />
                <span className="text-sm text-slate-700">{opt}</span>
              </label>
            ))}
          </div>
        );

      case 'boolean':
        return (
          <select
            value={value === true ? 'true' : value === false ? 'false' : ''}
            onChange={(e) => {
              if (e.target.value === 'true') onChange(true);
              else if (e.target.value === 'false') onChange(false);
              else onChange(null);
            }}
            disabled={disabled}
            className={baseInputClass}
          >
            <option value="">Select...</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        );

      case 'checkbox':
        return (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={!!value}
              onChange={(e) => onChange(e.target.checked)}
              disabled={disabled}
              className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
            />
            <span className="text-sm text-slate-700">{field.name}</span>
          </label>
        );

      case 'file':
        return (
          <div className="text-sm text-slate-500 italic">
            File upload not available in this view
          </div>
        );

      default:
        return (
          <input
            type="text"
            value={(value as string) || ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className={baseInputClass}
          />
        );
    }
  }

  if (field.field_type === 'checkbox') {
    return (
      <div>
        {renderInput()}
        {field.help_text && (
          <p className="mt-1 text-xs text-slate-500">{field.help_text}</p>
        )}
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div>
      <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 mb-1">
        {field.name}
        {field.is_required && <span className="text-red-500">*</span>}
        {field.help_text && (
          <span className="group relative">
            <HelpCircle className="w-3.5 h-3.5 text-slate-400 cursor-help" />
            <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2 py-1 text-xs text-white bg-slate-800 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              {field.help_text}
            </span>
          </span>
        )}
      </label>
      {renderInput()}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
