import type { ActionNodeData } from '../../../../types';

interface Props {
  data: ActionNodeData;
  onUpdate: (u: Partial<ActionNodeData>) => void;
}

export default function GoToConfig({ data, onUpdate }: Props) {
  const cfg = (data.config as Record<string, any>) ?? {};
  const set = (key: string, val: unknown) => onUpdate({ config: { ...cfg, [key]: val } });

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Destination Type</label>
        <select value={cfg.destinationType ?? 'node'} onChange={e => set('destinationType', e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20">
          <option value="node">Jump to node in this workflow</option>
          <option value="workflow">Trigger another workflow</option>
        </select>
      </div>
      {cfg.destinationType === 'node' && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Target Node ID</label>
          <input type="text" value={cfg.targetNodeId ?? ''} onChange={e => set('targetNodeId', e.target.value)}
            placeholder="node-id from workflow canvas" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
          <p className="text-xs text-gray-400 mt-1">Tip: hover over a node to see its ID.</p>
        </div>
      )}
      {cfg.destinationType === 'workflow' && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Target Workflow ID</label>
          <input type="text" value={cfg.targetWorkflowId ?? ''} onChange={e => set('targetWorkflowId', e.target.value)}
            placeholder="workflow-id" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
        </div>
      )}
      {cfg.destinationType === 'node' && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Max Jumps (loop prevention)</label>
          <input type="number" min={1} max={20} value={cfg.maxJumps ?? 3} onChange={e => set('maxJumps', parseInt(e.target.value) || 3)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
        </div>
      )}
    </div>
  );
}
