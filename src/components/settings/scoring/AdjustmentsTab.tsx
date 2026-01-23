import { useState, useEffect } from 'react';
import { Calendar, User, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { getModels, type ScoringModel, type ScoreEvent, formatScoreChange, getScoreChangeColor } from '../../../services/scoring';

export function AdjustmentsTab() {
  const [models, setModels] = useState<ScoringModel[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>('');
  const [events, setEvents] = useState<ScoreEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [sourceFilter, setSourceFilter] = useState<string>('manual');

  useEffect(() => {
    loadModels();
  }, []);

  useEffect(() => {
    loadEvents();
  }, [selectedModelId, sourceFilter]);

  async function loadModels() {
    try {
      const data = await getModels();
      setModels(data);
    } catch (error) {
      console.error('Failed to load models:', error);
    }
  }

  async function loadEvents() {
    try {
      setLoading(true);
      let query = supabase
        .from('score_events')
        .select(`
          *,
          scoring_rules(name),
          users:created_by(id, first_name, last_name, email)
        `)
        .eq('source', sourceFilter)
        .order('created_at', { ascending: false })
        .limit(100);

      if (selectedModelId) {
        query = query.eq('model_id', selectedModelId);
      }

      const { data, error } = await query;
      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error('Failed to load events:', error);
    } finally {
      setLoading(false);
    }
  }

  function getEntityLink(event: ScoreEvent): string {
    if (event.entity_type === 'contact') {
      return `/contacts/${event.entity_id}`;
    }
    return `/opportunities/${event.entity_id}`;
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Source:</label>
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          >
            <option value="manual">Manual Adjustments</option>
            <option value="rule">Rule-Based</option>
            <option value="decay">Decay</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Model:</label>
          <select
            value={selectedModelId}
            onChange={(e) => setSelectedModelId(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          >
            <option value="">All Models</option>
            {models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
          <p className="text-gray-500">No {sourceFilter} score changes found.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Entity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Change
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Reason
                </th>
                {sourceFilter === 'manual' && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Adjusted By
                  </th>
                )}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {events.map((event) => (
                <tr key={event.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <a
                      href={getEntityLink(event)}
                      className="text-sm font-medium text-teal-600 hover:text-teal-700 capitalize"
                    >
                      {event.entity_type} {event.entity_id.slice(0, 8)}...
                    </a>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {event.points_delta > 0 ? (
                        <ArrowUpRight className="h-4 w-4 text-green-500" />
                      ) : (
                        <ArrowDownRight className="h-4 w-4 text-red-500" />
                      )}
                      <span className={`text-sm font-semibold ${getScoreChangeColor(event.points_delta)}`}>
                        {formatScoreChange(event.points_delta)}
                      </span>
                      <span className="text-xs text-gray-500">
                        ({event.previous_score} → {event.new_score})
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-600 line-clamp-1">{event.reason}</span>
                  </td>
                  {sourceFilter === 'manual' && (
                    <td className="px-6 py-4 whitespace-nowrap">
                      {event.users ? (
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-gray-400" />
                          <span className="text-sm text-gray-600">
                            {[event.users.first_name, event.users.last_name].filter(Boolean).join(' ') || event.users.email}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
                  )}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-600">{formatDate(event.created_at)}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
