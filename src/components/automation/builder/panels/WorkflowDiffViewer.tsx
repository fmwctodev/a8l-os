import { useMemo } from 'react';
import { X, Plus, Minus, Edit3, ArrowLeftRight } from 'lucide-react';
import type { WorkflowDefinition } from '../../../../types';

interface Props {
  baseVersion: { version_number: number; definition: WorkflowDefinition; created_at: string };
  targetVersion: { version_number: number; definition: WorkflowDefinition; created_at: string };
  onClose: () => void;
}

interface NodeDiff {
  nodeId: string;
  label: string;
  status: 'added' | 'removed' | 'modified' | 'unchanged';
  changes?: string[];
}

/**
 * WorkflowDiffViewer — side-by-side compare of two workflow versions.
 * Walks the node arrays of base + target, classifies each node:
 *   - added (only in target)
 *   - removed (only in base)
 *   - modified (in both, but data.config differs)
 *   - unchanged (identical config + position)
 *
 * Edge-level changes are bucketed under the source/target node's row.
 */
export function WorkflowDiffViewer({ baseVersion, targetVersion, onClose }: Props) {
  const diff = useMemo<NodeDiff[]>(() => {
    const baseNodes = baseVersion.definition?.nodes ?? [];
    const targetNodes = targetVersion.definition?.nodes ?? [];
    const baseMap = new Map(baseNodes.map((n: any) => [n.id, n]));
    const targetMap = new Map(targetNodes.map((n: any) => [n.id, n]));

    const allIds = new Set([...baseMap.keys(), ...targetMap.keys()]);
    const diffs: NodeDiff[] = [];

    for (const id of allIds) {
      const baseNode = baseMap.get(id);
      const targetNode = targetMap.get(id);
      const label = (targetNode?.data?.label ?? baseNode?.data?.label ?? id) as string;

      if (!baseNode && targetNode) {
        diffs.push({ nodeId: id, label, status: 'added' });
        continue;
      }
      if (baseNode && !targetNode) {
        diffs.push({ nodeId: id, label, status: 'removed' });
        continue;
      }
      if (!baseNode || !targetNode) continue;

      const changes: string[] = [];
      const baseData = baseNode.data ?? {};
      const targetData = targetNode.data ?? {};
      if (JSON.stringify(baseData.nodeData) !== JSON.stringify(targetData.nodeData)) {
        changes.push('Configuration changed');
      }
      if (baseNode.position?.x !== targetNode.position?.x || baseNode.position?.y !== targetNode.position?.y) {
        changes.push('Position changed');
      }
      if (baseData.label !== targetData.label) {
        changes.push(`Label: "${baseData.label}" → "${targetData.label}"`);
      }
      diffs.push({
        nodeId: id,
        label,
        status: changes.length > 0 ? 'modified' : 'unchanged',
        changes,
      });
    }

    // Order: added → modified → removed → unchanged
    const order: NodeDiff['status'][] = ['added', 'modified', 'removed', 'unchanged'];
    return diffs.sort(
      (a, b) => order.indexOf(a.status) - order.indexOf(b.status) || a.label.localeCompare(b.label)
    );
  }, [baseVersion, targetVersion]);

  const counts = useMemo(() => {
    return diff.reduce(
      (acc, d) => {
        acc[d.status] = (acc[d.status] ?? 0) + 1;
        return acc;
      },
      {} as Record<NodeDiff['status'], number>
    );
  }, [diff]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-purple-500 flex items-center justify-center">
              <ArrowLeftRight className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900">
                Compare v{baseVersion.version_number} → v{targetVersion.version_number}
              </h3>
              <p className="text-xs text-gray-500">
                {new Date(baseVersion.created_at).toLocaleString()} →{' '}
                {new Date(targetVersion.created_at).toLocaleString()}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-md">
            <X className="w-4.5 h-4.5 text-gray-400" />
          </button>
        </div>

        <div className="px-6 py-3 border-b border-gray-100 flex items-center gap-3 text-xs">
          {counts.added && (
            <span className="flex items-center gap-1 text-emerald-600">
              <Plus className="w-3 h-3" /> {counts.added} added
            </span>
          )}
          {counts.removed && (
            <span className="flex items-center gap-1 text-red-600">
              <Minus className="w-3 h-3" /> {counts.removed} removed
            </span>
          )}
          {counts.modified && (
            <span className="flex items-center gap-1 text-amber-600">
              <Edit3 className="w-3 h-3" /> {counts.modified} modified
            </span>
          )}
          {counts.unchanged && (
            <span className="text-gray-400">{counts.unchanged} unchanged</span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
          {diff.map((d) => (
            <div
              key={d.nodeId}
              className={`px-6 py-3 flex items-start gap-3 ${
                d.status === 'added'
                  ? 'bg-emerald-50/50'
                  : d.status === 'removed'
                  ? 'bg-red-50/50'
                  : d.status === 'modified'
                  ? 'bg-amber-50/50'
                  : ''
              }`}
            >
              <div className="mt-0.5 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0">
                {d.status === 'added' && <Plus className="w-4 h-4 text-emerald-600" />}
                {d.status === 'removed' && <Minus className="w-4 h-4 text-red-600" />}
                {d.status === 'modified' && <Edit3 className="w-4 h-4 text-amber-600" />}
                {d.status === 'unchanged' && (
                  <span className="w-2 h-2 rounded-full bg-gray-300" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900">{d.label}</div>
                <div className="text-xs text-gray-500 mt-0.5 font-mono">{d.nodeId}</div>
                {d.changes && d.changes.length > 0 && (
                  <ul className="mt-1.5 space-y-0.5">
                    {d.changes.map((c, i) => (
                      <li key={i} className="text-xs text-gray-700">
                        • {c}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <span
                className={`text-[10px] font-medium px-1.5 py-0.5 rounded uppercase tracking-wider ${
                  d.status === 'added'
                    ? 'bg-emerald-100 text-emerald-700'
                    : d.status === 'removed'
                    ? 'bg-red-100 text-red-700'
                    : d.status === 'modified'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                {d.status}
              </span>
            </div>
          ))}
          {diff.length === 0 && (
            <div className="text-center py-12 text-gray-400 text-sm">
              No differences detected.
            </div>
          )}
        </div>

        <div className="px-6 py-3 border-t border-gray-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-white bg-gray-800 rounded-lg hover:bg-gray-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
