import { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown, X } from 'lucide-react';

export type TimeRange = '7d' | '30d' | '90d' | 'custom';

interface TimeRangeSelectorProps {
  value: TimeRange;
  onChange: (range: TimeRange, startDate?: string, endDate?: string) => void;
  startDate?: string;
  endDate?: string;
}

const presets: { label: string; value: TimeRange }[] = [
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' },
  { label: 'Last 90 days', value: '90d' },
  { label: 'Custom range', value: 'custom' },
];

export function TimeRangeSelector({
  value,
  onChange,
  startDate,
  endDate,
}: TimeRangeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [customStart, setCustomStart] = useState(startDate || '');
  const [customEnd, setCustomEnd] = useState(endDate || '');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowCustomPicker(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getLabel = () => {
    if (value === 'custom' && startDate && endDate) {
      const start = new Date(startDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
      const end = new Date(endDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
      return `${start} - ${end}`;
    }
    return presets.find((p) => p.value === value)?.label || 'Last 30 days';
  };

  const handlePresetClick = (preset: TimeRange) => {
    if (preset === 'custom') {
      setShowCustomPicker(true);
    } else {
      onChange(preset);
      setIsOpen(false);
      setShowCustomPicker(false);
    }
  };

  const handleApplyCustom = () => {
    if (customStart && customEnd) {
      onChange('custom', customStart, customEnd);
      setIsOpen(false);
      setShowCustomPicker(false);
    }
  };

  const handleClearCustom = () => {
    setCustomStart('');
    setCustomEnd('');
    setShowCustomPicker(false);
    onChange('30d');
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
      >
        <Calendar className="w-4 h-4 text-gray-500" />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {getLabel()}
        </span>
        <ChevronDown className="w-4 h-4 text-gray-400" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg min-w-[240px]">
          {!showCustomPicker ? (
            <div className="py-1">
              {presets.map((preset) => (
                <button
                  key={preset.value}
                  onClick={() => handlePresetClick(preset.value)}
                  className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                    value === preset.value
                      ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
                      : 'text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          ) : (
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Custom Range
                </span>
                <button
                  onClick={() => setShowCustomPicker(false)}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={handleClearCustom}
                    className="flex-1 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                  >
                    Clear
                  </button>
                  <button
                    onClick={handleApplyCustom}
                    disabled={!customStart || !customEnd}
                    className="flex-1 px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
