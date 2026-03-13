import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  getAutomationTemplateById,
  getAutomationTemplateVersions,
  getTemplateInstances,
  duplicateAutomationTemplate,
} from '../../services/automationTemplates';
import { TRIGGER_TYPE_LABELS, ACTION_TYPE_LABELS } from '../../services/workflowEngine';
import type {
  AutomationTemplate,
  AutomationTemplateVersion,
  AutomationTemplateInstance,
  WorkflowDefinition,
  WorkflowNode,
  WorkflowNodeType,
  TriggerNodeData,
  ActionNodeData,
  DelayNodeData,
} from '../../types';
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  Zap,
  GitBranch,
  Clock,
  Play,
  CheckCircle,
  Users,
  Copy,
  Pencil,
  ChevronDown,
  ChevronRight,
  Calendar,
  Target,
  TrendingUp,
  FileText,
  Send,
  Settings,
  Mail,
  MessageSquare,
  Sparkles,
  History,
} from 'lucide-react';
import { UseTemplateModal } from '../../components/automation/UseTemplateModal';

const NODE_COLORS: Record<WorkflowNodeType, { bg: string; border: string; icon: string }> = {
  trigger: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/50', icon: 'text-emerald-400' },
  condition: { bg: 'bg-amber-500/10', border: 'border-amber-500/50', icon: 'text-amber-400' },
  delay: { bg: 'bg-blue-500/10', border: 'border-blue-500/50', icon: 'text-blue-400' },
  action: { bg: 'bg-cyan-500/10', border: 'border-cyan-500/50', icon: 'text-cyan-400' },
  end: { bg: 'bg-slate-500/10', border: 'border-slate-500/50', icon: 'text-slate-400' },
};

const NODE_ICONS: Record<WorkflowNodeType, typeof Zap> = {
  trigger: Zap,
  condition: GitBranch,
  delay: Clock,
  action: Play,
  end: CheckCircle,
};

const CATEGORY_CONFIG: Record<string, { label: string; icon: typeof Zap; color: string; bg: string }> = {
  sales: { label: 'Sales', icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  lead_management: { label: 'Lead Management', icon: Target, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
  scheduling: { label: 'Scheduling', icon: Calendar, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  proposal: { label: 'Proposal', icon: FileText, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  follow_up: { label: 'Follow-Up', icon: Send, color: 'text-teal-400', bg: 'bg-teal-500/10' },
  internal_ops: { label: 'Internal Ops', icon: Settings, color: 'text-slate-400', bg: 'bg-slate-500/10' },
};

export default function AutomationTemplateViewer() {
  const { templateId } = useParams<{ templateId: string }>();
  const navigate = useNavigate();
  const { user: currentUser, hasPermission } = useAuth();
  const canManage = hasPermission('automation.manage');

  const [template, setTemplate] = useState<AutomationTemplate | null>(null);
  const [versions, setVersions] = useState<AutomationTemplateVersion[]>([]);
  const [instances, setInstances] = useState<AutomationTemplateInstance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showVersions, setShowVersions] = useState(false);
  const [showUseModal, setShowUseModal] = useState(false);

  const loadData = useCallback(async () => {
    if (!templateId) return;

    try {
      setIsLoading(true);
      setError(null);

      const [templateData, versionsData, instancesData] = await Promise.all([
        getAutomationTemplateById(templateId),
        getAutomationTemplateVersions(templateId),
        getTemplateInstances(templateId),
      ]);

      if (!templateData) {
        setError('Template not found');
        return;
      }

      setTemplate(templateData);
      setVersions(versionsData);
      setInstances(instancesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load template');
    } finally {
      setIsLoading(false);
    }
  }, [templateId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDuplicate = async () => {
    if (!template || !currentUser?.organization_id) return;

    try {
      const dup = await duplicateAutomationTemplate(template.id, currentUser.organization_id, currentUser.id);
      navigate(`/automation/templates/${dup.id}/edit`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to duplicate template');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  if (error || !template) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
        <p className="text-white font-medium">{error || 'Template not found'}</p>
        <button
          onClick={() => navigate('/automation/templates')}
          className="mt-4 text-sm text-cyan-400 hover:underline"
        >
          Back to templates
        </button>
      </div>
    );
  }

  const catConfig = CATEGORY_CONFIG[template.category] || CATEGORY_CONFIG.sales;
  const CatIcon = catConfig.icon;
  const definition = template.latest_version?.definition_snapshot;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/automation/templates')}
            className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-400" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg ${catConfig.bg} flex items-center justify-center`}>
                <CatIcon className={`w-5 h-5 ${catConfig.color}`} />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-white">{template.name}</h1>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${catConfig.bg} ${catConfig.color}`}>
                    {catConfig.label}
                  </span>
                  {template.is_system && (
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-cyan-500/10 text-cyan-400">
                      System Template
                    </span>
                  )}
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    {template.use_count} uses
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {template.is_system && canManage && (
            <button
              onClick={handleDuplicate}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 transition-colors"
            >
              <Copy className="w-4 h-4" />
              Duplicate to My Templates
            </button>
          )}
          {!template.is_system && canManage && (
            <button
              onClick={() => navigate(`/automation/templates/${template.id}/edit`)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 transition-colors"
            >
              <Pencil className="w-4 h-4" />
              Edit Template
            </button>
          )}
          {canManage && (
            <button
              onClick={() => setShowUseModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-600 text-white font-medium hover:from-cyan-600 hover:to-teal-700 transition-colors"
            >
              <Play className="w-4 h-4" />
              Use This Template
            </button>
          )}
        </div>
      </div>

      {template.description && (
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
          <p className="text-slate-300 text-sm leading-relaxed">{template.description}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
          <p className="text-xs text-slate-400 mb-1">Complexity</p>
          <p className="text-sm font-medium text-white capitalize">{template.complexity}</p>
        </div>
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
          <p className="text-xs text-slate-400 mb-1">Estimated Setup</p>
          <p className="text-sm font-medium text-white">{template.estimated_time || 'N/A'}</p>
        </div>
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
          <p className="text-xs text-slate-400 mb-1">Channels</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            {template.channel_tags.length > 0 ? template.channel_tags.map(tag => (
              <span key={tag} className="px-2 py-0.5 rounded bg-slate-800 text-xs text-slate-300">{tag}</span>
            )) : <span className="text-sm text-slate-500">None</span>}
          </div>
        </div>
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
          <p className="text-xs text-slate-400 mb-1">Versions</p>
          <p className="text-sm font-medium text-white">{versions.length}</p>
        </div>
      </div>

      {definition && (
        <>
          <div className="bg-slate-900 rounded-xl border border-slate-800">
            <div className="p-4 border-b border-slate-800">
              <h2 className="text-lg font-semibold text-white">Workflow Preview</h2>
              <p className="text-sm text-slate-400">Visual overview of the automation flow</p>
            </div>
            <div className="p-6">
              <WorkflowPreview definition={definition} />
            </div>
          </div>

          <div className="bg-slate-900 rounded-xl border border-slate-800">
            <div className="p-4 border-b border-slate-800">
              <h2 className="text-lg font-semibold text-white">What This Template Does</h2>
              <p className="text-sm text-slate-400">Step-by-step breakdown of the workflow</p>
            </div>
            <div className="p-4">
              <StepBreakdown definition={definition} />
            </div>
          </div>

          <RequirementsSection definition={definition} />
        </>
      )}

      <div className="bg-slate-900 rounded-xl border border-slate-800">
        <button
          className="w-full p-4 flex items-center justify-between text-left"
          onClick={() => setShowVersions(!showVersions)}
        >
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-slate-400" />
            <h2 className="text-lg font-semibold text-white">Version History</h2>
            <span className="text-sm text-slate-400">({versions.length})</span>
          </div>
          {showVersions ? (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronRight className="w-5 h-5 text-slate-400" />
          )}
        </button>
        {showVersions && (
          <div className="border-t border-slate-800 divide-y divide-slate-800">
            {versions.map(v => (
              <div key={v.id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white">Version {v.version_number}</p>
                  <p className="text-xs text-slate-400">{v.change_summary || 'No summary'}</p>
                </div>
                <p className="text-xs text-slate-500">
                  {new Date(v.created_at).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {instances.length > 0 && (
        <div className="bg-slate-900 rounded-xl border border-slate-800">
          <div className="p-4 border-b border-slate-800">
            <h2 className="text-lg font-semibold text-white">Usage</h2>
            <p className="text-sm text-slate-400">Workflows created from this template</p>
          </div>
          <div className="divide-y divide-slate-800">
            {instances.map(inst => (
              <div
                key={inst.id}
                className="p-4 flex items-center justify-between hover:bg-slate-800/50 cursor-pointer transition-colors"
                onClick={() => navigate(`/automation/${inst.workflow_id}`)}
              >
                <div className="flex items-center gap-3">
                  <Zap className="w-4 h-4 text-cyan-400" />
                  <div>
                    <p className="text-sm font-medium text-white">
                      {(inst.workflow as any)?.name || 'Workflow'}
                    </p>
                    <p className="text-xs text-slate-400">
                      Created {new Date(inst.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  (inst.workflow as any)?.status === 'published'
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : (inst.workflow as any)?.status === 'archived'
                      ? 'bg-slate-500/10 text-slate-400'
                      : 'bg-amber-500/10 text-amber-400'
                }`}>
                  {((inst.workflow as any)?.status || 'draft').charAt(0).toUpperCase() +
                   ((inst.workflow as any)?.status || 'draft').slice(1)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {showUseModal && template && (
        <UseTemplateModal
          template={template}
          onClose={() => setShowUseModal(false)}
          onSuccess={(workflowId) => {
            setShowUseModal(false);
            navigate(`/automation/${workflowId}`);
          }}
        />
      )}
    </div>
  );
}

function WorkflowPreview({ definition }: { definition: WorkflowDefinition }) {
  if (!definition.nodes.length) {
    return (
      <div className="text-center py-8">
        <Zap className="w-8 h-8 text-slate-600 mx-auto mb-2" />
        <p className="text-sm text-slate-400">No nodes defined</p>
      </div>
    );
  }

  const sortedNodes = [...definition.nodes].sort((a, b) => a.position.y - b.position.y);

  return (
    <div className="flex flex-col items-center gap-3">
      {sortedNodes.map((node, idx) => {
        const Icon = NODE_ICONS[node.type];
        const colors = NODE_COLORS[node.type];
        return (
          <div key={node.id}>
            <div className={`w-72 rounded-lg border ${colors.border} ${colors.bg} p-3`}>
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`w-4 h-4 ${colors.icon}`} />
                <span className="text-xs font-medium text-slate-400 uppercase">{node.type}</span>
              </div>
              <p className="text-sm text-white font-medium">{getNodeLabel(node)}</p>
            </div>
            {idx < sortedNodes.length - 1 && (
              <div className="flex justify-center py-1">
                <div className="w-px h-4 bg-slate-700" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function StepBreakdown({ definition }: { definition: WorkflowDefinition }) {
  const sortedNodes = [...definition.nodes].sort((a, b) => a.position.y - b.position.y);

  if (!sortedNodes.length) {
    return <p className="text-sm text-slate-400 py-4 text-center">No steps defined</p>;
  }

  return (
    <div className="space-y-0">
      {sortedNodes.map((node, idx) => {
        const Icon = NODE_ICONS[node.type];
        const colors = NODE_COLORS[node.type];
        return (
          <div key={node.id} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full ${colors.bg} border ${colors.border} flex items-center justify-center flex-shrink-0`}>
                <Icon className={`w-4 h-4 ${colors.icon}`} />
              </div>
              {idx < sortedNodes.length - 1 && (
                <div className="w-px flex-1 bg-slate-700 my-1" />
              )}
            </div>
            <div className="pb-6 pt-1">
              <p className="text-sm font-medium text-white">{getNodeLabel(node)}</p>
              <p className="text-xs text-slate-400 mt-0.5">{getNodeDescription(node)}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RequirementsSection({ definition }: { definition: WorkflowDefinition }) {
  const requirements: string[] = [];
  const actionNodes = definition.nodes.filter(n => n.type === 'action');

  const hasEmail = actionNodes.some(n => (n.data as ActionNodeData).actionType === 'send_email');
  const hasSms = actionNodes.some(n => (n.data as ActionNodeData).actionType === 'send_sms');
  const hasAI = actionNodes.some(n =>
    ['invoke_ai_agent', 'ai_conversation_reply', 'ai_email_draft', 'ai_follow_up_message', 'ai_lead_qualification', 'ai_booking_assist', 'ai_decision_step'].includes((n.data as ActionNodeData).actionType)
  );
  const hasWebhook = actionNodes.some(n => (n.data as ActionNodeData).actionType === 'webhook_post');

  if (hasEmail) requirements.push('Email service must be configured');
  if (hasSms) requirements.push('SMS / Phone system must be set up');
  if (hasAI) requirements.push('AI Agent must be configured with an LLM provider');
  if (hasWebhook) requirements.push('Webhook endpoint must be accessible');

  if (requirements.length === 0) return null;

  return (
    <div className="bg-amber-500/5 rounded-xl border border-amber-500/20 p-5">
      <h3 className="text-sm font-semibold text-amber-400 mb-3">Requirements</h3>
      <ul className="space-y-2">
        {requirements.map((req, idx) => (
          <li key={idx} className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
            <span className="text-sm text-slate-300">{req}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function getNodeLabel(node: WorkflowNode): string {
  switch (node.type) {
    case 'trigger': {
      const data = node.data as TriggerNodeData;
      return TRIGGER_TYPE_LABELS[data.triggerType] || data.triggerType || 'Trigger';
    }
    case 'action': {
      const data = node.data as ActionNodeData;
      return ACTION_TYPE_LABELS[data.actionType] || data.actionType || 'Action';
    }
    case 'delay': {
      const data = node.data as DelayNodeData;
      if (data.delayType === 'wait_duration' && data.duration) {
        return `Wait ${data.duration.value} ${data.duration.unit}`;
      }
      return 'Delay';
    }
    case 'condition':
      return 'Condition Check';
    case 'end':
      return 'End';
    default:
      return node.type;
  }
}

function getNodeDescription(node: WorkflowNode): string {
  switch (node.type) {
    case 'trigger': {
      const data = node.data as TriggerNodeData;
      if (data.triggerCategory === 'scheduled') return 'Runs on a recurring schedule';
      if (data.triggerCategory === 'webhook') return 'Triggered by an incoming webhook';
      return 'Starts when this event occurs';
    }
    case 'action': {
      const data = node.data as ActionNodeData;
      const label = ACTION_TYPE_LABELS[data.actionType] || data.actionType;
      return `Executes the "${label}" action`;
    }
    case 'delay': {
      const data = node.data as DelayNodeData;
      if (data.delayType === 'wait_duration' && data.duration) {
        return `Pauses the workflow for ${data.duration.value} ${data.duration.unit}`;
      }
      if (data.delayType === 'wait_until_datetime') return 'Waits until a specific date and time';
      if (data.delayType === 'wait_until_weekday_time') return 'Waits until a specific day of the week';
      return 'Pauses the workflow';
    }
    case 'condition':
      return 'Evaluates conditions and branches the flow';
    case 'end':
      return 'Completes the workflow';
    default:
      return '';
  }
}
