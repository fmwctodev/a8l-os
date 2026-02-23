import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Plus, MessageSquare } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useAssistant } from '../../../contexts/AssistantContext';
import { getThreads, createThread } from '../../../services/assistantChat';
import type { AssistantThread } from '../../../types/assistant';

export function ThreadSelector() {
  const { user } = useAuth();
  const { activeThreadId, setActiveThread, pageContext } = useAssistant();
  const [threads, setThreads] = useState<AssistantThread[]>([]);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    getThreads(user.id).then(setThreads).catch(() => {});
  }, [user, activeThreadId]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const active = threads.find((t) => t.id === activeThreadId);

  const handleNew = async () => {
    if (!user) return;
    try {
      const thread = await createThread(
        user.id,
        user.organization_id,
        pageContext.current_module,
        pageContext.current_record_id
      );
      setActiveThread(thread.id);
      setOpen(false);
    } catch { /* noop */ }
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 60) return `${diffMin}m`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition-colors max-w-[200px]"
      >
        <MessageSquare className="w-3 h-3 text-slate-500 flex-shrink-0" />
        <span className="truncate">{active?.title || 'New thread'}</span>
        <ChevronDown className="w-3 h-3 text-slate-500 flex-shrink-0" />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 overflow-hidden">
          <button
            onClick={handleNew}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-cyan-400 hover:bg-slate-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> New Thread
          </button>
          <div className="border-t border-slate-700 max-h-[200px] overflow-y-auto">
            {threads.map((t) => (
              <button
                key={t.id}
                onClick={() => { setActiveThread(t.id); setOpen(false); }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-slate-700 transition-colors ${
                  t.id === activeThreadId ? 'bg-slate-700/50 text-cyan-300' : 'text-slate-300'
                }`}
              >
                <span className="flex-1 truncate">{t.title || 'Untitled'}</span>
                {t.context_module && (
                  <span className="px-1.5 py-0.5 bg-slate-600 rounded text-[9px] text-slate-400 flex-shrink-0">
                    {t.context_module}
                  </span>
                )}
                <span className="text-[10px] text-slate-500 flex-shrink-0">
                  {formatTime(t.updated_at)}
                </span>
              </button>
            ))}
            {threads.length === 0 && (
              <p className="px-3 py-3 text-[10px] text-slate-500 text-center">No threads yet</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
