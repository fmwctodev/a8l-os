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
  ChevronsUpDown,
  CheckSquare,
  Calendar,
  EyeOff,
  ShieldCheck,
  Circle,
  Upload,
  Minus,
  Code,
  FileCode,
  GitBranch,
  X,
  Copy,
  ExternalLink,
  DollarSign,
  Map,
  Mailbox,
  Clock,
  CreditCard,
  ShoppingCart,
  Smartphone,
  BadgeCheck,
  Calculator,
  Columns,
  Tag,
  ListChecks,
  List,
  PenTool,
} from 'lucide-react';
import { getFormById, updateForm, publishForm, unpublishForm } from '../../services/forms';
import type { Form, FormField, FormFieldType, FormDefinition, FormSettings, FormConditionalRule, FormValidationRule } from '../../types';
import {
  US_STATES,
  COUNTRIES,
  COMMON_TIMEZONES,
  currencySymbol,
} from '../../constants/formFieldOptions';
import { EditableText } from '../../components/EditableText';
import { ThemePicker } from '../../components/ThemePicker';
import { SubmitRulesEditor } from '../../components/SubmitRulesEditor';
import { MappingPicker } from '../../components/MappingPicker';
import { Monitor, LayoutTemplate, Sparkles } from 'lucide-react';
import { FORM_TEMPLATES, type FormTemplate } from '../../constants/formTemplates';

interface FieldTypeConfig {
  type: FormFieldType;
  label: string;
  icon: React.ElementType;
  category: 'contact' | 'address' | 'input' | 'choice' | 'advanced' | 'layout' | 'special';
}

const FIELD_TYPES: FieldTypeConfig[] = [
  { type: 'first_name', label: 'First Name', icon: Type, category: 'contact' },
  { type: 'last_name', label: 'Last Name', icon: Type, category: 'contact' },
  { type: 'full_name', label: 'Full Name', icon: Type, category: 'contact' },
  { type: 'email', label: 'Email', icon: Mail, category: 'contact' },
  { type: 'phone', label: 'Phone', icon: Phone, category: 'contact' },
  { type: 'company', label: 'Company Name', icon: Building2, category: 'contact' },
  { type: 'website', label: 'URL / Website', icon: LinkIcon, category: 'contact' },

  { type: 'address', label: 'Address', icon: MapPin, category: 'address' },
  { type: 'city', label: 'City', icon: Building2, category: 'address' },
  { type: 'state', label: 'State', icon: Map, category: 'address' },
  { type: 'postal_code', label: 'Postal / Zip Code', icon: Mailbox, category: 'address' },
  { type: 'country', label: 'Country', icon: Globe, category: 'address' },
  { type: 'timezone', label: 'Timezone', icon: Clock, category: 'address' },

  { type: 'text', label: 'Single Line / Short Text', icon: Type, category: 'input' },
  { type: 'textarea', label: 'Multi Line / Long Text', icon: AlignLeft, category: 'input' },
  { type: 'textbox_list', label: 'Textbox List', icon: List, category: 'input' },
  { type: 'number', label: 'Number', icon: Hash, category: 'input' },
  { type: 'monetary', label: 'Monetary', icon: DollarSign, category: 'input' },
  { type: 'date', label: 'Date Picker', icon: Calendar, category: 'input' },

  { type: 'radio', label: 'Radio Select', icon: Circle, category: 'choice' },
  { type: 'dropdown', label: 'Single Dropdown', icon: ChevronDown, category: 'choice' },
  { type: 'multi_dropdown', label: 'Multi Dropdown', icon: ChevronsUpDown, category: 'choice' },
  { type: 'multi_select', label: 'Multi-Select Checkboxes', icon: CheckSquare, category: 'choice' },
  { type: 'checkbox', label: 'Checkbox', icon: CheckSquare, category: 'choice' },
  { type: 'checkbox_group', label: 'Checkbox Group', icon: ListChecks, category: 'choice' },

  { type: 'source', label: 'Source', icon: Tag, category: 'advanced' },
  { type: 'payment', label: 'Payment Element', icon: CreditCard, category: 'advanced' },
  { type: 'product_selection', label: 'Product Selection', icon: ShoppingCart, category: 'advanced' },
  { type: 'sms_verification', label: 'SMS Verification', icon: Smartphone, category: 'advanced' },
  { type: 'email_validation', label: 'Email Validation', icon: BadgeCheck, category: 'advanced' },
  { type: 'math_calculation', label: 'Math Calculation', icon: Calculator, category: 'advanced' },

  { type: 'divider', label: 'Section Divider', icon: Minus, category: 'layout' },
  { type: 'column', label: 'Column / Layout', icon: Columns, category: 'layout' },
  { type: 'custom_html', label: 'Custom HTML', icon: FileCode, category: 'layout' },

  { type: 'file_upload', label: 'File Upload', icon: Upload, category: 'special' },
  { type: 'signature', label: 'Signature', icon: PenTool, category: 'special' },
  { type: 'hidden', label: 'Hidden Field', icon: EyeOff, category: 'special' },
  { type: 'consent', label: 'Consent Checkbox', icon: ShieldCheck, category: 'special' },
];

const FIELD_CATEGORIES = [
  { id: 'contact', label: 'Contact Fields' },
  { id: 'address', label: 'Address Fields' },
  { id: 'input', label: 'Input Fields' },
  { id: 'choice', label: 'Choice Fields' },
  { id: 'advanced', label: 'Advanced' },
  { id: 'layout', label: 'Layout' },
  { id: 'special', label: 'Special' },
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
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [showEmbedModal, setShowEmbedModal] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    contact: true,
    address: false,
    input: true,
    choice: true,
    advanced: false,
    layout: false,
    special: false,
  });

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
      label: type === 'divider' || type === 'column' || type === 'custom_html' ? '' : getDefaultLabel(type),
      required: false,
      width: 'full',
    };

    if (
      type === 'dropdown' ||
      type === 'multi_select' ||
      type === 'multi_dropdown' ||
      type === 'radio' ||
      type === 'checkbox_group' ||
      type === 'product_selection'
    ) {
      newField.options = [
        { label: 'Option 1', value: 'option_1' },
        { label: 'Option 2', value: 'option_2' },
      ];
    }

    if (type === 'file_upload') {
      newField.fileUploadConfig = {
        maxSizeBytes: 10485760,
        allowedTypes: ['image/*', 'application/pdf', '.doc', '.docx'],
        maxFiles: 1,
      };
    }

    if (type === 'monetary') {
      newField.currency = 'USD';
    }

    if (type === 'custom_html') {
      newField.htmlContent = '<p>Custom HTML content</p>';
    }

    if (type === 'math_calculation') {
      newField.formula = '';
    }

    if (type === 'column') {
      newField.columnCount = 2;
    }

    if (type === 'textbox_list') {
      newField.options = [
        { label: 'Item', value: '' },
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
          {previewMode && (
            <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
              <button
                onClick={() => setPreviewDevice('desktop')}
                title="Desktop preview"
                className={`p-1.5 rounded ${
                  previewDevice === 'desktop'
                    ? 'bg-white shadow text-gray-900'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Monitor className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPreviewDevice('mobile')}
                title="Mobile preview"
                className={`p-1.5 rounded ${
                  previewDevice === 'mobile'
                    ? 'bg-white shadow text-gray-900'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Smartphone className="w-4 h-4" />
              </button>
            </div>
          )}
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
            <>
              <button
                onClick={() => setShowEmbedModal(true)}
                className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Code className="w-4 h-4" />
                Embed
              </button>
              <button
                onClick={handleUnpublish}
                className="flex items-center gap-2 px-4 py-2 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 transition-colors"
              >
                Unpublish
              </button>
            </>
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
              <div className="space-y-3">
                {FIELD_CATEGORIES.map((category) => {
                  const categoryFields = FIELD_TYPES.filter(
                    (f) => f.category === category.id
                  );
                  const isExpanded = expandedCategories[category.id];
                  return (
                    <div key={category.id}>
                      <button
                        onClick={() =>
                          setExpandedCategories((prev) => ({
                            ...prev,
                            [category.id]: !prev[category.id],
                          }))
                        }
                        className="w-full flex items-center justify-between px-2 py-1.5 text-xs font-medium text-gray-500 uppercase tracking-wider hover:bg-gray-50 rounded"
                      >
                        {category.label}
                        <ChevronDown
                          className={`w-4 h-4 transition-transform ${
                            isExpanded ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                      {isExpanded && (
                        <div className="mt-1 space-y-1">
                          {categoryFields.map((field) => (
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
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <FormSettingsPanel
                settings={form.settings}
                onUpdate={updateSettings}
                availableFields={form.definition.fields
                  .filter((f) => f.type !== 'divider' && f.type !== 'column' && f.type !== 'custom_html' && f.type !== 'hidden')
                  .map((f) => ({ id: f.id, label: f.label || `(unnamed ${f.type})` }))}
              />
            )}
          </div>
        </div>

        <div className="flex-1 bg-gray-50 overflow-y-auto p-6">
          {previewMode ? (
            <div
              className={
                previewDevice === 'mobile'
                  ? 'mx-auto max-w-[375px] border border-gray-300 rounded-2xl shadow-lg overflow-hidden'
                  : ''
              }
            >
              <FormPreview form={form} />
            </div>
          ) : (
            <div className="max-w-2xl mx-auto">
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                {form.definition.fields.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Plus className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p className="mb-4">Add fields from the left panel</p>
                    <button
                      onClick={() => setShowTemplateModal(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                    >
                      <LayoutTemplate className="w-4 h-4" />
                      Start from a template
                    </button>
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
                        onUpdate={(updates) => updateField(field.id, updates)}
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
              allFields={form.definition.fields}
              onUpdate={(updates) => updateField(selectedField.id, updates)}
              onClose={() => setSelectedFieldId(null)}
            />
          </div>
        )}
      </div>

      {showEmbedModal && form.public_slug && (
        <EmbedModal
          form={form}
          onClose={() => setShowEmbedModal(false)}
        />
      )}

      {showTemplateModal && (
        <FormTemplateModal
          onClose={() => setShowTemplateModal(false)}
          onApply={(template) => {
            const fields: FormField[] = template.fields.map((tf) => ({
              id: generateFieldId(),
              type: tf.type,
              label: tf.label,
              required: tf.required ?? false,
              placeholder: tf.placeholder,
              helpText: tf.helpText,
              options: tf.options,
              width: 'full',
            }));
            setForm({
              ...form,
              definition: { ...form.definition, fields },
            });
            setShowTemplateModal(false);
          }}
        />
      )}
    </div>
  );
}

function FormTemplateModal({
  onClose,
  onApply,
}: {
  onClose: () => void;
  onApply: (template: FormTemplate) => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Start from a template</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="p-6 grid sm:grid-cols-2 gap-4 overflow-y-auto">
          {FORM_TEMPLATES.map((template) => (
            <button
              key={template.id}
              onClick={() => onApply(template)}
              className="text-left p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
            >
              <div className="flex items-center gap-2 mb-2">
                <LayoutTemplate className="w-4 h-4 text-blue-600" />
                <span className="font-semibold text-gray-900">{template.name}</span>
              </div>
              <p className="text-sm text-gray-600 mb-3">{template.description}</p>
              <div className="text-xs text-gray-500">
                {template.fields.length} field{template.fields.length === 1 ? '' : 's'}
              </div>
            </button>
          ))}
        </div>
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <p className="text-xs text-gray-500">
            Applying a template replaces all current fields. You can still edit, add, and remove fields after.
          </p>
        </div>
      </div>
    </div>
  );
}

function FieldCard({
  field,
  isSelected,
  onSelect,
  onRemove,
  onMoveUp,
  onUpdate,
}: {
  field: FormField;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onUpdate: (updates: Partial<FormField>) => void;
}) {
  const fieldType = FIELD_TYPES.find((f) => f.type === field.type);
  const Icon = fieldType?.icon || Type;
  const isLayoutOnly = field.type === 'divider' || field.type === 'column' || field.type === 'custom_html';

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
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Icon className="w-4 h-4 text-gray-400 shrink-0" />
          {isLayoutOnly ? (
            <span className="font-medium text-gray-500 italic">{fieldType?.label}</span>
          ) : (
            <EditableText
              value={field.label}
              onChange={(next) => onUpdate({ label: next })}
              placeholder="Untitled field"
              className="font-medium text-gray-900"
            />
          )}
          {field.required && (
            <span className="text-red-500 text-sm">*</span>
          )}
        </div>
        <div className="text-sm text-gray-500">{fieldType?.label}</div>
        {!isLayoutOnly && field.type !== 'checkbox' && field.type !== 'consent' && field.type !== 'file_upload' && field.type !== 'hidden' && (
          <EditableText
            value={field.placeholder || ''}
            onChange={(next) => onUpdate({ placeholder: next })}
            placeholder="Click to add placeholder…"
            className="text-xs text-gray-400 italic mt-1"
          />
        )}
        {field.options && field.options.length > 0 && !isLayoutOnly && (
          <div className="mt-2 space-y-1">
            {field.options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-gray-600 pl-1">
                <span className="w-1 h-1 bg-gray-400 rounded-full shrink-0" />
                <EditableText
                  value={opt.label}
                  onChange={(next) => {
                    const nextOptions = [...(field.options || [])];
                    nextOptions[i] = { ...nextOptions[i], label: next };
                    onUpdate({ options: nextOptions });
                  }}
                  placeholder={`Option ${i + 1}`}
                  className="text-gray-600"
                />
              </div>
            ))}
          </div>
        )}
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
  allFields,
  onUpdate,
  onClose,
}: {
  field: FormField;
  allFields: FormField[];
  onUpdate: (updates: Partial<FormField>) => void;
  onClose: () => void;
}) {
  const [activeSection, setActiveSection] = useState<'general' | 'conditional' | 'validation'>('general');
  const isDivider = field.type === 'divider';

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Field Settings</h3>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex gap-1 mb-4 p-1 bg-gray-100 rounded-lg">
        <button
          onClick={() => setActiveSection('general')}
          className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            activeSection === 'general' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          General
        </button>
        {!isDivider && (
          <>
            <button
              onClick={() => setActiveSection('conditional')}
              className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                activeSection === 'conditional' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <GitBranch className="w-3 h-3 inline mr-1" />
              Logic
            </button>
            <button
              onClick={() => setActiveSection('validation')}
              className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                activeSection === 'validation' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Validation
            </button>
          </>
        )}
      </div>

      {activeSection === 'general' && (
        <div className="space-y-4">
          {!isDivider && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Label</label>
                <input
                  type="text"
                  value={field.label}
                  onChange={(e) => onUpdate({ label: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Help Text</label>
                <input
                  type="text"
                  value={field.helpText || ''}
                  onChange={(e) => onUpdate({ helpText: e.target.value })}
                  placeholder="Optional description"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {field.type !== 'checkbox' && field.type !== 'consent' && field.type !== 'file_upload' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Placeholder</label>
                  <input
                    type="text"
                    value={field.placeholder || ''}
                    onChange={(e) => onUpdate({ placeholder: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="required"
                  checked={field.required}
                  onChange={(e) => onUpdate({ required: e.target.checked })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="required" className="text-sm text-gray-700">Required field</label>
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Width</label>
            <select
              value={field.width || 'full'}
              onChange={(e) => onUpdate({ width: e.target.value as FormField['width'] })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="full">Full Width</option>
              <option value="two_thirds">2/3 Width</option>
              <option value="half">Half Width</option>
              <option value="third">1/3 Width</option>
            </select>
          </div>

          {!isDivider && field.type !== 'column' && field.type !== 'custom_html' && field.type !== 'hidden' && field.type !== 'file_upload' && (
            <DefaultValueInput field={field} onUpdate={onUpdate} />
          )}

          {!isDivider && field.type !== 'column' && field.type !== 'custom_html' && field.type !== 'hidden' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Label Alignment</label>
              <select
                value={field.labelAlignment || 'top'}
                onChange={(e) => onUpdate({ labelAlignment: e.target.value as FormField['labelAlignment'] })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="top">Top (default)</option>
                <option value="left">Left of input</option>
                <option value="inline">Inline (hide label, use placeholder)</option>
              </select>
            </div>
          )}

          {(field.type === 'dropdown' || field.type === 'radio' || field.type === 'multi_select' || field.type === 'multi_dropdown' || field.type === 'checkbox_group') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Options Layout</label>
              <select
                value={field.optionsLayout || 'vertical'}
                onChange={(e) => onUpdate({ optionsLayout: e.target.value as FormField['optionsLayout'] })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="vertical">Vertical (default)</option>
                <option value="horizontal">Horizontal (inline)</option>
                <option value="columns_2">2 columns</option>
                <option value="columns_3">3 columns</option>
              </select>
            </div>
          )}

          {!isDivider && field.type !== 'column' && field.type !== 'custom_html' && field.type !== 'hidden' && (
            <MappingPicker
              value={field.mapping}
              onChange={(mapping) => onUpdate({ mapping })}
              fieldType={field.type}
              fieldLabel={field.label}
              scope="contact"
              visibleInProperty="visible_in_forms"
            />
          )}

          {(field.type === 'dropdown' || field.type === 'multi_select' || field.type === 'radio') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Options</label>
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
                        const newOptions = (field.options || []).filter((_, i) => i !== idx);
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
                      { label: `Option ${(field.options || []).length + 1}`, value: `option_${(field.options || []).length + 1}` },
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

          {field.type === 'file_upload' && (
            <FileUploadSettings field={field} onUpdate={onUpdate} />
          )}

          {field.type === 'math_calculation' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Formula</label>
              <input
                type="text"
                value={field.formula || ''}
                onChange={(e) => onUpdate({ formula: e.target.value })}
                placeholder="e.g. {sqft} * 12 + 250"
                className="w-full px-3 py-2 font-mono text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Reference other fields with {'{field-id}'}. Supported: + - * / ( ).
              </p>
              {(() => {
                const numericFields = allFields.filter((f) => f.id !== field.id && (f.type === 'number' || f.type === 'monetary' || f.type === 'math_calculation'));
                if (numericFields.length === 0) return null;
                return (
                  <details className="mt-2 text-xs">
                    <summary className="cursor-pointer text-blue-600 hover:text-blue-700">Available field IDs (Number / Monetary only)</summary>
                    <div className="mt-1 space-y-0.5 max-h-32 overflow-y-auto bg-gray-50 rounded p-2">
                      {numericFields.map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => onUpdate({ formula: (field.formula || '') + `{${f.id}}` })}
                          className="block w-full text-left font-mono hover:bg-blue-50 px-1 py-0.5 rounded"
                        >
                          <span className="text-gray-500">{`{${f.id}}`}</span>
                          <span className="text-gray-700 ml-2">{f.label}</span>
                        </button>
                      ))}
                    </div>
                  </details>
                );
              })()}
            </div>
          )}

          {field.type === 'monetary' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
              <input
                type="text"
                value={field.currency || 'USD'}
                onChange={(e) => onUpdate({ currency: e.target.value.toUpperCase() })}
                maxLength={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {field.type === 'custom_html' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">HTML Content</label>
              <textarea
                value={field.htmlContent || ''}
                onChange={(e) => onUpdate({ htmlContent: e.target.value })}
                rows={6}
                placeholder="<p>Custom HTML content</p>"
                className="w-full px-3 py-2 font-mono text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Rendered as-is on the public page. Sanitize untrusted content.
              </p>
            </div>
          )}

          {field.type === 'column' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Columns</label>
              <select
                value={field.columnCount || 2}
                onChange={(e) => onUpdate({ columnCount: parseInt(e.target.value) as 2 | 3 | 4 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={2}>2 columns</option>
                <option value={3}>3 columns</option>
                <option value={4}>4 columns</option>
              </select>
            </div>
          )}

          {(field.type === 'text' || field.type === 'textarea') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Character Limit</label>
              <input
                type="number"
                value={field.characterLimit || ''}
                onChange={(e) => onUpdate({ characterLimit: e.target.value ? parseInt(e.target.value) : undefined })}
                placeholder="No limit"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {field.type === 'phone' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Format</label>
              <select
                value={field.phoneFormat || 'us'}
                onChange={(e) => onUpdate({ phoneFormat: e.target.value as 'us' | 'international' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="us">US (xxx) xxx-xxxx</option>
                <option value="international">International with country code</option>
              </select>
            </div>
          )}

          {field.type === 'email' && (
            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={field.validateDeliverability || false}
                onChange={(e) => onUpdate({ validateDeliverability: e.target.checked })}
                className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span>
                Validate email deliverability
                <span className="block text-xs text-gray-500 mt-0.5">Performs an MX/SMTP check (requires email-validation provider).</span>
              </span>
            </label>
          )}

          {field.type === 'address' && (
            <div className="space-y-3 p-3 bg-gray-50 rounded-lg">
              <div className="text-xs font-medium text-gray-700">Address Settings</div>
              <label className="flex items-start gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={field.addressAutoComplete || false}
                  onChange={(e) => onUpdate({ addressAutoComplete: e.target.checked })}
                  className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span>
                  Enable address auto-complete
                  <span className="block text-xs text-gray-500 mt-0.5">Wired to Google Places (coming soon)</span>
                </span>
              </label>
              {field.addressAutoComplete && (
                <label className="flex items-start gap-2 text-sm text-gray-700 ml-5">
                  <input
                    type="checkbox"
                    checked={field.addressMandatorySelect || false}
                    onChange={(e) => onUpdate({ addressMandatorySelect: e.target.checked })}
                    className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Require selecting an address from the dropdown</span>
                </label>
              )}
            </div>
          )}

          {(field.type === 'dropdown' || field.type === 'radio' || field.type === 'multi_select' || field.type === 'multi_dropdown' || field.type === 'checkbox_group') && (
            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={field.allowOther || false}
                onChange={(e) => onUpdate({ allowOther: e.target.checked })}
                className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span>
                Allow "Other" option
                <span className="block text-xs text-gray-500 mt-0.5">Adds an Other choice that reveals a free-text input.</span>
              </span>
            </label>
          )}

          {(field.type === 'multi_select' || field.type === 'multi_dropdown' || field.type === 'checkbox_group') && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Min selections</label>
                <input
                  type="number"
                  min={0}
                  value={field.minSelections ?? ''}
                  onChange={(e) => onUpdate({ minSelections: e.target.value ? parseInt(e.target.value) : undefined })}
                  placeholder="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max selections</label>
                <input
                  type="number"
                  min={1}
                  value={field.maxSelections ?? ''}
                  onChange={(e) => onUpdate({ maxSelections: e.target.value ? parseInt(e.target.value) : undefined })}
                  placeholder="No limit"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          {field.type === 'consent' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description (HTML allowed)</label>
              <textarea
                value={field.consentDescription || ''}
                onChange={(e) => onUpdate({ consentDescription: e.target.value })}
                rows={3}
                placeholder='I agree to the &lt;a href="/terms"&gt;Terms of Service&lt;/a&gt;'
                className="w-full px-3 py-2 text-xs font-mono border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Label stays plain text (matches GHL constraint). Description renders as HTML for links.
              </p>
            </div>
          )}

          {field.type === 'hidden' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">URL parameter key</label>
              <input
                type="text"
                value={field.hiddenParamKey || ''}
                onChange={(e) => onUpdate({ hiddenParamKey: e.target.value })}
                placeholder="utm_campaign"
                className="w-full px-3 py-2 font-mono text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Pre-filled from <code>?{field.hiddenParamKey || 'key'}=</code> on the form URL.
              </p>
            </div>
          )}

          {field.type === 'source' && (
            <p className="text-xs text-gray-500 -mt-2">
              The Default Value above is used unless the form URL includes <code>?source=</code>, which overrides it.
            </p>
          )}

          {field.type === 'signature' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Signature pad height (px)</label>
              <input
                type="number"
                min={80}
                max={400}
                value={field.signaturePadHeight ?? 120}
                onChange={(e) => onUpdate({ signaturePadHeight: parseInt(e.target.value) || 120 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}
        </div>
      )}

      {activeSection === 'conditional' && (
        <ConditionalLogicEditor field={field} allFields={allFields} onUpdate={onUpdate} />
      )}

      {activeSection === 'validation' && (
        <ValidationRulesEditor field={field} onUpdate={onUpdate} />
      )}
    </div>
  );
}

function DefaultValueInput({
  field,
  onUpdate,
}: {
  field: FormField;
  onUpdate: (updates: Partial<FormField>) => void;
}) {
  const value = field.defaultValue ?? '';
  const cls =
    'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';

  let input: React.ReactNode = null;

  if (field.type === 'number' || field.type === 'monetary') {
    input = (
      <input
        type="number"
        value={value}
        onChange={(e) => onUpdate({ defaultValue: e.target.value })}
        className={cls}
      />
    );
  } else if (field.type === 'date') {
    input = (
      <input
        type="date"
        value={value}
        onChange={(e) => onUpdate({ defaultValue: e.target.value })}
        className={cls}
      />
    );
  } else if (field.type === 'textarea') {
    input = (
      <textarea
        rows={2}
        value={value}
        onChange={(e) => onUpdate({ defaultValue: e.target.value })}
        className={cls}
      />
    );
  } else if (field.type === 'dropdown' || field.type === 'radio') {
    const opts = field.options || [];
    input = (
      <select
        value={value}
        onChange={(e) => onUpdate({ defaultValue: e.target.value })}
        className={cls}
      >
        <option value="">— None —</option>
        {opts.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  } else if (field.type === 'checkbox' || field.type === 'consent') {
    input = (
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={value === 'true'}
          onChange={(e) => onUpdate({ defaultValue: e.target.checked ? 'true' : '' })}
          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        Pre-checked by default
      </label>
    );
  } else {
    input = (
      <input
        type="text"
        value={value}
        onChange={(e) => onUpdate({ defaultValue: e.target.value })}
        className={cls}
      />
    );
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Default Value</label>
      {input}
      <p className="text-xs text-gray-500 mt-1">Pre-fills the field on load.</p>
    </div>
  );
}

const FILE_TYPE_OPTIONS: { type: string; label: string }[] = [
  { type: 'application/pdf', label: 'PDF' },
  { type: '.doc,.docx', label: 'Word (.doc, .docx)' },
  { type: '.xls,.xlsx', label: 'Excel (.xls, .xlsx)' },
  { type: 'image/jpeg', label: 'JPG / JPEG' },
  { type: 'image/png', label: 'PNG' },
  { type: 'image/gif', label: 'GIF' },
  { type: 'image/svg+xml', label: 'SVG' },
  { type: 'video/mp4', label: 'MP4' },
  { type: 'video/mpeg', label: 'MPEG' },
  { type: 'audio/mpeg', label: 'MP3' },
  { type: '.zip', label: 'ZIP' },
  { type: '.rar', label: 'RAR' },
  { type: 'text/csv', label: 'CSV' },
  { type: 'text/plain', label: 'TXT' },
];

function FileUploadSettings({
  field,
  onUpdate,
}: {
  field: FormField;
  onUpdate: (updates: Partial<FormField>) => void;
}) {
  const config = field.fileUploadConfig || {
    maxSizeBytes: 50 * 1048576,
    allowedTypes: ['application/pdf', 'image/jpeg', 'image/png'],
    maxFiles: 1,
  };

  const sizeInMB = Math.round(config.maxSizeBytes / 1048576);

  return (
    <div className="space-y-4 pt-2 border-t border-gray-200">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Max File Size (MB)</label>
        <select
          value={sizeInMB}
          onChange={(e) =>
            onUpdate({
              fileUploadConfig: { ...config, maxSizeBytes: parseInt(e.target.value) * 1048576 },
            })
          }
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value={5}>5 MB</option>
          <option value={10}>10 MB</option>
          <option value={25}>25 MB</option>
          <option value={50}>50 MB (default)</option>
          <option value={100}>100 MB</option>
        </select>
      </div>

      <label className="flex items-start gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={field.allowMultiple || (config.maxFiles > 1)}
          onChange={(e) => {
            const allowMultiple = e.target.checked;
            onUpdate({
              allowMultiple,
              fileUploadConfig: { ...config, maxFiles: allowMultiple ? Math.max(2, config.maxFiles) : 1 },
            });
          }}
          className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <span>Allow multiple file uploads</span>
      </label>

      {(field.allowMultiple || config.maxFiles > 1) && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Max Files</label>
          <input
            type="number"
            min={1}
            max={10}
            value={config.maxFiles}
            onChange={(e) =>
              onUpdate({
                fileUploadConfig: { ...config, maxFiles: parseInt(e.target.value) || 1 },
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Allowed File Types</label>
        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
          {FILE_TYPE_OPTIONS.map((opt) => (
            <label key={opt.type} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={config.allowedTypes.includes(opt.type)}
                onChange={(e) => {
                  const newTypes = e.target.checked
                    ? [...config.allowedTypes, opt.type]
                    : config.allowedTypes.filter((t) => t !== opt.type);
                  onUpdate({ fileUploadConfig: { ...config, allowedTypes: newTypes } });
                }}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              {opt.label}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

function ConditionalLogicEditor({
  field,
  allFields,
  onUpdate,
}: {
  field: FormField;
  allFields: FormField[];
  onUpdate: (updates: Partial<FormField>) => void;
}) {
  const rules = field.conditionalRules || [];
  const otherFields = allFields.filter(
    (f) => f.id !== field.id && f.type !== 'divider' && f.type !== 'hidden'
  );

  function addRule() {
    const newRule: FormConditionalRule = {
      fieldId: otherFields[0]?.id || '',
      operator: 'equals',
      value: '',
    };
    onUpdate({ conditionalRules: [...rules, newRule] });
  }

  function updateRule(index: number, updates: Partial<FormConditionalRule>) {
    const newRules = [...rules];
    newRules[index] = { ...newRules[index], ...updates };
    onUpdate({ conditionalRules: newRules });
  }

  function removeRule(index: number) {
    onUpdate({ conditionalRules: rules.filter((_, i) => i !== index) });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Show this field only when the following conditions are met:
      </p>

      {rules.length === 0 ? (
        <div className="text-center py-6 bg-gray-50 rounded-lg">
          <GitBranch className="w-8 h-8 mx-auto text-gray-300 mb-2" />
          <p className="text-sm text-gray-500">No conditions set</p>
          <p className="text-xs text-gray-400">Field is always visible</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule, idx) => {
            const sourceField = otherFields.find((f) => f.id === rule.fieldId);
            return (
              <div key={idx} className="p-3 bg-gray-50 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500">
                    {idx === 0 ? 'IF' : 'AND'}
                  </span>
                  <button
                    onClick={() => removeRule(idx)}
                    className="p-1 text-gray-400 hover:text-red-500"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <select
                  value={rule.fieldId}
                  onChange={(e) => updateRule(idx, { fieldId: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {otherFields.map((f) => (
                    <option key={f.id} value={f.id}>{f.label}</option>
                  ))}
                </select>

                <select
                  value={rule.operator}
                  onChange={(e) => updateRule(idx, { operator: e.target.value as FormConditionalRule['operator'] })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="equals">Equals</option>
                  <option value="not_equals">Does not equal</option>
                  <option value="contains">Contains</option>
                  <option value="is_empty">Is empty</option>
                  <option value="is_not_empty">Is not empty</option>
                </select>

                {rule.operator !== 'is_empty' && rule.operator !== 'is_not_empty' && (
                  <>
                    {sourceField?.options ? (
                      <select
                        value={rule.value}
                        onChange={(e) => updateRule(idx, { value: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select value...</option>
                        {sourceField.options.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={rule.value}
                        onChange={(e) => updateRule(idx, { value: e.target.value })}
                        placeholder="Value"
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {otherFields.length > 0 && (
        <button
          onClick={addRule}
          className="w-full px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
        >
          + Add Condition
        </button>
      )}

      {otherFields.length === 0 && (
        <p className="text-xs text-gray-400 text-center">
          Add more fields to create conditions
        </p>
      )}
    </div>
  );
}

function ValidationRulesEditor({
  field,
  onUpdate,
}: {
  field: FormField;
  onUpdate: (updates: Partial<FormField>) => void;
}) {
  const rules = field.validationRules || [];
  const fieldType = field.type;

  const availableRules: { type: FormValidationRule['type']; label: string }[] = [];
  if (
    fieldType === 'text' ||
    fieldType === 'textarea' ||
    fieldType === 'first_name' ||
    fieldType === 'last_name' ||
    fieldType === 'full_name' ||
    fieldType === 'company' ||
    fieldType === 'address' ||
    fieldType === 'city' ||
    fieldType === 'state' ||
    fieldType === 'postal_code' ||
    fieldType === 'source'
  ) {
    availableRules.push({ type: 'min_length', label: 'Minimum Length' });
    availableRules.push({ type: 'max_length', label: 'Maximum Length' });
    availableRules.push({ type: 'pattern', label: 'Regex Pattern' });
  }
  if (fieldType === 'number' || fieldType === 'monetary') {
    availableRules.push({ type: 'min', label: 'Minimum Value' });
    availableRules.push({ type: 'max', label: 'Maximum Value' });
  }
  if (fieldType === 'date') {
    availableRules.push({ type: 'min_date', label: 'Earliest Date' });
    availableRules.push({ type: 'max_date', label: 'Latest Date' });
  }
  if (fieldType === 'email' || fieldType === 'phone' || fieldType === 'website') {
    availableRules.push({ type: 'format', label: 'Strict format check' });
  }

  function addRule(type: FormValidationRule['type']) {
    const newRule: FormValidationRule = { type, value: '' };
    onUpdate({ validationRules: [...rules, newRule] });
  }

  function updateRule(index: number, updates: Partial<FormValidationRule>) {
    const newRules = [...rules];
    newRules[index] = { ...newRules[index], ...updates };
    onUpdate({ validationRules: newRules });
  }

  function removeRule(index: number) {
    onUpdate({ validationRules: rules.filter((_, i) => i !== index) });
  }

  if (availableRules.length === 0) {
    return (
      <div className="text-center py-6 bg-gray-50 rounded-lg">
        <p className="text-sm text-gray-500">No validation rules available for this field type</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {rules.map((rule, idx) => (
        <div key={idx} className="p-3 bg-gray-50 rounded-lg space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">
              {availableRules.find((r) => r.type === rule.type)?.label}
            </span>
            <button onClick={() => removeRule(idx)} className="p-1 text-gray-400 hover:text-red-500">
              <X className="w-4 h-4" />
            </button>
          </div>
          {rule.type !== 'format' && (
            <input
              type={
                rule.type === 'pattern'
                  ? 'text'
                  : rule.type === 'min_date' || rule.type === 'max_date'
                  ? 'date'
                  : 'number'
              }
              value={rule.value}
              onChange={(e) =>
                updateRule(idx, {
                  value:
                    rule.type === 'pattern' || rule.type === 'min_date' || rule.type === 'max_date'
                      ? e.target.value
                      : parseFloat(e.target.value),
                })
              }
              placeholder={rule.type === 'pattern' ? '^[a-zA-Z]+$' : '0'}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          )}
          {rule.type === 'format' && (
            <p className="text-xs text-gray-500 italic">Built-in format check (no value needed).</p>
          )}
          <input
            type="text"
            value={rule.message || ''}
            onChange={(e) => updateRule(idx, { message: e.target.value })}
            placeholder="Custom error message (optional)"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      ))}

      {availableRules.filter((r) => !rules.some((rule) => rule.type === r.type)).length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Add Rule</label>
          <select
            value=""
            onChange={(e) => e.target.value && addRule(e.target.value as FormValidationRule['type'])}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select rule type...</option>
            {availableRules
              .filter((r) => !rules.some((rule) => rule.type === r.type))
              .map((r) => (
                <option key={r.type} value={r.type}>{r.label}</option>
              ))}
          </select>
        </div>
      )}
    </div>
  );
}

function FormSettingsPanel({
  settings,
  onUpdate,
  availableFields,
}: {
  settings: FormSettings;
  onUpdate: (updates: Partial<FormSettings>) => void;
  availableFields: { id: string; label: string }[];
}) {
  const [activeSection, setActiveSection] = useState<'theme' | 'submission' | 'logic' | 'contacts' | 'spam' | 'notifications'>('theme');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1 p-1 bg-gray-100 rounded-lg">
        {[
          { id: 'theme', label: 'Theme' },
          { id: 'submission', label: 'Submit' },
          { id: 'logic', label: 'Logic' },
          { id: 'contacts', label: 'Contacts' },
          { id: 'spam', label: 'Spam' },
          { id: 'notifications', label: 'Notify' },
        ].map((section) => (
          <button
            key={section.id}
            onClick={() => setActiveSection(section.id as typeof activeSection)}
            className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeSection === section.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {section.label}
          </button>
        ))}
      </div>

      {activeSection === 'theme' && (
        <ThemePicker
          value={settings.theme}
          onChange={(theme) => onUpdate({ theme })}
        />
      )}

      {activeSection === 'logic' && (
        <SubmitRulesEditor
          rules={settings.submitRules || []}
          onChange={(submitRules) => onUpdate({ submitRules })}
          availableFields={availableFields}
        />
      )}

      {activeSection === 'submission' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Success Action</label>
            <select
              value={settings.successAction || 'message'}
              onChange={(e) => onUpdate({ successAction: e.target.value as FormSettings['successAction'] })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="message">Show message</option>
              <option value="redirect">Redirect to URL</option>
              <option value="both">Show message, then redirect</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Thank You Message</label>
            <textarea
              value={settings.thankYouMessage || ''}
              onChange={(e) => onUpdate({ thankYouMessage: e.target.value })}
              rows={3}
              placeholder="Thank you for your submission!"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {(settings.successAction === 'redirect' || settings.successAction === 'both') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Redirect URL</label>
              <input
                type="url"
                value={settings.redirectUrl || ''}
                onChange={(e) => onUpdate({ redirectUrl: e.target.value })}
                placeholder="https://..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}
        </div>
      )}

      {activeSection === 'contacts' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contact Matching</label>
            <select
              value={settings.contactMatching}
              onChange={(e) => onUpdate({ contactMatching: e.target.value as FormSettings['contactMatching'] })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="email_first">Match by Email first</option>
              <option value="phone_first">Match by Phone first</option>
              <option value="create_new">Always create new</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Field Overwrite</label>
            <select
              value={settings.fieldOverwrite}
              onChange={(e) => onUpdate({ fieldOverwrite: e.target.value as FormSettings['fieldOverwrite'] })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="always">Always overwrite</option>
              <option value="only_if_empty">Only if empty</option>
            </select>
          </div>

          <div className="pt-2 border-t border-gray-200">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.doubleOptInEnabled || false}
                onChange={(e) => onUpdate({ doubleOptInEnabled: e.target.checked })}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Enable double opt-in</span>
            </label>
            <p className="text-xs text-gray-500 mt-1 ml-6">
              Send confirmation email before creating contact
            </p>
          </div>
        </div>
      )}

      {activeSection === 'spam' && (
        <div className="space-y-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.honeypotEnabled ?? true}
              onChange={(e) => onUpdate({ honeypotEnabled: e.target.checked })}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Honeypot field</span>
          </label>

          <div className="pt-2 border-t border-gray-200">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.captchaEnabled || false}
                onChange={(e) =>
                  onUpdate({
                    captchaEnabled: e.target.checked,
                    captchaProvider: e.target.checked ? 'hcaptcha' : undefined,
                  })
                }
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Enable hCaptcha</span>
            </label>

            {settings.captchaEnabled && (
              <div className="mt-3 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">hCaptcha Site Key</label>
                  <input
                    type="text"
                    value={settings.captchaSiteKey || ''}
                    onChange={(e) => onUpdate({ captchaSiteKey: e.target.value })}
                    placeholder="10000000-ffff-ffff-ffff-000000000001"
                    className="w-full px-3 py-2 text-sm font-mono border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    The matching <code>HCAPTCHA_SECRET</code> must be set as a Supabase edge function secret.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-gray-200">
            <label className="block text-sm font-medium text-gray-700 mb-1">Rate Limit (per IP)</label>
            <select
              value={settings.rateLimitPerIp || 0}
              onChange={(e) => onUpdate({ rateLimitPerIp: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={0}>No limit</option>
              <option value={1}>1 per hour</option>
              <option value={3}>3 per hour</option>
              <option value={5}>5 per hour</option>
              <option value={10}>10 per hour</option>
            </select>
          </div>
        </div>
      )}

      {activeSection === 'notifications' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notification Emails</label>
            <textarea
              value={(settings.notificationEmails || []).join('\n')}
              onChange={(e) => onUpdate({
                notificationEmails: e.target.value.split('\n').filter(Boolean)
              })}
              rows={3}
              placeholder="email@example.com&#10;another@example.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">One email per line</p>
          </div>

          <div className="pt-2 border-t border-gray-200">
            <label className="block text-sm font-medium text-gray-700 mb-1">Webhook URL</label>
            <input
              type="url"
              value={settings.webhookUrl || ''}
              onChange={(e) => onUpdate({ webhookUrl: e.target.value })}
              placeholder="https://..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">POST submission data to this URL</p>
          </div>
        </div>
      )}
    </div>
  );
}

function FormPreview({ form }: { form: Form }) {
  const getWidthClass = (width: FormField['width']) => {
    switch (width) {
      case 'third': return 'w-1/3 inline-block align-top pr-2';
      case 'half': return 'w-1/2 inline-block align-top pr-2';
      case 'two_thirds': return 'w-2/3 inline-block align-top pr-2';
      default: return 'w-full';
    }
  };

  return (
    <div className="max-w-xl mx-auto">
      <div className="bg-white rounded-xl border border-gray-200 p-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">{form.name}</h2>
        {form.description && <p className="text-gray-500 mb-6">{form.description}</p>}

        <div className="space-y-4">
          {form.definition.fields.map((field) => (
            <div key={field.id} className={getWidthClass(field.width)}>
              {field.type === 'divider' ? (
                <div className="py-4">
                  <hr className="border-gray-200" />
                  {field.label && (
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mt-4">{field.label}</p>
                  )}
                </div>
              ) : field.type === 'column' ? (
                <div className="grid gap-3 py-2" style={{ gridTemplateColumns: `repeat(${field.columnCount || 2}, minmax(0, 1fr))` }}>
                  {Array.from({ length: field.columnCount || 2 }).map((_, i) => (
                    <div key={i} className="border border-dashed border-gray-300 rounded-lg p-4 text-center text-xs text-gray-400">
                      Column {i + 1}
                    </div>
                  ))}
                </div>
              ) : field.type === 'custom_html' ? (
                <div
                  className="prose prose-sm max-w-none border border-dashed border-gray-200 rounded-lg p-3"
                  dangerouslySetInnerHTML={{ __html: field.htmlContent || '<p class="text-gray-400 text-sm">Custom HTML</p>' }}
                />
              ) : field.type === 'hidden' ? null : (
                <>
                  {field.type !== 'checkbox' && field.type !== 'consent' && (
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {field.label}
                      {field.required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                  )}
                  {field.helpText && (
                    <p className="text-xs text-gray-500 mb-1">{field.helpText}</p>
                  )}

                  {field.type === 'textarea' ? (
                    <textarea
                      placeholder={field.placeholder}
                      rows={4}
                      maxLength={field.characterLimit}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : field.type === 'textbox_list' ? (
                    <div className="space-y-2">
                      {(field.options || [{ label: 'Item', value: '' }]).map((_, i) => (
                        <input
                          key={i}
                          type="text"
                          placeholder={`Item ${i + 1}`}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      ))}
                    </div>
                  ) : field.type === 'dropdown' || field.type === 'product_selection' ? (
                    <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">{field.placeholder || 'Select...'}</option>
                      {(field.options || []).map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  ) : field.type === 'multi_dropdown' ? (
                    <select multiple size={Math.min(5, (field.options || []).length || 3)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                      {(field.options || []).map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  ) : field.type === 'state' ? (
                    <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">{field.placeholder || 'Select state...'}</option>
                      {US_STATES.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  ) : field.type === 'country' ? (
                    <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">{field.placeholder || 'Select country...'}</option>
                      {COUNTRIES.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  ) : field.type === 'timezone' ? (
                    <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">{field.placeholder || 'Select timezone...'}</option>
                      {COMMON_TIMEZONES.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  ) : field.type === 'radio' ? (
                    <div className="space-y-2">
                      {(field.options || []).map((opt) => (
                        <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name={field.id}
                            value={opt.value}
                            className="text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  ) : field.type === 'multi_select' || field.type === 'checkbox_group' ? (
                    <div className="space-y-2">
                      {(field.options || []).map((opt) => (
                        <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                          <span className="text-sm text-gray-700">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  ) : field.type === 'checkbox' || field.type === 'consent' ? (
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mt-0.5" />
                      <span className="text-sm text-gray-700">{field.label}</span>
                    </label>
                  ) : field.type === 'file_upload' ? (
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors cursor-pointer">
                      <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                      <p className="text-sm text-gray-600">Click to upload or drag and drop</p>
                      <p className="text-xs text-gray-400 mt-1">
                        Max {Math.round((field.fileUploadConfig?.maxSizeBytes || 10485760) / 1048576)}MB
                      </p>
                    </div>
                  ) : field.type === 'monetary' ? (
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">{currencySymbol(field.currency)}</span>
                      <input
                        type="number"
                        step="0.01"
                        placeholder={field.placeholder || '0.00'}
                        className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  ) : field.type === 'payment' ? (
                    <div className="border border-gray-300 rounded-lg p-4 bg-gray-50 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-4 h-4" />
                        <span>Payment field — connect Stripe to collect payments here.</span>
                      </div>
                    </div>
                  ) : field.type === 'sms_verification' ? (
                    <div className="space-y-2">
                      <input type="tel" placeholder="Phone number" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      <div className="flex gap-2">
                        <input type="text" placeholder="Verification code" className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        <button type="button" className="px-3 py-2 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">Send code</button>
                      </div>
                    </div>
                  ) : field.type === 'email_validation' ? (
                    <div className="flex gap-2">
                      <input type="email" placeholder={field.placeholder || 'you@example.com'} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      <button type="button" className="px-3 py-2 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">Verify</button>
                    </div>
                  ) : field.type === 'math_calculation' ? (
                    <input type="text" readOnly placeholder={field.formula ? `= ${field.formula}` : 'Computed value'} className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-500" />
                  ) : (
                    <input
                      type={
                        field.type === 'email' ? 'email' :
                        field.type === 'phone' ? 'tel' :
                        field.type === 'number' ? 'number' :
                        field.type === 'date' ? 'date' :
                        field.type === 'website' ? 'url' :
                        'text'
                      }
                      placeholder={field.placeholder}
                      maxLength={field.characterLimit}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  )}
                </>
              )}
            </div>
          ))}

          <button type="button" className="w-full px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors">
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}

function EmbedModal({ form, onClose }: { form: Form; onClose: () => void }) {
  const [embedType, setEmbedType] = useState<'inline' | 'popup' | 'link'>('inline');
  const [copied, setCopied] = useState(false);

  const baseUrl = window.location.origin;
  const formUrl = `${baseUrl}/f/${form.public_slug}`;
  const containerId = `a8l-form-${form.public_slug}`;

  const getEmbedCode = () => {
    if (embedType === 'link') {
      return formUrl;
    }

    if (embedType === 'popup') {
      return `<script src="${baseUrl}/forms-widget.js"
  data-base-url="${baseUrl}"
  data-form-slug="${form.public_slug}"
  data-mode="popup"
  data-button-text="Get in touch"
  data-primary-color="#0891b2"></script>`;
    }

    return `<div id="${containerId}"></div>
<script src="${baseUrl}/forms-widget.js"
  data-base-url="${baseUrl}"
  data-form-slug="${form.public_slug}"
  data-mode="inline"
  data-target="#${containerId}"></script>`;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getEmbedCode());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Embed Form</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Embed Type</label>
            <div className="flex gap-2">
              {[
                { id: 'inline', label: 'Inline', desc: 'Embed directly in page' },
                { id: 'popup', label: 'Popup', desc: 'Floating button + modal' },
                { id: 'link', label: 'Link', desc: 'Share customer-facing URL' },
              ].map((type) => (
                <button
                  key={type.id}
                  onClick={() => setEmbedType(type.id as typeof embedType)}
                  className={`flex-1 p-3 rounded-lg border-2 text-left transition-colors ${
                    embedType === type.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-medium text-gray-900">{type.label}</div>
                  <div className="text-xs text-gray-500">{type.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                {embedType === 'link' ? 'Direct Link' : 'Embed Code'}
              </label>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                {copied ? 'Copied!' : <><Copy className="w-4 h-4" /> Copy</>}
              </button>
            </div>
            <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto whitespace-pre-wrap">
              {getEmbedCode()}
            </pre>
          </div>

          {embedType === 'link' && (
            <a
              href={formUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Open Form
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
