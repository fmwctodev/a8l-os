import { useEffect, useRef, useState } from 'react';
import { X, Search, FileText, ListChecks, Loader2 } from 'lucide-react';
import { supabase } from '../../../lib/supabase';

export interface PickerItem {
  kind: 'form' | 'survey';
  id: string;
  name: string;
  slug: string;
}

interface FormSurveyPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (item: PickerItem) => void;
}

interface SlugRow {
  id: string;
  name: string;
  public_slug: string;
}

export function FormSurveyPicker({ open, onClose, onSelect }: FormSurveyPickerProps) {
  const [forms, setForms] = useState<SlugRow[]>([]);
  const [surveys, setSurveys] = useState<SlugRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'forms' | 'surveys'>('forms');
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [formsRes, surveysRes] = await Promise.all([
          supabase
            .from('forms')
            .select('id,name,public_slug')
            .eq('status', 'published')
            .not('public_slug', 'is', null)
            .order('updated_at', { ascending: false }),
          supabase
            .from('surveys')
            .select('id,name,public_slug')
            .eq('status', 'published')
            .not('public_slug', 'is', null)
            .order('updated_at', { ascending: false }),
        ]);
        if (cancelled) return;
        setForms((formsRes.data || []) as SlugRow[]);
        setSurveys((surveysRes.data || []) as SlugRow[]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) return null;

  const items = (tab === 'forms' ? forms : surveys).filter(
    (i) => !search || i.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      onMouseDown={(e) => {
        if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md max-h-[70vh] overflow-hidden flex flex-col"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <h3 className="text-sm font-semibold text-white">Insert form or survey link</h3>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex border-b border-slate-700">
          <button
            onClick={() => setTab('forms')}
            className={`flex-1 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === 'forms'
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText size={14} className="inline mr-1.5 -mt-0.5" />
            Forms ({forms.length})
          </button>
          <button
            onClick={() => setTab('surveys')}
            className={`flex-1 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === 'surveys'
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ListChecks size={14} className="inline mr-1.5 -mt-0.5" />
            Surveys ({surveys.length})
          </button>
        </div>

        <div className="p-3 border-b border-slate-700">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${tab}...`}
              className="w-full pl-8 pr-3 py-2 text-sm bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              autoFocus
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="text-slate-500 animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-8 text-sm text-slate-500">
              No published {tab} found
            </div>
          ) : (
            <ul className="py-1">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    onClick={() =>
                      onSelect({
                        kind: tab === 'forms' ? 'form' : 'survey',
                        id: item.id,
                        name: item.name,
                        slug: item.public_slug,
                      })
                    }
                    className="w-full text-left px-4 py-2.5 hover:bg-slate-800 transition-colors"
                  >
                    <div className="text-sm text-white truncate">{item.name}</div>
                    <div className="text-xs text-slate-500 truncate font-mono">
                      /{tab === 'forms' ? 'f' : 's'}/{item.public_slug}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
