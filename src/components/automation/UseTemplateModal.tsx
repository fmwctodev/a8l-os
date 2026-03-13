import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { instantiateTemplate } from '../../services/automationTemplates';
import { TRIGGER_TYPE_LABELS, ACTION_TYPE_LABELS } from '../../services/workflowEngine';
import type {
  AutomationTemplate,
  WorkflowNode,
  TriggerNodeData,
  ActionNodeData,
  DelayNodeData,
  WorkflowNodeType,
} from '../../types';
import {
  X,
  Loader2,
  ChevronRight,
  ChevronLeft,
  Zap,
  GitBranch,
  Clock,
  Play,
  CheckCircle,
  Check,
  AlertCircle,
} from 'lucide-react';

const NODE_ICONS: Record<WorkflowNodeType, typeof Zap> = {
  trigger: Zap,
  condition: GitBranch,
  delay: Clock,
  action: Play,
  end: CheckCircle,
};

const NODE_TYPE_COLORS: Record<WorkflowNodeType, string> = {
  trigger: 'text-emerald-400',
  condition: 'text-amber-400',
  delay: 'text-blue-400',
  action: 'text-cyan-400',
  end: 'text-slate-400',
};

const STEPS = [
  { label: 'Name', description: 'Name your workflow' },
  { label: 'Review', description: 'Review template details' },
  { label: 'Create', description: 'Creating workflow' },
];

interface UseTemplateModalProps {
  template: AutomationTemplate;
  onClose: () => void;
  onSuccess: (workflowId: string) => void;
}

export function UseTemplateModal({ template, onClose, onSuccess }: UseTemplateModalProps) {
  const { user: currentUser } = useAuth();
  const [step, setStep] = useState(0);
  const [workflowName, setWorkflowName] = useState(`${template.name}`);
  const [workflowDescription, setWorkflowDescription] = useState(template.description || '');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const definition = template.latest_version?.definition_snapshot;
  const sortedNodes = definition ? [...definition.nodes].sort((a, b) => a.position.y - b.position.y) : [];

  const handleCreate = async () => {
    if (!currentUser?.organization_id || !template.latest_version) return;

    try {
      setStep(2);
      setIsCreating(true);
      setError(null);

      const workflow = await instantiateTemplate(
        template.id,
        currentUser.organization_id,
        currentUser.id,
        workflowName.trim(),
        workflowDescription.trim() || null
      );

      onSuccess(workflow.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create workflow');
      setStep(1);
      setIsCreating(false);
    }
  };

  const canProceed = step === 0 ? workflowName.trim().length > 0 : true;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-white">Use Template</h2>
            <p className="text-sm text-slate-400">{template.name}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-800 transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="px-5 py-3 border-b border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-2">
            {STEPS.map((s, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
                  idx < step ? 'bg-emerald-500 text-white' :
                  idx === step ? 'bg-cyan-500 text-white' :
                  'bg-slate-800 text-slate-500'
                }`}>
                  {idx < step ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                </div>
                <span className={`text-xs font-medium ${
                  idx <= step ? 'text-white' : 'text-slate-500'
                }`}>
                  {s.label}
                </span>
                {idx < STEPS.length - 1 && (
                  <div className={`w-8 h-px ${idx < step ? 'bg-emerald-500' : 'bg-slate-700'}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Workflow Name
                </label>
                <input
                  type="text"
                  value={workflowName}
                  onChange={(e) => setWorkflowName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  placeholder="Enter workflow name..."
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Description (optional)
                </label>
                <textarea
                  value={workflowDescription}
                  onChange={(e) => setWorkflowDescription(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent resize-none"
                  placeholder="Describe what this workflow does..."
                />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div className="bg-slate-800/50 rounded-lg p-4">
                <p className="text-xs text-slate-400 mb-1">Creating workflow</p>
                <p className="text-sm font-medium text-white">{workflowName}</p>
                {workflowDescription && (
                  <p className="text-xs text-slate-400 mt-1">{workflowDescription}</p>
                )}
              </div>

              <div>
                <p className="text-sm font-medium text-slate-300 mb-3">
                  Template includes {sortedNodes.length} step{sortedNodes.length !== 1 ? 's' : ''}:
                </p>
                <div className="space-y-2">
                  {sortedNodes.map((node, idx) => {
                    const Icon = NODE_ICONS[node.type];
                    const color = NODE_TYPE_COLORS[node.type];
                    return (
                      <div key={node.id} className="flex items-center gap-3 py-2">
                        <span className="text-xs text-slate-500 w-5 text-right">{idx + 1}.</span>
                        <Icon className={`w-4 h-4 ${color} flex-shrink-0`} />
                        <span className="text-sm text-white">{getNodeLabel(node)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                  <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-lg p-4">
                <p className="text-xs text-cyan-400 font-medium mb-1">What happens next</p>
                <p className="text-xs text-slate-300">
                  A new draft workflow will be created with all the template steps pre-configured.
                  You can then customize any step before publishing.
                </p>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-10 h-10 animate-spin text-cyan-500 mb-4" />
              <p className="text-white font-medium">Creating your workflow...</p>
              <p className="text-sm text-slate-400 mt-1">Setting up template steps</p>
            </div>
          )}
        </div>

        {step < 2 && (
          <div className="p-5 border-t border-slate-800 flex items-center justify-between flex-shrink-0">
            <button
              onClick={step === 0 ? onClose : () => setStep(step - 1)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              {step === 0 ? 'Cancel' : 'Back'}
            </button>
            <button
              onClick={step === 1 ? handleCreate : () => setStep(step + 1)}
              disabled={!canProceed || isCreating}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-600 text-white font-medium hover:from-cyan-600 hover:to-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {step === 1 ? (
                <>
                  <Play className="w-4 h-4" />
                  Create Workflow
                </>
              ) : (
                <>
                  Review
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        )}
      </div>
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
