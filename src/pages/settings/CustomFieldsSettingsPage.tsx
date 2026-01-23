import { useState, useEffect } from 'react';
import { LayoutList, Plus, Users, Briefcase } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { usePermission } from '../../hooks/usePermission';
import { getCustomFieldGroupsWithFields } from '../../services/customFieldGroups';
import { getCustomFields } from '../../services/customFields';
import type { CustomFieldGroup, CustomField, CustomFieldScope } from '../../types';
import { FieldGroupsPanel } from '../../components/settings/custom-fields/FieldGroupsPanel';
import { CustomFieldModal } from '../../components/settings/custom-fields/CustomFieldModal';
import { FieldGroupModal } from '../../components/settings/custom-fields/FieldGroupModal';

export function CustomFieldsSettingsPage() {
  const { user } = useAuth();
  const canManage = usePermission('custom_fields.manage');
  const [activeTab, setActiveTab] = useState<CustomFieldScope>('contact');
  const [groups, setGroups] = useState<CustomFieldGroup[]>([]);
  const [ungroupedFields, setUngroupedFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFieldModal, setShowFieldModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [editingField, setEditingField] = useState<CustomField | null>(null);
  const [editingGroup, setEditingGroup] = useState<CustomFieldGroup | null>(null);

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
    setShowFieldModal(true);
  }

  function handleEditField(field: CustomField) {
    setEditingField(field);
    setShowFieldModal(true);
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
    setShowFieldModal(false);
    setEditingField(null);
    loadData();
  }

  function handleGroupSaved() {
    setShowGroupModal(false);
    setEditingGroup(null);
    loadData();
  }

  const tabs: { id: CustomFieldScope; label: string; icon: React.ReactNode }[] = [
    { id: 'contact', label: 'Contact Fields', icon: <Users className="w-4 h-4" /> },
    { id: 'opportunity', label: 'Opportunity Fields', icon: <Briefcase className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-100 rounded-lg">
            <LayoutList className="w-6 h-6 text-slate-600" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Custom Fields</h1>
            <p className="text-sm text-slate-500">
              Define custom fields to capture additional information for contacts and opportunities
            </p>
          </div>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleCreateGroup}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Add Group
            </button>
            <button
              onClick={handleCreateField}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Field
            </button>
          </div>
        )}
      </div>

      <div className="border-b border-slate-200">
        <nav className="flex gap-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
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
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900" />
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

      {showFieldModal && (
        <CustomFieldModal
          scope={activeTab}
          field={editingField}
          groups={groups}
          onClose={() => {
            setShowFieldModal(false);
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
