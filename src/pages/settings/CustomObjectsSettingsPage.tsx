import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, X, Loader2, Database, Check, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  getCustomObjectDefinitions,
  createCustomObjectDefinition,
  updateCustomObjectDefinition,
  softDeleteCustomObjectDefinition,
  generateObjectFieldKey,
} from '../../services/customObjects';
import type {
  CustomObjectDefinition,
  CustomObjectFieldDefinition,
  CustomObjectFieldType,
} from '../../types';

const FIELD_TYPES: { value: CustomObjectFieldType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'textarea', label: 'Long text' },
  { value: 'number', label: 'Number' },
  { value: 'currency', label: 'Currency' },
  { value: 'date', label: 'Date' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'url', label: 'URL' },
  { value: 'select', label: 'Dropdown' },
  { value: 'boolean', label: 'Yes / No' },
];

export function CustomObjectsSettingsPage() {
  const { user } = useAuth();
  const [defs, setDefs] = useState<CustomObjectDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(() => defs.find((d) => d.id === selectedId) || null, [defs, selectedId]);

  useEffect(() => {
    if (!user?.organization_id) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await getCustomObjectDefinitions(user.organization_id, { includeInactive: true });
        if (cancelled) return;
        setDefs(list);
        if (!selectedId && list.length > 0) setSelectedId(list[0].id);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load custom objects');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.organization_id]);

  async function handleSaveDefinition(updates: Partial<CustomObjectDefinition>) {
    if (!selected) return;
    try {
      const next = await updateCustomObjectDefinition(selected.id, {
        name: updates.name,
        icon: updates.icon ?? null,
        primary_field_key: updates.primary_field_key,
        field_definitions: updates.field_definitions,
        active: updates.active,
      });
      setDefs((prev) => prev.map((d) => (d.id === next.id ? next : d)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save object');
    }
  }

  async function handleDelete(def: CustomObjectDefinition) {
    if (def.is_builtin) return;
    if (!confirm(`Delete the "${def.name}" object? Existing records remain but will become orphaned.`)) return;
    try {
      await softDeleteCustomObjectDefinition(def.id);
      setDefs((prev) => prev.filter((d) => d.id !== def.id));
      if (selectedId === def.id) setSelectedId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete object');
    }
  }

  async function handleCreate(input: {
    slug: string;
    name: string;
    icon?: string;
    primary_field_key: string;
    field_definitions: CustomObjectFieldDefinition[];
  }) {
    if (!user?.organization_id) return;
    try {
      const def = await createCustomObjectDefinition(user.organization_id, input);
      setDefs((prev) => [...prev, def]);
      setSelectedId(def.id);
      setShowCreate(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create object');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 text-gray-900">
            <Database className="w-5 h-5" />
            <h1 className="text-2xl font-semibold">Custom Objects</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Define reusable record types like Company or Property. Forms and surveys can map fields to objects so submissions populate them automatically.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
        >
          <Plus className="w-4 h-4" /> New custom object
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 mt-0.5" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 sm:col-span-4">
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            {defs.length === 0 ? (
              <div className="p-6 text-sm text-gray-500 text-center">No objects yet.</div>
            ) : (
              defs.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setSelectedId(d.id)}
                  className={`w-full text-left px-3 py-2.5 border-b border-gray-100 last:border-b-0 flex items-center justify-between transition-colors ${
                    selectedId === d.id ? 'bg-blue-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <div>
                    <div className="text-sm font-medium text-gray-900">{d.name}</div>
                    <div className="text-xs text-gray-500">
                      {d.field_definitions.length} fields · {d.is_builtin ? 'Built-in' : 'Custom'}
                    </div>
                  </div>
                  {!d.is_builtin && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(d);
                      }}
                      className="p-1 text-gray-400 hover:text-red-500 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        <div className="col-span-12 sm:col-span-8">
          {selected ? (
            <ObjectDefinitionEditor
              key={selected.id}
              def={selected}
              onSave={handleSaveDefinition}
            />
          ) : (
            <div className="p-8 bg-white border border-gray-200 rounded-lg text-sm text-gray-500 text-center">
              Select an object on the left to edit its fields.
            </div>
          )}
        </div>
      </div>

      {showCreate && (
        <CreateObjectModal
          onClose={() => setShowCreate(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  );
}

function ObjectDefinitionEditor({
  def,
  onSave,
}: {
  def: CustomObjectDefinition;
  onSave: (updates: Partial<CustomObjectDefinition>) => Promise<void>;
}) {
  const [name, setName] = useState(def.name);
  const [icon, setIcon] = useState(def.icon || '');
  const [fields, setFields] = useState<CustomObjectFieldDefinition[]>(def.field_definitions);
  const [primaryKey, setPrimaryKey] = useState(def.primary_field_key);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const dirty =
    name !== def.name ||
    (icon || '') !== (def.icon || '') ||
    primaryKey !== def.primary_field_key ||
    JSON.stringify(fields) !== JSON.stringify(def.field_definitions);

  const updateField = (idx: number, patch: Partial<CustomObjectFieldDefinition>) => {
    setFields((prev) => prev.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  };

  const addField = () => {
    const newKey = generateObjectFieldKey(`field_${fields.length + 1}`);
    setFields((prev) => [...prev, { key: newKey, label: 'New field', type: 'text' }]);
  };

  const removeField = (idx: number) => {
    const next = fields.filter((_, i) => i !== idx);
    setFields(next);
    if (fields[idx]?.key === primaryKey && next[0]) {
      setPrimaryKey(next[0].key);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave({
      name,
      icon: icon || null,
      primary_field_key: primaryKey,
      field_definitions: fields.map((f, idx) => ({
        ...f,
        key: f.key || generateObjectFieldKey(f.label || `field_${idx + 1}`),
        is_primary: f.key === primaryKey,
      })),
    });
    setSaving(false);
    setSavedAt(Date.now());
    setTimeout(() => setSavedAt(null), 1500);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="p-4 border-b border-gray-200 flex items-center gap-3">
        <div className="flex-1">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={def.is_builtin}
            placeholder="Object name"
            className="w-full px-3 py-2 text-base font-medium border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
          />
        </div>
        <input
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
          placeholder="Icon (lucide name)"
          className="w-40 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleSave}
          disabled={!dirty || saving}
          className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : savedAt ? <Check className="w-4 h-4" /> : null}
          {saving ? 'Saving' : savedAt ? 'Saved' : 'Save'}
        </button>
      </div>

      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-900">Fields</h3>
          <button
            type="button"
            onClick={addField}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded"
          >
            <Plus className="w-3 h-3" /> Add field
          </button>
        </div>
        <div className="space-y-2">
          {fields.map((f, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-gray-50 rounded-lg p-2">
              <input
                value={f.label}
                onChange={(e) => {
                  updateField(idx, { label: e.target.value });
                  if (!f.key || f.key === generateObjectFieldKey(f.label)) {
                    updateField(idx, { key: generateObjectFieldKey(e.target.value) });
                  }
                }}
                placeholder="Label"
                className="col-span-4 px-2 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                value={f.key}
                onChange={(e) => updateField(idx, { key: generateObjectFieldKey(e.target.value) })}
                placeholder="key"
                className="col-span-3 px-2 py-1.5 text-sm font-mono border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <select
                value={f.type}
                onChange={(e) => updateField(idx, { type: e.target.value as CustomObjectFieldType })}
                className="col-span-3 px-2 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {FIELD_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <label className="col-span-1 flex items-center justify-center text-xs text-gray-600 cursor-pointer">
                <input
                  type="radio"
                  name={`primary-${def.id}`}
                  checked={f.key === primaryKey}
                  onChange={() => setPrimaryKey(f.key)}
                  className="text-blue-600 focus:ring-blue-500"
                />
              </label>
              <button
                type="button"
                onClick={() => removeField(idx)}
                disabled={fields.length === 1}
                className="col-span-1 p-1 text-gray-400 hover:text-red-500 disabled:opacity-30 rounded"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          {fields.length === 0 && (
            <p className="text-sm text-gray-500 italic text-center py-4">No fields yet.</p>
          )}
          <p className="text-xs text-gray-500 mt-2">
            The radio column marks the primary field — its value is stored in <code>primary_value</code> for fast indexing.
          </p>
        </div>
      </div>
    </div>
  );
}

function CreateObjectModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (input: {
    slug: string;
    name: string;
    icon?: string;
    primary_field_key: string;
    field_definitions: CustomObjectFieldDefinition[];
  }) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [icon, setIcon] = useState('');
  const [saving, setSaving] = useState(false);

  const computedSlug = slug || name.toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');

  const handleCreate = async () => {
    if (!name.trim() || !computedSlug) return;
    setSaving(true);
    await onCreate({
      slug: computedSlug,
      name: name.trim(),
      icon: icon || undefined,
      primary_field_key: 'name',
      field_definitions: [
        { key: 'name', label: 'Name', type: 'text', required: true, is_primary: true },
      ],
    });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900">New custom object</h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Property"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Slug</label>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_]+/g, '_'))}
              placeholder={computedSlug || 'property'}
              className="w-full px-3 py-2 text-sm font-mono border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">Used internally to reference this object.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Icon (optional)</label>
            <input
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="lucide icon name (e.g. Home)"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
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
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
