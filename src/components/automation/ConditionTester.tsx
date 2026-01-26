import { useState } from 'react';
import { Play, CheckCircle, XCircle, AlertTriangle, Clock, ChevronDown, ChevronRight } from 'lucide-react';
import type { ConditionGroup, ConditionEvaluationContext, ConditionEvaluationResult, EvaluatedCondition } from '../../types/conditions';
import { evaluateConditions } from '../../services/conditionEngine';
import { validateConditions } from '../../lib/conditionValidator';

interface ConditionTesterProps { conditions: ConditionGroup; entityType?: string; onClose?: () => void; }

const SAMPLE_DATA: Record<string, Record<string, unknown>> = {
  contact: { id: 'sample-contact-123', first_name: 'John', last_name: 'Doe', full_name: 'John Doe', email: 'john.doe@example.com', phone: '+1 555-123-4567', company: 'Acme Corp', job_title: 'Marketing Manager', source: 'Website', status: 'active', lead_score: 75, lifetime_value: 5000, created_at: new Date(Date.now() - 30 * 86400000).toISOString(), tags: ['customer', 'newsletter', 'premium'], city: 'San Francisco', state: 'CA', country: 'USA' },
  opportunity: { id: 'sample-opp-456', name: 'Enterprise Deal', status: 'open', value_amount: 25000, probability: 60, expected_close_date: new Date(Date.now() + 14 * 86400000).toISOString(), days_in_stage: 5 },
  appointment: { id: 'sample-appt-789', title: 'Discovery Call', status: 'scheduled', start_at_utc: new Date(Date.now() + 2 * 86400000).toISOString(), duration_minutes: 60 },
  invoice: { id: 'sample-inv-101', invoice_number: 'INV-2024-001', status: 'sent', total: 2160, balance_due: 2160, due_date: new Date(Date.now() + 30 * 86400000).toISOString() },
};

export function ConditionTester({ conditions, entityType = 'contact', onClose }: ConditionTesterProps) {
  const [testData, setTestData] = useState<string>(JSON.stringify(SAMPLE_DATA[entityType] || SAMPLE_DATA.contact, null, 2));
  const [result, setResult] = useState<ConditionEvaluationResult | null>(null);
  const [validationResult, setValidationResult] = useState<ReturnType<typeof validateConditions> | null>(null);
  const [running, setRunning] = useState(false);
  const [expandedConditions, setExpandedConditions] = useState<Set<string>>(new Set());

  const handleTest = async () => {
    setRunning(true); setResult(null);
    const validation = validateConditions(conditions);
    setValidationResult(validation);
    if (!validation.valid) { setRunning(false); return; }
    try {
      const parsedData = JSON.parse(testData);
      const context: ConditionEvaluationContext = { entityType: entityType as 'contact', entityId: parsedData.id || 'test-entity', entityData: parsedData, tags: parsedData.tags || [], timestamp: new Date().toISOString() };
      const evalResult = evaluateConditions(conditions, context);
      setResult(evalResult);
    } catch (err) { setResult({ success: false, result: false, evaluatedConditions: [], duration_ms: 0, errors: [err instanceof Error ? err.message : 'Invalid JSON data'] }); }
    finally { setRunning(false); }
  };

  const toggleCondition = (conditionId: string) => { setExpandedConditions(prev => { const next = new Set(prev); if (next.has(conditionId)) next.delete(conditionId); else next.add(conditionId); return next; }); };
  const loadSampleData = (type: string) => { setTestData(JSON.stringify(SAMPLE_DATA[type] || SAMPLE_DATA.contact, null, 2)); };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Test Conditions</h3>
        {onClose && <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">&times;</button>}
      </div>
      <div className="p-4 space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Test Data (JSON)</label>
            <div className="flex gap-1">{Object.keys(SAMPLE_DATA).map(type => (<button key={type} onClick={() => loadSampleData(type)} className="px-2 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">{type}</button>))}</div>
          </div>
          <textarea value={testData} onChange={e => setTestData(e.target.value)} rows={10} className="w-full px-3 py-2 text-sm font-mono border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
        </div>
        <button onClick={handleTest} disabled={running} className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
          {running ? (<><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Running...</>) : (<><Play className="w-4 h-4" />Test Conditions</>)}
        </button>
        {validationResult && !validationResult.valid && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-medium mb-2"><AlertTriangle className="w-4 h-4" />Validation Errors</div>
            <ul className="space-y-1">{validationResult.errors.map((err, idx) => (<li key={idx} className="text-sm text-red-600 dark:text-red-400">{err.field && <span className="font-medium">{err.field}:</span>} {err.message}</li>))}</ul>
          </div>
        )}
        {result && (
          <div className="space-y-3">
            <div className={`p-4 rounded-lg ${result.result ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">{result.result ? <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" /> : <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />}<span className={`font-semibold ${result.result ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>{result.result ? 'Conditions Passed' : 'Conditions Failed'}</span></div>
                <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400"><Clock className="w-4 h-4" />{result.duration_ms.toFixed(2)}ms</div>
              </div>
            </div>
            {result.evaluatedConditions.length > 0 && (
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <div className="p-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700"><h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Evaluation Details</h4></div>
                <div className="divide-y divide-gray-200 dark:divide-gray-700">{result.evaluatedConditions.map((evalCond, idx) => (<EvaluatedConditionRow key={idx} condition={evalCond} isExpanded={expandedConditions.has(evalCond.conditionId)} onToggle={() => toggleCondition(evalCond.conditionId)} />))}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function EvaluatedConditionRow({ condition, isExpanded, onToggle }: { condition: EvaluatedCondition; isExpanded: boolean; onToggle: () => void }) {
  return (
    <div className="bg-white dark:bg-gray-800">
      <button onClick={onToggle} className="w-full p-3 flex items-center gap-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
        {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
        {condition.result ? <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" /> : <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />}
        <div className="flex-1 min-w-0"><span className="text-sm font-medium text-gray-900 dark:text-white">{condition.field}</span><span className="text-sm text-gray-500 dark:text-gray-400 ml-2">{condition.operator}</span></div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded ${condition.result ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>{condition.result ? 'PASS' : 'FAIL'}</span>
      </button>
      {isExpanded && (
        <div className="px-3 pb-3 pl-10 space-y-2">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-gray-500 dark:text-gray-400">Expected:</span><pre className="mt-1 p-2 bg-gray-100 dark:bg-gray-900 rounded text-xs font-mono overflow-auto">{JSON.stringify(condition.expectedValue, null, 2)}</pre></div>
            <div><span className="text-gray-500 dark:text-gray-400">Actual:</span><pre className="mt-1 p-2 bg-gray-100 dark:bg-gray-900 rounded text-xs font-mono overflow-auto">{JSON.stringify(condition.actualValue, null, 2)}</pre></div>
          </div>
          {condition.error && <div className="text-sm text-red-600 dark:text-red-400">Error: {condition.error}</div>}
        </div>
      )}
    </div>
  );
}
