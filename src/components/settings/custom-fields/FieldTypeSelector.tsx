import {
  Type,
  AlignLeft,
  Hash,
  Phone,
  Mail,
  Calendar,
  CalendarClock,
  ChevronDown,
  ListChecks,
  CheckSquare,
  Circle,
  Link,
  Upload,
  ToggleLeft,
  DollarSign,
} from 'lucide-react';
import type { CustomFieldType } from '../../../types';

interface FieldTypeSelectorProps {
  value: CustomFieldType;
  onChange: (type: CustomFieldType) => void;
  disabled?: boolean;
  disabledTypes?: CustomFieldType[];
}

interface FieldTypeOption {
  value: CustomFieldType;
  label: string;
  description: string;
  icon: React.ElementType;
}

const fieldTypes: FieldTypeOption[] = [
  { value: 'text', label: 'Single Line Text', description: 'Short text input', icon: Type },
  { value: 'textarea', label: 'Multi-Line Text', description: 'Longer text with multiple lines', icon: AlignLeft },
  { value: 'number', label: 'Number', description: 'Numeric values', icon: Hash },
  { value: 'currency', label: 'Currency', description: 'Monetary values', icon: DollarSign },
  { value: 'phone', label: 'Phone Number', description: 'Phone with formatting', icon: Phone },
  { value: 'email', label: 'Email Address', description: 'Email with validation', icon: Mail },
  { value: 'date', label: 'Date', description: 'Date picker', icon: Calendar },
  { value: 'datetime', label: 'Date & Time', description: 'Date and time picker', icon: CalendarClock },
  { value: 'select', label: 'Dropdown', description: 'Single selection from options', icon: ChevronDown },
  { value: 'multi_select', label: 'Multi-Select', description: 'Multiple selections', icon: ListChecks },
  { value: 'checkbox', label: 'Checkbox', description: 'Yes/No toggle', icon: CheckSquare },
  { value: 'radio', label: 'Radio Buttons', description: 'Single selection with visible options', icon: Circle },
  { value: 'boolean', label: 'Boolean', description: 'True/False value', icon: ToggleLeft },
  { value: 'url', label: 'URL', description: 'Website link', icon: Link },
  { value: 'file', label: 'File Upload', description: 'Attach a file', icon: Upload },
];

export function FieldTypeSelector({
  value,
  onChange,
  disabled = false,
  disabledTypes = [],
}: FieldTypeSelectorProps) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {fieldTypes.map((type) => {
        const Icon = type.icon;
        const isSelected = value === type.value;
        const isDisabled = disabled || disabledTypes.includes(type.value);

        return (
          <button
            key={type.value}
            type="button"
            onClick={() => !isDisabled && onChange(type.value)}
            disabled={isDisabled}
            className={`
              relative p-3 rounded-lg border text-left transition-all
              ${isSelected
                ? 'border-cyan-500 bg-cyan-500/10 ring-1 ring-cyan-500/50'
                : 'border-slate-600 bg-slate-800 hover:border-cyan-500/50 hover:bg-slate-700/50'
              }
              ${isDisabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            <div className="flex items-start gap-3">
              <div className={`
                p-2 rounded-lg shrink-0
                ${isSelected ? 'bg-cyan-500/20 text-cyan-400' : 'bg-slate-700 text-slate-400'}
              `}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className={`text-sm font-medium truncate ${isSelected ? 'text-cyan-400' : 'text-white'}`}>
                  {type.label}
                </p>
                <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                  {type.description}
                </p>
              </div>
            </div>
            {isSelected && (
              <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-cyan-400" />
            )}
          </button>
        );
      })}
    </div>
  );
}
