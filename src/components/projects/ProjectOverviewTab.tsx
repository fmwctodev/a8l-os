import { useState } from 'react';
import { Calendar, Flag, Shield, Target, TrendingUp, DollarSign, Edit2, Check, X } from 'lucide-react';
import type { Project, User } from '../../types';
import { updateProject } from '../../services/projects';

interface Props {
  project: Project;
  users: User[];
  canEdit: boolean;
  currentUserId: string;
  onUpdate: (updated: Project) => void;
}

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-cyan-500/20 text-cyan-400',
  on_hold: 'bg-amber-500/20 text-amber-400',
  completed: 'bg-emerald-500/20 text-emerald-400',
  cancelled: 'bg-red-500/20 text-red-400',
};

const RISK_STYLES: Record<string, string> = {
  low: 'bg-emerald-500/20 text-emerald-400',
  medium: 'bg-amber-500/20 text-amber-400',
  high: 'bg-orange-500/20 text-orange-400',
  critical: 'bg-red-500/20 text-red-400',
};

const PRIORITY_STYLES: Record<string, string> = {
  low: 'bg-slate-500/20 text-slate-400',
  medium: 'bg-blue-500/20 text-blue-400',
  high: 'bg-amber-500/20 text-amber-400',
  urgent: 'bg-red-500/20 text-red-400',
};

export function ProjectOverviewTab({ project, users, canEdit, currentUserId, onUpdate }: Props) {
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  async function saveField(field: string, value: unknown) {
    try {
      const updated = await updateProject(project.id, { [field]: value } as Partial<Project>, currentUserId);
      onUpdate(updated);
    } catch (err) {
      console.error(err);
    }
    setEditingField(null);
  }

  function startEdit(field: string, currentValue: string) {
    setEditingField(field);
    setEditValue(currentValue);
  }

  const today = new Date().toISOString().split('T')[0];
  const isOverdue = project.status === 'active' && project.target_end_date && project.target_end_date < today;
  const daysRemaining = project.target_end_date
    ? Math.ceil((new Date(project.target_end_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
      <div className="space-y-6">
        <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50 space-y-4">
          <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
            <Target className="w-4 h-4" /> Details
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Status</label>
              {canEdit ? (
                <select
                  value={project.status}
                  onChange={(e) => saveField('status', e.target.value)}
                  className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm text-white w-full"
                >
                  <option value="active">Active</option>
                  <option value="on_hold">On Hold</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              ) : (
                <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${STATUS_STYLES[project.status]}`}>
                  {project.status.replace('_', ' ')}
                </span>
              )}
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Priority</label>
              {canEdit ? (
                <select
                  value={project.priority}
                  onChange={(e) => saveField('priority', e.target.value)}
                  className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm text-white w-full"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              ) : (
                <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${PRIORITY_STYLES[project.priority]}`}>
                  {project.priority}
                </span>
              )}
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Risk Level</label>
              {canEdit ? (
                <select
                  value={project.risk_level}
                  onChange={(e) => saveField('risk_level', e.target.value)}
                  className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm text-white w-full"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              ) : (
                <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${RISK_STYLES[project.risk_level]}`}>
                  {project.risk_level}
                </span>
              )}
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Owner</label>
              {canEdit ? (
                <select
                  value={project.assigned_user_id || ''}
                  onChange={(e) => saveField('assigned_user_id', e.target.value || null)}
                  className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm text-white w-full"
                >
                  <option value="">Unassigned</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              ) : (
                <span className="text-sm text-white">{project.assigned_user?.name || 'Unassigned'}</span>
              )}
            </div>
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50 space-y-4">
          <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" /> Progress
          </h3>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-400">Overall Progress</span>
              <span className="text-sm font-semibold text-white">{project.progress_percent}%</span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-3 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400 rounded-full transition-all duration-500"
                style={{ width: `${project.progress_percent}%` }}
              />
            </div>
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50 space-y-4">
          <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
            <Flag className="w-4 h-4" /> Description
          </h3>
          {editingField === 'description' ? (
            <div className="space-y-2">
              <textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                rows={4}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white resize-none"
              />
              <div className="flex gap-2">
                <button onClick={() => saveField('description', editValue)} className="p-1 text-emerald-400 hover:bg-slate-700 rounded"><Check className="w-4 h-4" /></button>
                <button onClick={() => setEditingField(null)} className="p-1 text-slate-400 hover:bg-slate-700 rounded"><X className="w-4 h-4" /></button>
              </div>
            </div>
          ) : (
            <div className="group relative">
              <p className="text-sm text-slate-300 whitespace-pre-wrap">
                {project.description || 'No description provided.'}
              </p>
              {canEdit && (
                <button
                  onClick={() => startEdit('description', project.description || '')}
                  className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-white"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50 space-y-4">
          <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
            <Calendar className="w-4 h-4" /> Key Dates
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-500 block mb-1">Start Date</label>
              {canEdit ? (
                <input
                  type="date"
                  value={project.start_date || ''}
                  onChange={(e) => saveField('start_date', e.target.value || null)}
                  className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm text-white w-full"
                />
              ) : (
                <span className="text-sm text-white">{project.start_date ? new Date(project.start_date).toLocaleDateString() : '-'}</span>
              )}
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Target End Date</label>
              {canEdit ? (
                <input
                  type="date"
                  value={project.target_end_date || ''}
                  onChange={(e) => saveField('target_end_date', e.target.value || null)}
                  className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm text-white w-full"
                />
              ) : (
                <span className="text-sm text-white">{project.target_end_date ? new Date(project.target_end_date).toLocaleDateString() : '-'}</span>
              )}
            </div>
          </div>
          {daysRemaining !== null && (
            <div className={`text-sm font-medium ${isOverdue ? 'text-red-400' : 'text-emerald-400'}`}>
              {isOverdue ? `${Math.abs(daysRemaining)} days overdue` : `${daysRemaining} days remaining`}
            </div>
          )}
          {project.actual_end_date && (
            <div>
              <label className="text-xs text-slate-500 block mb-1">Actual End Date</label>
              <span className="text-sm text-white">{new Date(project.actual_end_date).toLocaleDateString()}</span>
            </div>
          )}
        </div>

        <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50 space-y-4">
          <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
            <DollarSign className="w-4 h-4" /> Financials
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-900/50 rounded-lg p-3">
              <p className="text-xs text-slate-500 mb-1">Budget</p>
              <p className="text-lg font-semibold text-white">${Number(project.budget_amount).toLocaleString()}</p>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-3">
              <p className="text-xs text-slate-500 mb-1">Actual Cost</p>
              <p className="text-lg font-semibold text-white">${Number(project.actual_cost).toLocaleString()}</p>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-slate-500">Budget Used</span>
              <span className="text-xs text-slate-400">
                {project.budget_amount > 0
                  ? `${Math.round((Number(project.actual_cost) / Number(project.budget_amount)) * 100)}%`
                  : '-'}
              </span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-2">
              <div
                className={`h-full rounded-full transition-all ${
                  Number(project.actual_cost) > Number(project.budget_amount)
                    ? 'bg-red-500'
                    : 'bg-emerald-500'
                }`}
                style={{
                  width: project.budget_amount > 0
                    ? `${Math.min(100, (Number(project.actual_cost) / Number(project.budget_amount)) * 100)}%`
                    : '0%',
                }}
              />
            </div>
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50 space-y-3">
          <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
            <Shield className="w-4 h-4" /> Pipeline
          </h3>
          <div className="text-sm text-slate-400">
            <span className="text-white">{project.pipeline?.name || '-'}</span>
            <span className="mx-2 text-slate-600">/</span>
            <span className="text-cyan-400">{project.stage?.name || '-'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
