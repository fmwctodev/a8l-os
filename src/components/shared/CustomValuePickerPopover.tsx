import { useState, useEffect, useRef } from 'react';
import { Search, Braces, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import * as customValuesService from '../../services/customValues';
import type { CustomValue } from '../../services/customValues';

type ContextType = 'emails' | 'sms' | 'automations' | 'ai_prompts' | 'proposals';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (token: string) => void;
  context: ContextType;
  anchorRef?: React.RefObject<HTMLElement>;
}

export function CustomValuePickerPopover({ isOpen, onClose, onSelect, context, anchorRef }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [values, setValues] = useState<CustomValue[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && user?.organization_id) {
      loadValues();
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, user?.organization_id, context]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  const loadValues = async () => {
    if (!user?.organization_id) return;

    try {
      setLoading(true);
      const data = await customValuesService.getAvailableCustomValues(user.organization_id, context);
      setValues(data);
    } catch (err) {
      console.error('Failed to load custom values:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (value: CustomValue) => {
    const token = customValuesService.formatTokenKey(value.key);
    onSelect(token);
    onClose();
  };

  const filteredValues = values.filter(v =>
    v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.key.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const groupedValues = filteredValues.reduce<Record<string, CustomValue[]>>((acc, value) => {
    const category = value.custom_value_categories?.name || 'Uncategorized';
    if (!acc[category]) acc[category] = [];
    acc[category].push(value);
    return acc;
  }, {});

  if (!isOpen) return null;

  return (
    <div
      ref={popoverRef}
      className="absolute z-50 w-80 bg-slate-800 rounded-lg shadow-xl border border-slate-700 overflow-hidden"
      style={{
        top: anchorRef?.current ? anchorRef.current.offsetHeight + 4 : 'auto',
        right: 0,
      }}
    >
      <div className="p-3 border-b border-slate-700">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-white flex items-center gap-2">
            <Braces className="h-4 w-4 text-cyan-400" />
            Custom Values
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-slate-500 hover:text-slate-300 rounded"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search values..."
            className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
          />
        </div>
      </div>

      <div className="max-h-64 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-cyan-500" />
          </div>
        ) : filteredValues.length === 0 ? (
          <div className="text-center py-8">
            <Braces className="mx-auto h-8 w-8 text-slate-600" />
            <p className="mt-2 text-sm text-slate-400">
              {searchQuery ? 'No matching values' : 'No custom values available'}
            </p>
          </div>
        ) : (
          <div className="py-1">
            {Object.entries(groupedValues).map(([category, categoryValues]) => (
              <div key={category}>
                <div className="px-3 py-1.5 text-xs font-medium text-slate-500 uppercase tracking-wider bg-slate-800/50">
                  {category}
                </div>
                {categoryValues.map(value => (
                  <button
                    key={value.id}
                    onClick={() => handleSelect(value)}
                    className="w-full px-3 py-2 text-left hover:bg-slate-700/50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-white">{value.name}</span>
                    </div>
                    <code className="text-xs font-mono text-cyan-400/70">
                      {customValuesService.formatTokenKey(value.key)}
                    </code>
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="px-3 py-2 border-t border-slate-700 bg-slate-800/50">
        <p className="text-xs text-slate-500">
          Click to insert at cursor position
        </p>
      </div>
    </div>
  );
}
