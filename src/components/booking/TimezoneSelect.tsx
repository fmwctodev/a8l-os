import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Globe, Search } from 'lucide-react';

interface TimezoneSelectProps {
  value: string;
  onChange: (tz: string) => void;
  className?: string;
}

const FALLBACK_ZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Anchorage',
  'America/Phoenix',
  'America/Toronto',
  'America/Mexico_City',
  'America/Sao_Paulo',
  'America/Buenos_Aires',
  'Europe/London',
  'Europe/Dublin',
  'Europe/Lisbon',
  'Europe/Madrid',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Amsterdam',
  'Europe/Rome',
  'Europe/Athens',
  'Europe/Istanbul',
  'Europe/Moscow',
  'Africa/Lagos',
  'Africa/Cairo',
  'Africa/Johannesburg',
  'Asia/Dubai',
  'Asia/Karachi',
  'Asia/Kolkata',
  'Asia/Bangkok',
  'Asia/Shanghai',
  'Asia/Hong_Kong',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Australia/Perth',
  'Australia/Sydney',
  'Australia/Melbourne',
  'Pacific/Auckland',
  'Pacific/Honolulu',
];

function getAllZones(): string[] {
  const intlAny = Intl as unknown as { supportedValuesOf?: (k: string) => string[] };
  if (typeof intlAny.supportedValuesOf === 'function') {
    try {
      const list = intlAny.supportedValuesOf('timeZone');
      if (Array.isArray(list) && list.length > 0) return list;
    } catch {
      // fall through
    }
  }
  return FALLBACK_ZONES;
}

function offsetForZone(tz: string): string {
  try {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      timeZoneName: 'shortOffset',
    });
    const parts = dtf.formatToParts(new Date());
    const offsetPart = parts.find((p) => p.type === 'timeZoneName');
    if (offsetPart?.value) {
      return offsetPart.value.replace('GMT', 'UTC');
    }
  } catch {
    // ignore
  }
  return '';
}

interface ZoneItem {
  tz: string;
  region: string;
  city: string;
  offset: string;
}

function buildZones(): ZoneItem[] {
  const all = getAllZones();
  return all.map((tz) => {
    const [region, ...rest] = tz.split('/');
    return {
      tz,
      region,
      city: rest.join('/').replace(/_/g, ' ') || tz,
      offset: offsetForZone(tz),
    };
  });
}

export function TimezoneSelect({ value, onChange, className }: TimezoneSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const zones = useMemo(() => buildZones(), []);

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? zones.filter(
          (z) =>
            z.tz.toLowerCase().includes(q) ||
            z.city.toLowerCase().includes(q) ||
            z.region.toLowerCase().includes(q) ||
            z.offset.toLowerCase().includes(q)
        )
      : zones;

    const map = new Map<string, ZoneItem[]>();
    for (const z of filtered) {
      const arr = map.get(z.region) || [];
      arr.push(z);
      map.set(z.region, arr);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [zones, query]);

  const selected = useMemo(() => zones.find((z) => z.tz === value), [zones, value]);

  useEffect(() => {
    if (!isOpen) return;
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  return (
    <div ref={containerRef} className={`relative ${className || ''}`}>
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
      >
        <Globe className="w-4 h-4 text-slate-400 shrink-0" />
        <span className="flex-1 text-left truncate">
          {selected ? `${selected.city || selected.tz}` : value}
        </span>
        {selected?.offset && (
          <span className="text-xs text-slate-400 font-mono">{selected.offset}</span>
        )}
        <ChevronDown
          className={`w-4 h-4 text-slate-400 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute z-30 mt-1 w-full max-w-md bg-slate-900 border border-slate-700 rounded-lg shadow-xl overflow-hidden">
          <div className="p-2 border-b border-slate-700">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search timezones..."
                className="w-full pl-9 pr-3 py-2 rounded-md bg-slate-800 border border-slate-700 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto">
            {grouped.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-slate-500">
                No timezones match "{query}"
              </div>
            ) : (
              grouped.map(([region, list]) => (
                <div key={region}>
                  <div className="px-3 py-1.5 bg-slate-800/60 text-xs font-medium text-slate-400 uppercase tracking-wider sticky top-0">
                    {region}
                  </div>
                  {list.map((z) => {
                    const isSelected = z.tz === value;
                    return (
                      <button
                        key={z.tz}
                        type="button"
                        onClick={() => {
                          onChange(z.tz);
                          setIsOpen(false);
                        }}
                        className={`w-full px-3 py-2 flex items-center justify-between text-left text-sm transition-colors ${
                          isSelected
                            ? 'bg-cyan-500/10 text-cyan-400'
                            : 'text-slate-200 hover:bg-slate-800'
                        }`}
                      >
                        <span className="truncate">{z.city || z.tz}</span>
                        {z.offset && (
                          <span className="ml-3 text-xs text-slate-500 font-mono shrink-0">
                            {z.offset}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
