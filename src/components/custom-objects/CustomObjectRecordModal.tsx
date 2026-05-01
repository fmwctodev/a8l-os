import { useState } from 'react';
import { X, Loader2, Check } from 'lucide-react';
import type { CustomObjectDefinition, CustomObjectRecord, CustomObjectFieldDefinition } from '../../types';

export function CustomObjectRecordModal({
  def,
  record,
  onClose,
  onSave,
}: {
  def: CustomObjectDefinition;
  record: CustomObjectRecord | null;
  onClose: () => void;
  onSave: (values: Record<string, unknown>) => Promise<void>;
}) {
  const [values, setValues] = useState<Record<string, unknown>>(record?.values || {});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setValue(key: string, v: unknown) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      // Validate required
      for (const fd of def.field_definitions) {
        if (fd.required) {
          const v = values[fd.key];
          if (v === undefined || v === null || v === '') {
            setError(`${fd.label} is required`);
            setSaving(false);
            return;
          }
        }
      }
      await onSave(values);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900">
            {record ? `Edit ${def.name}` : `New ${def.name}`}
          </h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
          {def.field_definitions.map((fd) => (
            <FieldInput
              key={fd.key}
              fd={fd}
              value={values[fd.key]}
              onChange={(v) => setValue(fd.key, v)}
            />
          ))}
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
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function FieldInput({
  fd,
  value,
  onChange,
}: {
  fd: CustomObjectFieldDefinition;
  value: unknown;
  onChange: (next: unknown) => void;
}) {
  const cls =
    'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';
  const stringValue = value === undefined || value === null ? '' : String(value);

  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">
        {fd.label}
        {fd.required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {fd.type === 'textarea' ? (
        <textarea
          rows={3}
          value={stringValue}
          onChange={(e) => onChange(e.target.value)}
          className={cls}
        />
      ) : fd.type === 'number' || fd.type === 'currency' ? (
        <input
          type="number"
          step={fd.type === 'currency' ? '0.01' : 'any'}
          value={stringValue}
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
          className={cls}
        />
      ) : fd.type === 'date' ? (
        <input
          type="date"
          value={stringValue}
          onChange={(e) => onChange(e.target.value)}
          className={cls}
        />
      ) : fd.type === 'email' ? (
        <input
          type="email"
          value={stringValue}
          onChange={(e) => onChange(e.target.value)}
          className={cls}
        />
      ) : fd.type === 'phone' ? (
        <input
          type="tel"
          value={stringValue}
          onChange={(e) => onChange(e.target.value)}
          className={cls}
        />
      ) : fd.type === 'url' ? (
        <input
          type="url"
          value={stringValue}
          onChange={(e) => onChange(e.target.value)}
          className={cls}
        />
      ) : fd.type === 'select' ? (
        <select
          value={stringValue}
          onChange={(e) => onChange(e.target.value)}
          className={cls}
        >
          <option value="">— Select —</option>
          {(fd.options || []).map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      ) : fd.type === 'boolean' ? (
        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={value === true || value === 'true'}
            onChange={(e) => onChange(e.target.checked)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          Yes
        </label>
      ) : (
        <input
          type="text"
          value={stringValue}
          onChange={(e) => onChange(e.target.value)}
          className={cls}
        />
      )}
      {fd.help_text && (
        <p className="text-xs text-gray-500 mt-1">{fd.help_text}</p>
      )}
    </div>
  );
}
