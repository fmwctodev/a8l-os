import { useState, useEffect, useCallback } from 'react';
import { X, History, RotateCcw, Clock, User, GitCompare } from 'lucide-react';
import type { WorkflowVersion, WorkflowDefinition } from '../../../../types';
import { supabase } from '../../../../lib/supabase';
import { WorkflowDiffViewer } from './WorkflowDiffViewer';

interface VersionHistoryPanelProps {
  workflowId: string;
  onRestore: (definition: WorkflowDefinition) => void;
  onClose: () => void;
}

export function VersionHistoryPanel({ workflowId, onRestore, onClose }: VersionHistoryPanelProps) {
  const [versions, setVersions] = useState<WorkflowVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [pickedIds, setPickedIds] = useState<string[]>([]);
  const [diffOpen, setDiffOpen] = useState(false);

  useEffect(() => {
    loadVersions();
  }, [workflowId]);

  const loadVersions = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('workflow_versions')
      .select('*, created_by:users!workflow_versions_created_by_user_id_fkey(id, name, email)')
      .eq('workflow_id', workflowId)
      .order('version_number', { ascending: false });
    setVersions(data ?? []);
    setLoading(false);
  };

  const handleRestore = useCallback(async (version: WorkflowVersion) => {
    setRestoring(version.id);
    onRestore(version.definition);
    setRestoring(null);
  }, [onRestore]);

  const togglePicked = (id: string) => {
    setPickedIds(prev => {
      if (prev.includes(id)) return prev.filter(p => p !== id);
      // Cap at 2 picks; oldest gets dropped.
      return prev.length >= 2 ? [prev[1], id] : [...prev, id];
    });
  };

  const pickedVersions = pickedIds
    .map(id => versions.find(v => v.id === id))
    .filter(Boolean) as WorkflowVersion[];
  const canCompare = pickedVersions.length === 2;

  return (
    <>
    {diffOpen && canCompare && (
      <WorkflowDiffViewer
        baseVersion={{
          version_number: pickedVersions[0].version_number,
          definition: pickedVersions[0].definition,
          created_at: pickedVersions[0].created_at,
        }}
        targetVersion={{
          version_number: pickedVersions[1].version_number,
          definition: pickedVersions[1].definition,
          created_at: pickedVersions[1].created_at,
        }}
        onClose={() => setDiffOpen(false)}
      />
    )}
    <div className="w-[440px] h-full bg-white border-l border-gray-200 flex flex-col shadow-xl">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md bg-gray-700 flex items-center justify-center">
            <History className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900">Version History</h3>
            <p className="text-xs text-gray-500">{versions.length} published version{versions.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => { setCompareMode(c => !c); setPickedIds([]); }}
            className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors ${
              compareMode
                ? 'bg-purple-50 text-purple-700 border-purple-200'
                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
            }`}
          >
            <GitCompare className="w-3 h-3" />
            {compareMode ? 'Cancel compare' : 'Compare'}
          </button>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-md transition-colors">
            <X className="w-4.5 h-4.5 text-gray-400" />
          </button>
        </div>
      </div>

      {compareMode && (
        <div className="px-5 py-3 bg-purple-50 border-b border-purple-100 flex items-center justify-between gap-2">
          <span className="text-xs text-purple-700">
            Pick 2 versions to compare ({pickedIds.length}/2)
          </span>
          <button
            disabled={!canCompare}
            onClick={() => setDiffOpen(true)}
            className="px-3 py-1.5 text-xs font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Compare selected
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
          </div>
        ) : versions.length === 0 ? (
          <div className="text-center py-12 px-5">
            <History className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No published versions yet</p>
            <p className="text-xs text-gray-400 mt-1">Publish your workflow to create a version snapshot</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {versions.map((version, i) => (
              <div
                key={version.id}
                className={`px-5 py-4 transition-colors ${
                  compareMode && pickedIds.includes(version.id)
                    ? 'bg-purple-50'
                    : 'hover:bg-gray-50'
                }`}
                onClick={() => compareMode && togglePicked(version.id)}
                role={compareMode ? 'button' : undefined}
              >
                <div className="flex items-start justify-between">
                  {compareMode && (
                    <input
                      type="checkbox"
                      checked={pickedIds.includes(version.id)}
                      readOnly
                      className="mt-1 mr-3 rounded border-purple-300"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900">
                        v{version.version_number}
                      </span>
                      {i === 0 && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                          Latest
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(version.created_at).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                      {(version as any).created_by?.name && (
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {(version as any).created_by.name}
                        </span>
                      )}
                    </div>
                    {version.notes && (
                      <p className="text-xs text-gray-600 mt-1.5 line-clamp-2">{version.notes}</p>
                    )}
                    <div className="text-xs text-gray-400 mt-1">
                      {version.definition?.nodes?.length ?? 0} nodes, {version.definition?.edges?.length ?? 0} edges
                    </div>
                  </div>
                  {!compareMode && (
                    <div className="flex items-center gap-1 ml-3">
                      <button
                        onClick={() => handleRestore(version)}
                        disabled={restoring === version.id}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Restore
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
    </>
  );
}
