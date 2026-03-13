import { useState, useEffect } from 'react';
import {
  Plus, Wrench, ToggleLeft, ToggleRight, Edit, Trash2,
  Shield, Building2, ChevronDown, ChevronUp, X,
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import {
  listTools, createTool, updateTool, toggleTool, deleteTool,
} from '../../../services/vapiTools';
import type { VapiTool, CreateToolInput } from '../../../services/vapiTools';

const emptyForm: CreateToolInput = {
  tool_name: '',
  description: '',
  input_schema: { type: 'object', properties: {}, required: [] },
  endpoint_path: '/custom-handler',
  allowed_assistant_scopes: ['*'],
};

export function VapiToolsPage() {
  const { user, hasPermission } = useAuth();
  const [tools, setTools] = useState<VapiTool[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingTool, setEditingTool] = useState<VapiTool | null>(null);
  const [form, setForm] = useState<CreateToolInput>(emptyForm);
  const [schemaText, setSchemaText] = useState('{\n  "type": "object",\n  "properties": {},\n  "required": []\n}');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const canCreate = hasPermission('ai_agents.voice.create');
  const canEdit = hasPermission('ai_agents.voice.edit');

  const loadTools = async () => {
    if (!user?.organization_id) return;
    setLoading(true);
    try {
      const data = await listTools(user.organization_id);
      setTools(data);
    } catch (e) {
      console.error('Failed to load tools:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTools();
  }, [user?.organization_id]);

  const openCreate = () => {
    setEditingTool(null);
    setForm(emptyForm);
    setSchemaText('{\n  "type": "object",\n  "properties": {},\n  "required": []\n}');
    setShowEditor(true);
  };

  const openEdit = (tool: VapiTool) => {
    setEditingTool(tool);
    setForm({
      tool_name: tool.tool_name,
      description: tool.description,
      input_schema: tool.input_schema,
      endpoint_path: tool.endpoint_path,
      allowed_assistant_scopes: tool.allowed_assistant_scopes,
    });
    setSchemaText(JSON.stringify(tool.input_schema, null, 2));
    setShowEditor(true);
  };

  const handleSave = async () => {
    if (!user?.organization_id) return;
    setSaving(true);
    try {
      let schema = form.input_schema;
      try {
        schema = JSON.parse(schemaText);
      } catch {
        alert('Invalid JSON in input schema');
        setSaving(false);
        return;
      }

      const payload = { ...form, input_schema: schema };

      if (editingTool) {
        await updateTool(editingTool.id, payload);
      } else {
        await createTool(user.organization_id, payload);
      }

      setShowEditor(false);
      loadTools();
    } catch (e) {
      console.error('Failed to save tool:', e);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (tool: VapiTool) => {
    try {
      await toggleTool(tool.id, !tool.active);
      loadTools();
    } catch (e) {
      console.error('Failed to toggle tool:', e);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this custom tool?')) return;
    try {
      await deleteTool(id);
      loadTools();
    } catch (e) {
      console.error('Failed to delete tool:', e);
    }
  };

  const systemTools = tools.filter(t => t.is_system);
  const orgTools = tools.filter(t => !t.is_system);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-white">Tool Registry</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Manage tools that assistants can invoke during calls and sessions
          </p>
        </div>
        {canCreate && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-700 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Tool
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-slate-800 border border-slate-700 rounded-lg p-4 animate-pulse">
              <div className="h-4 w-40 bg-slate-700 rounded mb-2" />
              <div className="h-3 w-64 bg-slate-700 rounded" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {systemTools.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-4 h-4 text-slate-400" />
                <h3 className="text-sm font-medium text-slate-300">System Tools</h3>
                <span className="text-xs text-slate-500">({systemTools.length})</span>
              </div>
              <div className="space-y-2">
                {systemTools.map(tool => (
                  <div
                    key={tool.id}
                    className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden"
                  >
                    <div
                      className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-700/30 transition-colors"
                      onClick={() => setExpanded(expanded === tool.id ? null : tool.id)}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-1.5 bg-slate-700 rounded">
                          <Wrench className="w-3.5 h-3.5 text-slate-400" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-white">{tool.tool_name}</span>
                            <span className="text-xs text-slate-500 bg-slate-700 px-1.5 py-0.5 rounded">system</span>
                          </div>
                          <p className="text-xs text-slate-500 truncate">{tool.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {canEdit && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleToggle(tool); }}
                            className="text-slate-400 hover:text-white transition-colors"
                          >
                            {tool.active ? (
                              <ToggleRight className="w-5 h-5 text-emerald-400" />
                            ) : (
                              <ToggleLeft className="w-5 h-5" />
                            )}
                          </button>
                        )}
                        {expanded === tool.id ? (
                          <ChevronUp className="w-4 h-4 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                    </div>
                    {expanded === tool.id && (
                      <div className="px-4 pb-4 border-t border-slate-700/50">
                        <div className="mt-3 grid grid-cols-2 gap-4 text-xs">
                          <div>
                            <span className="text-slate-500">Endpoint:</span>
                            <span className="ml-2 text-slate-300 font-mono">{tool.endpoint_path}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Scopes:</span>
                            <span className="ml-2 text-slate-300">{tool.allowed_assistant_scopes.join(', ')}</span>
                          </div>
                        </div>
                        <div className="mt-3">
                          <span className="text-xs text-slate-500">Input Schema:</span>
                          <pre className="mt-1 p-3 bg-slate-900 rounded-lg text-xs text-slate-400 font-mono overflow-x-auto">
                            {JSON.stringify(tool.input_schema, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center gap-2 mb-3">
              <Building2 className="w-4 h-4 text-slate-400" />
              <h3 className="text-sm font-medium text-slate-300">Custom Tools</h3>
              <span className="text-xs text-slate-500">({orgTools.length})</span>
            </div>
            {orgTools.length === 0 ? (
              <div className="text-center py-10 bg-slate-800/50 border border-slate-700 rounded-xl">
                <Wrench className="w-8 h-8 text-slate-500 mx-auto mb-3" />
                <p className="text-sm text-slate-400">No custom tools created yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {orgTools.map(tool => (
                  <div
                    key={tool.id}
                    className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden"
                  >
                    <div
                      className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-700/30 transition-colors"
                      onClick={() => setExpanded(expanded === tool.id ? null : tool.id)}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-1.5 bg-cyan-500/10 rounded">
                          <Wrench className="w-3.5 h-3.5 text-cyan-400" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-sm font-medium text-white">{tool.tool_name}</span>
                          <p className="text-xs text-slate-500 truncate">{tool.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {canEdit && (
                          <>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleToggle(tool); }}
                              className="text-slate-400 hover:text-white transition-colors"
                            >
                              {tool.active ? (
                                <ToggleRight className="w-5 h-5 text-emerald-400" />
                              ) : (
                                <ToggleLeft className="w-5 h-5" />
                              )}
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); openEdit(tool); }}
                              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDelete(tool.id); }}
                              className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                        {expanded === tool.id ? (
                          <ChevronUp className="w-4 h-4 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                    </div>
                    {expanded === tool.id && (
                      <div className="px-4 pb-4 border-t border-slate-700/50">
                        <div className="mt-3 grid grid-cols-2 gap-4 text-xs">
                          <div>
                            <span className="text-slate-500">Endpoint:</span>
                            <span className="ml-2 text-slate-300 font-mono">{tool.endpoint_path}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Scopes:</span>
                            <span className="ml-2 text-slate-300">{tool.allowed_assistant_scopes.join(', ')}</span>
                          </div>
                        </div>
                        <div className="mt-3">
                          <span className="text-xs text-slate-500">Input Schema:</span>
                          <pre className="mt-1 p-3 bg-slate-900 rounded-lg text-xs text-slate-400 font-mono overflow-x-auto">
                            {JSON.stringify(tool.input_schema, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {showEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-2xl mx-4 shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-slate-700">
              <h3 className="text-base font-semibold text-white">
                {editingTool ? 'Edit Tool' : 'Create Custom Tool'}
              </h3>
              <button onClick={() => setShowEditor(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[65vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Tool Name</label>
                <input
                  value={form.tool_name}
                  onChange={(e) => setForm({ ...form, tool_name: e.target.value.replace(/[^a-zA-Z0-9_-]/g, '') })}
                  className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 font-mono"
                  placeholder="my_custom_tool"
                />
                <p className="text-xs text-slate-500 mt-1">Lowercase letters, numbers, hyphens, and underscores only</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 resize-none"
                  placeholder="Describe what this tool does..."
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Endpoint Path</label>
                <input
                  value={form.endpoint_path}
                  onChange={(e) => setForm({ ...form, endpoint_path: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 font-mono"
                  placeholder="/my-handler"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Input Schema (JSON)</label>
                <textarea
                  value={schemaText}
                  onChange={(e) => setSchemaText(e.target.value)}
                  rows={8}
                  className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 resize-none font-mono"
                  spellCheck={false}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 p-5 border-t border-slate-700">
              <button
                onClick={() => setShowEditor(false)}
                className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!form.tool_name || !form.description || saving}
                className="px-4 py-2 text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : editingTool ? 'Update Tool' : 'Create Tool'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
