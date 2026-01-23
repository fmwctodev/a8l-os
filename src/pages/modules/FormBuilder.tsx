import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Eye,
  Settings,
  Plus,
  Trash2,
  GripVertical,
  Globe,
  Type,
  Mail,
  Phone,
  Building2,
  Link as LinkIcon,
  MapPin,
  AlignLeft,
  Hash,
  ChevronDown,
  CheckSquare,
  Calendar,
  EyeOff,
  ShieldCheck,
} from 'lucide-react';
import { getFormById, updateForm, publishForm, unpublishForm } from '../../services/forms';
import type { Form, FormField, FormFieldType, FormDefinition, FormSettings } from '../../types';

const FIELD_TYPES: { type: FormFieldType; label: string; icon: React.ElementType }[] = [
  { type: 'first_name', label: 'First Name', icon: Type },
  { type: 'last_name', label: 'Last Name', icon: Type },
  { type: 'full_name', label: 'Full Name', icon: Type },
  { type: 'email', label: 'Email', icon: Mail },
  { type: 'phone', label: 'Phone', icon: Phone },
  { type: 'company', label: 'Company', icon: Building2 },
  { type: 'website', label: 'Website', icon: LinkIcon },
  { type: 'address', label: 'Address', icon: MapPin },
  { type: 'text', label: 'Single Line Text', icon: Type },
  { type: 'textarea', label: 'Paragraph', icon: AlignLeft },
  { type: 'number', label: 'Number', icon: Hash },
  { type: 'dropdown', label: 'Dropdown', icon: ChevronDown },
  { type: 'multi_select', label: 'Multi-Select', icon: CheckSquare },
  { type: 'checkbox', label: 'Checkbox', icon: CheckSquare },
  { type: 'date', label: 'Date', icon: Calendar },
  { type: 'hidden', label: 'Hidden Field', icon: EyeOff },
  { type: 'consent', label: 'Consent Checkbox', icon: ShieldCheck },
];

function generateFieldId(): string {
  return `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function getDefaultLabel(type: FormFieldType): string {
  const fieldType = FIELD_TYPES.find((f) => f.type === type);
  return fieldType?.label || 'Field';
}

export function FormBuilder() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form, setForm] = useState<Form | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'fields' | 'settings'>('fields');
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);

  useEffect(() => {
    if (id) loadForm();
  }, [id]);

  async function loadForm() {
    try {
      setLoading(true);
      const data = await getFormById(id!);
      if (data) {
        setForm(data);
      } else {
        navigate('/marketing/forms');
      }
    } catch (error) {
      console.error('Failed to load form:', error);
      navigate('/marketing/forms');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!form) return;

    try {
      setSaving(true);
      await updateForm(form.id, {
        name: form.name,
        description: form.description,
        definition: form.definition,
        settings: form.settings,
      });
    } catch (error) {
      console.error('Failed to save form:', error);
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    if (!form) return;

    try {
      await handleSave();
      const updated = await publishForm(form.id);
      setForm(updated);
    } catch (error) {
      console.error('Failed to publish form:', error);
    }
  }

  async function handleUnpublish() {
    if (!form) return;

    try {
      const updated = await unpublishForm(form.id);
      setForm(updated);
    } catch (error) {
      console.error('Failed to unpublish form:', error);
    }
  }

  function addField(type: FormFieldType) {
    if (!form) return;

    const newField: FormField = {
      id: generateFieldId(),
      type,
      label: getDefaultLabel(type),
      required: false,
      width: 'full',
    };

    if (type === 'dropdown' || type === 'multi_select') {
      newField.options = [
        { label: 'Option 1', value: 'option_1' },
        { label: 'Option 2', value: 'option_2' },
      ];
    }

    setForm({
      ...form,
      definition: {
        ...form.definition,
        fields: [...form.definition.fields, newField],
      },
    });
    setSelectedFieldId(newField.id);
  }

  function updateField(fieldId: string, updates: Partial<FormField>) {
    if (!form) return;

    setForm({
      ...form,
      definition: {
        ...form.definition,
        fields: form.definition.fields.map((f) =>
          f.id === fieldId ? { ...f, ...updates } : f
        ),
      },
    });
  }

  function removeField(fieldId: string) {
    if (!form) return;

    setForm({
      ...form,
      definition: {
        ...form.definition,
        fields: form.definition.fields.filter((f) => f.id !== fieldId),
      },
    });
    if (selectedFieldId === fieldId) {
      setSelectedFieldId(null);
    }
  }

  function moveField(fromIndex: number, toIndex: number) {
    if (!form) return;

    const fields = [...form.definition.fields];
    const [moved] = fields.splice(fromIndex, 1);
    fields.splice(toIndex, 0, moved);

    setForm({
      ...form,
      definition: { ...form.definition, fields },
    });
  }

  function updateSettings(updates: Partial<FormSettings>) {
    if (!form) return;

    setForm({
      ...form,
      settings: { ...form.settings, ...updates },
    });
  }

  const selectedField = form?.definition.fields.find(
    (f) => f.id === selectedFieldId
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!form) return null;

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-4">
          <Link
            to="/marketing/forms"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </Link>
          <div>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="text-xl font-semibold text-gray-900 border-none focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 -ml-2"
            />
            <div className="text-sm text-gray-500 ml-2">
              {form.status === 'published' ? (
                <span className="text-green-600">Published</span>
              ) : (
                <span>Draft</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPreviewMode(!previewMode)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
              previewMode
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Eye className="w-4 h-4" />
            Preview
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save'}
          </button>
          {form.status === 'published' ? (
            <button
              onClick={handleUnpublish}
              className="flex items-center gap-2 px-4 py-2 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 transition-colors"
            >
              Unpublish
            </button>
          ) : (
            <button
              onClick={handlePublish}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Globe className="w-4 h-4" />
              Publish
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-64 border-r border-gray-200 bg-white overflow-y-auto">
          <div className="p-4">
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setActiveTab('fields')}
                className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === 'fields'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Fields
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === 'settings'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Settings className="w-4 h-4 inline mr-1" />
                Settings
              </button>
            </div>

            {activeTab === 'fields' ? (
              <div className="space-y-2">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                  Add Field
                </div>
                {FIELD_TYPES.map((field) => (
                  <button
                    key={field.type}
                    onClick={() => addField(field.type)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <field.icon className="w-4 h-4 text-gray-400" />
                    {field.label}
                  </button>
                ))}
              </div>
            ) : (
              <FormSettingsPanel
                settings={form.settings}
                onUpdate={updateSettings}
              />
            )}
          </div>
        </div>

        <div className="flex-1 bg-gray-50 overflow-y-auto p-6">
          {previewMode ? (
            <FormPreview form={form} />
          ) : (
            <div className="max-w-2xl mx-auto">
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                {form.definition.fields.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Plus className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>Add fields from the left panel</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {form.definition.fields.map((field, index) => (
                      <FieldCard
                        key={field.id}
                        field={field}
                        index={index}
                        isSelected={selectedFieldId === field.id}
                        onSelect={() => setSelectedFieldId(field.id)}
                        onRemove={() => removeField(field.id)}
                        onMoveUp={() =>
                          index > 0 && moveField(index, index - 1)
                        }
                        onMoveDown={() =>
                          index < form.definition.fields.length - 1 &&
                          moveField(index, index + 1)
                        }
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {selectedField && !previewMode && (
          <div className="w-80 border-l border-gray-200 bg-white overflow-y-auto">
            <FieldEditor
              field={selectedField}
              onUpdate={(updates) => updateField(selectedField.id, updates)}
              onClose={() => setSelectedFieldId(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function FieldCard({
  field,
  index,
  isSelected,
  onSelect,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  field: FormField;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const fieldType = FIELD_TYPES.find((f) => f.type === field.type);
  const Icon = fieldType?.icon || Type;

  return (
    <div
      onClick={onSelect}
      className={`group flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
        isSelected
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onMoveUp();
          }}
          className="p-1 hover:bg-gray-200 rounded"
        >
          <GripVertical className="w-4 h-4 text-gray-400" />
        </button>
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <Icon className="w-4 h-4 text-gray-400" />
          <span className="font-medium text-gray-900">{field.label}</span>
          {field.required && (
            <span className="text-red-500 text-sm">*</span>
          )}
        </div>
        <div className="text-sm text-gray-500">{fieldType?.label}</div>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

function FieldEditor({
  field,
  onUpdate,
  onClose,
}: {
  field: FormField;
  onUpdate: (updates: Partial<FormField>) => void;
  onClose: () => void;
}) {
  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Field Settings</h3>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 rounded"
        >
          &times;
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Label
          </label>
          <input
            type="text"
            value={field.label}
            onChange={(e) => onUpdate({ label: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Placeholder
          </label>
          <input
            type="text"
            value={field.placeholder || ''}
            onChange={(e) => onUpdate({ placeholder: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="required"
            checked={field.required}
            onChange={(e) => onUpdate({ required: e.target.checked })}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <label htmlFor="required" className="text-sm text-gray-700">
            Required field
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Width
          </label>
          <select
            value={field.width || 'full'}
            onChange={(e) =>
              onUpdate({ width: e.target.value as 'full' | 'half' })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="full">Full Width</option>
            <option value="half">Half Width</option>
          </select>
        </div>

        {(field.type === 'dropdown' || field.type === 'multi_select') && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Options
            </label>
            <div className="space-y-2">
              {(field.options || []).map((option, idx) => (
                <div key={idx} className="flex gap-2">
                  <input
                    type="text"
                    value={option.label}
                    onChange={(e) => {
                      const newOptions = [...(field.options || [])];
                      newOptions[idx] = {
                        ...option,
                        label: e.target.value,
                        value: e.target.value.toLowerCase().replace(/\s+/g, '_'),
                      };
                      onUpdate({ options: newOptions });
                    }}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={() => {
                      const newOptions = (field.options || []).filter(
                        (_, i) => i !== idx
                      );
                      onUpdate({ options: newOptions });
                    }}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => {
                  const newOptions = [
                    ...(field.options || []),
                    {
                      label: `Option ${(field.options || []).length + 1}`,
                      value: `option_${(field.options || []).length + 1}`,
                    },
                  ];
                  onUpdate({ options: newOptions });
                }}
                className="w-full px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                + Add Option
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FormSettingsPanel({
  settings,
  onUpdate,
}: {
  settings: FormSettings;
  onUpdate: (updates: Partial<FormSettings>) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Thank You Message
        </label>
        <textarea
          value={settings.thankYouMessage || ''}
          onChange={(e) => onUpdate({ thankYouMessage: e.target.value })}
          rows={3}
          placeholder="Thank you for your submission!"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Redirect URL (optional)
        </label>
        <input
          type="url"
          value={settings.redirectUrl || ''}
          onChange={(e) => onUpdate({ redirectUrl: e.target.value })}
          placeholder="https://..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Contact Matching
        </label>
        <select
          value={settings.contactMatching}
          onChange={(e) =>
            onUpdate({
              contactMatching: e.target.value as FormSettings['contactMatching'],
            })
          }
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="email_first">Match by Email first</option>
          <option value="phone_first">Match by Phone first</option>
          <option value="create_new">Always create new</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Field Overwrite
        </label>
        <select
          value={settings.fieldOverwrite}
          onChange={(e) =>
            onUpdate({
              fieldOverwrite: e.target.value as FormSettings['fieldOverwrite'],
            })
          }
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="always">Always overwrite</option>
          <option value="only_if_empty">Only if empty</option>
        </select>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="honeypot"
          checked={settings.honeypotEnabled ?? true}
          onChange={(e) => onUpdate({ honeypotEnabled: e.target.checked })}
          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <label htmlFor="honeypot" className="text-sm text-gray-700">
          Enable spam protection
        </label>
      </div>
    </div>
  );
}

function FormPreview({ form }: { form: Form }) {
  return (
    <div className="max-w-xl mx-auto">
      <div className="bg-white rounded-xl border border-gray-200 p-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">
          {form.name}
        </h2>
        {form.description && (
          <p className="text-gray-500 mb-6">{form.description}</p>
        )}

        <div className="space-y-4">
          {form.definition.fields.map((field) => (
            <div
              key={field.id}
              className={field.width === 'half' ? 'w-1/2 inline-block pr-2' : ''}
            >
              {field.type !== 'hidden' && (
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </label>
              )}

              {field.type === 'textarea' ? (
                <textarea
                  placeholder={field.placeholder}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ) : field.type === 'dropdown' ? (
                <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">{field.placeholder || 'Select...'}</option>
                  {(field.options || []).map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : field.type === 'checkbox' || field.type === 'consent' ? (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">{field.label}</span>
                </div>
              ) : field.type === 'hidden' ? null : (
                <input
                  type={
                    field.type === 'email'
                      ? 'email'
                      : field.type === 'phone'
                      ? 'tel'
                      : field.type === 'number'
                      ? 'number'
                      : field.type === 'date'
                      ? 'date'
                      : 'text'
                  }
                  placeholder={field.placeholder}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}
            </div>
          ))}

          <button
            type="button"
            className="w-full px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}
