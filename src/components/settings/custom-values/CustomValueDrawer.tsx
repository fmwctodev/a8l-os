import { useState, useEffect } from 'react';
import { X, Plus, AlertCircle } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import * as customValuesService from '../../../services/customValues';
import type { CustomValue, CustomValueCategory } from '../../../services/customValues';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  valueId: string | null;
}

interface FormData {
  name: string;
  key: string;
  value: string;
  category_id: string | null;
  available_in_emails: boolean;
  available_in_sms: boolean;
  available_in_automations: boolean;
  available_in_ai_prompts: boolean;
  available_in_proposals: boolean;
}

const initialFormData: FormData = {
  name: '',
  key: '',
  value: '',
  category_id: null,
  available_in_emails: true,
  available_in_sms: true,
  available_in_automations: true,
  available_in_ai_prompts: true,
  available_in_proposals: true,
};

export function CustomValueDrawer({ isOpen, onClose, onSuccess, valueId }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<CustomValueCategory[]>([]);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [error, setError] = useState<string | null>(null);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isEdit, setIsEdit] = useState(false);

  useEffect(() => {
    if (isOpen && user?.organization_id) {
      loadCategories();
      if (valueId) {
        loadValue(valueId);
        setIsEdit(true);
      } else {
        setFormData(initialFormData);
        setIsEdit(false);
      }
    }
  }, [isOpen, valueId, user?.organization_id]);

  const loadCategories = async () => {
    if (!user?.organization_id) return;
    try {
      const data = await customValuesService.getCategories(user.organization_id);
      setCategories(data);
    } catch (err) {
      console.error('Failed to load categories:', err);
    }
  };

  const loadValue = async (id: string) => {
    if (!user?.organization_id) return;
    try {
      setLoading(true);
      const value = await customValuesService.getCustomValueById(user.organization_id, id);
      if (value) {
        setFormData({
          name: value.name,
          key: value.key,
          value: value.value,
          category_id: value.category_id,
          available_in_emails: value.available_in_emails,
          available_in_sms: value.available_in_sms,
          available_in_automations: value.available_in_automations,
          available_in_ai_prompts: value.available_in_ai_prompts,
          available_in_proposals: value.available_in_proposals,
        });
      }
    } catch (err) {
      console.error('Failed to load value:', err);
      setError('Failed to load custom value');
    } finally {
      setLoading(false);
    }
  };

  const handleNameChange = (name: string) => {
    setFormData(prev => ({
      ...prev,
      name,
      key: isEdit ? prev.key : customValuesService.nameToKey(name),
    }));
  };

  const handleCreateCategory = async () => {
    if (!user?.organization_id || !newCategoryName.trim()) return;
    try {
      const newCategory = await customValuesService.createCategory(user.organization_id, {
        name: newCategoryName.trim(),
      });
      setCategories(prev => [...prev, newCategory]);
      setFormData(prev => ({ ...prev, category_id: newCategory.id }));
      setNewCategoryName('');
      setShowNewCategory(false);
    } catch (err) {
      console.error('Failed to create category:', err);
    }
  };

  const handleSubmit = async () => {
    if (!user?.organization_id || !formData.name.trim()) return;

    try {
      setSaving(true);
      setError(null);

      if (isEdit && valueId) {
        await customValuesService.updateCustomValue(user.organization_id, user.id, valueId, {
          name: formData.name,
          value: formData.value,
          category_id: formData.category_id,
          available_in_emails: formData.available_in_emails,
          available_in_sms: formData.available_in_sms,
          available_in_automations: formData.available_in_automations,
          available_in_ai_prompts: formData.available_in_ai_prompts,
          available_in_proposals: formData.available_in_proposals,
        });
      } else {
        await customValuesService.createCustomValue(user.organization_id, user.id, {
          name: formData.name,
          key: formData.key || undefined,
          value: formData.value,
          category_id: formData.category_id,
          available_in_emails: formData.available_in_emails,
          available_in_sms: formData.available_in_sms,
          available_in_automations: formData.available_in_automations,
          available_in_ai_prompts: formData.available_in_ai_prompts,
          available_in_proposals: formData.available_in_proposals,
        });
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save custom value');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-slate-900 border-l border-slate-700 shadow-xl flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">
            {isEdit ? 'Edit Custom Value' : 'Add Custom Value'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-300 rounded-lg hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0" />
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            <div className="space-y-4">
              <h3 className="text-sm font-medium text-slate-300 uppercase tracking-wider">Basic Info</h3>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g., Company Name"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  Token Key
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 text-sm">{'{{custom.'}</span>
                  <input
                    type="text"
                    value={formData.key}
                    onChange={(e) => !isEdit && setFormData(prev => ({ ...prev, key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') }))}
                    disabled={isEdit}
                    placeholder="company_name"
                    className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-cyan-400 font-mono text-sm placeholder-slate-500 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                  <span className="text-slate-500 text-sm">{'}}'}</span>
                </div>
                {isEdit && (
                  <p className="mt-1 text-xs text-slate-500">Token key cannot be changed after creation</p>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-medium text-slate-300 uppercase tracking-wider">Value</h3>

              <div>
                <textarea
                  value={formData.value}
                  onChange={(e) => setFormData(prev => ({ ...prev, value: e.target.value }))}
                  placeholder="Enter the value..."
                  rows={4}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 resize-none"
                />
                <p className="mt-1 text-xs text-slate-500 text-right">
                  {formData.value.length} characters
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-medium text-slate-300 uppercase tracking-wider">Category</h3>

              {showNewCategory ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="New category name"
                    className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateCategory();
                      if (e.key === 'Escape') {
                        setShowNewCategory(false);
                        setNewCategoryName('');
                      }
                    }}
                  />
                  <button
                    onClick={handleCreateCategory}
                    disabled={!newCategoryName.trim()}
                    className="px-3 py-2 bg-cyan-500 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-cyan-600"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => {
                      setShowNewCategory(false);
                      setNewCategoryName('');
                    }}
                    className="px-3 py-2 text-slate-400 hover:text-slate-300 text-sm"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <select
                    value={formData.category_id || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, category_id: e.target.value || null }))}
                    className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                  >
                    <option value="">No category</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => setShowNewCategory(true)}
                    className="p-2 text-slate-400 hover:text-cyan-400 rounded-lg hover:bg-slate-800"
                    title="Create new category"
                  >
                    <Plus className="h-5 w-5" />
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-medium text-slate-300 uppercase tracking-wider">Availability</h3>
              <p className="text-xs text-slate-500">Choose where this value can be used</p>

              <div className="space-y-3">
                {[
                  { key: 'available_in_emails', label: 'Available in Emails' },
                  { key: 'available_in_sms', label: 'Available in SMS' },
                  { key: 'available_in_automations', label: 'Available in Automations' },
                  { key: 'available_in_ai_prompts', label: 'Available in AI Prompts' },
                  { key: 'available_in_proposals', label: 'Available in Proposals & Invoices' },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData[key as keyof FormData] as boolean}
                      onChange={(e) => setFormData(prev => ({ ...prev, [key]: e.target.checked }))}
                      className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-slate-900"
                    />
                    <span className="text-sm text-slate-300">{label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="px-6 py-4 border-t border-slate-700 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-400 hover:text-slate-300 text-sm font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!formData.name.trim() || saving}
            className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-teal-600 text-white rounded-lg text-sm font-medium shadow-lg shadow-cyan-500/25 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-cyan-500/40 hover:brightness-110"
          >
            {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Value'}
          </button>
        </div>
      </div>
    </>
  );
}
