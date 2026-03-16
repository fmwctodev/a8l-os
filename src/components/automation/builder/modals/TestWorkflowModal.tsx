import { useState, useCallback } from 'react';
import { X, Play, Search, User, CheckCircle2, XCircle, Clock, Zap, ArrowRight, AlertTriangle } from 'lucide-react';
import type { BuilderNode } from '../../../../types/workflowBuilder';
import type { TriggerNodeData, ConditionNodeData, DelayNodeData } from '../../../../types';
import { supabase } from '../../../../lib/supabase';
import { useAuth } from '../../../../contexts/AuthContext';
import { TRIGGER_OPTIONS, ACTION_OPTIONS } from '../../../../types/workflowBuilder';

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

    setStep('running');
    const steps: TestStep[] = [];

    const triggerNode = nodes.find(n => n.id === selectedTriggerId);
    if (triggerNode) {
      const td = triggerNode.data.nodeData as TriggerNodeData;
      const opt = TRIGGER_OPTIONS.find(t => t.type === td.triggerType);
      steps.push({
        nodeId: triggerNode.id,
        label: opt?.label ?? 'Trigger',
        type: 'trigger',
        status: 'executed',
        detail: `Trigger "${opt?.label}" matched`,
      });
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
        const opt = ACTION_OPTIONS.find(a => a.type === actionType);
        steps.push({
          nodeId: nextNode.id,
          label: opt?.label ?? nextNode.data.label,
          type: 'action',
          status: nextNode.data.isValid ? 'executed' : 'failed',
          detail: nextNode.data.isValid
            ? `Would execute "${opt?.label ?? 'action'}"`
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
  }, [selectedContact, selectedTriggerId, nodes, edges]);

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
                  return (
                    <button
                      key={t.id}
                      onClick={() => {
                        setSelectedTriggerId(t.id);
                        runTest();
                      }}
                      className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:bg-emerald-50 hover:border-emerald-200 transition-colors text-left"
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
