import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  getContacts,
  exportContactsToCSV,
  bulkDeleteContacts,
  type ContactFilters,
} from '../../services/contacts';
import { getTags } from '../../services/tags';
import { getDepartments } from '../../services/departments';
import { getUsers } from '../../services/users';
import type { Contact, Tag, Department, User } from '../../types';
import {
  Search,
  Plus,
  Filter,
  Download,
  Upload,
  Trash2,
  MoreVertical,
  Loader2,
  AlertCircle,
  Users,
  Mail,
  Phone,
  Building2,
  ChevronDown,
  X,
  Check,
  GitMerge,
} from 'lucide-react';
import { ContactModal } from '../../components/contacts/ContactModal';
import { ImportContactsModal } from '../../components/contacts/ImportContactsModal';
import { ContactFiltersPanel } from '../../components/contacts/ContactFiltersPanel';
import { MergeContactsModal } from '../../components/contacts/MergeContactsModal';

export function Contacts() {
  const { user: currentUser, hasPermission, isSuperAdmin } = useAuth();
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<ContactFilters>({});
  const [showFilters, setShowFilters] = useState(false);

  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [showBulkActions, setShowBulkActions] = useState(false);

  const canCreate = hasPermission('contacts.create');
  const canEdit = hasPermission('contacts.edit');
  const canDelete = hasPermission('contacts.delete');
  const canExport = hasPermission('contacts.export');
  const canImport = hasPermission('contacts.import');
  const canMerge = hasPermission('contacts.merge');
  const canBulkDelete = hasPermission('contacts.bulk_delete');
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

      const [contactsData, tagsData, departmentsData, usersData] = await Promise.all([
        getContacts(currentUser.organization_id, appliedFilters),
        getTags(currentUser.organization_id),
        getDepartments(currentUser.organization_id),
        getUsers(),
      ]);

      setContacts(contactsData);
      setTags(tagsData);
      setDepartments(departmentsData);
      setUsers(usersData);
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

  const activeFilterCount = Object.values(filters).filter(
    (v) => v !== undefined && v !== '' && (!Array.isArray(v) || v.length > 0)
  ).length;

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Contacts</h1>
          <p className="text-slate-400 mt-1">
            {contacts.length} contact{contacts.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {canImport && (
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 transition-colors"
            >
              <Upload className="w-4 h-4" />
              Import
            </button>
          )}
          {canExport && (
            <button
              onClick={handleExport}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          )}
          {canCreate && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-600 text-white font-medium hover:from-cyan-600 hover:to-teal-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Contact
            </button>
          )}
        </div>
      </div>

      <div className="bg-slate-900 rounded-xl border border-slate-800">
        <div className="p-4 border-b border-slate-800">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search contacts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                showFilters || activeFilterCount > 0
                  ? 'bg-cyan-500/10 border-cyan-500/50 text-cyan-400'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Filter className="w-4 h-4" />
              Filters
              {activeFilterCount > 0 && (
                <span className="px-1.5 py-0.5 text-xs rounded-full bg-cyan-500 text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>
            {activeFilterCount > 0 && (
              <button
                onClick={clearFilters}
                className="text-sm text-slate-400 hover:text-white transition-colors"
              >
                Clear all
              </button>
            )}
          </div>

          {showFilters && (
            <ContactFiltersPanel
              filters={filters}
              onFiltersChange={setFilters}
              tags={tags}
              departments={departments}
              users={users}
              isAdmin={isAdmin}
            />
          )}
        </div>

        {selectedContacts.size > 0 && (
          <div className="px-4 py-3 bg-slate-800/50 border-b border-slate-800 flex items-center justify-between">
            <span className="text-sm text-slate-300">
              {selectedContacts.size} selected
            </span>
            <div className="flex items-center gap-2">
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
                  Export Selected
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
            <thead>
              <tr className="border-b border-slate-800">
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedContacts.size === contacts.length && contacts.length > 0}
                    onChange={handleSelectAll}
                    className="rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-slate-900"
                  />
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Name
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Contact Info
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Company
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Tags
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Owner
                </th>
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
                >
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedContacts.has(contact.id)}
                      onChange={() => handleSelectContact(contact.id)}
                      className="rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-slate-900"
                    />
                  </td>
                  <td className="px-4 py-3">
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
                  </td>
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      {contact.email && (
                        <div className="flex items-center gap-2 text-sm text-slate-300">
                          <Mail className="w-3.5 h-3.5 text-slate-500" />
                          {contact.email}
                        </div>
                      )}
                      {contact.phone && (
                        <div className="flex items-center gap-2 text-sm text-slate-300">
                          <Phone className="w-3.5 h-3.5 text-slate-500" />
                          {contact.phone}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {contact.company && (
                      <div className="flex items-center gap-2 text-sm text-slate-300">
                        <Building2 className="w-3.5 h-3.5 text-slate-500" />
                        {contact.company}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
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
                  </td>
                  <td className="px-4 py-3">
                    {contact.owner ? (
                      <span className="text-sm text-slate-300">{contact.owner.name}</span>
                    ) : (
                      <span className="text-sm text-slate-500">Unassigned</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <button className="p-1 rounded hover:bg-slate-700 transition-colors">
                      <MoreVertical className="w-4 h-4 text-slate-400" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {contacts.length === 0 && (
            <div className="p-12 text-center">
              <Users className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-white font-medium mb-1">No contacts found</p>
              <p className="text-slate-400 text-sm mb-6">
                {activeFilterCount > 0
                  ? 'Try adjusting your filters'
                  : 'Get started by adding your first contact'}
              </p>
              {canCreate && activeFilterCount === 0 && (
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-600 text-white font-medium hover:from-cyan-600 hover:to-teal-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Contact
                </button>
              )}
            </div>
          )}
        </div>
      </div>

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
    </div>
  );
}
