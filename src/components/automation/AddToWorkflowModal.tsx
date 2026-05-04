import { useEffect, useState } from 'react';
import { X, Loader2, Workflow as WorkflowIcon, Search, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  getEnrollableWorkflows,
  manualEnroll,
  bulkEnrollContacts,
  type BulkEnrollResult,
} from '../../services/workflowEnrollmentActions';
import type { Workflow } from '../../types';

interface AddToWorkflowModalProps {
  /** One contact (single-enroll) or many (bulk-enroll). */
  contactIds: string[];
  contactNameHint?: string;
  onClose: () => void;
  onEnrolled?: (result: { enrolled: number; alreadyEnrolled: number; workflow: Workflow | null }) => void;
}

export function AddToWorkflowModal({
  contactIds,
  contactNameHint,
  onClose,
  onEnrolled,
}: AddToWorkflowModalProps) {
  const { user } = useAuth();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BulkEnrollResult | { enrolled: 1 } | null>(null);

  useEffect(() => {
    if (!user?.organization_id) return;
    setLoading(true);
    getEnrollableWorkflows(user.organization_id)
      .then(setWorkflows)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load workflows'))
      .finally(() => setLoading(false));
  }, [user?.organization_id]);

  const filtered = workflows.filter((w) =>
    w.name.toLowerCase().includes(search.toLowerCase())
  );

  const isBulk = contactIds.length > 1;

  async function handleEnroll() {
    if (!user?.organization_id || !selectedId || contactIds.length === 0) return;
    try {
      setSubmitting(true);
      setError(null);

      if (isBulk) {
        const r = await bulkEnrollContacts(user.organization_id, selectedId, contactIds);
        setResult(r);
        const wf = workflows.find((w) => w.id === selectedId) || null;
        onEnrolled?.({ enrolled: r.enrolled, alreadyEnrolled: r.alreadyEnrolled, workflow: wf });
      } else {
        const r = await manualEnroll(user.organization_id, selectedId, contactIds[0]);
        if (r.error) {
          setError(r.error);
          return;
        }
        setResult({ enrolled: r.enrollment ? 1 : 0 } as { enrolled: 1 });
        const wf = workflows.find((w) => w.id === selectedId) || null;
        onEnrolled?.({
          enrolled: r.enrollment ? 1 : 0,
          alreadyEnrolled: r.alreadyEnrolled ? 1 : 0,
          workflow: wf,
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Enrollment failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-slate-900 rounded-xl border border-slate-800 shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-semibold text-white">Add to Workflow</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {isBulk
                ? `Enroll ${contactIds.length} contacts in a published workflow`
                : `Enroll ${contactNameHint || 'this contact'} in a published workflow`}
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-800 transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-sm flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {result && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-medium">
                  {('enrolled' in result ? result.enrolled : 0)} enrolled successfully
                </div>
                {isBulk && 'alreadyEnrolled' in result && result.alreadyEnrolled > 0 && (
                  <div className="text-xs text-emerald-400/80 mt-0.5">
                    {result.alreadyEnrolled} already enrolled (skipped)
                  </div>
                )}
                {isBulk && 'errors' in result && result.errors.length > 0 && (
                  <div className="text-xs text-red-300 mt-0.5">
                    {result.errors.length} failed — see console for details
                  </div>
                )}
              </div>
            </div>
          )}

          {!result && (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search workflows..."
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              <div className="border border-slate-800 rounded-lg max-h-64 overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="py-12 text-center">
                    <WorkflowIcon className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <p className="text-sm text-slate-400">
                      {workflows.length === 0
                        ? 'No published workflows yet'
                        : 'No workflows match your search'}
                    </p>
                  </div>
                ) : (
                  filtered.map((w) => (
                    <button
                      key={w.id}
                      onClick={() => setSelectedId(w.id)}
                      className={`w-full flex items-center gap-3 p-3 text-left border-b border-slate-800 last:border-b-0 transition-colors ${
                        selectedId === w.id ? 'bg-cyan-500/10' : 'hover:bg-slate-800/60'
                      }`}
                    >
                      <div
                        className={`w-2 h-2 rounded-full ${
                          selectedId === w.id ? 'bg-cyan-400' : 'bg-slate-700'
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-white truncate">{w.name}</div>
                        {w.description && (
                          <div className="text-xs text-slate-500 truncate">{w.description}</div>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        <div className="px-4 py-3 border-t border-slate-800 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-slate-300 hover:bg-slate-800 text-sm"
          >
            {result ? 'Done' : 'Cancel'}
          </button>
          {!result && (
            <button
              onClick={handleEnroll}
              disabled={!selectedId || submitting}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-600 text-white font-medium hover:from-cyan-600 hover:to-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {isBulk ? `Enroll ${contactIds.length} contacts` : 'Enroll'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
