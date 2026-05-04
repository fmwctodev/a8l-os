import { useReactFlow, useViewport } from '@xyflow/react';
import { AlertCircle } from 'lucide-react';
import type { ValidationIssue } from '../../../../types/workflowBuilder';

interface ValidationOverlayProps {
  issues: ValidationIssue[];
}

/**
 * Renders a small red marker on each node that has at least one validation
 * error. Mounted alongside the canvas; reads node positions via React Flow's
 * viewport transform and renders pointer-events-none badges so canvas
 * interactions still work.
 *
 * Intentionally only shows ERROR-severity issues — warnings are surfaced in
 * the publish modal but don't earn a node-level visual marker.
 */
export function ValidationOverlay({ issues }: ValidationOverlayProps) {
  const { getNodes } = useReactFlow();
  const viewport = useViewport();
  const nodes = getNodes();

  // Group errors per node id
  const errorsByNode = new Map<string, ValidationIssue[]>();
  for (const issue of issues) {
    if (issue.severity !== 'error') continue;
    if (!issue.nodeId) continue; // workflow-level issues are shown in modal
    const list = errorsByNode.get(issue.nodeId) || [];
    list.push(issue);
    errorsByNode.set(issue.nodeId, list);
  }

  if (errorsByNode.size === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-10">
      {nodes.map((n) => {
        const errs = errorsByNode.get(n.id);
        if (!errs || errs.length === 0) return null;

        // Top-left corner of the node, offset slightly upward / leftward
        const x = n.position.x * viewport.zoom + viewport.x - 8;
        const y = n.position.y * viewport.zoom + viewport.y - 8;
        const tooltip = errs.map((e) => e.message).join('\n');

        return (
          <div
            key={n.id}
            className="absolute pointer-events-auto"
            style={{ left: x, top: y }}
            title={tooltip}
          >
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-bold shadow-lg ring-2 ring-white">
              <AlertCircle className="w-3 h-3" />
              {errs.length > 1 ? errs.length : ''}
            </div>
          </div>
        );
      })}
    </div>
  );
}
