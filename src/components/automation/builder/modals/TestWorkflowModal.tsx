import { useState, useCallback } from 'react';
import { X, Play, Search, User, CheckCircle2, XCircle, Clock, Zap, ArrowRight, AlertTriangle, FileText } from 'lucide-react';
import type { BuilderNode } from '../../../../types/workflowBuilder';
import type { TriggerNodeData, ConditionNodeData, DelayNodeData } from '../../../../types';
import { supabase } from '../../../../lib/supabase';
import { useAuth } from '../../../../contexts/AuthContext';
import { TRIGGER_OPTIONS, ACTION_OPTIONS } from '../../../../types/workflowBuilder';
import { matchesTrigger } from '../../../../services/triggerMatcher';

interface TestWorkflowModalProps {
  nodes: BuilderNode[];
  edges: any[];
  onClose: () => void;
}

interface TestStep {
  nodeId: string;
  label: string;
  type: string;
  status: 'executed' | 'skipped' | 'waiting' | 'failed';
  detail?: string;
}

export function TestWorkflowModal({ nodes, edges, onClose }: TestWorkflowModalProps) {
  const { user } = useAuth();
  const [step, setStep] = useState<'select-contact' | 'select-trigger' | 'running' | 'results'>('select-contact');
  const [contactSearch, setContactSearch] = useState('');
  type ContactResult = { id: string; first_name: string; last_name: string; email: string; phone: string; status: string };
  const [contacts, setContacts] = useState<ContactResult[]>([]);
  const [selectedContact, setSelectedContact] = useState<ContactResult | null>(null);
  const [selectedTriggerId, setSelectedTriggerId] = useState<string | null>(null);
  const [testSteps, setTestSteps] = useState<TestStep[]>([]);
  const [searching, setSearching] = useState(false);
  const [payloadJson, setPayloadJson] = useState('{}');
  const [payloadError, setPayloadError] = useState('');

  const triggers = nodes.filter(n => n.data.nodeType === 'trigger');

  const searchContacts = useCallback(async (q: string) => {
    if (!q || q.length < 2 || !user) return;
    setSearching(true);
    const { data } = await supabase
      .from('contacts')
      .select('id, first_name, last_name, email, phone, status')
      .eq('organization_id', user.organization_id)
      .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%`)
      .limit(10);
    setContacts(data ?? []);
    setSearching(false);
  }, [user]);

  const runTest = useCallback(() => {
    if (!selectedContact || !selectedTriggerId) return;

    let testPayload: Record<string, unknown> = {};
    try {
      testPayload = JSON.parse(payloadJson);
      setPayloadError('');
    } catch {
      setPayloadError('Invalid JSON');
      return;
    }

    setStep('running');
    const steps: TestStep[] = [];

    const triggerNode = nodes.find(n => n.id === selectedTriggerId);
    if (triggerNode) {
      const td = triggerNode.data.nodeData as TriggerNodeData;
      const opt = TRIGGER_OPTIONS.find(t => t.type === td.triggerType);
      const triggerMatched = matchesTrigger(td, testPayload);
      steps.push({
        nodeId: triggerNode.id,
        label: opt?.label ?? 'Trigger',
        type: 'trigger',
        status: triggerMatched ? 'executed' : 'skipped',
        detail: triggerMatched
          ? `Trigger "${opt?.label}" matched with test payload`
          : `Trigger "${opt?.label}" did NOT match - workflow would not fire`,
      });
      if (!triggerMatched) {
        setTestSteps(steps);
        setStep('results');
        return;
      }
    }

    let currentNodeId = selectedTriggerId;
    const visited = new Set<string>();
    let iterations = 0;
    const MAX = 100;

    while (currentNodeId && iterations < MAX) {
      iterations++;
      visited.add(currentNodeId);

      const outEdges = edges.filter((e: any) => e.source === currentNodeId);
      if (outEdges.length === 0) break;

      let nextEdge = outEdges[0];

      const currentNode = nodes.find(n => n.id === currentNodeId);
      if (currentNode?.data.nodeType === 'condition') {
        const cd = currentNode.data.nodeData as ConditionNodeData;
        const ruleCount = cd?.conditions?.rules?.length ?? 0;
        const branchTaken = ruleCount > 0 ? 'yes' : 'no';
        nextEdge = outEdges.find((e: any) => e.sourceHandle === branchTaken) ?? outEdges[0];

        steps.push({
          nodeId: currentNode.id,
          label: currentNode.data.label,
          type: 'condition',
          status: 'executed',
          detail: `Branch: ${branchTaken.toUpperCase()} (simulated)`,
        });
      }

      const nextNodeId = nextEdge?.target;
      if (!nextNodeId || visited.has(nextNodeId)) break;

      const nextNode = nodes.find(n => n.id === nextNodeId);
      if (!nextNode) break;

      if (nextNode.data.nodeType === 'delay') {
        const dd = nextNode.data.nodeData as DelayNodeData;
        steps.push({
          nodeId: nextNode.id,
          label: nextNode.data.label,
          type: 'delay',
          status: 'waiting',
          detail: dd.delayType === 'wait_duration'
            ? `Would wait ${dd.duration?.value ?? '?'} ${dd.duration?.unit ?? 'hours'}`
            : 'Would wait until condition met',
        });
      } else if (nextNode.data.nodeType === 'end') {
        steps.push({
          nodeId: nextNode.id,
          label: 'End Workflow',
          type: 'end',
          status: 'executed',
          detail: 'Workflow complete',
        });
      } else if (nextNode.data.nodeType === 'action') {
        const actionType = (nextNode.data.nodeData as any)?.actionType;
        const cfg = (nextNode.data.nodeData as any)?.config ?? {};
        const opt = ACTION_OPTIONS.find(a => a.type === actionType);
        const dangerPrefix = isDangerAction(actionType) ? '⚠️ DESTRUCTIVE — ' : '';
        steps.push({
          nodeId: nextNode.id,
          label: opt?.label ?? nextNode.data.label,
          type: 'action',
          status: nextNode.data.isValid ? 'executed' : 'failed',
          detail: nextNode.data.isValid
            ? dangerPrefix + getActionSimulationDetail(actionType, cfg)
            : 'Node has incomplete configuration',
        });
      } else if (nextNode.data.nodeType === 'goal') {
        steps.push({
          nodeId: nextNode.id,
          label: nextNode.data.label,
          type: 'goal',
          status: 'executed',
          detail: 'Goal checkpoint (simulated)',
        });
      }

      currentNodeId = nextNodeId;
    }

    setTestSteps(steps);
    setStep('results');
  }, [selectedContact, selectedTriggerId, nodes, edges, payloadJson]);

  function getActionSimulationDetail(actionType: string, cfg: Record<string, unknown>): string {
    switch (actionType) {
      case 'send_email': return `Would send email: "${cfg.subject ?? '(no subject)'}"`;
      case 'send_sms': return `Would send SMS: "${String(cfg.body ?? '').substring(0, 60)}"`;
      case 'add_tag': return `Would add tag "${cfg.tagName ?? cfg.tagId ?? '?'}"`;
      case 'remove_tag': return `Would remove tag "${cfg.tagName ?? cfg.tagId ?? '?'}"`;
      case 'webhook':
      case 'webhook_post': return `Would POST to ${cfg.url ?? '(no URL)'}`;
      case 'notify_user': return `Would notify user: "${String(cfg.message ?? '').substring(0, 60)}"`;
      case 'trigger_another_workflow': return `Would trigger workflow: ${cfg.workflowId ?? '?'}`;
      case 'create_contact': return `Would create contact: ${cfg.firstName ?? ''} ${cfg.lastName ?? ''} <${cfg.email ?? cfg.phone ?? '?'}>`;
      case 'find_contact': return `Would look up contact by ${cfg.lookupField ?? 'email'}: "${cfg.lookupValue ?? '?'}"`;
      case 'copy_contact': return `Would copy contact fields to a new record`;
      case 'delete_contact': return `Would ${cfg.mode === 'hard' ? 'permanently delete' : 'archive'} contact`;
      case 'modify_engagement_score': return `Would ${cfg.operation ?? 'increase'} engagement score by ${cfg.value ?? 0}`;
      case 'modify_followers': return `Would ${cfg.action ?? 'add'} followers (${cfg.followerType ?? 'specific_user'})`;
      case 'add_note': return `Would add note: "${String(cfg.content ?? '').substring(0, 60)}"`;
      case 'edit_conversation': return `Would ${cfg.operation ?? 'mark_read'} conversation`;
      case 'send_slack_message': return `Would send Slack message to ${cfg.channelType === 'webhook' ? 'webhook' : (cfg.channelId ?? 'channel')}`;
      case 'send_messenger': return `Would send ${cfg.channel ?? 'Facebook'} Messenger message`;
      case 'send_gmb_message': return `Would send Google Business Profile message`;
      case 'send_internal_notification': return `Would notify: "${cfg.title ?? '?'}"`;
      case 'conversation_ai_reply': return `Would ${cfg.mode === 'auto_reply' ? 'auto-reply' : 'draft reply'} using AI agent`;
      case 'facebook_interactive_messenger': return `Would send interactive Facebook message`;
      case 'instagram_interactive_messenger': return `Would send interactive Instagram message`;
      case 'reply_in_comments': return `Would reply to ${cfg.platform ?? 'social'} comment`;
      case 'send_live_chat_message': return `Would send live chat message`;
      case 'manual_action': return `Would pause workflow for manual task: "${String(cfg.instructionText ?? '').substring(0, 60)}"`;
      case 'split_test': {
        const variants = (cfg.variants as Array<{ label: string; percentage: number }>) ?? [];
        return `Would A/B split into ${variants.length} variants`;
      }
      case 'go_to': return `Would jump to ${cfg.destinationType === 'workflow' ? `workflow ${cfg.targetWorkflowId ?? '?'}` : `node ${cfg.targetNodeId ?? '?'}`}`;
      case 'remove_from_workflow_action': return `Would remove contact from ${cfg.target === 'current' ? 'current' : 'selected'} workflow(s)`;
      case 'drip_mode': return `Would schedule ${cfg.batchSize ?? 1}/batch every ${cfg.intervalValue ?? 1} ${cfg.intervalUnit ?? 'hours'}`;
      case 'update_custom_value': return `Would ${cfg.operation ?? 'set'} custom value "${cfg.customValueKey ?? '?'}" = "${cfg.value ?? '?'}"`;
      case 'array_operation': return `Would ${cfg.operation ?? 'create'} array → save to "${cfg.outputKey ?? '?'}"`;
      case 'text_formatter': return `Would ${cfg.operation ?? 'format'} text → save to "${cfg.outputKey ?? '?'}"`;
      case 'ai_prompt': return `Would run AI prompt → save ${cfg.outputMode ?? 'text'} to "${cfg.saveOutputKey ?? 'ai_output'}"`;
      case 'update_appointment_status': return `Would set appointment status to "${cfg.newStatus ?? '?'}"`;
      case 'generate_booking_link': return `Would generate booking link → save to "${cfg.saveToField ?? 'booking_link'}"`;
      case 'create_or_update_opportunity': return `Would ${cfg.mode ?? 'create'} opportunity "${cfg.titleTemplate ?? 'New Opportunity'}"`;
      case 'remove_opportunity': return `Would ${cfg.mode === 'delete' ? 'delete' : 'archive'} ${cfg.scope ?? 'current'} opportunity`;
      case 'send_documents_and_contracts': return `Would send document via ${cfg.deliveryChannel ?? 'email'}${cfg.requireSignature ? ', signature required' : ''}`;

      // P4 — dual-rail email
      case 'send_email_org': return cfg.template_id
        ? `Would send Mailgun email using template ${cfg.template_id}`
        : `Would send raw Mailgun email: "${(cfg.raw_subject as string) ?? '(no subject)'}"`;
      case 'send_email_personal': return cfg.template_id
        ? `Would send Gmail (personal) using template ${cfg.template_id}`
        : `Would send raw Gmail email: "${(cfg.raw_subject as string) ?? '(no subject)'}"`;

      // P6 — Vapi voice AI
      case 'start_ai_call': return `Would start AI voice call (Vapi) — assistant ${cfg.assistant_id ?? '?'}, max ${cfg.max_duration_seconds ?? 600}s`;
      case 'transfer_to_ai_agent': return `Would transfer to AI assistant ${cfg.target_assistant_id ?? '?'} (mode: ${cfg.transfer_mode ?? 'auto'})`;
      case 'send_ai_voicemail': return `Would drop AI voicemail (Vapi) — assistant ${cfg.assistant_id ?? '?'}`;

      default: return `Would execute action: ${actionType}`;
    }
  }

  // Destructive actions get a red-highlighted "DANGER" badge in the trace.
  function isDangerAction(actionType: string): boolean {
    return [
      'delete_contact',
      'mark_opportunity_lost',
      'remove_opportunity',
      'void_invoice',
      'set_dnd',
      'remove_from_workflow_action',
    ].includes(actionType);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-blue-500 flex items-center justify-center">
              <Play className="w-4 h-4 text-white" />
            </div>
            <h3 className="text-base font-semibold text-gray-900">Test Workflow</h3>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-md">
            <X className="w-4.5 h-4.5 text-gray-400" />
          </button>
        </div>

        <div className="px-3 py-2 border-b border-gray-100">
          <div className="flex items-center gap-1">
            {['select-contact', 'select-trigger', 'results'].map((s, i) => (
              <div key={s} className="flex items-center gap-1">
                {i > 0 && <ArrowRight className="w-3 h-3 text-gray-300" />}
                <div className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                  step === s || (s === 'running' && step === 'running')
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-400'
                }`}>
                  {i + 1}. {s === 'select-contact' ? 'Contact' : s === 'select-trigger' ? 'Trigger' : 'Results'}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {step === 'select-contact' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">Choose a contact to simulate the workflow against.</p>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={contactSearch}
                  onChange={e => {
                    setContactSearch(e.target.value);
                    searchContacts(e.target.value);
                  }}
                  placeholder="Search contacts by name or email..."
                  className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              {searching && <div className="text-xs text-gray-400">Searching...</div>}
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {contacts.map(c => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setSelectedContact(c);
                      setStep('select-trigger');
                    }}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left ${
                      selectedContact?.id === c.id
                        ? 'border-blue-300 bg-blue-50'
                        : 'border-gray-100 hover:bg-gray-50'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                      <User className="w-4 h-4 text-gray-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900">
                        {c.first_name} {c.last_name}
                      </div>
                      <div className="text-xs text-gray-500 truncate">{c.email}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 'select-trigger' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">Select which trigger to simulate firing.</p>
              <div className="space-y-2">
                {triggers.map(t => {
                  const td = t.data.nodeData as TriggerNodeData;
                  const opt = TRIGGER_OPTIONS.find(o => o.type === td.triggerType);
                  const isSelected = selectedTriggerId === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTriggerId(t.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left ${
                        isSelected
                          ? 'border-emerald-300 bg-emerald-50'
                          : 'border-gray-100 hover:bg-emerald-50 hover:border-emerald-200'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-md bg-emerald-500 flex items-center justify-center">
                        <Zap className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">{opt?.label ?? 'Trigger'}</div>
                        <div className="text-xs text-gray-500">{opt?.description}</div>
                      </div>
                    </button>
                  );
                })}
                {triggers.length === 0 && (
                  <div className="text-center py-8 text-gray-400">
                    <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
                    <p className="text-sm">No triggers configured</p>
                  </div>
                )}
              </div>

              {selectedTriggerId && (
                <div className="space-y-2 pt-2 border-t border-gray-100">
                  <div className="flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-gray-400" />
                    <label className="text-xs font-medium text-gray-700">Test Payload (JSON)</label>
                  </div>
                  <textarea
                    value={payloadJson}
                    onChange={e => {
                      setPayloadJson(e.target.value);
                      setPayloadError('');
                    }}
                    rows={5}
                    placeholder='{"changed_fields": ["email"], "source": "web"}'
                    className="w-full px-3 py-2 text-xs font-mono border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
                  />
                  {payloadError && (
                    <p className="text-xs text-red-500">{payloadError}</p>
                  )}
                  <p className="text-[11px] text-gray-400">
                    Provide sample event data to test trigger matching against your configuration.
                  </p>
                  <button
                    onClick={runTest}
                    className="w-full py-2.5 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
                  >
                    Run Simulation
                  </button>
                </div>
              )}
            </div>
          )}

          {step === 'running' && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-10 h-10 border-3 border-blue-200 border-t-blue-500 rounded-full animate-spin mb-4" />
              <p className="text-sm text-gray-600">Simulating workflow...</p>
            </div>
          )}

          {step === 'results' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-blue-500" />
                <span className="text-xs text-blue-700 font-medium">TEST MODE - No real actions were executed</span>
              </div>

              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <User className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-700">
                  {selectedContact?.first_name} {selectedContact?.last_name}
                </span>
                <span className="text-xs text-gray-400">{selectedContact?.email}</span>
              </div>

              <div className="space-y-0">
                {testSteps.map((ts, i) => (
                  <div key={i} className="flex items-start gap-3 py-3 border-b border-gray-50 last:border-0">
                    <div className="mt-0.5">
                      {ts.status === 'executed' && <CheckCircle2 className="w-4.5 h-4.5 text-emerald-500" />}
                      {ts.status === 'waiting' && <Clock className="w-4.5 h-4.5 text-blue-500" />}
                      {ts.status === 'failed' && <XCircle className="w-4.5 h-4.5 text-red-500" />}
                      {ts.status === 'skipped' && <XCircle className="w-4.5 h-4.5 text-gray-300" />}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900">{ts.label}</div>
                      {ts.detail && <div className="text-xs text-gray-500 mt-0.5">{ts.detail}</div>}
                    </div>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                      ts.status === 'executed' ? 'bg-emerald-100 text-emerald-700' :
                      ts.status === 'waiting' ? 'bg-blue-100 text-blue-700' :
                      ts.status === 'failed' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-500'
                    }`}>
                      {ts.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-3 border-t border-gray-100 flex justify-end gap-2">
          {step === 'results' && (
            <button
              onClick={() => {
                setStep('select-contact');
                setTestSteps([]);
                setSelectedContact(null);
                setSelectedTriggerId(null);
              }}
              className="px-4 py-2 text-sm text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              Run Again
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-white bg-gray-800 rounded-lg hover:bg-gray-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
