import { useState } from 'react';
import { Upload, AlertTriangle, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import type { ValidationIssue } from '../../../../types/workflowBuilder';

interface PublishWorkflowModalProps {
  validationIssues: ValidationIssue[];
  isPublishing: boolean;
  onPublish: (notes: string) => void;
  onClose: () => void;
}

export function PublishWorkflowModal({
  validationIssues,
  isPublishing,
  onPublish,
  onClose,
}: PublishWorkflowModalProps) {
  const [notes, setNotes] = useState('');
  const errors = validationIssues.filter(i => i.severity === 'error');
  const warnings = validationIssues.filter(i => i.severity === 'warning');
  const canPublish = errors.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
          <div className="w-9 h-9 rounded-lg bg-blue-500 flex items-center justify-center">
            <Upload className="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900">Publish Workflow</h3>
            <p className="text-xs text-gray-500">Create a new published version</p>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">
          {errors.length > 0 && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg space-y-1.5">
              <div className="flex items-center gap-2 text-red-700">
                <XCircle className="w-4 h-4" />
                <span className="text-sm font-medium">{errors.length} blocking error{errors.length !== 1 ? 's' : ''}</span>
              </div>
              {errors.map((e, i) => (
                <div key={i} className="text-xs text-red-600 pl-6">
                  {e.nodeLabel}: {e.message}
                </div>
              ))}
            </div>
          )}

          {warnings.length > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-1.5">
              <div className="flex items-center gap-2 text-amber-700">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-sm font-medium">{warnings.length} warning{warnings.length !== 1 ? 's' : ''}</span>
              </div>
              {warnings.map((w, i) => (
                <div key={i} className="text-xs text-amber-600 pl-6">
                  {w.nodeLabel}: {w.message}
                </div>
              ))}
            </div>
          )}

          {canPublish && errors.length === 0 && warnings.length === 0 && (
            <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span className="text-sm text-emerald-700 font-medium">All checks passed</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Version Notes (optional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Describe what changed in this version..."
              rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
            />
          </div>

          {!canPublish && (
            <p className="text-xs text-red-600">
              Fix the errors above before publishing. The workflow must have at least one trigger and all nodes must be properly configured.
            </p>
          )}
        </div>

        <div className="px-6 py-3 border-t border-gray-100 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={isPublishing}
            className="px-4 py-2 text-sm text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onPublish(notes)}
            disabled={!canPublish || isPublishing}
            className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isPublishing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Publishing...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Publish
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
