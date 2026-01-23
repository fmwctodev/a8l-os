import { useState, useEffect, useRef } from 'react';
import { X, ChevronDown, Plus, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  createSnippet,
  updateSnippet,
  getAvailableVariables,
  resolveSnippetVariables,
} from '../../services/snippets';
import { getDepartments } from '../../services/departments';
import { calculateSMSSegments } from '../../services/channels/twilio';
import type { Snippet, SnippetScope, MessageChannel, Department, CustomField } from '../../types';

interface SnippetEditorDrawerProps {
  snippet?: Snippet | null;
  onClose: () => void;
  onSave: (snippet: Snippet) => void;
}

export function SnippetEditorDrawer({ snippet, onClose, onSave }: SnippetEditorDrawerProps) {
  const { user, hasPermission } = useAuth();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [name, setName] = useState(snippet?.name || '');
  const [content, setContent] = useState(snippet?.content || '');
  const [channelSupport, setChannelSupport] = useState<MessageChannel[]>(
    snippet?.channel_support || ['sms', 'email']
  );
  const [scope, setScope] = useState<SnippetScope>(snippet?.scope || 'personal');
  const [departmentId, setDepartmentId] = useState<string | null>(snippet?.department_id || null);

  const [departments, setDepartments] = useState<Department[]>([]);
  const [variables, setVariables] = useState<{ contact: string[]; custom: CustomField[] }>({
    contact: [],
    custom: [],
  });
  const [showVariableMenu, setShowVariableMenu] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canManageTeam = hasPermission('snippets.manage');
  const canManageSystem = hasPermission('snippets.system.manage');

  useEffect(() => {
    async function loadData() {
      if (!user) return;
      try {
        const [depts, vars] = await Promise.all([
          getDepartments(user.organization_id),
          getAvailableVariables(user.organization_id),
        ]);
        setDepartments(depts);
        setVariables(vars);

        if (!departmentId && scope === 'team' && user.department_id) {
          setDepartmentId(user.department_id);
        }
      } catch (err) {
        console.error('Failed to load data:', err);
      }
    }
    loadData();
  }, [user]);

  const handleChannelToggle = (channel: MessageChannel) => {
    setChannelSupport((prev) => {
      if (prev.includes(channel)) {
        if (prev.length === 1) return prev;
        return prev.filter((c) => c !== channel);
      }
      return [...prev, channel];
    });
  };

  const insertVariable = (variable: string) => {
    if (!textareaRef.current) return;

    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const newContent = content.slice(0, start) + variable + content.slice(end);
    setContent(newContent);
    setShowVariableMenu(false);

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(start + variable.length, start + variable.length);
      }
    }, 0);
  };

  const handleSave = async () => {
    if (!user) return;

    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    if (!content.trim()) {
      setError('Content is required');
      return;
    }

    if (channelSupport.length === 0) {
      setError('At least one channel must be selected');
      return;
    }

    if (scope === 'team' && !departmentId) {
      setError('Department is required for team snippets');
      return;
    }

    setError(null);
    setSaving(true);

    try {
      let savedSnippet: Snippet;

      if (snippet) {
        savedSnippet = await updateSnippet(snippet.id, {
          name: name.trim(),
          content: content.trim(),
          channel_support: channelSupport,
          scope,
          department_id: scope === 'team' ? departmentId : null,
        });
      } else {
        savedSnippet = await createSnippet({
          organization_id: user.organization_id,
          created_by_user_id: user.id,
          name: name.trim(),
          content: content.trim(),
          channel_support: channelSupport,
          scope,
          department_id: scope === 'team' ? departmentId : null,
        });
      }

      onSave(savedSnippet);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save snippet');
    } finally {
      setSaving(false);
    }
  };

  const previewContent = resolveSnippetVariables(content, {
    contact: {
      id: '',
      organization_id: '',
      department_id: '',
      owner_id: null,
      first_name: 'John',
      last_name: 'Doe',
      email: 'john@example.com',
      phone: '+1234567890',
      company: 'Acme Inc',
      job_title: 'Manager',
      address_line1: null,
      address_line2: null,
      city: null,
      state: null,
      postal_code: null,
      country: null,
      source: null,
      status: 'active',
      merged_into_contact_id: null,
      merged_at: null,
      merged_by_user_id: null,
      created_at: '',
      updated_at: '',
      created_by_user_id: null,
    },
  });

  const smsInfo = channelSupport.includes('sms') ? calculateSMSSegments(previewContent) : null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative w-[500px] h-full bg-slate-800 shadow-xl flex flex-col animate-slide-in-right">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">
            {snippet ? 'Edit Snippet' : 'Create Snippet'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Greeting, Follow-up"
              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Channels</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleChannelToggle('sms')}
                className={`flex-1 px-4 py-2 rounded-lg border transition-colors ${
                  channelSupport.includes('sms')
                    ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400'
                    : 'bg-slate-900 border-slate-600 text-slate-400 hover:border-slate-500'
                }`}
              >
                SMS
              </button>
              <button
                type="button"
                onClick={() => handleChannelToggle('email')}
                className={`flex-1 px-4 py-2 rounded-lg border transition-colors ${
                  channelSupport.includes('email')
                    ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400'
                    : 'bg-slate-900 border-slate-600 text-slate-400 hover:border-slate-500'
                }`}
              >
                Email
              </button>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-slate-300">Content</label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowVariableMenu(!showVariableMenu)}
                  className="flex items-center gap-1 px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 rounded text-slate-300 transition-colors"
                >
                  <Plus size={12} />
                  Insert Variable
                  <ChevronDown size={12} />
                </button>

                {showVariableMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowVariableMenu(false)}
                    />
                    <div className="absolute right-0 top-full mt-1 w-56 bg-slate-800 border border-slate-600 rounded-lg shadow-lg z-20 max-h-64 overflow-y-auto">
                      <div className="p-2 text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Contact Fields
                      </div>
                      {variables.contact.map((field) => (
                        <button
                          key={field}
                          onClick={() => insertVariable(`{{contact.${field}}}`)}
                          className="w-full px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-700"
                        >
                          {`{{contact.${field}}}`}
                        </button>
                      ))}
                      {variables.custom.length > 0 && (
                        <>
                          <div className="p-2 text-xs font-medium text-slate-500 uppercase tracking-wider border-t border-slate-700 mt-1">
                            Custom Fields
                          </div>
                          {variables.custom.map((field) => (
                            <button
                              key={field.id}
                              onClick={() => insertVariable(`{{custom.${field.field_key}}}`)}
                              className="w-full px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-700"
                            >
                              {`{{custom.${field.field_key}}}`}
                              <span className="ml-2 text-slate-500">({field.name})</span>
                            </button>
                          ))}
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Type your message template..."
              rows={6}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            />
            {smsInfo && content.length > 0 && (
              <div className="mt-1 text-xs text-slate-500 text-right">
                {content.length} characters / {smsInfo.segments} SMS segment
                {smsInfo.segments !== 1 ? 's' : ''}
              </div>
            )}
          </div>

          {(canManageTeam || canManageSystem) && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Scope</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setScope('personal')}
                  className={`px-3 py-2 rounded-lg border text-sm transition-colors ${
                    scope === 'personal'
                      ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400'
                      : 'bg-slate-900 border-slate-600 text-slate-400 hover:border-slate-500'
                  }`}
                >
                  Personal
                </button>
                {canManageTeam && (
                  <button
                    type="button"
                    onClick={() => setScope('team')}
                    className={`px-3 py-2 rounded-lg border text-sm transition-colors ${
                      scope === 'team'
                        ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400'
                        : 'bg-slate-900 border-slate-600 text-slate-400 hover:border-slate-500'
                    }`}
                  >
                    Team
                  </button>
                )}
                {canManageSystem && (
                  <button
                    type="button"
                    onClick={() => setScope('system')}
                    className={`px-3 py-2 rounded-lg border text-sm transition-colors ${
                      scope === 'system'
                        ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400'
                        : 'bg-slate-900 border-slate-600 text-slate-400 hover:border-slate-500'
                    }`}
                  >
                    System
                  </button>
                )}
              </div>
              <p className="mt-1.5 text-xs text-slate-500">
                {scope === 'personal' && 'Only you can see and use this snippet'}
                {scope === 'team' && 'All team members in the selected department can use this'}
                {scope === 'system' && 'All users in your organization can use this snippet'}
              </p>
            </div>
          )}

          {scope === 'team' && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Department</label>
              <select
                value={departmentId || ''}
                onChange={(e) => setDepartmentId(e.target.value || null)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              >
                <option value="">Select department...</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Preview</label>
            <div className="p-3 bg-slate-900 border border-slate-600 rounded-lg">
              <p className="text-sm text-slate-300 whitespace-pre-wrap">{previewContent || 'Your message preview will appear here...'}</p>
            </div>
            <p className="mt-1.5 text-xs text-slate-500">
              Preview uses sample data: John Doe, john@example.com, Acme Inc
            </p>
          </div>
        </div>

        <div className="p-4 border-t border-slate-700 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-300 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-teal-600 text-white rounded-lg hover:from-cyan-600 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Saving...' : snippet ? 'Save Changes' : 'Create Snippet'}
          </button>
        </div>
      </div>
    </div>
  );
}
