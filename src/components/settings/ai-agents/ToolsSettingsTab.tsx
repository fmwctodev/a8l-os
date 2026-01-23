import { useState, useEffect } from 'react';
import { Shield, Check, Info } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import * as defaultsService from '../../../services/aiAgentDefaults';
import type { AIAgentSettingsDefaults, AIAgentToolName } from '../../../types';
import { AI_TOOL_DEFINITIONS } from '../../../types';

const TOOL_CATEGORIES = {
  read: { label: 'Read Operations', description: 'Tools for reading CRM data' },
  write: { label: 'Write Operations', description: 'Tools for modifying contact data' },
  calendar: { label: 'Calendar Operations', description: 'Tools for scheduling appointments' },
  communication: { label: 'Communication', description: 'Tools for sending messages' },
};

export function ToolsSettingsTab() {
  const { user } = useAuth();
  const orgId = user?.organization_id;
  const isAdmin = user?.role?.name === 'SuperAdmin' || user?.role?.name === 'Admin';

  const [defaults, setDefaults] = useState<AIAgentSettingsDefaults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const [selectedTools, setSelectedTools] = useState<AIAgentToolName[]>([]);
  const [requireHumanApproval, setRequireHumanApproval] = useState(true);
  const [maxOutboundPerRun, setMaxOutboundPerRun] = useState(5);

  useEffect(() => {
    if (orgId) {
      loadDefaults();
    }
  }, [orgId]);

  const loadDefaults = async () => {
    if (!orgId) return;
    try {
      setLoading(true);
      const data = await defaultsService.getOrCreateDefaults(orgId);
      setDefaults(data);
      setSelectedTools(data.default_allowed_tools);
      setRequireHumanApproval(data.require_human_approval_default);
      setMaxOutboundPerRun(data.max_outbound_per_run_default);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load defaults');
    } finally {
      setLoading(false);
    }
  };

  const toggleTool = (tool: AIAgentToolName) => {
    setSelectedTools((prev) =>
      prev.includes(tool) ? prev.filter((t) => t !== tool) : [...prev, tool]
    );
  };

  const selectAllInCategory = (category: string) => {
    const categoryTools = AI_TOOL_DEFINITIONS.filter((t) => t.category === category).map(
      (t) => t.name
    );
    setSelectedTools((prev) => {
      const otherTools = prev.filter(
        (t) => !categoryTools.includes(t)
      );
      return [...otherTools, ...categoryTools];
    });
  };

  const deselectAllInCategory = (category: string) => {
    const categoryTools = AI_TOOL_DEFINITIONS.filter((t) => t.category === category).map(
      (t) => t.name
    );
    setSelectedTools((prev) => prev.filter((t) => !categoryTools.includes(t)));
  };

  const handleSave = async () => {
    if (!orgId || !isAdmin) return;
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      await defaultsService.updateDefaults(orgId, {
        default_allowed_tools: selectedTools,
        require_human_approval_default: requireHumanApproval,
        max_outbound_per_run_default: maxOutboundPerRun,
      });

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save defaults');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-red-400">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">
            Dismiss
          </button>
        </div>
      )}

      {success && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4 text-emerald-400 flex items-center gap-2">
          <Check className="w-5 h-5" />
          Settings saved successfully
        </div>
      )}

      <section>
        <h2 className="text-lg font-medium text-white mb-2">Tool Registry</h2>
        <p className="text-sm text-slate-400 mb-4">
          View all available tools that AI agents can use. These tools allow agents to read and
          modify CRM data.
        </p>

        <div className="space-y-6">
          {Object.entries(TOOL_CATEGORIES).map(([category, config]) => {
            const categoryTools = AI_TOOL_DEFINITIONS.filter((t) => t.category === category);
            const selectedCount = categoryTools.filter((t) =>
              selectedTools.includes(t.name)
            ).length;

            return (
              <div
                key={category}
                className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden"
              >
                <div className="flex items-center justify-between px-4 py-3 bg-slate-800/50 border-b border-slate-700">
                  <div>
                    <h3 className="font-medium text-white">{config.label}</h3>
                    <p className="text-xs text-slate-400">{config.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">
                      {selectedCount}/{categoryTools.length} selected
                    </span>
                    {isAdmin && (
                      <>
                        <button
                          onClick={() => selectAllInCategory(category)}
                          className="text-xs text-cyan-400 hover:text-cyan-300"
                        >
                          Select All
                        </button>
                        <span className="text-slate-600">|</span>
                        <button
                          onClick={() => deselectAllInCategory(category)}
                          className="text-xs text-slate-400 hover:text-white"
                        >
                          Deselect All
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="p-4 grid gap-3 md:grid-cols-2">
                  {categoryTools.map((tool) => (
                    <div
                      key={tool.name}
                      className={`p-3 rounded-lg border ${
                        selectedTools.includes(tool.name)
                          ? 'bg-cyan-500/10 border-cyan-500/30'
                          : 'bg-slate-800/50 border-slate-700'
                      }`}
                    >
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedTools.includes(tool.name)}
                          onChange={() => toggleTool(tool.name)}
                          disabled={!isAdmin}
                          className="mt-1 rounded border-slate-600 text-cyan-500 focus:ring-cyan-500 disabled:opacity-50"
                        />
                        <div>
                          <div className="font-medium text-white text-sm">{tool.displayName}</div>
                          <p className="text-xs text-slate-400 mt-0.5">{tool.description}</p>
                          {tool.parameters.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {tool.parameters.map((param) => (
                                <span
                                  key={param.name}
                                  className="inline-flex items-center px-1.5 py-0.5 bg-slate-700 text-slate-400 text-xs rounded"
                                  title={param.description}
                                >
                                  {param.name}
                                  {param.required && <span className="text-red-400 ml-0.5">*</span>}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-medium text-white mb-2">Organization Defaults</h2>
        <p className="text-sm text-slate-400 mb-4">
          Default settings applied to new AI agents. Individual agents can override these values.
        </p>

        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 space-y-6">
          <div>
            <h3 className="font-medium text-white mb-3">Default Allowed Tools</h3>
            <p className="text-sm text-slate-400 mb-4">
              The tools selected above will be enabled by default for new agents.
            </p>
            <div className="flex flex-wrap gap-2">
              {selectedTools.map((tool) => {
                const toolDef = AI_TOOL_DEFINITIONS.find((t) => t.name === tool);
                return (
                  <span
                    key={tool}
                    className="inline-flex items-center px-2 py-1 bg-cyan-500/10 text-cyan-400 text-xs rounded"
                  >
                    {toolDef?.displayName || tool}
                  </span>
                );
              })}
              {selectedTools.length === 0 && (
                <span className="text-slate-500 text-sm">No tools selected</span>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-700">
            <h3 className="font-medium text-white mb-4">Safety Defaults</h3>

            <div className="space-y-4">
              <label className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg cursor-pointer hover:bg-slate-700/50">
                <div>
                  <span className="text-slate-300">Require Human Approval</span>
                  <p className="text-xs text-slate-400">
                    New agents will require approval before sending messages
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={requireHumanApproval}
                  onChange={(e) => setRequireHumanApproval(e.target.checked)}
                  disabled={!isAdmin}
                  className="rounded border-slate-600 text-cyan-500 focus:ring-cyan-500 disabled:opacity-50"
                />
              </label>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Max Outbound Messages Per Run
                </label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={maxOutboundPerRun}
                  onChange={(e) => setMaxOutboundPerRun(parseInt(e.target.value) || 5)}
                  disabled={!isAdmin}
                  className="w-32 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Limits the number of messages an agent can send in a single run
                </p>
              </div>
            </div>
          </div>

          {isAdmin && (
            <div className="pt-4 border-t border-slate-700 flex justify-end">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Defaults'}
              </button>
            </div>
          )}

          {!isAdmin && (
            <div className="pt-4 border-t border-slate-700">
              <div className="flex items-center gap-2 text-slate-400 text-sm">
                <Info className="w-4 h-4" />
                Only administrators can modify organization defaults
              </div>
            </div>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-medium text-white mb-2">Model Fallback Logic</h2>
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-cyan-400 mt-0.5" />
            <div>
              <p className="text-sm text-slate-300">
                When an AI agent runs, it uses the following model selection priority:
              </p>
              <ol className="mt-2 text-sm text-slate-400 list-decimal list-inside space-y-1">
                <li>Agent-specific model (if configured)</li>
                <li>Organization default model</li>
                <li>First enabled model from any configured provider</li>
              </ol>
              <p className="mt-2 text-xs text-slate-500">
                If no models are available, the agent run will fail with an error.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
