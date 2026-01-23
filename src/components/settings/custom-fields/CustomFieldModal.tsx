import { useState, useEffect } from 'react';
import { X, Plus, Trash2, AlertCircle, HelpCircle } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import type {
  CustomField,
  CustomFieldGroup,
  CustomFieldScope,
  CustomFieldType,
  CreateCustomFieldInput,
} from '../../../types';
import { CUSTOM_FIELD_TYPE_LABELS, SAFE_TYPE_MIGRATIONS } from '../../../types';
import {
  createCustomField,
  updateCustomField,
  generateFieldKey,
  getFieldValueCount,
  canMigrateFieldType,
} from '../../../services/customFields';

interface CustomFieldModalProps {
  scope: CustomFieldScope;
  field: CustomField | null;
  groups: CustomFieldGroup[];
  onClose: () => void;
  onSaved: () => void;
}

export function CustomFieldModal({
  scope,
  field,
  groups,
  onClose,
  onSaved,
}: CustomFieldModalProps) {
  const { user } = useAuth();
  const isEditing = !!field;

  const [name, setName] = useState(field?.name || '');
  const [fieldKey, setFieldKey] = useState(field?.field_key || '');
  const [fieldType, setFieldType] = useState<CustomFieldType>(field?.field_type || 'text');
  const [groupId, setGroupId] = useState<string | null>(field?.group_id || null);
  const [options, setOptions] = useState<string[]>(field?.options || []);
  const [newOption, setNewOption] = useState('');
  const [isRequired, setIsRequired] = useState(field?.is_required || false);
  const [placeholder, setPlaceholder] = useState(field?.placeholder || '');
  const [helpText, setHelpText] = useState(field?.help_text || '');
  const [visibleInForms, setVisibleInForms] = useState(field?.visible_in_forms ?? true);
  const [visibleInSurveys, setVisibleInSurveys] = useState(field?.visible_in_surveys ?? true);
  const [filterable, setFilterable] = useState(field?.filterable ?? true);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [keyEdited, setKeyEdited] = useState(isEditing);
  const [existingValueCount, setExistingValueCount] = useState(0);

  useEffect(() => {
    if (isEditing && field) {
      getFieldValueCount(field.id, scope).then(setExistingValueCount);
    }
  }, [isEditing, field, scope]);

  useEffect(() => {
    if (!keyEdited && name) {
      setFieldKey(generateFieldKey(name));
    }
  }, [name, keyEdited]);

  const needsOptions =
    fieldType === 'select' ||
    fieldType === 'multi_select' ||
    fieldType === 'radio';

  const typeOptions: { value: CustomFieldType; label: string; description: string }[] = [
    { value: 'text', label: 'Single Line Text', description: 'Short text input' },
    { value: 'textarea', label: 'Multi-Line Text', description: 'Longer text with multiple lines' },
    { value: 'number', label: 'Number', description: 'Numeric values' },
    { value: 'currency', label: 'Currency', description: 'Monetary values' },
    { value: 'date', label: 'Date', description: 'Date picker' },
    { value: 'datetime', label: 'Date & Time', description: 'Date and time picker' },
    { value: 'select', label: 'Dropdown', description: 'Single selection from options' },
    { value: 'multi_select', label: 'Multi-Select', description: 'Multiple selections' },
    { value: 'checkbox', label: 'Checkbox', description: 'Yes/No toggle' },
    { value: 'radio', label: 'Radio Buttons', description: 'Single selection with visible options' },
    { value: 'phone', label: 'Phone Number', description: 'Phone number with formatting' },
    { value: 'email', label: 'Email Address', description: 'Email with validation' },
    { value: 'url', label: 'URL', description: 'Website link' },
    { value: 'file', label: 'File Upload', description: 'Attach a file' },
  ];

  function canChangeToType(newType: CustomFieldType): boolean {
    if (!isEditing || existingValueCount === 0) return true;
    return canMigrateFieldType(field!.field_type, newType, SAFE_TYPE_MIGRATIONS);
  }

  function handleAddOption() {
    if (newOption.trim() && !options.includes(newOption.trim())) {
      setOptions([...options, newOption.trim()]);
      setNewOption('');
    }
  }

  function handleRemoveOption(index: number) {
    setOptions(options.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    setError('');

    if (!name.trim()) {
      setError('Field name is required');
      return;
    }

    if (!fieldKey.trim()) {
      setError('Field key is required');
      return;
    }

    if (needsOptions && options.length === 0) {
      setError('At least one option is required for this field type');
      return;
    }

    setSaving(true);

    try {
      if (isEditing) {
        await updateCustomField(
          field!.id,
          {
            name: name.trim(),
            group_id: groupId,
            field_type: fieldType,
            options: needsOptions ? options : null,
            is_required: isRequired,
            placeholder: placeholder.trim() || null,
            help_text: helpText.trim() || null,
            visible_in_forms: visibleInForms,
            visible_in_surveys: visibleInSurveys,
            filterable,
          },
          user
        );
      } else {
        const input: CreateCustomFieldInput = {
          scope,
          group_id: groupId,
          name: name.trim(),
          field_key: fieldKey.trim(),
          field_type: fieldType,
          options: needsOptions ? options : undefined,
          is_required: isRequired,
          placeholder: placeholder.trim() || undefined,
          help_text: helpText.trim() || undefined,
          visible_in_forms: visibleInForms,
          visible_in_surveys: visibleInSurveys,
          filterable,
        };
        await createCustomField(user.organization_id, input, user);
      }
      onSaved();
    } catch (err) {
      console.error('Failed to save field:', err);
      setError(err instanceof Error ? err.message : 'Failed to save field');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">
            {isEditing ? 'Edit Custom Field' : 'Create Custom Field'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-130px)]">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-red-700">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {existingValueCount > 0 && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2 text-amber-700">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span className="text-sm">
                This field has {existingValueCount} existing value(s). Some changes may be restricted.
              </span>
            </div>
          )}

          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Field Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Lead Source"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Field Key <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={fieldKey}
                  onChange={(e) => {
                    setFieldKey(e.target.value);
                    setKeyEdited(true);
                  }}
                  disabled={isEditing}
                  placeholder="lead_source"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent font-mono text-sm disabled:bg-slate-100 disabled:cursor-not-allowed"
                />
                {isEditing && (
                  <p className="mt-1 text-xs text-slate-500">Field key cannot be changed</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Field Type</label>
                <select
                  value={fieldType}
                  onChange={(e) => setFieldType(e.target.value as CustomFieldType)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                >
                  {typeOptions.map((opt) => (
                    <option
                      key={opt.value}
                      value={opt.value}
                      disabled={!canChangeToType(opt.value)}
                    >
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Group</label>
                <select
                  value={groupId || ''}
                  onChange={(e) => setGroupId(e.target.value || null)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                >
                  <option value="">No Group (Ungrouped)</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {needsOptions && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Options <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2">
                  {options.map((opt, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => {
                          const newOpts = [...options];
                          newOpts[index] = e.target.value;
                          setOptions(newOpts);
                        }}
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveOption(index)}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newOption}
                      onChange={(e) => setNewOption(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddOption();
                        }
                      }}
                      placeholder="Add new option..."
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                    />
                    <button
                      type="button"
                      onClick={handleAddOption}
                      className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Placeholder</label>
                <input
                  type="text"
                  value={placeholder}
                  onChange={(e) => setPlaceholder(e.target.value)}
                  placeholder="Enter placeholder text..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                />
              </div>
              <div>
                <label className="flex items-center gap-1 text-sm font-medium text-slate-700 mb-1">
                  Help Text
                  <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                </label>
                <input
                  type="text"
                  value={helpText}
                  onChange={(e) => setHelpText(e.target.value)}
                  placeholder="Additional guidance for users..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                />
              </div>
            </div>

            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isRequired}
                  onChange={(e) => setIsRequired(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                />
                <span className="text-sm text-slate-700">Required field</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filterable}
                  onChange={(e) => setFilterable(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                />
                <span className="text-sm text-slate-700">
                  Available in filters and reports
                </span>
              </label>
              {scope === 'contact' && (
                <>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={visibleInForms}
                      onChange={(e) => setVisibleInForms(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                    />
                    <span className="text-sm text-slate-700">Show in Form Builder</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={visibleInSurveys}
                      onChange={(e) => setVisibleInSurveys(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                    />
                    <span className="text-sm text-slate-700">Show in Survey Builder</span>
                  </label>
                </>
              )}
            </div>
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
            {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Field'}
          </button>
        </div>
      </div>
    </div>
  );
}
