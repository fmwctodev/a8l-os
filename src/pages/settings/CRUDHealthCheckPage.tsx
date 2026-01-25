import { useState } from 'react';
import {
  HeartPulse,
  Play,
  CheckCircle,
  XCircle,
  Clock,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Database,
  FileText,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  runFullHealthCheck,
  verifyContactsCRUD,
  verifyOpportunitiesCRUD,
  verifyMessagesCRUD,
  verifyAuditLogsCRUD,
  type HealthCheckReport,
  type EntityTestResult,
} from '../../services/crudHealthCheck';
import { supabase } from '../../lib/supabase';

type EntityType = 'contacts' | 'opportunities' | 'messages' | 'audit_logs' | 'all';

export function CRUDHealthCheckPage() {
  const { user } = useAuth();
  const [running, setRunning] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<EntityType>('all');
  const [report, setReport] = useState<HealthCheckReport | null>(null);
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());

  const toggleExpanded = (entity: string) => {
    const newExpanded = new Set(expandedResults);
    if (newExpanded.has(entity)) {
      newExpanded.delete(entity);
    } else {
      newExpanded.add(entity);
    }
    setExpandedResults(newExpanded);
  };

  const runTest = async () => {
    if (!user?.organization_id || !user?.id) return;

    setRunning(true);
    setReport(null);

    try {
      if (selectedEntity === 'all') {
        const fullReport = await runFullHealthCheck(user.organization_id, user.id);
        setReport(fullReport);
        setExpandedResults(new Set(fullReport.results.map((r) => r.entity)));
      } else {
        let result: EntityTestResult;

        switch (selectedEntity) {
          case 'contacts':
            result = await verifyContactsCRUD(user.organization_id, user.id);
            break;

          case 'opportunities': {
            const { data: contacts } = await supabase
              .from('contacts')
              .select('id')
              .eq('organization_id', user.organization_id)
              .limit(1);

            const { data: pipelines } = await supabase
              .from('pipelines')
              .select('id, stages:pipeline_stages(id)')
              .eq('org_id', user.organization_id)
              .limit(1);

            if (!contacts?.length || !pipelines?.length || !(pipelines[0] as any).stages?.length) {
              setReport({
                timestamp: new Date().toISOString(),
                overallPassed: false,
                totalTests: 1,
                passedTests: 0,
                failedTests: 1,
                results: [{
                  entity: 'opportunities',
                  passed: false,
                  duration: 0,
                  createPassed: false,
                  readPassed: false,
                  updatePassed: false,
                  deletePassed: false,
                  auditLogExists: false,
                  fieldValidations: [],
                  errors: ['No contacts or pipelines found. Create sample data first.'],
                }],
              });
              setRunning(false);
              return;
            }

            result = await verifyOpportunitiesCRUD(
              user.organization_id,
              user.id,
              contacts[0].id,
              pipelines[0].id,
              (pipelines[0] as any).stages[0].id
            );
            break;
          }

          case 'messages': {
            const { data: conversations } = await supabase
              .from('conversations')
              .select('id, contact_id')
              .eq('organization_id', user.organization_id)
              .limit(1);

            if (!conversations?.length) {
              setReport({
                timestamp: new Date().toISOString(),
                overallPassed: false,
                totalTests: 1,
                passedTests: 0,
                failedTests: 1,
                results: [{
                  entity: 'messages',
                  passed: false,
                  duration: 0,
                  createPassed: false,
                  readPassed: false,
                  updatePassed: false,
                  deletePassed: false,
                  auditLogExists: false,
                  fieldValidations: [],
                  errors: ['No conversations found. Create sample data first.'],
                }],
              });
              setRunning(false);
              return;
            }

            result = await verifyMessagesCRUD(
              user.organization_id,
              user.id,
              conversations[0].id,
              conversations[0].contact_id
            );
            break;
          }

          case 'audit_logs':
            result = await verifyAuditLogsCRUD(user.organization_id, user.id);
            break;

          default:
            throw new Error(`Unknown entity type: ${selectedEntity}`);
        }

        setReport({
          timestamp: new Date().toISOString(),
          overallPassed: result.passed,
          totalTests: 1,
          passedTests: result.passed ? 1 : 0,
          failedTests: result.passed ? 0 : 1,
          results: [result],
        });
        setExpandedResults(new Set([result.entity]));
      }
    } catch (error) {
      console.error('Health check failed:', error);
      setReport({
        timestamp: new Date().toISOString(),
        overallPassed: false,
        totalTests: 1,
        passedTests: 0,
        failedTests: 1,
        results: [{
          entity: selectedEntity,
          passed: false,
          duration: 0,
          createPassed: false,
          readPassed: false,
          updatePassed: false,
          deletePassed: false,
          auditLogExists: false,
          fieldValidations: [],
          errors: [error instanceof Error ? error.message : String(error)],
        }],
      });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-rose-500/10 to-orange-500/10 border border-rose-500/20">
            <HeartPulse className="w-6 h-6 text-rose-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">CRUD Health Check</h2>
            <p className="text-sm text-slate-400 mt-0.5">
              Verify data persistence and audit logging across entities
            </p>
          </div>
        </div>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Select Entity to Test
            </label>
            <select
              value={selectedEntity}
              onChange={(e) => setSelectedEntity(e.target.value as EntityType)}
              className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              disabled={running}
            >
              <option value="all">All Entities (Comprehensive)</option>
              <option value="contacts">Contacts</option>
              <option value="opportunities">Opportunities</option>
              <option value="messages">Messages</option>
              <option value="audit_logs">Audit Logs</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={runTest}
              disabled={running}
              className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-teal-500 text-white font-medium rounded-lg hover:from-cyan-600 hover:to-teal-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {running ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="w-5 h-5" />
                  Run Test
                </>
              )}
            </button>
          </div>
        </div>

        <div className="mt-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <div className="flex gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-200">
              <p className="font-medium">Test Data Notice</p>
              <p className="text-amber-200/70 mt-1">
                This test creates temporary records with the prefix "__crud_test_" which are
                automatically cleaned up after the test completes. No production data will be affected.
              </p>
            </div>
          </div>
        </div>
      </div>

      {report && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className={`p-4 rounded-xl border ${
              report.overallPassed
                ? 'bg-emerald-500/10 border-emerald-500/20'
                : 'bg-rose-500/10 border-rose-500/20'
            }`}>
              <div className="flex items-center gap-3">
                {report.overallPassed ? (
                  <CheckCircle className="w-8 h-8 text-emerald-400" />
                ) : (
                  <XCircle className="w-8 h-8 text-rose-400" />
                )}
                <div>
                  <p className="text-sm text-slate-400">Overall Status</p>
                  <p className={`text-lg font-semibold ${
                    report.overallPassed ? 'text-emerald-400' : 'text-rose-400'
                  }`}>
                    {report.overallPassed ? 'All Tests Passed' : 'Tests Failed'}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
              <div className="flex items-center gap-3">
                <Database className="w-8 h-8 text-cyan-400" />
                <div>
                  <p className="text-sm text-slate-400">Total Tests</p>
                  <p className="text-lg font-semibold text-white">{report.totalTests}</p>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-8 h-8 text-emerald-400" />
                <div>
                  <p className="text-sm text-slate-400">Passed</p>
                  <p className="text-lg font-semibold text-emerald-400">{report.passedTests}</p>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
              <div className="flex items-center gap-3">
                <XCircle className="w-8 h-8 text-rose-400" />
                <div>
                  <p className="text-sm text-slate-400">Failed</p>
                  <p className="text-lg font-semibold text-rose-400">{report.failedTests}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-700">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-white">Test Results</h3>
                <span className="text-sm text-slate-400">
                  {new Date(report.timestamp).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="divide-y divide-slate-700">
              {report.results.map((result) => (
                <div key={result.entity} className="bg-slate-900/30">
                  <button
                    onClick={() => toggleExpanded(result.entity)}
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      {expandedResults.has(result.entity) ? (
                        <ChevronDown className="w-5 h-5 text-slate-400" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-slate-400" />
                      )}
                      <div className="flex items-center gap-3">
                        {result.passed ? (
                          <CheckCircle className="w-5 h-5 text-emerald-400" />
                        ) : (
                          <XCircle className="w-5 h-5 text-rose-400" />
                        )}
                        <span className="font-medium text-white capitalize">
                          {result.entity.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-slate-400">
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {result.duration}ms
                      </span>
                    </div>
                  </button>

                  {expandedResults.has(result.entity) && (
                    <div className="px-6 pb-4 space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        <div className={`p-3 rounded-lg ${
                          result.createPassed ? 'bg-emerald-500/10' : 'bg-rose-500/10'
                        }`}>
                          <p className="text-xs text-slate-400 mb-1">Create</p>
                          <p className={`font-medium ${
                            result.createPassed ? 'text-emerald-400' : 'text-rose-400'
                          }`}>
                            {result.createPassed ? 'Passed' : 'Failed'}
                          </p>
                        </div>
                        <div className={`p-3 rounded-lg ${
                          result.readPassed ? 'bg-emerald-500/10' : 'bg-rose-500/10'
                        }`}>
                          <p className="text-xs text-slate-400 mb-1">Read</p>
                          <p className={`font-medium ${
                            result.readPassed ? 'text-emerald-400' : 'text-rose-400'
                          }`}>
                            {result.readPassed ? 'Passed' : 'Failed'}
                          </p>
                        </div>
                        <div className={`p-3 rounded-lg ${
                          result.updatePassed ? 'bg-emerald-500/10' : 'bg-rose-500/10'
                        }`}>
                          <p className="text-xs text-slate-400 mb-1">Update</p>
                          <p className={`font-medium ${
                            result.updatePassed ? 'text-emerald-400' : 'text-rose-400'
                          }`}>
                            {result.updatePassed ? 'Passed' : 'Failed'}
                          </p>
                        </div>
                        <div className={`p-3 rounded-lg ${
                          result.deletePassed ? 'bg-emerald-500/10' : 'bg-rose-500/10'
                        }`}>
                          <p className="text-xs text-slate-400 mb-1">Delete/Hide</p>
                          <p className={`font-medium ${
                            result.deletePassed ? 'text-emerald-400' : 'text-rose-400'
                          }`}>
                            {result.deletePassed ? 'Passed' : 'Failed'}
                          </p>
                        </div>
                        <div className={`p-3 rounded-lg ${
                          result.auditLogExists ? 'bg-emerald-500/10' : 'bg-amber-500/10'
                        }`}>
                          <p className="text-xs text-slate-400 mb-1">Audit Log</p>
                          <p className={`font-medium ${
                            result.auditLogExists ? 'text-emerald-400' : 'text-amber-400'
                          }`}>
                            {result.auditLogExists ? 'Exists' : 'Not Found'}
                          </p>
                        </div>
                      </div>

                      {result.fieldValidations.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
                            <FileText className="w-4 h-4" />
                            Field Validations
                          </h4>
                          <div className="bg-slate-900 rounded-lg p-3 space-y-2">
                            {result.fieldValidations.map((fv, idx) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between text-sm"
                              >
                                <span className="text-slate-400">{fv.field}</span>
                                <span className={fv.passed ? 'text-emerald-400' : 'text-rose-400'}>
                                  {fv.passed ? 'OK' : fv.message || 'Mismatch'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {result.errors.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-rose-400 mb-2">Errors</h4>
                          <div className="bg-rose-500/10 border border-rose-500/20 rounded-lg p-3 space-y-1">
                            {result.errors.map((err, idx) => (
                              <p key={idx} className="text-sm text-rose-300">{err}</p>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
