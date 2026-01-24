import { useState, useEffect, useMemo, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { LayoutList, Plus, Users, Briefcase, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { usePermission } from '../../hooks/usePermission';
import {
  getCustomFieldGroupsWithFields,
  updateCustomFieldGroup,
  deleteCustomFieldGroup,
  reorderCustomFieldGroups,
  ensureDefaultGroups,
} from '../../services/customFieldGroups';
import {
  getCustomFields,
  softDeleteCustomField,
  duplicateCustomField,
  toggleCustomFieldActive,
  getFieldValueCount,
  reorderCustomFields,
  moveFieldToGroup,
  bulkMoveFields,
  bulkDeleteFields,
  bulkToggleFieldsActive,
} from '../../services/customFields';
import type { CustomFieldGroup, CustomField, CustomFieldScope } from '../../types';
import { FieldGroupSidebar } from '../../components/settings/custom-fields/FieldGroupSidebar';
import { FieldListPanel } from '../../components/settings/custom-fields/FieldListPanel';
import { FieldEditorDrawer } from '../../components/settings/custom-fields/FieldEditorDrawer';
import { FieldGroupModal } from '../../components/settings/custom-fields/FieldGroupModal';
import { MoveToGroupModal } from '../../components/settings/custom-fields/MoveToGroupModal';
import { BulkActionsBar, BulkDeleteConfirmModal } from '../../components/settings/custom-fields/BulkActionsBar';
import { DependencyWarningModal } from '../../components/settings/custom-fields/DependencyWarningModal';

const BLOCKED_ROLES = ['Team Lead', 'Agent'];

export function CustomFieldsSettingsPage() {
  const { user } = useAuth();
  const canManage = usePermission('custom_fields.manage');
  const canView = usePermission('custom_fields.view');

  const [activeTab, setActiveTab] = useState<CustomFieldScope>('contact');
  const [groups, setGroups] = useState<CustomFieldGroup[]>([]);
  const [ungroupedFields, setUngroupedFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedFieldIds, setSelectedFieldIds] = useState<Set<string>>(new Set());

  const [showFieldDrawer, setShowFieldDrawer] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);

  const [editingField, setEditingField] = useState<CustomField | null>(null);
  const [editingGroup, setEditingGroup] = useState<CustomFieldGroup | null>(null);
  const [movingField, setMovingField] = useState<CustomField | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<CustomField | null>(null);
  const [deleteValueCount, setDeleteValueCount] = useState(0);
  const [deleting, setDeleting] = useState(false);

  const roleName = user?.role?.name;
  const isBlocked = roleName && BLOCKED_ROLES.includes(roleName);
  const isViewOnly = !canManage && canView;

  const displayedFields = useMemo(() => {
    if (selectedGroupId === null) {
      const allFields: CustomField[] = [];
      groups.forEach((g) => {
        if (g.fields) {
          allFields.push(...g.fields);
        }
      });
      allFields.push(...ungroupedFields);
      return allFields.sort((a, b) => a.display_order - b.display_order);
    }

    if (selectedGroupId === 'ungrouped') {
      return ungroupedFields;
    }

    const group = groups.find((g) => g.id === selectedGroupId);
    return group?.fields || [];
  }, [selectedGroupId, groups, ungroupedFields]);

  const loadData = useCallback(async () => {
    if (!user?.organization_id) return;

    setLoading(true);
    try {
      let [groupsData, fieldsData] = await Promise.all([
        getCustomFieldGroupsWithFields(user.organization_id, activeTab),
        getCustomFields(user.organization_id, { scope: activeTab, groupId: null, active: undefined }),
      ]);

      if (groupsData.length === 0 && canManage) {
        groupsData = await ensureDefaultGroups(user.organization_id, activeTab, user);
      }

      setGroups(groupsData);
      setUngroupedFields(fieldsData.filter((f) => !f.deleted_at));
    } catch (err) {
      console.error('Failed to load custom fields:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.organization_id, activeTab, canManage, user]);

  useEffect(() => {
    loadData();
    setSelectedGroupId(null);
    setSelectedFieldIds(new Set());
  }, [loadData]);

  function handleCreateField() {
    setEditingField(null);
    setShowFieldDrawer(true);
  }

  function handleEditField(field: CustomField) {
    setEditingField(field);
    setShowFieldDrawer(true);
  }

  function handleCreateGroup() {
    setEditingGroup(null);
    setShowGroupModal(true);
  }

  function handleEditGroup(group: CustomFieldGroup) {
    setEditingGroup(group);
    setShowGroupModal(true);
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
      loadData();
    } catch (err) {
      console.error('Failed to delete group:', err);
      alert('Failed to delete group');
    }
  }

  async function handleReorderGroups(groupIds: string[]) {
    if (!user) return;

    try {
      await reorderCustomFieldGroups(user.organization_id, activeTab, groupIds, user);
      loadData();
    } catch (err) {
      console.error('Failed to reorder groups:', err);
    }
  }

  async function handleReorderFields(fieldIds: string[]) {
    if (!user) return;

    const groupId = selectedGroupId === 'ungrouped' ? null : selectedGroupId;
    try {
      await reorderCustomFields(groupId, fieldIds, user);
      loadData();
    } catch (err) {
      console.error('Failed to reorder fields:', err);
    }
  }

  async function handleDuplicateField(field: CustomField) {
    if (!user) return;

    try {
      await duplicateCustomField(field.id, user);
      loadData();
    } catch (err) {
      console.error('Failed to duplicate field:', err);
      alert('Failed to duplicate field');
    }
  }

  async function handleToggleFieldActive(field: CustomField) {
    if (!user) return;

    try {
      await toggleCustomFieldActive(field.id, !field.active, user);
      loadData();
    } catch (err) {
      console.error('Failed to toggle field:', err);
      alert('Failed to update field');
    }
  }

  async function handleDeleteClick(field: CustomField) {
    const count = await getFieldValueCount(field.id, activeTab);
    setDeleteValueCount(count);
    setDeleteTarget(field);
  }

  async function handleConfirmDelete() {
    if (!user || !deleteTarget) return;

    setDeleting(true);
    try {
      await softDeleteCustomField(deleteTarget.id, user);
      loadData();
    } catch (err) {
      console.error('Failed to delete field:', err);
      alert('Failed to delete field');
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  function handleMoveField(field: CustomField) {
    setMovingField(field);
    setShowMoveModal(true);
  }

  async function handleMoveFieldConfirm(targetGroupId: string | null) {
    if (!user || !movingField) return;

    await moveFieldToGroup(movingField.id, targetGroupId, user);
    setMovingField(null);
    setShowMoveModal(false);
    loadData();
  }

  function handleFieldSaved() {
    setShowFieldDrawer(false);
    setEditingField(null);
    loadData();
  }

  function handleGroupSaved() {
    setShowGroupModal(false);
    setEditingGroup(null);
    loadData();
  }

  function handleToggleFieldSelection(fieldId: string) {
    const newSelected = new Set(selectedFieldIds);
    if (newSelected.has(fieldId)) {
      newSelected.delete(fieldId);
    } else {
      newSelected.add(fieldId);
    }
    setSelectedFieldIds(newSelected);
  }

  function handleSelectAll() {
    setSelectedFieldIds(new Set(displayedFields.map((f) => f.id)));
  }

  function handleClearSelection() {
    setSelectedFieldIds(new Set());
  }

  function handleBulkMove() {
    setMovingField(null);
    setShowMoveModal(true);
  }

  async function handleBulkMoveConfirm(targetGroupId: string | null) {
    if (!user) return;

    await bulkMoveFields(Array.from(selectedFieldIds), targetGroupId, user);
    setShowMoveModal(false);
    setSelectedFieldIds(new Set());
    loadData();
  }

  async function handleBulkEnable() {
    if (!user) return;
    await bulkToggleFieldsActive(Array.from(selectedFieldIds), true, user);
    setSelectedFieldIds(new Set());
    loadData();
  }

  async function handleBulkDisable() {
    if (!user) return;
    await bulkToggleFieldsActive(Array.from(selectedFieldIds), false, user);
    setSelectedFieldIds(new Set());
    loadData();
  }

  async function handleBulkDeleteConfirm() {
    if (!user) return;
    await bulkDeleteFields(Array.from(selectedFieldIds), user);
    setShowBulkDeleteModal(false);
    setSelectedFieldIds(new Set());
    loadData();
  }

  if (isBlocked) {
    return <Navigate to="/unauthorized" replace />;
  }

  const tabs: { id: CustomFieldScope; label: string; icon: React.ReactNode }[] = [
    { id: 'contact', label: 'Contact Fields', icon: <Users className="w-4 h-4" /> },
    { id: 'opportunity', label: 'Opportunity Fields', icon: <Briefcase className="w-4 h-4" /> },
  ];

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 px-6 pt-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-700 rounded-lg">
              <LayoutList className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-white">Custom Fields</h1>
              <p className="text-sm text-slate-400">Create and manage custom data fields</p>
            </div>
          </div>
          {canManage && (
            <button
              onClick={handleCreateField}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-cyan-500 to-teal-600 rounded-lg hover:from-cyan-600 hover:to-teal-700 transition-all"
            >
              <Plus className="w-4 h-4" />
              Add Field
            </button>
          )}
        </div>

        {isViewOnly && (
          <div className="mb-4 bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <p className="text-amber-400 text-sm">
              You have view-only access to custom fields. Contact an administrator to make changes.
            </p>
          </div>
        )}

        <div className="border-b border-slate-700">
          <nav className="flex gap-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-cyan-500 text-cyan-400'
                    : 'border-transparent text-slate-400 hover:text-white hover:border-slate-600'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden border-t border-slate-700 mt-0">
        <FieldGroupSidebar
          scope={activeTab}
          groups={groups}
          ungroupedFields={ungroupedFields}
          selectedGroupId={selectedGroupId}
          onSelectGroup={setSelectedGroupId}
          onEditGroup={handleEditGroup}
          onDeleteGroup={handleDeleteGroup}
          onCreateGroup={handleCreateGroup}
          onReorderGroups={handleReorderGroups}
          canManage={canManage}
        />

        <FieldListPanel
          fields={displayedFields}
          groups={groups}
          selectedGroupId={selectedGroupId}
          selectedFieldIds={selectedFieldIds}
          onToggleFieldSelection={handleToggleFieldSelection}
          onSelectAll={handleSelectAll}
          onClearSelection={handleClearSelection}
          onEditField={handleEditField}
          onDuplicateField={handleDuplicateField}
          onToggleFieldActive={handleToggleFieldActive}
          onDeleteField={handleDeleteClick}
          onMoveField={handleMoveField}
          onReorderFields={handleReorderFields}
          canManage={canManage}
          loading={loading}
        />
      </div>

      {canManage && selectedFieldIds.size > 0 && (
        <BulkActionsBar
          selectedCount={selectedFieldIds.size}
          onClearSelection={handleClearSelection}
          onBulkMove={handleBulkMove}
          onBulkEnable={handleBulkEnable}
          onBulkDisable={handleBulkDisable}
          onBulkDelete={() => setShowBulkDeleteModal(true)}
        />
      )}

      {showFieldDrawer && (
        <FieldEditorDrawer
          scope={activeTab}
          field={editingField}
          groups={groups}
          onClose={() => {
            setShowFieldDrawer(false);
            setEditingField(null);
          }}
          onSaved={handleFieldSaved}
        />
      )}

      {showGroupModal && (
        <FieldGroupModal
          scope={activeTab}
          group={editingGroup}
          onClose={() => {
            setShowGroupModal(false);
            setEditingGroup(null);
          }}
          onSaved={handleGroupSaved}
        />
      )}

      {showMoveModal && (
        <MoveToGroupModal
          field={movingField}
          fieldCount={movingField ? 1 : selectedFieldIds.size}
          groups={groups}
          currentGroupId={movingField?.group_id || null}
          onMove={movingField ? handleMoveFieldConfirm : handleBulkMoveConfirm}
          onClose={() => {
            setShowMoveModal(false);
            setMovingField(null);
          }}
        />
      )}

      {showBulkDeleteModal && (
        <BulkDeleteConfirmModal
          fieldCount={selectedFieldIds.size}
          onConfirm={handleBulkDeleteConfirm}
          onCancel={() => setShowBulkDeleteModal(false)}
        />
      )}

      {deleteTarget && (
        <DependencyWarningModal
          field={deleteTarget}
          valueCount={deleteValueCount}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteTarget(null)}
          deleting={deleting}
        />
      )}
    </div>
  );
}
