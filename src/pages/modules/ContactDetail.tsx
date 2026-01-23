import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getContactById, deleteContact, archiveContact, restoreContact } from '../../services/contacts';
import { getContactNotes } from '../../services/contactNotes';
import { getContactTasks } from '../../services/contactTasks';
import { getAggregatedTimeline, type AggregatedTimelineEvent } from '../../services/contactTimeline';
import { getTags, addTagToContact, removeTagFromContact } from '../../services/tags';
import { getCustomFields, getContactCustomFieldValues } from '../../services/customFields';
import { getDepartments } from '../../services/departments';
import { getUsers } from '../../services/users';
import type { Contact, ContactNote, ContactTask, Tag, CustomField, ContactCustomFieldValue, Department, User } from '../../types';
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  Mail,
  Phone,
  Building2,
  MapPin,
  Calendar,
  User as UserIcon,
  Edit2,
  Trash2,
  Archive,
  RotateCcw,
  MoreVertical,
  Plus,
  X,
  Clock,
} from 'lucide-react';
import { ContactModal } from '../../components/contacts/ContactModal';
import { ContactOverviewTab } from '../../components/contacts/ContactOverviewTab';
import { ContactNotesTab } from '../../components/contacts/ContactNotesTab';
import { ContactTasksTab } from '../../components/contacts/ContactTasksTab';
import { ContactPaymentsTab } from '../../components/contacts/ContactPaymentsTab';
import ContactFilesTab from '../../components/contacts/ContactFilesTab';
import { ScoreWidget } from '../../components/scoring/ScoreWidget';
import { ContactQuickActions } from '../../components/contacts/ContactQuickActions';
import { VirtualizedTimeline } from '../../components/contacts/VirtualizedTimeline';
import { LeadScoreBadge } from '../../components/contacts/LeadScoreBadge';
import { isFeatureEnabled } from '../../services/featureFlags';
import { getAttachmentCount } from '../../services/fileAttachments';

type TabType = 'overview' | 'notes' | 'tasks' | 'timeline' | 'payments' | 'files';

export function ContactDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: currentUser, hasPermission, isSuperAdmin } = useAuth();

  const [contact, setContact] = useState<Contact | null>(null);
  const [notes, setNotes] = useState<ContactNote[]>([]);
  const [tasks, setTasks] = useState<ContactTask[]>([]);
  const [aggregatedTimeline, setAggregatedTimeline] = useState<AggregatedTimelineEvent[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [customFieldValues, setCustomFieldValues] = useState<ContactCustomFieldValue[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [isLoading, setIsLoading] = useState(true);
  const [isTimelineLoading, setIsTimelineLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [paymentsEnabled, setPaymentsEnabled] = useState(false);
  const [mediaEnabled, setMediaEnabled] = useState(false);
  const [scoringEnabled, setScoringEnabled] = useState(false);
  const [reputationEnabled, setReputationEnabled] = useState(false);
  const [conversationsEnabled, setConversationsEnabled] = useState(false);
  const [calendarsEnabled, setCalendarsEnabled] = useState(false);
  const [opportunitiesEnabled, setOpportunitiesEnabled] = useState(false);
  const [filesCount, setFilesCount] = useState(0);

  const canEdit = hasPermission('contacts.edit');
  const canViewPayments = hasPermission('payments.view');
  const canViewMedia = hasPermission('media.view');
  const canDelete = hasPermission('contacts.delete');
  const canAdjustScore = hasPermission('scoring.adjust');
  const canSendMessage = hasPermission('conversations.send');
  const canCreateOpportunity = hasPermission('opportunities.create');
  const canBookAppointment = hasPermission('appointments.create');
  const canCreateInvoice = hasPermission('invoices.create');
  const canRequestReview = hasPermission('reputation.request');
  const isAdmin = isSuperAdmin || currentUser?.role?.hierarchy_level === 2;

  const loadContact = useCallback(async () => {
    if (!id || !currentUser?.organization_id) return;

    try {
      setIsLoading(true);
      setError(null);

      const [
        contactData,
        tagsData,
        customFieldsData,
        departmentsData,
        usersData,
        paymentsFlag,
        mediaFlag,
        scoringFlag,
        reputationFlag,
        conversationsFlag,
        calendarsFlag,
        opportunitiesFlag,
      ] = await Promise.all([
        getContactById(id),
        getTags(currentUser.organization_id),
        getCustomFields(currentUser.organization_id),
        getDepartments(currentUser.organization_id),
        getUsers(),
        isFeatureEnabled('payments'),
        isFeatureEnabled('media'),
        isFeatureEnabled('scoring_management'),
        isFeatureEnabled('reputation'),
        isFeatureEnabled('conversations'),
        isFeatureEnabled('calendars'),
        isFeatureEnabled('opportunities'),
      ]);
      setPaymentsEnabled(paymentsFlag);
      setMediaEnabled(mediaFlag);
      setScoringEnabled(scoringFlag);
      setReputationEnabled(reputationFlag);
      setConversationsEnabled(conversationsFlag);
      setCalendarsEnabled(calendarsFlag);
      setOpportunitiesEnabled(opportunitiesFlag);

      if (!contactData) {
        setError('Contact not found');
        return;
      }

      setContact(contactData);
      setTags(tagsData);
      setCustomFields(customFieldsData);
      setDepartments(departmentsData);
      setUsers(usersData);

      const [notesData, tasksData, fieldValues, attachmentCount] = await Promise.all([
        getContactNotes(id),
        getContactTasks(id),
        getContactCustomFieldValues(id),
        mediaFlag ? getAttachmentCount('contacts', id) : 0,
      ]);

      setNotes(notesData);
      setTasks(tasksData);
      setCustomFieldValues(fieldValues);
      setFilesCount(attachmentCount);

      setIsTimelineLoading(true);
      const timelineData = await getAggregatedTimeline(id);
      setAggregatedTimeline(timelineData);
      setIsTimelineLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load contact');
    } finally {
      setIsLoading(false);
    }
  }, [id, currentUser?.organization_id]);

  useEffect(() => {
    loadContact();
  }, [loadContact]);

  const handleDelete = async () => {
    if (!contact || !currentUser) return;

    if (!confirm('Are you sure you want to delete this contact? This action cannot be undone.')) {
      return;
    }

    try {
      await deleteContact(contact.id, currentUser);
      navigate('/contacts');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete contact');
    }
  };

  const handleArchive = async () => {
    if (!contact || !currentUser) return;

    try {
      await archiveContact(contact.id, currentUser);
      loadContact();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to archive contact');
    }
  };

  const handleRestore = async () => {
    if (!contact || !currentUser) return;

    try {
      await restoreContact(contact.id, currentUser);
      loadContact();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restore contact');
    }
  };

  const handleAddTag = async (tagId: string) => {
    if (!contact || !currentUser) return;

    try {
      await addTagToContact(contact.id, tagId, currentUser);
      loadContact();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add tag');
    }
  };

  const handleRemoveTag = async (tagId: string) => {
    if (!contact || !currentUser) return;

    try {
      await removeTagFromContact(contact.id, tagId, currentUser);
      loadContact();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove tag');
    }
  };

  const refreshNotes = async () => {
    if (!id) return;
    const notesData = await getContactNotes(id);
    setNotes(notesData);
    const timelineData = await getAggregatedTimeline(id);
    setAggregatedTimeline(timelineData);
  };

  const refreshTasks = async () => {
    if (!id) return;
    const tasksData = await getContactTasks(id);
    setTasks(tasksData);
    const timelineData = await getAggregatedTimeline(id);
    setAggregatedTimeline(timelineData);
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  if (error || !contact) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
        <p className="text-white font-medium">{error || 'Contact not found'}</p>
        <button
          onClick={() => navigate('/contacts')}
          className="mt-4 text-cyan-400 hover:text-cyan-300 transition-colors"
        >
          Back to Contacts
        </button>
      </div>
    );
  }

  const tabs: { id: TabType; label: string; count?: number }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'notes', label: 'Notes', count: notes.length },
    { id: 'tasks', label: 'Tasks', count: tasks.filter((t) => t.status !== 'completed').length },
    { id: 'timeline', label: 'Timeline', count: aggregatedTimeline.length },
    ...(paymentsEnabled && canViewPayments ? [{ id: 'payments' as const, label: 'Payments' }] : []),
    ...(mediaEnabled && canViewMedia ? [{ id: 'files' as const, label: 'Files', count: filesCount }] : []),
  ];

  const availableTags = tags.filter((tag) => !contact.tags?.some((t) => t.id === tag.id));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/contacts')}
          className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-slate-400" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-white">
              {contact.first_name} {contact.last_name}
            </h1>
            {contact.status === 'archived' && (
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-500/10 text-amber-400">
                Archived
              </span>
            )}
            <LeadScoreBadge score={contact.lead_score || 0} size="md" />
          </div>
          {contact.job_title && contact.company && (
            <p className="text-slate-400 mt-1">
              {contact.job_title} at {contact.company}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {canEdit && contact.status === 'active' && (
            <button
              onClick={() => setIsEditModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 transition-colors"
            >
              <Edit2 className="w-4 h-4" />
              Edit
            </button>
          )}
          <div className="relative">
            <button
              onClick={() => setShowActions(!showActions)}
              className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <MoreVertical className="w-5 h-5 text-slate-400" />
            </button>
            {showActions && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowActions(false)}
                />
                <div className="absolute right-0 mt-2 w-48 bg-slate-800 rounded-lg border border-slate-700 shadow-xl z-20">
                  {contact.status === 'active' ? (
                    <button
                      onClick={() => {
                        setShowActions(false);
                        handleArchive();
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors"
                    >
                      <Archive className="w-4 h-4" />
                      Archive Contact
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setShowActions(false);
                        handleRestore();
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Restore Contact
                    </button>
                  )}
                  {canDelete && isAdmin && (
                    <button
                      onClick={() => {
                        setShowActions(false);
                        handleDelete();
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-slate-700 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete Contact
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
            <div className="flex items-center justify-center mb-4">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center">
                <span className="text-2xl font-bold text-white">
                  {contact.first_name[0]}
                  {contact.last_name?.[0] || ''}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              {contact.email && (
                <a
                  href={`mailto:${contact.email}`}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800 transition-colors group"
                >
                  <Mail className="w-4 h-4 text-slate-500 group-hover:text-cyan-400" />
                  <span className="text-sm text-slate-300 group-hover:text-white">
                    {contact.email}
                  </span>
                </a>
              )}
              {contact.phone && (
                <a
                  href={`tel:${contact.phone}`}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800 transition-colors group"
                >
                  <Phone className="w-4 h-4 text-slate-500 group-hover:text-cyan-400" />
                  <span className="text-sm text-slate-300 group-hover:text-white">
                    {contact.phone}
                  </span>
                </a>
              )}
              {contact.company && (
                <div className="flex items-center gap-3 p-2">
                  <Building2 className="w-4 h-4 text-slate-500" />
                  <span className="text-sm text-slate-300">{contact.company}</span>
                </div>
              )}
              {(contact.city || contact.state || contact.country) && (
                <div className="flex items-center gap-3 p-2">
                  <MapPin className="w-4 h-4 text-slate-500" />
                  <span className="text-sm text-slate-300">
                    {[contact.city, contact.state, contact.country].filter(Boolean).join(', ')}
                  </span>
                </div>
              )}
              {contact.owner && (
                <div className="flex items-center gap-3 p-2">
                  <UserIcon className="w-4 h-4 text-slate-500" />
                  <span className="text-sm text-slate-300">Owner: {contact.owner.name}</span>
                </div>
              )}
              <div className="flex items-center gap-3 p-2">
                <Clock className="w-4 h-4 text-slate-500" />
                <span className="text-sm text-slate-300">
                  Last activity: {formatRelativeTime(contact.last_activity_at)}
                </span>
              </div>
              <div className="flex items-center gap-3 p-2">
                <Calendar className="w-4 h-4 text-slate-500" />
                <span className="text-sm text-slate-300">
                  Added {new Date(contact.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          {contact.status === 'active' && (
            <ContactQuickActions
              contact={contact}
              onRefresh={loadContact}
              canSendMessage={canSendMessage && conversationsEnabled}
              canCall={!!contact.phone}
              canCreateOpportunity={canCreateOpportunity && opportunitiesEnabled}
              canBookAppointment={canBookAppointment && calendarsEnabled}
              canCreateInvoice={canCreateInvoice && paymentsEnabled}
              canRequestReview={canRequestReview && reputationEnabled}
            />
          )}

          {scoringEnabled && (
            <ScoreWidget
              entityType="contact"
              entityId={contact.id}
              canAdjust={canAdjustScore}
            />
          )}

          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
            <h3 className="text-sm font-medium text-slate-300 mb-3">Tags</h3>
            <div className="flex flex-wrap gap-2 mb-3">
              {contact.tags?.map((tag) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium group"
                  style={{
                    backgroundColor: `${tag.color}20`,
                    color: tag.color,
                  }}
                >
                  {tag.name}
                  {canEdit && (
                    <button
                      onClick={() => handleRemoveTag(tag.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </span>
              ))}
              {(!contact.tags || contact.tags.length === 0) && (
                <span className="text-sm text-slate-500">No tags</span>
              )}
            </div>
            {canEdit && availableTags.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-2 border-t border-slate-800">
                {availableTags.map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => handleAddTag(tag.id)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium opacity-50 hover:opacity-100 transition-opacity"
                    style={{
                      backgroundColor: `${tag.color}20`,
                      color: tag.color,
                    }}
                  >
                    <Plus className="w-3 h-3" />
                    {tag.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-slate-900 rounded-xl border border-slate-800">
            <div className="border-b border-slate-800">
              <div className="flex gap-1 p-1 overflow-x-auto">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                      activeTab === tab.id
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                    }`}
                  >
                    {tab.label}
                    {tab.count !== undefined && tab.count > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full bg-slate-700 text-xs">
                        {tab.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4">
              {activeTab === 'overview' && (
                <ContactOverviewTab
                  contact={contact}
                  customFields={customFields}
                  customFieldValues={customFieldValues}
                />
              )}
              {activeTab === 'notes' && (
                <ContactNotesTab
                  contactId={contact.id}
                  notes={notes}
                  onRefresh={refreshNotes}
                />
              )}
              {activeTab === 'tasks' && (
                <ContactTasksTab
                  contactId={contact.id}
                  tasks={tasks}
                  users={users}
                  onRefresh={refreshTasks}
                />
              )}
              {activeTab === 'timeline' && (
                <VirtualizedTimeline
                  events={aggregatedTimeline}
                  isLoading={isTimelineLoading}
                />
              )}
              {activeTab === 'payments' && (
                <ContactPaymentsTab contactId={contact.id} />
              )}
              {activeTab === 'files' && (
                <ContactFilesTab contact={contact} onUpdate={loadContact} />
              )}
            </div>
          </div>
        </div>
      </div>

      {isEditModalOpen && (
        <ContactModal
          contact={contact}
          departments={departments}
          users={users}
          tags={tags}
          onClose={() => setIsEditModalOpen(false)}
          onSuccess={() => {
            setIsEditModalOpen(false);
            loadContact();
          }}
        />
      )}
    </div>
  );
}
