import { useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import type { CustomFieldGroup, CustomFieldScope } from '../../../types';
import {
  createCustomFieldGroup,
  updateCustomFieldGroup,
} from '../../../services/customFieldGroups';

interface FieldGroupModalProps {
  scope: CustomFieldScope;
  group: CustomFieldGroup | null;
  onClose: () => void;
  onSaved: () => void;
}

export function FieldGroupModal({ scope, group, onClose, onSaved }: FieldGroupModalProps) {
  const { user } = useAuth();
  const isEditing = !!group;

  const [name, setName] = useState(group?.name || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    setError('');

    if (!name.trim()) {
      setError('Group name is required');
      return;
    }

    setSaving(true);

    try {
      if (isEditing) {
        await updateCustomFieldGroup(group!.id, { name: name.trim() }, user);
      } else {
        await createCustomFieldGroup(
          user.organization_id,
          { scope, name: name.trim() },
          user
        );
      }
      onSaved();
    } catch (err) {
      console.error('Failed to save group:', err);
      setError(err instanceof Error ? err.message : 'Failed to save group');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">
            {isEditing ? 'Edit Field Group' : 'Create Field Group'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-red-700">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Group Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Lead Qualification"
              autoFocus
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
            />
            <p className="mt-1 text-xs text-slate-500">
              Groups help organize related custom fields together
            </p>
          </div>
        </form>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Group'}
          </button>
        </div>
      </div>
    </div>
  );
}
