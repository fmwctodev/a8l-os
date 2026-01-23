import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Edit3, Check, X } from 'lucide-react';
import type { CustomField, CustomFieldGroup } from '../../types';
import { CustomFieldInput } from './CustomFieldInput';
import { formatFieldValue } from '../../services/customFields';

interface CustomFieldsSectionProps {
  groups: CustomFieldGroup[];
  ungroupedFields: CustomField[];
  values: Record<string, unknown>;
  onSave?: (values: Record<string, unknown>) => Promise<void>;
  canEdit?: boolean;
}

export function CustomFieldsSection({
  groups,
  ungroupedFields,
  values,
  onSave,
  canEdit = false,
}: CustomFieldsSectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValues, setEditValues] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(groups.map((g) => g.id))
  );

  useEffect(() => {
    if (isEditing) {
      setEditValues({ ...values });
    }
  }, [isEditing, values]);

  function toggleGroup(groupId: string) {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  }

  async function handleSave() {
    if (!onSave) return;

    setSaving(true);
    try {
      await onSave(editValues);
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to save custom fields:', err);
      alert('Failed to save changes');
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setEditValues({});
    setIsEditing(false);
  }

  function renderFieldValue(field: CustomField) {
    const val = values[field.id];
    if (val === null || val === undefined) {
      return <span className="text-slate-400 italic">Not set</span>;
    }
    return <span className="text-slate-900">{formatFieldValue(field, val)}</span>;
  }

  function renderField(field: CustomField) {
    if (isEditing) {
      return (
        <CustomFieldInput
          key={field.id}
          field={field}
          value={editValues[field.id]}
          onChange={(val) => setEditValues((prev) => ({ ...prev, [field.id]: val }))}
        />
      );
    }

    return (
      <div key={field.id} className="py-2">
        <dt className="text-sm font-medium text-slate-500">{field.name}</dt>
        <dd className="mt-0.5 text-sm">{renderFieldValue(field)}</dd>
      </div>
    );
  }

  function renderGroup(group: CustomFieldGroup) {
    const fields = group.fields?.filter((f) => f.active) || [];
    if (fields.length === 0) return null;

    const isExpanded = expandedGroups.has(group.id);

    return (
      <div key={group.id} className="border-b border-slate-100 last:border-b-0">
        <button
          onClick={() => toggleGroup(group.id)}
          className="w-full flex items-center justify-between py-3 text-left"
        >
          <span className="text-sm font-medium text-slate-700">{group.name}</span>
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-400" />
          )}
        </button>
        {isExpanded && (
          <dl className={`pb-4 ${isEditing ? 'space-y-4' : 'space-y-1'}`}>
            {fields.map(renderField)}
          </dl>
        )}
      </div>
    );
  }

  const allFields = [
    ...groups.flatMap((g) => g.fields?.filter((f) => f.active) || []),
    ...ungroupedFields.filter((f) => f.active),
  ];

  if (allFields.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
        <h3 className="text-sm font-semibold text-slate-900">Custom Fields</h3>
        {canEdit && onSave && (
          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <button
                  onClick={handleCancel}
                  disabled={saving}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="p-1.5 text-green-600 hover:text-green-700 hover:bg-green-50 rounded transition-colors"
                >
                  <Check className="w-4 h-4" />
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
              >
                <Edit3 className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>
      <div className="px-4">
        {groups.map(renderGroup)}

        {ungroupedFields.length > 0 && (
          <div className="py-3 border-t border-slate-100 first:border-t-0">
            <dl className={isEditing ? 'space-y-4' : 'space-y-1'}>
              {ungroupedFields.filter((f) => f.active).map(renderField)}
            </dl>
          </div>
        )}
      </div>
    </div>
  );
}
