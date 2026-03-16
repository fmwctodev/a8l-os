import { useEffect, useState } from 'react';
import { supabase } from '../../../../lib/supabase';
import type { TriggerNodeData } from '../../../../types';

interface Props {
  data: TriggerNodeData;
  onUpdate: (updates: Partial<TriggerNodeData>) => void;
}

export default function SurveySubmittedConfig({ data, onUpdate }: Props) {
  const config = (data.triggerConfig ?? {}) as Record<string, unknown>;
  const surveyId = (config.surveyId as string) ?? '';
  const minScore = (config.minScore as number | undefined);
  const maxScore = (config.maxScore as number | undefined);
  const [surveys, setSurveys] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    supabase.from('surveys').select('id, name').eq('status', 'published').order('name').then(({ data }) => {
      if (data) setSurveys(data);
    });
  }, []);

  function update(patch: Record<string, unknown>) {
    onUpdate({ triggerConfig: { ...config, ...patch } });
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Survey</label>
        <select
          value={surveyId}
          onChange={e => update({ surveyId: e.target.value })}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
        >
          <option value="">Any survey</option>
          {surveys.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Min Score (Optional)</label>
          <input
            type="number"
            min={0}
            value={minScore ?? ''}
            onChange={e => update({ minScore: e.target.value ? parseInt(e.target.value) : undefined })}
            placeholder="Any"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Max Score (Optional)</label>
          <input
            type="number"
            min={0}
            value={maxScore ?? ''}
            onChange={e => update({ maxScore: e.target.value ? parseInt(e.target.value) : undefined })}
            placeholder="Any"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
          />
        </div>
      </div>

      <div className="p-3 bg-blue-50 rounded-lg">
        <p className="text-xs text-blue-700">
          Use score band to filter survey responses by NPS or CSAT score range.
        </p>
      </div>
    </div>
  );
}
