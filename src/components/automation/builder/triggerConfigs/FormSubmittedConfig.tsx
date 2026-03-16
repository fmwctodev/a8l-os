import { useEffect, useState } from 'react';
import { supabase } from '../../../../lib/supabase';
import type { TriggerNodeData } from '../../../../types';

interface Props {
  data: TriggerNodeData;
  onUpdate: (updates: Partial<TriggerNodeData>) => void;
}

export default function FormSubmittedConfig({ data, onUpdate }: Props) {
  const config = (data.triggerConfig ?? {}) as Record<string, unknown>;
  const formId = (config.formId as string) ?? '';
  const sourceFilter = (config.sourceFilter as string) ?? '';
  const [forms, setForms] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    supabase.from('forms').select('id, name').eq('status', 'published').order('name').then(({ data }) => {
      if (data) setForms(data);
    });
  }, []);

  function update(patch: Record<string, unknown>) {
    onUpdate({ triggerConfig: { ...config, ...patch } });
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Form</label>
        <select
          value={formId}
          onChange={e => update({ formId: e.target.value })}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
        >
          <option value="">Any form</option>
          {forms.map(f => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>
        <p className="text-xs text-gray-400 mt-1">Select a specific form or leave empty for all forms</p>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Source / Page Filter (Optional)</label>
        <input
          value={sourceFilter}
          onChange={e => update({ sourceFilter: e.target.value })}
          placeholder="e.g. landing-page, homepage"
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
        />
      </div>
    </div>
  );
}
