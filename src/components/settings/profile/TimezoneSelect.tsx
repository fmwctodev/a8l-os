import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search } from 'lucide-react';

interface TimezoneSelectProps {
  value: string;
  onChange: (timezone: string) => void;
}

const timezones = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
  { value: 'America/Phoenix', label: 'Arizona Time (MST)' },
  { value: 'Europe/London', label: 'London (GMT)' },
  { value: 'Europe/Paris', label: 'Paris (CET)' },
  { value: 'Europe/Berlin', label: 'Berlin (CET)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
  { value: 'Asia/Dubai', label: 'Dubai (GST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEDT)' },
];

export function TimezoneSelect({ value, onChange }: TimezoneSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedTimezone = timezones.find((tz) => tz.value === value);
  const filteredTimezones = timezones.filter((tz) =>
    tz.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white hover:border-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-colors"
      >
        <span>{selectedTimezone?.label || 'Select timezone'}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-10 mt-2 w-full bg-slate-800 border border-slate-700 rounded-lg shadow-xl max-h-64 overflow-hidden">
          <div className="p-2 border-b border-slate-700">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search timezones..."
                className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                autoFocus
              />
            </div>
          </div>
          <div className="overflow-y-auto max-h-52">
            {filteredTimezones.map((tz) => (
              <button
                key={tz.value}
                type="button"
                onClick={() => {
                  onChange(tz.value);
                  setIsOpen(false);
                  setSearchQuery('');
                }}
                className={`w-full text-left px-4 py-2 hover:bg-slate-700 transition-colors ${
                  tz.value === value ? 'bg-cyan-500/10 text-cyan-400' : 'text-white'
                }`}
              >
                {tz.label}
              </button>
            ))}
            {filteredTimezones.length === 0 && (
              <div className="px-4 py-3 text-sm text-slate-400 text-center">
                No timezones found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
