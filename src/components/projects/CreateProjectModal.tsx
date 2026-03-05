import { useState, useEffect } from 'react';
import { X, FolderKanban, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import type { ProjectPipeline, ProjectStage, Contact, User } from '../../types';
import { getProjectPipelines } from '../../services/projectPipelines';
import { createProject } from '../../services/projects';
import { getContacts } from '../../services/contacts';
import { getUsers } from '../../services/users';

interface Props {
  onClose: () => void;
  onCreated: (projectId: string) => void;
  defaultContactId?: string;
  defaultOpportunityId?: string;
}

export function CreateProjectModal({ onClose, onCreated, defaultContactId, defaultOpportunityId }: Props) {
  const { user } = useAuth();
  const [pipelines, setPipelines] = useState<ProjectPipeline[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contactSearch, setContactSearch] = useState('');

  const [form, setForm] = useState({
    name: '',
    contact_id: defaultContactId || '',
    pipeline_id: '',
    stage_id: '',
    assigned_user_id: '',
    priority: 'medium',
    start_date: new Date().toISOString().split('T')[0],
    target_end_date: '',
    budget_amount: '',
    description: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    if (!user) return;
    try {
      const [pipelineData, contactData, userData] = await Promise.all([
        getProjectPipelines(user.organization_id),
        getContacts(user.organization_id),
        getUsers(),
      ]);
      setPipelines(pipelineData);
      setContacts(contactData);
      setUsers(userData);

      if (pipelineData.length > 0) {
        const first = pipelineData[0];
        const firstStage = first.stages?.[0];
        setForm((prev) => ({
          ...prev,
          pipeline_id: first.id,
          stage_id: firstStage?.id || '',
          assigned_user_id: user.id,
        }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const selectedPipeline = pipelines.find((p) => p.id === form.pipeline_id);
  const stages: ProjectStage[] = selectedPipeline?.stages || [];

  const filteredContacts = contactSearch
    ? contacts.filter(
        (c) =>
          c.name?.toLowerCase().includes(contactSearch.toLowerCase()) ||
          c.email?.toLowerCase().includes(contactSearch.toLowerCase())
      )
    : contacts;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !form.contact_id || !form.pipeline_id || !form.stage_id || !form.name.trim()) {
      setError('Please fill in all required fields.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const project = await createProject(
        {
          org_id: user.organization_id,
          contact_id: form.contact_id,
          opportunity_id: defaultOpportunityId ?? null,
          pipeline_id: form.pipeline_id,
          stage_id: form.stage_id,
          assigned_user_id: form.assigned_user_id || null,
          name: form.name.trim(),
          description: form.description || null,
          priority: form.priority,
          start_date: form.start_date || null,
          target_end_date: form.target_end_date || null,
          budget_amount: form.budget_amount ? Number(form.budget_amount) : 0,
          created_by: user.id,
        },
        user.id
      );
      onCreated(project.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-slate-700">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
              <FolderKanban className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Create Project</h2>
              <p className="text-sm text-slate-400">Start a new project</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Project Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              placeholder="e.g. Website Redesign"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Contact *</label>
            {!defaultContactId && (
              <input
                type="text"
                value={contactSearch}
                onChange={(e) => setContactSearch(e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 mb-2"
                placeholder="Search contacts..."
              />
            )}
            <select
              value={form.contact_id}
              onChange={(e) => setForm({ ...form, contact_id: e.target.value })}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              disabled={!!defaultContactId}
            >
              <option value="">Select contact</option>
              {filteredContacts.map((c) => (
                <option key={c.id} value={c.id}>{c.name} {c.email ? `(${c.email})` : ''}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Pipeline *</label>
              <select
                value={form.pipeline_id}
                onChange={(e) => {
                  const pid = e.target.value;
                  const p = pipelines.find((pp) => pp.id === pid);
                  setForm({
                    ...form,
                    pipeline_id: pid,
                    stage_id: p?.stages?.[0]?.id || '',
                  });
                }}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="">Select pipeline</option>
                {pipelines.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Initial Stage *</label>
              <select
                value={form.stage_id}
                onChange={(e) => setForm({ ...form, stage_id: e.target.value })}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="">Select stage</option>
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Owner</label>
              <select
                value={form.assigned_user_id}
                onChange={(e) => setForm({ ...form, assigned_user_id: e.target.value })}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="">Unassigned</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Priority</label>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Start Date</label>
              <input
                type="date"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Target End Date</label>
              <input
                type="date"
                value={form.target_end_date}
                onChange={(e) => setForm({ ...form, target_end_date: e.target.value })}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Budget</label>
              <input
                type="number"
                value={form.budget_amount}
                onChange={(e) => setForm({ ...form, budget_amount: e.target.value })}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                placeholder="0.00"
                min={0}
                step="0.01"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
              placeholder="Brief project description..."
            />
          </div>
        </form>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-700">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit as () => void}
            disabled={saving || loading || !form.name.trim() || !form.contact_id || !form.pipeline_id || !form.stage_id}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 text-sm disabled:opacity-50"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Create Project
          </button>
        </div>
      </div>
    </div>
  );
}
