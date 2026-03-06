import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, DollarSign, User, Calendar, Tag, CreditCard as Edit2, Trophy, XCircle, RotateCcw, Clock, MessageSquare, CheckSquare, FileText, ExternalLink, Plus, Trash2, CreditCard, Send, Copy, MoreVertical, Link as LinkIcon, FolderKanban, Lock } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { usePermission } from '../../hooks/usePermission';
import { usePaymentsAccess } from '../../hooks/usePaymentsAccess';
import type {
  Opportunity,
  OpportunityNote,
  OpportunityTimelineEvent,
  PipelineStage,
  User as UserType,
  Invoice,
  InvoiceStatus,
  Tag as TagType,
  Project,
} from '../../types';
import * as opportunitiesService from '../../services/opportunities';
import * as opportunityNotesService from '../../services/opportunityNotes';
import * as opportunityTimelineService from '../../services/opportunityTimeline';
import * as pipelinesService from '../../services/pipelines';
import { getUsers } from '../../services/users';
import { getOpportunityInvoices } from '../../services/invoices';
import { getAttachmentCount } from '../../services/fileAttachments';
import { OpportunityModal } from '../../components/opportunities/OpportunityModal';
import { CreateInvoiceModal } from '../../components/payments/CreateInvoiceModal';
import { CloseLostModal } from '../../components/opportunities/CloseLostModal';
import OpportunityFilesTab from '../../components/opportunities/OpportunityFilesTab';
import { OpportunityTasksTab } from '../../components/opportunities/OpportunityTasksTab';
import { ScoreWidget } from '../../components/scoring/ScoreWidget';
import { ConvertToProjectModal } from '../../components/projects/ConvertToProjectModal';
import { AskClaraButton } from '../../components/assistant/AskClaraButton';
import { getProjectByOpportunityId } from '../../services/projects';

function normalizeTagsArray(rawTags: unknown): TagType[] {
  if (!rawTags || !Array.isArray(rawTags)) return [];
  return rawTags
    .map((item) => {
      if (item && typeof item === 'object' && 'tag' in item && item.tag) {
        return item.tag as TagType;
      }
      return item as TagType;
    })
    .filter((tag): tag is TagType => tag !== null && tag !== undefined && typeof tag?.id === 'string');
}

type TabType = 'details' | 'activity' | 'tasks' | 'notes' | 'invoices' | 'files';

const INVOICE_STATUS_STYLES: Record<InvoiceStatus, { bg: string; text: string; label: string }> = {
  draft: { bg: 'bg-slate-500/20', text: 'text-slate-300', label: 'Draft' },
  sent: { bg: 'bg-cyan-500/20', text: 'text-cyan-300', label: 'Sent' },
  paid: { bg: 'bg-emerald-500/20', text: 'text-emerald-300', label: 'Paid' },
  overdue: { bg: 'bg-red-500/20', text: 'text-red-300', label: 'Overdue' },
  void: { bg: 'bg-slate-700/50', text: 'text-slate-500', label: 'Void' },
};

export function OpportunityDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isFeatureEnabled } = useAuth();
  const canEdit = usePermission('opportunities.edit');
  const canClose = usePermission('opportunities.close');
  const canViewPayments = usePermission('payments.view');
  const canCreateInvoice = usePermission('invoices.create');
  const canAccessPayments = usePaymentsAccess();
  const canViewMedia = usePermission('media.view');
  const canAdjustScore = usePermission('scoring.adjust');
  const canCreateProject = usePermission('projects.create');

  const paymentsEnabled = isFeatureEnabled('payments');
  const projectsEnabled = isFeatureEnabled('projects');
  const mediaEnabled = isFeatureEnabled('media');
  const scoringEnabled = isFeatureEnabled('scoring_management');

  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);
  const [timeline, setTimeline] = useState<OpportunityTimelineEvent[]>([]);
  const [notes, setNotes] = useState<OpportunityNote[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('details');
  const [filesCount, setFilesCount] = useState(0);

  const [linkedProject, setLinkedProject] = useState<Project | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showWonModal, setShowWonModal] = useState(false);
  const [showLostModal, setShowLostModal] = useState(false);
  const [showCreateInvoice, setShowCreateInvoice] = useState(false);
  const [showConvertToProject, setShowConvertToProject] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    if (id) {
      loadOpportunity();
    }
  }, [id]);

  useEffect(() => {
    if (opportunity) {
      loadRelatedData();
    }
  }, [opportunity?.id, activeTab]);

  async function loadOpportunity() {
    try {
      const data = await opportunitiesService.getOpportunityById(id!);

      if (!data) {
        navigate('/opportunities');
        return;
      }
      setOpportunity(data);

      const [stagesData, usersData, attachmentCount, projectData] = await Promise.all([
        pipelinesService.getStagesByPipeline(data.pipeline_id),
        getUsers(),
        mediaEnabled ? getAttachmentCount('opportunities', data.id) : 0,
        projectsEnabled ? getProjectByOpportunityId(data.id).catch(() => null) : null,
      ]);
      setStages(stagesData);
      setUsers(usersData);
      setFilesCount(attachmentCount);
      setLinkedProject(projectData);
    } catch (error) {
      console.error('Failed to load opportunity:', error);
      navigate('/opportunities');
    } finally {
      setLoading(false);
    }
  }

  async function loadRelatedData() {
    if (!opportunity) return;

    try {
      if (activeTab === 'activity') {
        const result = await opportunityTimelineService.getTimelineByOpportunity(opportunity.id);
        setTimeline(result.data);
      } else if (activeTab === 'notes') {
        const notesData = await opportunityNotesService.getNotesByOpportunity(opportunity.id);
        setNotes(notesData);
      } else if (activeTab === 'invoices') {
        const invoicesData = await getOpportunityInvoices(opportunity.id);
        setInvoices(invoicesData);
      }
    } catch (error) {
      console.error('Failed to load related data:', error);
    }
  }

  async function handleStageChange(stageId: string) {
    if (!opportunity || !user) return;
    try {
      const updated = await opportunitiesService.moveOpportunityToStage(opportunity.id, stageId, user.id);
      setOpportunity(updated);
    } catch (error) {
      console.error('Failed to change stage:', error);
    }
  }

  async function handleMarkWon() {
    if (!opportunity || !user) return;
    try {
      const updated = await opportunitiesService.closeOpportunity(
        opportunity.id,
        'won',
        user.id
      );
      setOpportunity(updated);
      setShowWonModal(false);
      if (projectsEnabled && canCreateProject) {
        setShowConvertToProject(true);
      }
    } catch (error) {
      console.error('Failed to mark as won:', error);
    }
  }

  async function handleMarkLost(lostReasonId: string, lostReasonText: string, notes?: string) {
    if (!opportunity || !user) return;
    const reasonWithNotes = notes ? `${lostReasonText}: ${notes}` : lostReasonText;
    const updated = await opportunitiesService.closeOpportunity(
      opportunity.id,
      'lost',
      user.id,
      lostReasonId,
      reasonWithNotes
    );
    setOpportunity(updated);
    setShowLostModal(false);
  }

  async function handleCopyLink() {
    const url = window.location.href;
    await navigator.clipboard.writeText(url);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
    setShowMoreMenu(false);
  }

  async function handleDelete() {
    if (!opportunity) return;
    if (!confirm('Are you sure you want to delete this opportunity? This action cannot be undone.')) return;
    try {
      await opportunitiesService.deleteOpportunity(opportunity.id);
      navigate('/opportunities');
    } catch (error) {
      console.error('Failed to delete opportunity:', error);
    }
  }

  async function handleReopen() {
    if (!opportunity || !user) return;
    if (!confirm('Reopen this opportunity?')) return;
    try {
      const updated = await opportunitiesService.reopenOpportunity(opportunity.id, user.id);
      setOpportunity(updated);
    } catch (error) {
      console.error('Failed to reopen opportunity:', error);
    }
  }

  async function handleAddNote() {
    if (!newNote.trim() || !opportunity || !user) return;
    setSavingNote(true);
    try {
      await opportunityNotesService.createNote({
        org_id: opportunity.org_id,
        opportunity_id: opportunity.id,
        contact_id: opportunity.contact_id,
        body: newNote.trim(),
        created_by: user.id
      });
      setNewNote('');
      loadRelatedData();
    } catch (error) {
      console.error('Failed to add note:', error);
    } finally {
      setSavingNote(false);
    }
  }

  async function handleDeleteNote(noteId: string) {
    if (!confirm('Delete this note?')) return;
    try {
      await opportunityNotesService.deleteNote(noteId);
      setNotes(notes.filter(n => n.id !== noteId));
    } catch (error) {
      console.error('Failed to delete note:', error);
    }
  }

  function formatCurrency(amount: number, currency: string = 'USD') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0
    }).format(amount);
  }

  function formatDate(date: string) {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  function formatDateTime(date: string) {
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  function getStatusBadge(status: string) {
    const styles = {
      open: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
      won: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      lost: 'bg-red-500/20 text-red-400 border-red-500/30'
    };
    return styles[status as keyof typeof styles] || styles.open;
  }

  function getEventIcon(eventType: string) {
    switch (eventType) {
      case 'opportunity_created':
        return <Plus className="w-4 h-4 text-emerald-400" />;
      case 'stage_changed':
        return <ArrowLeft className="w-4 h-4 text-cyan-400 rotate-180" />;
      case 'status_changed':
        return <Trophy className="w-4 h-4 text-amber-400" />;
      case 'assigned_changed':
        return <User className="w-4 h-4 text-blue-400" />;
      case 'value_changed':
        return <DollarSign className="w-4 h-4 text-emerald-400" />;
      case 'note_added':
        return <MessageSquare className="w-4 h-4 text-slate-400" />;
      case 'task_created':
      case 'task_completed':
        return <CheckSquare className="w-4 h-4 text-amber-400" />;
      default:
        return <Clock className="w-4 h-4 text-slate-400" />;
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!opportunity) {
    return null;
  }

  const contact = opportunity.contact;
  const contactName = contact ? `${contact.first_name} ${contact.last_name}`.trim() : 'Unknown';

  return (
    <div className="h-full flex flex-col">
      <div className="flex-none p-4 border-b border-slate-700">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={() => navigate('/opportunities')}
            className="p-2 hover:bg-slate-700 rounded"
          >
            <ArrowLeft className="w-5 h-5 text-slate-400" />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-white">{contactName}</h1>
              <span className={`px-2 py-1 rounded border text-sm ${getStatusBadge(opportunity.status)}`}>
                {opportunity.status}
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm text-slate-400 mt-1">
              <span>{opportunity.pipeline?.name}</span>
              <span>-</span>
              <span>{opportunity.stage?.name}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {opportunity.status === 'open' && canClose && (
              <>
                <button
                  onClick={() => setShowWonModal(true)}
                  className="flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                >
                  <Trophy className="w-4 h-4" />
                  Won
                </button>
                <button
                  onClick={() => setShowLostModal(true)}
                  className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  <XCircle className="w-4 h-4" />
                  Lost
                </button>
              </>
            )}
            {opportunity.status === 'won' && projectsEnabled && canCreateProject && !linkedProject && (
              <button
                onClick={() => setShowConvertToProject(true)}
                className="flex items-center gap-2 px-3 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700"
              >
                <FolderKanban className="w-4 h-4" />
                Convert to Project
              </button>
            )}
            {opportunity.status !== 'open' && canClose && (
              <button
                onClick={handleReopen}
                className="flex items-center gap-2 px-3 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-500"
              >
                <RotateCcw className="w-4 h-4" />
                Reopen
              </button>
            )}
            {canEdit && (
              <button
                onClick={() => setShowEditModal(true)}
                className="flex items-center gap-2 px-3 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
              >
                <Edit2 className="w-4 h-4" />
                Edit
              </button>
            )}
            <div className="relative">
              <button
                onClick={() => setShowMoreMenu(!showMoreMenu)}
                className="p-2 hover:bg-slate-700 rounded-lg"
              >
                <MoreVertical className="w-5 h-5 text-slate-400" />
              </button>
              {showMoreMenu && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowMoreMenu(false)}
                  />
                  <div className="absolute right-0 top-full mt-1 w-48 bg-slate-700 border border-slate-600 rounded-lg shadow-xl z-20 py-1">
                    <button
                      onClick={handleCopyLink}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-600"
                    >
                      <LinkIcon className="w-4 h-4" />
                      {copySuccess ? 'Copied!' : 'Copy Link'}
                    </button>
                    {canEdit && (
                      <button
                        onClick={handleDelete}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-red-400 hover:bg-slate-600"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete Opportunity
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-1">
          {(['details', 'activity', 'tasks', 'notes', ...(paymentsEnabled && canViewPayments && canAccessPayments ? ['invoices'] : []), ...(mediaEnabled && canViewMedia ? ['files'] : [])] as TabType[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-t-lg text-sm font-medium capitalize ${
                activeTab === tab
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="flex h-full">
          <div className="flex-1 p-6 overflow-y-auto">
            {activeTab === 'details' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-slate-400 mb-1">Value</label>
                      <div className="flex items-center gap-2 text-2xl font-semibold text-emerald-400">
                        <DollarSign className="w-6 h-6" />
                        {formatCurrency(Number(opportunity.value_amount), opportunity.currency)}
                        {(opportunity as Opportunity & { financial_locked?: boolean }).financial_locked && (
                          <Lock className="w-4 h-4 text-amber-400" title="Financials locked - linked to project" />
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm text-slate-400 mb-1">Stage</label>
                      {canEdit && opportunity.status === 'open' ? (
                        <select
                          value={opportunity.stage_id}
                          onChange={(e) => handleStageChange(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
                        >
                          {stages.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      ) : (
                        <div className="text-white">{opportunity.stage?.name}</div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm text-slate-400 mb-1">Assigned To</label>
                      <div className="flex items-center gap-2 text-white">
                        <User className="w-4 h-4 text-slate-400" />
                        {opportunity.assigned_user?.name || 'Unassigned'}
                      </div>
                    </div>

                    {opportunity.source && (
                      <div>
                        <label className="block text-sm text-slate-400 mb-1">Source</label>
                        <div className="text-white">{opportunity.source}</div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    {opportunity.close_date && (
                      <div>
                        <label className="block text-sm text-slate-400 mb-1">Close Date</label>
                        <div className="flex items-center gap-2 text-white">
                          <Calendar className="w-4 h-4 text-slate-400" />
                          {formatDate(opportunity.close_date)}
                        </div>
                      </div>
                    )}

                    {opportunity.closed_at && (
                      <div>
                        <label className="block text-sm text-slate-400 mb-1">Closed At</label>
                        <div className="text-white">{formatDateTime(opportunity.closed_at)}</div>
                      </div>
                    )}

                    {opportunity.lost_reason && (
                      <div>
                        <label className="block text-sm text-slate-400 mb-1">Lost Reason</label>
                        <div className="text-red-400">{opportunity.lost_reason}</div>
                      </div>
                    )}

                    <div>
                      <label className="block text-sm text-slate-400 mb-1">Created</label>
                      <div className="text-slate-300">{formatDateTime(opportunity.created_at)}</div>
                    </div>

                    <div>
                      <label className="block text-sm text-slate-400 mb-1">Last Updated</label>
                      <div className="text-slate-300">{formatDateTime(opportunity.updated_at)}</div>
                    </div>
                  </div>
                </div>

                {opportunity.custom_field_values && opportunity.custom_field_values.length > 0 && (
                  <div className="border-t border-slate-700 pt-6">
                    <h3 className="text-sm font-medium text-slate-300 mb-4">Custom Fields</h3>
                    <div className="grid grid-cols-2 gap-4">
                      {opportunity.custom_field_values.map(cfv => (
                        <div key={cfv.id}>
                          <label className="block text-sm text-slate-400 mb-1">
                            {cfv.custom_field?.label}
                          </label>
                          <div className="text-white">
                            {cfv.value_text ||
                              cfv.value_number?.toString() ||
                              (cfv.value_date ? formatDate(cfv.value_date) : null) ||
                              (cfv.value_boolean !== null ? (cfv.value_boolean ? 'Yes' : 'No') : null) ||
                              JSON.stringify(cfv.value_json) ||
                              '-'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'activity' && (
              <div className="space-y-4">
                {timeline.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    No activity yet
                  </div>
                ) : (
                  <div className="relative">
                    <div className="absolute left-4 top-0 bottom-0 w-px bg-slate-700" />
                    <div className="space-y-4">
                      {timeline.map(event => (
                        <div key={event.id} className="relative pl-10">
                          <div className="absolute left-2 top-1 w-5 h-5 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center">
                            {getEventIcon(event.event_type)}
                          </div>
                          <div className="bg-slate-800/50 rounded-lg p-3">
                            <div className="text-white">{event.summary}</div>
                            <div className="flex items-center gap-3 mt-1 text-sm text-slate-400">
                              {event.actor && <span>{event.actor.name}</span>}
                              <span>{formatDateTime(event.created_at)}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'tasks' && opportunity && (
              <OpportunityTasksTab
                contactId={opportunity.contact_id}
                opportunityId={opportunity.id}
                users={users}
                canEdit={canEdit}
              />
            )}

            {activeTab === 'notes' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <textarea
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Add a note..."
                    rows={3}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white resize-none"
                  />
                  <button
                    onClick={handleAddNote}
                    disabled={savingNote || !newNote.trim()}
                    className="px-4 py-2 bg-cyan-600 text-white rounded hover:bg-cyan-700 disabled:opacity-50"
                  >
                    {savingNote ? 'Adding...' : 'Add Note'}
                  </button>
                </div>

                {notes.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    No notes yet
                  </div>
                ) : (
                  <div className="space-y-3">
                    {notes.map(note => (
                      <div key={note.id} className="bg-slate-800/50 rounded-lg p-4">
                        <div className="text-white whitespace-pre-wrap">{note.body}</div>
                        <div className="flex items-center justify-between mt-2 text-sm text-slate-400">
                          <div className="flex items-center gap-2">
                            {note.created_by_user && <span>{note.created_by_user.name}</span>}
                            <span>{formatDateTime(note.created_at)}</span>
                          </div>
                          {user?.id === note.created_by && (
                            <button
                              onClick={() => handleDeleteNote(note.id)}
                              className="p-1 hover:bg-slate-700 rounded"
                            >
                              <Trash2 className="w-4 h-4 text-red-400" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'invoices' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-slate-300">Invoices</h3>
                  {canCreateInvoice && (
                    <button
                      onClick={() => setShowCreateInvoice(true)}
                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-600/20 text-emerald-400 rounded-lg hover:bg-emerald-600/30 text-sm"
                    >
                      <Plus className="w-4 h-4" />
                      New Invoice
                    </button>
                  )}
                </div>

                {invoices.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <CreditCard className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p>No invoices yet</p>
                    {canCreateInvoice && (
                      <button
                        onClick={() => setShowCreateInvoice(true)}
                        className="mt-2 text-emerald-400 hover:text-emerald-300 text-sm"
                      >
                        Create the first invoice
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {invoices.map(invoice => {
                      const statusStyle = INVOICE_STATUS_STYLES[invoice.status];
                      return (
                        <Link
                          key={invoice.id}
                          to={`/payments/invoices/${invoice.id}`}
                          className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg hover:bg-slate-700/50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <FileText className="w-4 h-4 text-slate-400" />
                            <div>
                              <p className="text-white font-medium">{invoice.doc_number || 'Draft'}</p>
                              <p className="text-xs text-slate-400">{formatDate(invoice.created_at)}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`}>
                              {statusStyle.label}
                            </span>
                            <span className="text-white font-medium">
                              {formatCurrency(invoice.total, invoice.currency)}
                            </span>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'files' && opportunity && (
              <OpportunityFilesTab opportunity={opportunity} onUpdate={loadOpportunity} />
            )}
          </div>

          <div className="w-80 border-l border-slate-700 p-4 bg-slate-800/30 overflow-y-auto">
            <h3 className="text-sm font-medium text-slate-300 mb-4">Contact</h3>
            {contact && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center">
                    <User className="w-6 h-6 text-slate-400" />
                  </div>
                  <div>
                    <div className="text-white font-medium">{contactName}</div>
                    {contact.company && (
                      <div className="text-sm text-slate-400">{contact.company}</div>
                    )}
                  </div>
                </div>

                {contact.email && (
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Email</label>
                    <div className="text-slate-300">{contact.email}</div>
                  </div>
                )}

                {contact.phone && (
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Phone</label>
                    <div className="text-slate-300">{contact.phone}</div>
                  </div>
                )}

                {(() => {
                  const normalizedTags = normalizeTagsArray(contact.tags);
                  return normalizedTags.length > 0 && (
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Tags</label>
                      <div className="flex flex-wrap gap-1">
                        {normalizedTags.map((tag) => (
                          <span
                            key={tag.id}
                            className="px-2 py-0.5 rounded text-xs"
                            style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
                          >
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                <Link
                  to={`/contacts/${contact.id}`}
                  className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300 text-sm"
                >
                  <ExternalLink className="w-4 h-4" />
                  View Full Profile
                </Link>

                {scoringEnabled && (
                  <div className="pt-4 border-t border-slate-700">
                    <h4 className="text-xs font-medium text-slate-400 mb-2">Contact Score</h4>
                    <ScoreWidget
                      entityType="contact"
                      entityId={contact.id}
                      canAdjust={canAdjustScore}
                    />
                  </div>
                )}
              </div>
            )}

            {linkedProject && (
              <div className="mt-6 pt-4 border-t border-slate-700">
                <h3 className="text-sm font-medium text-slate-300 mb-3">Linked Project</h3>
                <Link
                  to={`/projects/${linkedProject.id}`}
                  className="block p-3 bg-slate-700/50 rounded-lg hover:bg-slate-700 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <FolderKanban className="w-4 h-4 text-cyan-400" />
                    <span className="text-white font-medium text-sm truncate">{linkedProject.name}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <span className="capitalize">{linkedProject.status.replace('_', ' ')}</span>
                    <span>{linkedProject.progress_percent}% complete</span>
                  </div>
                </Link>
              </div>
            )}

            {scoringEnabled && (
              <div className="mt-6 pt-4 border-t border-slate-700">
                <h3 className="text-sm font-medium text-slate-300 mb-4">Opportunity Score</h3>
                <ScoreWidget
                  entityType="opportunity"
                  entityId={opportunity.id}
                  canAdjust={canAdjustScore}
                />
              </div>
            )}

            <div className="mt-6 pt-4 border-t border-slate-700">
              <AskClaraButton
                module="opportunities"
                recordId={opportunity.id}
                prompt={`Tell me about opportunity ${opportunity.name}`}
                label="Ask Clara about this deal"
                size="md"
              />
            </div>
          </div>
        </div>
      </div>

      {showEditModal && user && (
        <OpportunityModal
          opportunity={opportunity}
          orgId={user.organization_id}
          currentUser={user}
          onClose={() => setShowEditModal(false)}
          onSave={(updated) => {
            setOpportunity(updated);
            setShowEditModal(false);
          }}
        />
      )}

      {showWonModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <Trophy className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Mark as Won</h2>
                <p className="text-sm text-slate-400">Congratulations on closing this deal!</p>
              </div>
            </div>

            <div className="p-3 bg-slate-700/50 rounded-lg mb-4">
              <div className="text-white font-medium">{contactName}</div>
              <div className="flex items-center gap-2 text-emerald-400 mt-1">
                <DollarSign className="w-4 h-4" />
                {formatCurrency(Number(opportunity.value_amount), opportunity.currency)}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowWonModal(false)}
                className="flex-1 px-4 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={handleMarkWon}
                className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center justify-center gap-2"
              >
                <Trophy className="w-4 h-4" />
                Confirm Won
              </button>
            </div>
          </div>
        </div>
      )}

      {showLostModal && (
        <CloseLostModal
          opportunity={opportunity}
          onClose={() => setShowLostModal(false)}
          onConfirm={handleMarkLost}
        />
      )}

      {showCreateInvoice && opportunity && (
        <CreateInvoiceModal
          defaultContactId={opportunity.contact_id}
          defaultOpportunityId={opportunity.id}
          onClose={() => setShowCreateInvoice(false)}
          onCreated={() => {
            setShowCreateInvoice(false);
            loadRelatedData();
          }}
        />
      )}

      {showConvertToProject && opportunity && (
        <ConvertToProjectModal
          opportunity={opportunity}
          onClose={() => setShowConvertToProject(false)}
          onConverted={() => {
            setShowConvertToProject(false);
            loadOpportunity();
          }}
        />
      )}
    </div>
  );
}
