import { useState, useEffect } from 'react';
import { CircleDollarSign, Users, Calendar, Trophy, XCircle } from 'lucide-react';
import type {
  CreateOpportunityConfig,
  MoveStageConfig,
  MarkWonConfig,
  MarkLostConfig,
  AssignOpportunityOwnerConfig,
  WorkflowActionType,
} from '../../types/workflowActions';
import { supabase } from '../../lib/supabase';

interface OpportunityActionConfigProps {
  actionType: WorkflowActionType;
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
  orgId: string;
}

interface Pipeline {
  id: string;
  name: string;
  stages: Array<{ id: string; name: string; sort_order: number }>;
}

interface LostReason {
  id: string;
  name: string;
}

export function OpportunityActionConfig({
  actionType,
  config,
  onChange,
  orgId,
}: OpportunityActionConfigProps) {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [lostReasons, setLostReasons] = useState<LostReason[]>([]);
  const [users, setUsers] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);

      const [pipelinesRes, usersRes, lostReasonsRes] = await Promise.all([
        supabase
          .from('pipelines')
          .select('id, name, stages:pipeline_stages(id, name, sort_order)')
          .eq('org_id', orgId)
          .order('sort_order'),
        supabase
          .from('users')
          .select('id, name')
          .eq('org_id', orgId)
          .eq('status', 'active'),
        supabase
          .from('lost_reasons')
          .select('id, name')
          .eq('org_id', orgId)
          .eq('is_active', true),
      ]);

      if (pipelinesRes.data) {
        setPipelines(
          pipelinesRes.data.map(p => ({
            ...p,
            stages: (p.stages as Array<{ id: string; name: string; sort_order: number }>)?.sort(
              (a, b) => a.sort_order - b.sort_order
            ) || [],
          }))
        );
      }

      if (usersRes.data) {
        setUsers(usersRes.data);
      }

      if (lostReasonsRes.data) {
        setLostReasons(lostReasonsRes.data);
      }

      setLoading(false);
    }

    loadData();
  }, [orgId]);

  const selectedPipeline = pipelines.find(p => p.id === config.pipelineId);

  if (loading) {
    return (
      <div className="p-4 text-center text-gray-500">
        Loading configuration...
      </div>
    );
  }

  if (actionType === 'create_opportunity') {
    return (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Pipeline *
          </label>
          <select
            value={(config.pipelineId as string) || ''}
            onChange={e => {
              const pipeline = pipelines.find(p => p.id === e.target.value);
              onChange({
                ...config,
                pipelineId: e.target.value,
                stageId: pipeline?.stages[0]?.id || '',
              });
            }}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="">Select pipeline...</option>
            {pipelines.map(pipeline => (
              <option key={pipeline.id} value={pipeline.id}>
                {pipeline.name}
              </option>
            ))}
          </select>
        </div>

        {selectedPipeline && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Initial Stage *
            </label>
            <select
              value={(config.stageId as string) || ''}
              onChange={e => onChange({ ...config, stageId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {selectedPipeline.stages.map(stage => (
                <option key={stage.id} value={stage.id}>
                  {stage.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Opportunity Name
          </label>
          <input
            type="text"
            value={(config.name as string) || ''}
            onChange={e => onChange({ ...config, name: e.target.value })}
            placeholder="Leave blank for auto-generated name"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
          <p className="mt-1 text-xs text-gray-500">
            Use {'{{contact.first_name}}'} for merge fields
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Value
            </label>
            <input
              type="number"
              value={(config.value as number) || ''}
              onChange={e => onChange({ ...config, value: parseFloat(e.target.value) || 0 })}
              placeholder="0.00"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Currency
            </label>
            <select
              value={(config.currency as string) || 'USD'}
              onChange={e => onChange({ ...config, currency: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
              <option value="CAD">CAD</option>
              <option value="AUD">AUD</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Source
          </label>
          <input
            type="text"
            value={(config.source as string) || ''}
            onChange={e => onChange({ ...config, source: e.target.value })}
            placeholder="e.g., Website, Referral, Campaign"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Close Date (Days from Now)
          </label>
          <input
            type="number"
            value={(config.closeDateDays as number) || ''}
            onChange={e => onChange({ ...config, closeDateDays: parseInt(e.target.value) || undefined })}
            placeholder="30"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Assign To
          </label>
          <select
            value={(config.assigneeType as string) || 'contact_owner'}
            onChange={e => onChange({ ...config, assigneeType: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="contact_owner">Contact Owner</option>
            <option value="specific_user">Specific User</option>
            <option value="round_robin">Round Robin</option>
            <option value="least_busy">Least Busy</option>
          </select>
        </div>

        {config.assigneeType === 'specific_user' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Select User
            </label>
            <select
              value={(config.assigneeId as string) || ''}
              onChange={e => onChange({ ...config, assigneeId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">Select user...</option>
              {users.map(user => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    );
  }

  if (actionType === 'move_opportunity_stage') {
    return (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Opportunity Source
          </label>
          <select
            value={(config.opportunitySource as string) || 'most_recent'}
            onChange={e => onChange({ ...config, opportunitySource: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="most_recent">Most Recent Open Opportunity</option>
            <option value="context">From Workflow Context</option>
            <option value="specific_id">Specific Opportunity</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Pipeline
          </label>
          <select
            value={(config.pipelineId as string) || ''}
            onChange={e => {
              const pipeline = pipelines.find(p => p.id === e.target.value);
              onChange({
                ...config,
                pipelineId: e.target.value,
                targetStageId: pipeline?.stages[0]?.id || '',
              });
            }}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="">Select pipeline...</option>
            {pipelines.map(pipeline => (
              <option key={pipeline.id} value={pipeline.id}>
                {pipeline.name}
              </option>
            ))}
          </select>
        </div>

        {selectedPipeline && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Move to Stage *
            </label>
            <select
              value={(config.targetStageId as string) || ''}
              onChange={e => onChange({ ...config, targetStageId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">Select stage...</option>
              {selectedPipeline.stages.map(stage => (
                <option key={stage.id} value={stage.id}>
                  {stage.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="validateSequence"
            checked={(config.validateSequence as boolean) || false}
            onChange={e => onChange({ ...config, validateSequence: e.target.checked })}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <label htmlFor="validateSequence" className="text-sm text-gray-700 dark:text-gray-300">
            Only allow moving forward in pipeline
          </label>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="createTimelineEvent"
            checked={(config.createTimelineEvent as boolean) !== false}
            onChange={e => onChange({ ...config, createTimelineEvent: e.target.checked })}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <label htmlFor="createTimelineEvent" className="text-sm text-gray-700 dark:text-gray-300">
            Log stage change to timeline
          </label>
        </div>
      </div>
    );
  }

  if (actionType === 'mark_opportunity_won') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <Trophy className="w-5 h-5 text-green-600" />
          <span className="text-sm text-green-700 dark:text-green-300">
            This action will mark the opportunity as won
          </span>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Opportunity Source
          </label>
          <select
            value={(config.opportunitySource as string) || 'most_recent'}
            onChange={e => onChange({ ...config, opportunitySource: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="most_recent">Most Recent Open Opportunity</option>
            <option value="context">From Workflow Context</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Notes (Optional)
          </label>
          <textarea
            value={(config.notes as string) || ''}
            onChange={e => onChange({ ...config, notes: e.target.value })}
            placeholder="Add closing notes..."
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>
      </div>
    );
  }

  if (actionType === 'mark_opportunity_lost') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
          <XCircle className="w-5 h-5 text-red-600" />
          <span className="text-sm text-red-700 dark:text-red-300">
            This action will mark the opportunity as lost
          </span>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Opportunity Source
          </label>
          <select
            value={(config.opportunitySource as string) || 'most_recent'}
            onChange={e => onChange({ ...config, opportunitySource: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="most_recent">Most Recent Open Opportunity</option>
            <option value="context">From Workflow Context</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Lost Reason
          </label>
          <select
            value={(config.lostReasonId as string) || ''}
            onChange={e => onChange({ ...config, lostReasonId: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="">Select reason...</option>
            {lostReasons.map(reason => (
              <option key={reason.id} value={reason.id}>
                {reason.name}
              </option>
            ))}
            <option value="custom">Custom reason...</option>
          </select>
        </div>

        {config.lostReasonId === 'custom' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Custom Reason
            </label>
            <input
              type="text"
              value={(config.lostReasonText as string) || ''}
              onChange={e => onChange({ ...config, lostReasonText: e.target.value })}
              placeholder="Enter custom reason..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Notes (Optional)
          </label>
          <textarea
            value={(config.notes as string) || ''}
            onChange={e => onChange({ ...config, notes: e.target.value })}
            placeholder="Add closing notes..."
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>
      </div>
    );
  }

  if (actionType === 'assign_opportunity_owner') {
    return (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Opportunity Source
          </label>
          <select
            value={(config.opportunitySource as string) || 'most_recent'}
            onChange={e => onChange({ ...config, opportunitySource: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="most_recent">Most Recent Open Opportunity</option>
            <option value="context">From Workflow Context</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Assign To
          </label>
          <select
            value={(config.ownerType as string) || 'contact_owner'}
            onChange={e => onChange({ ...config, ownerType: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="contact_owner">Contact Owner</option>
            <option value="specific">Specific User</option>
            <option value="round_robin">Round Robin</option>
          </select>
        </div>

        {config.ownerType === 'specific' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Select User
            </label>
            <select
              value={(config.ownerId as string) || ''}
              onChange={e => onChange({ ...config, ownerId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">Select user...</option>
              {users.map(user => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="notifyOwner"
            checked={(config.notifyOwner as boolean) || false}
            onChange={e => onChange({ ...config, notifyOwner: e.target.checked })}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <label htmlFor="notifyOwner" className="text-sm text-gray-700 dark:text-gray-300">
            Notify the new owner
          </label>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 text-center text-gray-500">
      Configuration not available for this action type.
    </div>
  );
}
