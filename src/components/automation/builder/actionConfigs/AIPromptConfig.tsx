import type { ActionNodeData } from '../../../../types';

interface Props {
  data: ActionNodeData;
  onUpdate: (u: Partial<ActionNodeData>) => void;
}

export default function AIPromptConfig({ data, onUpdate }: Props) {
  const cfg = (data.config as Record<string, any>) ?? {};
  const set = (key: string, val: unknown) => onUpdate({ config: { ...cfg, [key]: val } });

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Prompt Template</label>
        <textarea value={cfg.promptTemplate ?? ''} onChange={e => set('promptTemplate', e.target.value)}
          rows={5} placeholder="Write your prompt here... Use {{contact.first_name}}, {{opportunity.title}} etc. for merge fields."
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Output Mode</label>
        <select value={cfg.outputMode ?? 'plain_text'} onChange={e => set('outputMode', e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20">
          <option value="plain_text">Plain text</option>
          <option value="json">JSON object</option>
          <option value="summary">Summary paragraph</option>
          <option value="classification">Classification label</option>
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Save Output To</label>
        <select value={cfg.saveOutputTo ?? 'variable'} onChange={e => set('saveOutputTo', e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20">
          <option value="variable">Workflow variable</option>
          <option value="contact_field">Contact field</option>
          <option value="note">Contact note</option>
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          {cfg.saveOutputTo === 'contact_field' ? 'Field Key' : cfg.saveOutputTo === 'note' ? 'Note prefix (optional)' : 'Variable Name'}
        </label>
        <input type="text" value={cfg.saveOutputKey ?? ''} onChange={e => set('saveOutputKey', e.target.value)}
          placeholder={cfg.saveOutputTo === 'contact_field' ? 'field_key' : cfg.saveOutputTo === 'note' ? 'AI Summary:' : 'ai_output'}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={cfg.requireApproval ?? false} onChange={e => set('requireApproval', e.target.checked)}
          className="rounded border-gray-300" />
        <span className="text-gray-700">Require human approval before saving output</span>
      </label>
    </div>
  );
}
