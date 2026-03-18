import type { ActionNodeData } from '../../../../types';

interface Props {
  data: ActionNodeData;
  onUpdate: (u: Partial<ActionNodeData>) => void;
}

export default function RemoveOpportunityConfig({ data, onUpdate }: Props) {
  const cfg = (data.config as Record<string, any>) ?? {};
  const set = (key: string, val: unknown) => onUpdate({ config: { ...cfg, [key]: val } });

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Target Opportunity</label>
        <select value={cfg.opportunitySource ?? 'most_recent'} onChange={e => set('opportunitySource', e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20">
          <option value="most_recent">Most recent opportunity</option>
          <option value="context">From workflow context</option>
          <option value="specific_id">Specific opportunity ID</option>
        </select>
      </div>
      {cfg.opportunitySource === 'specific_id' && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Opportunity ID</label>
          <input type="text" value={cfg.opportunityId ?? ''} onChange={e => set('opportunityId', e.target.value)}
            placeholder="opportunity-id or {{variable}}" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
        </div>
      )}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Scope</label>
        <select value={cfg.scope ?? 'current'} onChange={e => set('scope', e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20">
          <option value="current">Current pipeline only</option>
          <option value="all_pipelines">All pipelines</option>
          <option value="selected_pipelines">Selected pipelines</option>
        </select>
      </div>
      {cfg.scope === 'selected_pipelines' && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Pipeline IDs (comma-separated)</label>
          <input type="text" value={(cfg.pipelineIds ?? []).join(', ')} onChange={e => set('pipelineIds', e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean))}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
        </div>
      )}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Removal Mode</label>
        <select value={cfg.mode ?? 'archive'} onChange={e => set('mode', e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20">
          <option value="archive">Archive (hidden, data retained)</option>
          <option value="delete">Permanently delete</option>
        </select>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={cfg.requireApproval ?? (cfg.mode === 'delete')}
          onChange={e => set('requireApproval', e.target.checked)} className="rounded border-gray-300" />
        <span className="text-gray-700">Require approval before removing</span>
      </label>
    </div>
  );
}
