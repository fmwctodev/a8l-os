import { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  Edit,
  Trash2,
  Copy,
  ToggleLeft,
  ToggleRight,
  GripVertical,
  FolderOpen,
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import type { CustomFieldGroup, CustomField, CustomFieldScope } from '../../../types';
import { CUSTOM_FIELD_TYPE_LABELS } from '../../../types';
import {
  softDeleteCustomField,
  duplicateCustomField,
  toggleCustomFieldActive,
} from '../../../services/customFields';
import { deleteCustomFieldGroup } from '../../../services/customFieldGroups';

interface FieldGroupsPanelProps {
  scope: CustomFieldScope;
  groups: CustomFieldGroup[];
  ungroupedFields: CustomField[];
  canManage: boolean;
  onEditField: (field: CustomField) => void;
  onEditGroup: (group: CustomFieldGroup) => void;
  onRefresh: () => void;
}

export function FieldGroupsPanel({
  groups,
  ungroupedFields,
  canManage,
  onEditField,
  onEditGroup,
  onRefresh,
}: FieldGroupsPanelProps) {
  const { user } = useAuth();
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(groups.map((g) => g.id))
  );
  const [fieldMenuOpen, setFieldMenuOpen] = useState<string | null>(null);
  const [groupMenuOpen, setGroupMenuOpen] = useState<string | null>(null);

  function toggleGroupExpanded(groupId: string) {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  }

  async function handleDeleteField(field: CustomField) {
    if (!user || !confirm(`Are you sure you want to delete "${field.name}"?`)) return;

    try {
      await softDeleteCustomField(field.id, user);
      onRefresh();
    } catch (err) {
      console.error('Failed to delete field:', err);
      alert('Failed to delete field');
    }
    setFieldMenuOpen(null);
  }

  async function handleDuplicateField(field: CustomField) {
    if (!user) return;

    try {
      await duplicateCustomField(field.id, user);
      onRefresh();
    } catch (err) {
      console.error('Failed to duplicate field:', err);
      alert('Failed to duplicate field');
    }
    setFieldMenuOpen(null);
  }

  async function handleToggleFieldActive(field: CustomField) {
    if (!user) return;

    try {
      await toggleCustomFieldActive(field.id, !field.active, user);
      onRefresh();
    } catch (err) {
      console.error('Failed to toggle field:', err);
      alert('Failed to update field');
    }
    setFieldMenuOpen(null);
  }

  async function handleDeleteGroup(group: CustomFieldGroup) {
    if (!user) return;

    const fieldCount = group.fields?.length || 0;
    if (fieldCount > 0) {
      alert(
        `Cannot delete group "${group.name}" because it contains ${fieldCount} field(s). Move or delete the fields first.`
      );
      return;
    }

    if (!confirm(`Are you sure you want to delete the group "${group.name}"?`)) return;

    try {
      await deleteCustomFieldGroup(group.id, user);
      onRefresh();
    } catch (err) {
      console.error('Failed to delete group:', err);
      alert('Failed to delete group');
    }
    setGroupMenuOpen(null);
  }

  function renderField(field: CustomField) {
    return (
      <div
        key={field.id}
        className={`flex items-center justify-between px-4 py-3 border-b border-slate-100 last:border-b-0 ${
          !field.active ? 'opacity-50' : ''
        }`}
      >
        <div className="flex items-center gap-3">
          {canManage && (
            <GripVertical className="w-4 h-4 text-slate-300 cursor-move" />
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-slate-900">{field.name}</span>
              {field.is_required && (
                <span className="px-1.5 py-0.5 text-xs font-medium text-red-700 bg-red-50 rounded">
                  Required
                </span>
              )}
              {!field.active && (
                <span className="px-1.5 py-0.5 text-xs font-medium text-slate-500 bg-slate-100 rounded">
                  Inactive
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-0.5 text-sm text-slate-500">
              <span className="font-mono text-xs">{field.field_key}</span>
              <span className="text-slate-300">|</span>
              <span>{CUSTOM_FIELD_TYPE_LABELS[field.field_type]}</span>
            </div>
          </div>
        </div>
        {canManage && (
          <div className="relative">
            <button
              onClick={() => setFieldMenuOpen(fieldMenuOpen === field.id ? null : field.id)}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
            {fieldMenuOpen === field.id && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setFieldMenuOpen(null)}
                />
                <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50">
                  <button
                    onClick={() => {
                      onEditField(field);
                      setFieldMenuOpen(null);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <Edit className="w-4 h-4" />
                    Edit
                  </button>
                  <button
                    onClick={() => handleDuplicateField(field)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <Copy className="w-4 h-4" />
                    Duplicate
                  </button>
                  <button
                    onClick={() => handleToggleFieldActive(field)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    {field.active ? (
                      <>
                        <ToggleLeft className="w-4 h-4" />
                        Disable
                      </>
                    ) : (
                      <>
                        <ToggleRight className="w-4 h-4" />
                        Enable
                      </>
                    )}
                  </button>
                  <hr className="my-1 border-slate-200" />
                  <button
                    onClick={() => handleDeleteField(field)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  function renderGroup(group: CustomFieldGroup) {
    const isExpanded = expandedGroups.has(group.id);
    const fields = group.fields || [];

    return (
      <div key={group.id} className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div
          className="flex items-center justify-between px-4 py-3 bg-slate-50 cursor-pointer"
          onClick={() => toggleGroupExpanded(group.id)}
        >
          <div className="flex items-center gap-3">
            {canManage && (
              <GripVertical className="w-4 h-4 text-slate-300 cursor-move" />
            )}
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-slate-400" />
            )}
            <span className="font-medium text-slate-900">{group.name}</span>
            <span className="text-sm text-slate-500">({fields.length} fields)</span>
          </div>
          {canManage && (
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setGroupMenuOpen(groupMenuOpen === group.id ? null : group.id)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded transition-colors"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
              {groupMenuOpen === group.id && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setGroupMenuOpen(null)}
                  />
                  <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50">
                    <button
                      onClick={() => {
                        onEditGroup(group);
                        setGroupMenuOpen(null);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      <Edit className="w-4 h-4" />
                      Edit Group
                    </button>
                    <hr className="my-1 border-slate-200" />
                    <button
                      onClick={() => handleDeleteGroup(group)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete Group
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
        {isExpanded && (
          <div>
            {fields.length === 0 ? (
              <div className="px-4 py-8 text-center text-slate-500">
                No fields in this group
              </div>
            ) : (
              fields.map(renderField)
            )}
          </div>
        )}
      </div>
    );
  }

  const hasAnyFields = groups.some((g) => (g.fields?.length || 0) > 0) || ungroupedFields.length > 0;

  if (!hasAnyFields && groups.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
        <div className="flex justify-center mb-4">
          <div className="p-4 bg-slate-100 rounded-full">
            <FolderOpen className="w-8 h-8 text-slate-400" />
          </div>
        </div>
        <h3 className="text-lg font-medium text-slate-900 mb-2">No custom fields yet</h3>
        <p className="text-slate-500 mb-6 max-w-md mx-auto">
          Create custom fields to capture additional information specific to your business needs.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map(renderGroup)}

      {ungroupedFields.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
            <span className="font-medium text-slate-500">Ungrouped Fields</span>
            <span className="text-sm text-slate-400 ml-2">
              ({ungroupedFields.length} fields)
            </span>
          </div>
          <div>{ungroupedFields.map(renderField)}</div>
        </div>
      )}
    </div>
  );
}
