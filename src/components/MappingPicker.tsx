import { useEffect, useState } from 'react';
import { Plus, Check, Loader2, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { createCustomField, generateFieldKey } from '../services/customFields';
import type {
  FormFieldMapping,
  FormFieldType,
  CustomField,
  CustomFieldType,
  CustomFieldScope,
} from '../types';

const BUILTIN_CONTACT_FIELDS: { value: string; label: string }[] = [
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'first_name', label: 'First Name' },
  { value: 'last_name', label: 'Last Name' },
  { value: 'company', label: 'Company' },
  { value: 'source', label: 'Source' },
];

function suggestCustomFieldType(t: FormFieldType | undefined): CustomFieldType {
  if (!t) return 'text';
  switch (t) {
    case 'textarea': return 'textarea';
    case 'number': return 'number';
    case 'monetary': return 'currency';
    case 'date': return 'date';
    case 'email': return 'email';
    case 'phone': return 'phone';
    case 'website': return 'url';
    case 'dropdown': case 'radio': return 'select';
    case 'multi_select': case 'multi_dropdown': case 'checkbox_group':
      return 'multi_select';
    case 'checkbox': case 'consent': return 'boolean';
    case 'file_upload': return 'file';
    default: return 'text';
  }
}

interface MappingPickerProps {
  value: FormFieldMapping | undefined;
  onChange: (next: FormFieldMapping | undefined) => void;
  fieldType?: FormFieldType;
  fieldLabel?: string;
  scope?: CustomFieldScope;
  visibleInProperty?: 'visible_in_forms' | 'visible_in_surveys';
}

type Mode = 'none' | 'contact' | 'custom';

export function MappingPicker({
  value,
  onChange,
  fieldType,
  fieldLabel,
  scope = 'contact',
  visibleInProperty = 'visible_in_forms',
}: MappingPickerProps) {
  const { user } = useAuth();
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const mode: Mode = value?.customFieldId ? 'custom' : value?.contactField ? 'contact' : 'none';

  useEffect(() => {
    if (!user?.organization_id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data } = await supabase
          .from('custom_fields')
          .select('*')
          .eq('organization_id', user.organization_id)
          .eq('scope', scope)
          .eq('active', true)
          .is('deleted_at', null)
          .order('display_order')
          .order('name');
        if (cancelled) return;
        setCustomFields((data || []) as CustomField[]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.organization_id, scope, showCreate]);

  const handleModeChange = (next: Mode) => {
    if (next === 'none') {
      onChange(undefined);
    } else if (next === 'contact') {
      onChange({ contactField: BUILTIN_CONTACT_FIELDS[0].value });
    } else {
      const first = customFields[0];
      onChange(first ? { customFieldId: first.id } : {});
    }
  };

  const handleCustomFieldCreated = (field: CustomField) => {
    setCustomFields((prev) => [...prev, field]);
    onChange({ customFieldId: field.id });
    setShowCreate(false);
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Maps to</label>
        <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
          {([
            { id: 'none', label: 'No mapping' },
            { id: 'contact', label: 'Contact field' },
            { id: 'custom', label: 'Custom field' },
          ] as { id: Mode; label: string }[]).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => handleModeChange(opt.id)}
              className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-md transition-colors ${
                mode === opt.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {mode === 'contact' && (
        <select
          value={value?.contactField || ''}
          onChange={(e) => onChange({ contactField: e.target.value })}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {BUILTIN_CONTACT_FIELDS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
      )}

      {mode === 'custom' && (
        <div className="space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-3">
              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
            </div>
          ) : customFields.length === 0 ? (
            <p className="text-xs text-gray-500 italic">No custom fields yet for this scope.</p>
          ) : (
            <select
              value={value?.customFieldId || ''}
              onChange={(e) => onChange({ customFieldId: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a custom field...</option>
              {customFields.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} {f[visibleInProperty] ? '' : ' (hidden in builder)'}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="w-full inline-flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg border border-dashed border-blue-300"
          >
            <Plus className="w-3.5 h-3.5" />
            Create new custom field
          </button>
        </div>
      )}

      {showCreate && (
        <CreateCustomFieldModal
          defaultName={fieldLabel || ''}
          defaultType={suggestCustomFieldType(fieldType)}
          scope={scope}
          visibleInProperty={visibleInProperty}
          onClose={() => setShowCreate(false)}
          onCreated={handleCustomFieldCreated}
        />
      )}
    </div>
  );
}

const CUSTOM_FIELD_TYPES: { value: CustomFieldType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'textarea', label: 'Long text' },
  { value: 'number', label: 'Number' },
  { value: 'currency', label: 'Currency' },
  { value: 'date', label: 'Date' },
  { value: 'datetime', label: 'Date & time' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'url', label: 'URL' },
  { value: 'select', label: 'Dropdown (single)' },
  { value: 'multi_select', label: 'Multi-select' },
  { value: 'radio', label: 'Radio' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'boolean', label: 'Yes / No' },
  { value: 'file', label: 'File' },
];

function CreateCustomFieldModal({
  defaultName,
  defaultType,
  scope,
  visibleInProperty,
  onClose,
  onCreated,
}: {
  defaultName: string;
  defaultType: CustomFieldType;
  scope: CustomFieldScope;
  visibleInProperty: 'visible_in_forms' | 'visible_in_surveys';
  onClose: () => void;
  onCreated: (field: CustomField) => void;
}) {
  const { user } = useAuth();
  const [name, setName] = useState(defaultName);
  const [fieldType, setFieldType] = useState<CustomFieldType>(defaultType);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fieldKey = name ? generateFieldKey(name) : '';

  const handleCreate = async () => {
    if (!user?.organization_id || !user.id) return;
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const created = await createCustomField(
        user.organization_id,
        {
          scope,
          group_id: null,
          name: name.trim(),
          field_key: fieldKey,
          field_type: fieldType,
          options: null,
          option_items: null,
          default_value: null,
          is_required: false,
          display_order: 0,
          placeholder: null,
          help_text: null,
          [visibleInProperty]: true,
        } as Parameters<typeof createCustomField>[1],
        user as Parameters<typeof createCustomField>[2]
      );
      onCreated(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create custom field');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900">Create custom field</h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Project Budget"
              autoFocus
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {fieldKey && (
              <p className="text-xs text-gray-500 mt-1">
                Key: <span className="font-mono">{fieldKey}</span>
              </p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
            <select
              value={fieldType}
              onChange={(e) => setFieldType(e.target.value as CustomFieldType)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {CUSTOM_FIELD_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div className="text-xs text-gray-500">
            Scope: <span className="font-medium text-gray-700 capitalize">{scope}</span>
          </div>
          {error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">{error}</div>
          )}
        </div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-lg disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={saving || !name.trim()}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Create &amp; use
          </button>
        </div>
      </div>
    </div>
  );
}
