import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { LayoutList, Plus, Users, Briefcase, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { usePermission } from '../../hooks/usePermission';
import { getCustomFieldGroupsWithFields } from '../../services/customFieldGroups';
import { getCustomFields } from '../../services/customFields';
import type { CustomFieldGroup, CustomField, CustomFieldScope } from '../../types';
import { FieldGroupsPanel } from '../../components/settings/custom-fields/FieldGroupsPanel';
import { FieldEditorDrawer } from '../../components/settings/custom-fields/FieldEditorDrawer';
import { FieldGroupModal } from '../../components/settings/custom-fields/FieldGroupModal';

const BLOCKED_ROLES = ['Team Lead', 'Agent'];

export function CustomFieldsSettingsPage() {
  const { user } = useAuth();
  const canManage = usePermission('custom_fields.manage');
  const canView = usePermission('custom_fields.view');
  const [activeTab, setActiveTab] = useState<CustomFieldScope>('contact');
  const [groups, setGroups] = useState<CustomFieldGroup[]>([]);
  const [ungroupedFields, setUngroupedFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFieldDrawer, setShowFieldDrawer] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [editingField, setEditingField] = useState<CustomField | null>(null);
  const [editingGroup, setEditingGroup] = useState<CustomFieldGroup | null>(null);

  const roleName = user?.role?.name;
  const isBlocked = roleName && BLOCKED_ROLES.includes(roleName);
  const isViewOnly = !canManage && canView;

  useEffect(() => {
    loadData();
  }, [activeTab, user?.organization_id]);

  async function loadData() {
    if (!user?.organization_id) return;

    setLoading(true);
    try {
      const [groupsData, fieldsData] = await Promise.all([
        getCustomFieldGroupsWithFields(user.organization_id, activeTab),
        getCustomFields(user.organization_id, { scope: activeTab, groupId: null, active: true }),
      ]);
      setGroups(groupsData);
      setUngroupedFields(fieldsData);
    } catch (err) {
      console.error('Failed to load custom fields:', err);
    } finally {
      setLoading(false);
    }
  }

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

  if (isBlocked) {
    return <Navigate to="/unauthorized" replace />;
  }

  const tabs: { id: CustomFieldScope; label: string; icon: React.ReactNode }[] = [
    { id: 'contact', label: 'Contact Fields', icon: <Users className="w-4 h-4" /> },
    { id: 'opportunity', label: 'Opportunity Fields', icon: <Briefcase className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-700 rounded-lg">
            <LayoutList className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-white">Custom Fields</h1>
            <p className="text-sm text-slate-400">
              Create and manage custom data fields
            </p>
          </div>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleCreateGroup}
              className="px-4 py-2 text-sm font-medium text-slate-300 border border-slate-600 rounded-lg hover:bg-slate-700 transition-colors"
            >
              Add Group
            </button>
            <button
              onClick={handleCreateField}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-cyan-500 to-teal-600 rounded-lg hover:from-cyan-600 hover:to-teal-700 transition-all"
            >
              <Plus className="w-4 h-4" />
              Add Field
            </button>
          </div>
        )}
      </div>

      {isViewOnly && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 flex items-center gap-3">
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

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500" />
        </div>
      ) : (
        <FieldGroupsPanel
          scope={activeTab}
          groups={groups}
          ungroupedFields={ungroupedFields}
          canManage={canManage}
          onEditField={handleEditField}
          onEditGroup={handleEditGroup}
          onRefresh={loadData}
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
    </div>
  );
}
