import type { ActionNodeData } from '../../../../types';

interface Props {
  data: ActionNodeData;
  onUpdate: (u: Partial<ActionNodeData>) => void;
}

export default function CreateOrUpdateOpportunityConfig({ data, onUpdate }: Props) {
  const cfg = (data.config as Record<string, any>) ?? {};
  const set = (key: string, val: unknown) => onUpdate({ config: { ...cfg, [key]: val } });

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Mode</label>
        <select value={cfg.mode ?? 'create'} onChange={e => set('mode', e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20">
          <option value="create">Create new opportunity</option>
          <option value="update">Update existing opportunity</option>
          <option value="upsert">Create or update (upsert)</option>
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Pipeline ID</label>
        <input type="text" value={cfg.pipelineId ?? ''} onChange={e => set('pipelineId', e.target.value)}
          placeholder="pipeline-id" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Stage ID</label>
        <input type="text" value={cfg.stageId ?? ''} onChange={e => set('stageId', e.target.value)}
          placeholder="stage-id" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Title Template</label>
        <input type="text" value={cfg.titleTemplate ?? ''} onChange={e => set('titleTemplate', e.target.value)}
          placeholder="{{contact.first_name}} - New Deal" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Value ($)</label>
          <input type="number" min={0} value={cfg.value ?? ''} onChange={e => set('value', parseFloat(e.target.value) || undefined)}
            placeholder="0.00" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Close In (days)</label>
          <input type="number" min={0} value={cfg.closeDateDays ?? ''} onChange={e => set('closeDateDays', parseInt(e.target.value) || undefined)}
            placeholder="30" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
        <select value={cfg.status ?? 'open'} onChange={e => set('status', e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20">
          <option value="open">Open</option>
          <option value="won">Won</option>
          <option value="lost">Lost</option>
          <option value="abandoned">Abandoned</option>
        </select>
      </div>
      {(cfg.mode === 'create' || cfg.mode === 'upsert') && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">If Duplicate Found</label>
          <select value={cfg.duplicateRule ?? 'update'} onChange={e => set('duplicateRule', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20">
            <option value="skip">Skip creation</option>
            <option value="update">Update existing</option>
            <option value="create_new">Create new anyway</option>
          </select>
        </div>
      )}
    </div>
  );
}
