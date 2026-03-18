import type { ActionNodeData } from '../../../../types';

interface Props {
  data: ActionNodeData;
  onUpdate: (u: Partial<ActionNodeData>) => void;
}

export default function ConversationAIReplyConfig({ data, onUpdate }: Props) {
  const cfg = (data.config as Record<string, any>) ?? {};
  const set = (key: string, val: unknown) => onUpdate({ config: { ...cfg, [key]: val } });

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">AI Agent ID</label>
        <input type="text" value={cfg.agentId ?? ''} onChange={e => set('agentId', e.target.value)}
          placeholder="agent-id or leave blank for default" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
        <p className="text-xs text-gray-400 mt-1">Configure agents in AI Agents settings.</p>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Mode</label>
        <select value={cfg.mode ?? 'draft'} onChange={e => set('mode', e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20">
          <option value="draft">Draft reply (requires approval)</option>
          <option value="auto_reply">Auto-reply (send immediately)</option>
          <option value="classify">Classify conversation intent</option>
          <option value="summarize">Summarize conversation</option>
        </select>
      </div>
      {cfg.mode === 'auto_reply' && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-xs text-amber-700">Auto-reply mode will send the response without human review. Use carefully.</p>
        </div>
      )}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={cfg.requireApproval ?? (cfg.mode !== 'auto_reply')}
          onChange={e => set('requireApproval', e.target.checked)} className="rounded border-gray-300" />
        <span className="text-gray-700">Require approval before sending</span>
      </label>
      {(cfg.mode === 'classify' || cfg.mode === 'summarize') && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Save Output to Variable</label>
          <input type="text" value={cfg.outputField ?? ''} onChange={e => set('outputField', e.target.value)}
            placeholder="ai_classification" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
        </div>
      )}
    </div>
  );
}
