import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  getContacts,
  exportContactsToCSV,
  bulkDeleteContacts,
  bulkAssignOwner,
  bulkAddTag,
  bulkRemoveTag,
  type ContactFilters,
} from '../../services/contacts';
import { getTags } from '../../services/tags';
import { getDepartments } from '../../services/departments';
import { getUsers } from '../../services/users';
import { getCustomFields } from '../../services/customFields';
import type { Contact, Tag, Department, User, CustomField } from '../../types';
import {
  Plus,
  Download,
  Upload,
  Trash2,
  Loader2,
  AlertCircle,
  Users,
  Mail,
  Phone,
  Building2,
  X,
  GitMerge,
  UserCheck,
  Tag as TagIcon,
  Settings2,
  Clock,
  Calendar,
} from 'lucide-react';
import { PageHeader, FilterBar, EmptyState } from '../../components/layouts';
import { ContactModal } from '../../components/contacts/ContactModal';
import { ImportContactsModal } from '../../components/contacts/ImportContactsModal';
import { MergeContactsModal } from '../../components/contacts/MergeContactsModal';
import { ContactFilterDrawer } from '../../components/contacts/ContactFilterDrawer';
import { BulkAssignOwnerModal } from '../../components/contacts/BulkAssignOwnerModal';
import { BulkTagsModal } from '../../components/contacts/BulkTagsModal';
import { ContactContextMenu } from '../../components/contacts/ContactContextMenu';
import { LeadScoreBadge } from '../../components/contacts/LeadScoreBadge';
import { archiveContact, restoreContact, deleteContact } from '../../services/contacts';

type ColumnKey = 'name' | 'contact' | 'company' | 'tags' | 'owner' | 'leadScore' | 'lastActivity' | 'createdAt';

interface ColumnConfig {
  key: ColumnKey;
  label: string;
  visible: boolean;
}

const DEFAULT_COLUMNS: ColumnConfig[] = [
  { key: 'name', label: 'Name', visible: true },
  { key: 'contact', label: 'Contact Info', visible: true },
  { key: 'company', label: 'Company', visible: true },
  { key: 'leadScore', label: 'Lead Score', visible: true },
  { key: 'tags', label: 'Tags', visible: true },
  { key: 'owner', label: 'Owner', visible: true },
  { key: 'lastActivity', label: 'Last Activity', visible: true },
  { key: 'createdAt', label: 'Created', visible: false },
];

export function Contacts() {
  const { user: currentUser, hasPermission, isSuperAdmin } = useAuth();
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<ContactFilters>({});
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);

  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [isAssignOwnerModalOpen, setIsAssignOwnerModalOpen] = useState(false);
  const [isAddTagModalOpen, setIsAddTagModalOpen] = useState(false);
  const [isRemoveTagModalOpen, setIsRemoveTagModalOpen] = useState(false);

  const [columns, setColumns] = useState<ColumnConfig[]>(DEFAULT_COLUMNS);
  const [showColumnPicker, setShowColumnPicker] = useState(false);

  const [contextMenu, setContextMenu] = useState<{
    contact: Contact;
    position: { x: number; y: number };
  } | null>(null);

  const canCreate = hasPermission('contacts.create');
  const canEdit = hasPermission('contacts.edit');
  const canExport = hasPermission('contacts.export');
  const canImport = hasPermission('contacts.import');
  const canMerge = hasPermission('contacts.merge');
  const canBulkDelete = hasPermission('contacts.bulk_delete');
  const canDelete = hasPermission('contacts.delete');
  const isAdmin = isSuperAdmin || currentUser?.role?.hierarchy_level === 2;

  const loadData = useCallback(async () => {
    if (!currentUser?.organization_id) return;

    try {
      setIsLoading(true);
      setError(null);

      const appliedFilters: ContactFilters = {
        ...filters,
        search: searchQuery || undefined,
      };

      const [contactsData, tagsData, departmentsData, usersData, customFieldsData] = await Promise.all([
        getContacts(currentUser.organization_id, appliedFilters),
        getTags(currentUser.organization_id),
        getDepartments(currentUser.organization_id),
        getUsers(),
        getCustomFields(currentUser.organization_id),
      ]);

      setContacts(contactsData);
      setTags(tagsData);
      setDepartments(departmentsData);
      setUsers(usersData);
      setCustomFields(customFieldsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load contacts');
    } finally {
      setIsLoading(false);
    }
  }, [currentUser?.organization_id, filters, searchQuery]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSelectContact = (contactId: string) => {
    setSelectedContacts((prev) => {
      const next = new Set(prev);
      if (next.has(contactId)) {
        next.delete(contactId);
      } else {
        next.add(contactId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedContacts.size === contacts.length) {
      setSelectedContacts(new Set());
    } else {
      setSelectedContacts(new Set(contacts.map((c) => c.id)));
    }
  };

  const handleExport = () => {
    const contactsToExport =
      selectedContacts.size > 0
        ? contacts.filter((c) => selectedContacts.has(c.id))
        : contacts;

    const csv = exportContactsToCSV(contactsToExport);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contacts-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleBulkDelete = async () => {
    if (!currentUser || selectedContacts.size === 0) return;

    if (!confirm(`Are you sure you want to delete ${selectedContacts.size} contacts?`)) {
      return;
    }

    try {
      await bulkDeleteContacts([...selectedContacts], currentUser);
      setSelectedContacts(new Set());
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete contacts');
    }
  };

  const handleBulkAssignOwner = async (ownerId: string | null) => {
    if (!currentUser || selectedContacts.size === 0) return;

    await bulkAssignOwner([...selectedContacts], ownerId, currentUser);
    setSelectedContacts(new Set());
    loadData();
  };

  const handleBulkAddTag = async (tagId: string) => {
    if (!currentUser || selectedContacts.size === 0) return;

    await bulkAddTag([...selectedContacts], tagId, currentUser);
    setSelectedContacts(new Set());
    loadData();
  };

  const handleBulkRemoveTag = async (tagId: string) => {
    if (!currentUser || selectedContacts.size === 0) return;

    await bulkRemoveTag([...selectedContacts], tagId, currentUser);
    setSelectedContacts(new Set());
    loadData();
  };

  const handleOpenMerge = () => {
    if (selectedContacts.size !== 2) {
      alert('Please select exactly 2 contacts to merge');
      return;
    }
    setIsMergeModalOpen(true);
  };

  const clearFilters = () => {
    setFilters({});
    setSearchQuery('');
  };

  const handleContextMenu = (e: React.MouseEvent, contact: Contact) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      contact,
      position: { x: e.clientX, y: e.clientY },
    });
  };

  const handleContextMenuAction = async (action: string, contact: Contact) => {
    if (!currentUser) return;

    switch (action) {
      case 'archive':
        if (contact.status === 'active') {
          await archiveContact(contact.id, currentUser);
        } else {
          await restoreContact(contact.id, currentUser);
        }
        loadData();
        break;
      case 'delete':
        if (confirm('Are you sure you want to delete this contact?')) {
          await deleteContact(contact.id, currentUser);
          loadData();
        }
        break;
    }
    setContextMenu(null);
  };

  const toggleColumn = (key: ColumnKey) => {
    setColumns((prev) =>
      prev.map((col) => (col.key === key ? { ...col, visible: !col.visible } : col))
    );
  };

  const formatRelativeTime = (date: string | null): string => {
    if (!date) return 'Never';
    const now = new Date();
    const d = new Date(date);
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  };

  const activeFilterCount = Object.entries(filters).filter(
    ([_, v]) => v !== undefined && v !== '' && (!Array.isArray(v) || v.length > 0)
  ).length;

  const secondaryActions = [];
  if (canImport) {
    secondaryActions.push({
      label: 'Import Contacts',
      icon: Upload,
      onClick: () => setIsImportModalOpen(true),
    });
  }
  if (canExport) {
    secondaryActions.push({
      label: 'Export All',
      icon: Download,
      onClick: handleExport,
    });
  }

  const visibleColumns = columns.filter((c) => c.visible);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
        <p className="text-white font-medium">Error loading contacts</p>
        <p className="text-slate-400 text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contacts"
        subtitle={`${contacts.length} contact${contacts.length !== 1 ? 's' : ''}`}
        icon={Users}
        primaryAction={
          canCreate
            ? {
                label: 'Add Contact',
                icon: Plus,
                onClick: () => setIsCreateModalOpen(true),
              }
            : undefined
        }
        secondaryActions={secondaryActions.length > 0 ? secondaryActions : undefined}
      />

      <div className="bg-slate-900 rounded-xl border border-slate-800">
        <div className="p-4 border-b border-slate-800">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <FilterBar
                searchPlaceholder="Search contacts..."
                searchValue={searchQuery}
                onSearchChange={setSearchQuery}
                filterCount={activeFilterCount}
                onFilterClick={() => setIsFilterDrawerOpen(true)}
              >
                {activeFilterCount > 0 && (
                  <button
                    onClick={clearFilters}
                    className="text-sm text-slate-400 hover:text-white transition-colors"
                  >
                    Clear all
                  </button>
                )}
              </FilterBar>
            </div>
            <div className="relative">
              <button
                onClick={() => setShowColumnPicker(!showColumnPicker)}
                className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
                title="Configure columns"
              >
                <Settings2 className="w-5 h-5 text-slate-400" />
              </button>
              {showColumnPicker && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowColumnPicker(false)} />
                  <div className="absolute right-0 mt-2 w-48 bg-slate-800 rounded-lg border border-slate-700 shadow-xl z-50 py-2">
                    <p className="px-3 py-1 text-xs font-medium text-slate-400 uppercase">Columns</p>
                    {columns.map((col) => (
                      <label
                        key={col.key}
                        className="flex items-center gap-2 px-3 py-2 hover:bg-slate-700 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={col.visible}
                          onChange={() => toggleColumn(col.key)}
                          className="rounded border-slate-600 bg-slate-700 text-cyan-500 focus:ring-cyan-500"
                        />
                        <span className="text-sm text-slate-300">{col.label}</span>
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {selectedContacts.size > 0 && (
          <div className="px-4 py-3 bg-slate-800/50 border-b border-slate-800 flex items-center justify-between sticky bottom-0 z-10">
            <span className="text-sm text-slate-300">{selectedContacts.size} selected</span>
            <div className="flex items-center gap-2">
              {canEdit && (
                <>
                  <button
                    onClick={() => setIsAssignOwnerModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors text-sm"
                  >
                    <UserCheck className="w-4 h-4" />
                    Assign Owner
                  </button>
                  <button
                    onClick={() => setIsAddTagModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors text-sm"
                  >
                    <TagIcon className="w-4 h-4" />
                    Add Tag
                  </button>
                  <button
                    onClick={() => setIsRemoveTagModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors text-sm"
                  >
                    <TagIcon className="w-4 h-4" />
                    Remove Tag
                  </button>
                </>
              )}
              {canMerge && selectedContacts.size === 2 && (
                <button
                  onClick={handleOpenMerge}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-colors text-sm"
                >
                  <GitMerge className="w-4 h-4" />
                  Merge
                </button>
              )}
              {canExport && (
                <button
                  onClick={handleExport}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors text-sm"
                >
                  <Download className="w-4 h-4" />
                  Export
                </button>
              )}
              {canBulkDelete && (
                <button
                  onClick={handleBulkDelete}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors text-sm"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              )}
              <button
                onClick={() => setSelectedContacts(new Set())}
                className="p-1.5 rounded-lg hover:bg-slate-700 transition-colors"
              >
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-900 sticky top-0 z-10">
              <tr className="border-b border-slate-800">
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedContacts.size === contacts.length && contacts.length > 0}
                    onChange={handleSelectAll}
                    className="rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-slate-900"
                  />
                </th>
                {visibleColumns.map((col) => (
                  <th
                    key={col.key}
                    className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider"
                  >
                    {col.label}
                  </th>
                ))}
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {contacts.map((contact) => (
                <tr
                  key={contact.id}
                  className="hover:bg-slate-800/50 transition-colors cursor-pointer"
                  onClick={() => navigate(`/contacts/${contact.id}`)}
                  onContextMenu={(e) => handleContextMenu(e, contact)}
                >
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedContacts.has(contact.id)}
                      onChange={() => handleSelectContact(contact.id)}
                      className="rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-slate-900"
                    />
                  </td>

                  {visibleColumns.map((col) => (
                    <td key={col.key} className="px-4 py-3">
                      {col.key === 'name' && (
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center flex-shrink-0">
                            <span className="text-sm font-semibold text-white">
                              {contact.first_name[0]}
                              {contact.last_name?.[0] || ''}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-white">
                              {contact.first_name} {contact.last_name}
                            </p>
                            {contact.job_title && (
                              <p className="text-xs text-slate-400">{contact.job_title}</p>
                            )}
                          </div>
                        </div>
                      )}

                      {col.key === 'contact' && (
                        <div className="space-y-1">
                          {contact.email && (
                            <div className="flex items-center gap-2 text-sm text-slate-300">
                              <Mail className="w-3.5 h-3.5 text-slate-500" />
                              <span className="truncate max-w-[180px]">{contact.email}</span>
                            </div>
                          )}
                          {contact.phone && (
                            <div className="flex items-center gap-2 text-sm text-slate-300">
                              <Phone className="w-3.5 h-3.5 text-slate-500" />
                              {contact.phone}
                            </div>
                          )}
                        </div>
                      )}

                      {col.key === 'company' && contact.company && (
                        <div className="flex items-center gap-2 text-sm text-slate-300">
                          <Building2 className="w-3.5 h-3.5 text-slate-500" />
                          {contact.company}
                        </div>
                      )}

                      {col.key === 'leadScore' && (
                        <LeadScoreBadge score={contact.lead_score || 0} size="sm" />
                      )}

                      {col.key === 'tags' && (
                        <div className="flex flex-wrap gap-1">
                          {contact.tags?.slice(0, 3).map((tag) => (
                            <span
                              key={tag.id}
                              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                              style={{
                                backgroundColor: `${tag.color}20`,
                                color: tag.color,
                              }}
                            >
                              {tag.name}
                            </span>
                          ))}
                          {(contact.tags?.length || 0) > 3 && (
                            <span className="text-xs text-slate-400">
                              +{contact.tags!.length - 3}
                            </span>
                          )}
                        </div>
                      )}

                      {col.key === 'owner' && (
                        contact.owner ? (
                          <span className="text-sm text-slate-300">{contact.owner.name}</span>
                        ) : (
                          <span className="text-sm text-slate-500">Unassigned</span>
                        )
                      )}

                      {col.key === 'lastActivity' && (
                        <div className="flex items-center gap-2 text-sm text-slate-400">
                          <Clock className="w-3.5 h-3.5" />
                          {formatRelativeTime(contact.last_activity_at)}
                        </div>
                      )}

                      {col.key === 'createdAt' && (
                        <div className="flex items-center gap-2 text-sm text-slate-400">
                          <Calendar className="w-3.5 h-3.5" />
                          {new Date(contact.created_at).toLocaleDateString()}
                        </div>
                      )}
                    </td>
                  ))}

                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={(e) => handleContextMenu(e, contact)}
                      className="p-1 rounded hover:bg-slate-700 transition-colors"
                    >
                      <svg className="w-4 h-4 text-slate-400" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {contacts.length === 0 && (
            <EmptyState
              icon={Users}
              title="No contacts found"
              description={
                activeFilterCount > 0
                  ? 'Try adjusting your filters to see more results'
                  : 'Get started by adding your first contact'
              }
              primaryAction={
                canCreate && activeFilterCount === 0
                  ? {
                      label: 'Add Contact',
                      onClick: () => setIsCreateModalOpen(true),
                    }
                  : undefined
              }
            />
          )}
        </div>
      </div>

      <ContactFilterDrawer
        isOpen={isFilterDrawerOpen}
        onClose={() => setIsFilterDrawerOpen(false)}
        filters={filters}
        onFiltersChange={setFilters}
        tags={tags}
        departments={departments}
        users={users}
        customFields={customFields}
        isAdmin={isAdmin}
      />

      {isCreateModalOpen && (
        <ContactModal
          departments={departments}
          users={users}
          tags={tags}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={() => {
            setIsCreateModalOpen(false);
            loadData();
          }}
        />
      )}

      {isImportModalOpen && (
        <ImportContactsModal
          departments={departments}
          onClose={() => setIsImportModalOpen(false)}
          onSuccess={() => {
            setIsImportModalOpen(false);
            loadData();
          }}
        />
      )}

      {isMergeModalOpen && selectedContacts.size === 2 && (
        <MergeContactsModal
          contactIds={[...selectedContacts]}
          onClose={() => setIsMergeModalOpen(false)}
          onSuccess={() => {
            setIsMergeModalOpen(false);
            setSelectedContacts(new Set());
            loadData();
          }}
        />
      )}

      <BulkAssignOwnerModal
        isOpen={isAssignOwnerModalOpen}
        onClose={() => setIsAssignOwnerModalOpen(false)}
        onAssign={handleBulkAssignOwner}
        users={users}
        selectedCount={selectedContacts.size}
      />

      <BulkTagsModal
        isOpen={isAddTagModalOpen}
        onClose={() => setIsAddTagModalOpen(false)}
        onAddTag={handleBulkAddTag}
        onRemoveTag={handleBulkRemoveTag}
        tags={tags}
        selectedCount={selectedContacts.size}
        mode="add"
      />

      <BulkTagsModal
        isOpen={isRemoveTagModalOpen}
        onClose={() => setIsRemoveTagModalOpen(false)}
        onAddTag={handleBulkAddTag}
        onRemoveTag={handleBulkRemoveTag}
        tags={tags}
        selectedCount={selectedContacts.size}
        mode="remove"
      />

      {contextMenu && (
        <ContactContextMenu
          contact={contextMenu.contact}
          position={contextMenu.position}
          onClose={() => setContextMenu(null)}
          onEdit={() => {
            navigate(`/contacts/${contextMenu.contact.id}`);
            setContextMenu(null);
          }}
          onAssignOwner={() => {
            setSelectedContacts(new Set([contextMenu.contact.id]));
            setIsAssignOwnerModalOpen(true);
            setContextMenu(null);
          }}
          onAddTag={() => {
            setSelectedContacts(new Set([contextMenu.contact.id]));
            setIsAddTagModalOpen(true);
            setContextMenu(null);
          }}
          onArchive={() => handleContextMenuAction('archive', contextMenu.contact)}
          onDelete={() => handleContextMenuAction('delete', contextMenu.contact)}
          onViewDetail={() => {
            navigate(`/contacts/${contextMenu.contact.id}`);
            setContextMenu(null);
          }}
          canEdit={canEdit}
          canDelete={canDelete && isAdmin}
        />
      )}
    </div>
  );
}
