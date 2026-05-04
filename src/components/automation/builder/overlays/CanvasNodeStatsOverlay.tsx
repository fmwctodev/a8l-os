import { useEffect, useState, useRef } from 'react';
import { useReactFlow, useViewport } from '@xyflow/react';
import { CheckCircle2, AlertTriangle, Users } from 'lucide-react';
import { getWorkflowNodeStats, type WorkflowNodeStats } from '../../../../services/workflowRuntimeStats';

interface CanvasNodeStatsOverlayProps {
  workflowId: string;
  /** How often to re-fetch stats while the overlay is mounted, in ms. */
  refreshIntervalMs?: number;
}

/**
 * Renders a small per-node badge showing entered / completed / errored counts
 * over each node on the React Flow canvas. Mounted alongside (not inside) the
 * canvas, projecting node positions into screen coordinates via the React Flow
 * viewport transform.
 *
 * The badges are pointer-events-none so they don't intercept canvas clicks.
 */
export function CanvasNodeStatsOverlay({
  workflowId,
  refreshIntervalMs = 30000,
}: CanvasNodeStatsOverlayProps) {
  const { getNodes } = useReactFlow();
  const viewport = useViewport();
  const [statsByNode, setStatsByNode] = useState<Record<string, WorkflowNodeStats>>({});
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      try {
        const next = await getWorkflowNodeStats(workflowId);
        if (!cancelled) setStatsByNode(next);
      } catch {
        // swallow; stats are non-critical
      }
    }

    refresh();
    intervalRef.current = window.setInterval(refresh, refreshIntervalMs);

    return () => {
      cancelled = true;
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [workflowId, refreshIntervalMs]);

  const nodes = getNodes();

  return (
    <div className="absolute inset-0 pointer-events-none z-20">
      {nodes.map((n) => {
        const s = statsByNode[n.id];
        if (!s || (s.entered === 0 && s.completed === 0 && s.errored === 0)) {
          return null;
        }

        // Compute screen-space coordinates for this node's top-right corner.
        // Node position is in graph space; multiply by zoom and add the
        // viewport pan to get pixels relative to the canvas container.
        const nodeWidth = (n.measured?.width ?? n.width ?? 240) as number;
        const x = (n.position.x + nodeWidth) * viewport.zoom + viewport.x;
        const y = n.position.y * viewport.zoom + viewport.y;

        return (
          <div
            key={n.id}
            className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-900 border border-slate-700 shadow-lg text-[10px] font-medium text-white pointer-events-none whitespace-nowrap"
            style={{ left: x, top: y }}
            title={`Entered: ${s.entered}\nCompleted: ${s.completed}\nIn-progress: ${s.inProgress}\nErrored: ${s.errored}${s.avgDurationMs != null ? `\nAvg: ${formatMs(s.avgDurationMs)}` : ''}`}
          >
            <span className="flex items-center gap-0.5 text-blue-300">
              <Users className="w-2.5 h-2.5" />
              {s.entered}
            </span>
            {s.completed > 0 && (
              <span className="flex items-center gap-0.5 text-emerald-300">
                <CheckCircle2 className="w-2.5 h-2.5" />
                {s.completed}
              </span>
            )}
            {s.errored > 0 && (
              <span className="flex items-center gap-0.5 text-red-300">
                <AlertTriangle className="w-2.5 h-2.5" />
                {s.errored}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}
