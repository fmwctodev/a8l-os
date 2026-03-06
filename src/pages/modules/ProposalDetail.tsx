import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { usePaymentsAccess } from '../../hooks/usePaymentsAccess';
import { SendProposalModal } from '../../components/proposals/SendProposalModal';
import { ConvertToInvoiceModal } from '../../components/proposals/ConvertToInvoiceModal';
import {
  getProposalById,
  updateProposal,
  sendProposal,
  deleteProposal,
  duplicateProposal,
  archiveProposal,
  unarchiveProposal,
  getProposalComments,
  addProposalComment,
  getProposalActivities,
  updateProposalSection,
  deleteProposalSection,
  reorderProposalSections,
  addProposalLineItem,
  updateProposalLineItem,
  deleteProposalLineItem,
  recalculateAndUpdateProposalTotal,
} from '../../services/proposals';
import type { Proposal, ProposalComment, ProposalActivity, ProposalSection, ProposalLineItem } from '../../types';
import {
  ArrowLeft,
  FileText,
  FileDown,
  Send,
  Edit3,
  Trash2,
  Loader2,
  User,
  Calendar,
  DollarSign,
  Clock,
  CheckCircle2,
  XCircle,
  Eye,
  AlertCircle,
  MessageSquare,
  Activity,
  Plus,
  GripVertical,
  Sparkles,
  ExternalLink,
  Copy,
  MoreVertical,
  Video,
  Archive,
  ArchiveRestore,
  Copy as CopyIcon,
} from 'lucide-react';
import { exportProposalToPDF } from '../../services/proposalPdfExport';
import { getBrandKits } from '../../services/brandboard';

const STATUS_STYLES = {
  draft: { bg: 'bg-slate-500/20', text: 'text-slate-300', icon: Clock, label: 'Draft' },
  sent: { bg: 'bg-cyan-500/20', text: 'text-cyan-300', icon: Send, label: 'Sent' },
  viewed: { bg: 'bg-amber-500/20', text: 'text-amber-300', icon: Eye, label: 'Viewed' },
  accepted: { bg: 'bg-emerald-500/20', text: 'text-emerald-300', icon: CheckCircle2, label: 'Accepted' },
  rejected: { bg: 'bg-red-500/20', text: 'text-red-300', icon: XCircle, label: 'Rejected' },
  expired: { bg: 'bg-slate-700/50', text: 'text-slate-500', icon: AlertCircle, label: 'Expired' },
};

type TabType = 'content' | 'pricing' | 'comments' | 'activity';

export function ProposalDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  const canAccessPayments = usePaymentsAccess();
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [comments, setComments] = useState<ProposalComment[]>([]);
  const [activities, setActivities] = useState<ProposalActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('content');
  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [sectionContent, setSectionContent] = useState('');
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);

  const canEdit = hasPermission('proposals.edit');
  const canSend = hasPermission('proposals.send');
  const canDelete = hasPermission('proposals.delete');

  useEffect(() => {
    if (id) {
      loadProposal();
    }
  }, [id]);

  const loadProposal = async () => {
    try {
      setIsLoading(true);
      const data = await getProposalById(id!);
      setProposal(data);

      if (data) {
        const [commentsData, activitiesData] = await Promise.all([
          getProposalComments(id!),
          getProposalActivities(id!),
        ]);
        setComments(commentsData);
        setActivities(activitiesData);
      }
    } catch (err) {
      console.error('Failed to load proposal:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportPDF = async () => {
    if (!proposal) return;
    try {
      setIsExportingPDF(true);
      let brandKit = null;
      try {
        const kits = await getBrandKits(proposal.org_id, { active: true });
        if (kits.length > 0) brandKit = kits[0];
      } catch {}
      await exportProposalToPDF(proposal, brandKit);
    } catch (err) {
      console.error('Failed to export PDF:', err);
      alert('Failed to open print window. Please allow popups for this site.');
    } finally {
      setIsExportingPDF(false);
    }
  };

  const handleSendProposal = () => {
    if (!proposal?.contact?.email) {
      alert('This proposal must have a contact with an email address before it can be sent.');
      return;
    }
    setShowSendModal(true);
  };

  const handleSendComplete = () => {
    setShowSendModal(false);
    loadProposal();
  };

  const handleDeleteProposal = async () => {
    if (!proposal || !confirm('Are you sure you want to delete this proposal?')) return;
    try {
      await deleteProposal(proposal.id);
      navigate('/proposals');
    } catch (err) {
      console.error('Failed to delete proposal:', err);
    }
  };

  const handleDuplicateProposal = async () => {
    if (!proposal || !user) return;
    try {
      const duplicated = await duplicateProposal(proposal.id, user.id);
      navigate(`/proposals/${duplicated.id}`);
    } catch (err) {
      console.error('Failed to duplicate proposal:', err);
    }
  };

  const handleArchiveProposal = async () => {
    if (!proposal || !user) return;
    try {
      await archiveProposal(proposal.id, user.id);
      loadProposal();
    } catch (err) {
      console.error('Failed to archive proposal:', err);
    }
  };

  const handleUnarchiveProposal = async () => {
    if (!proposal || !user) return;
    try {
      await unarchiveProposal(proposal.id, user.id);
      loadProposal();
    } catch (err) {
      console.error('Failed to unarchive proposal:', err);
    }
  };

  const handleAddComment = async () => {
    if (!proposal || !user || !newComment.trim()) return;
    try {
      setIsSubmittingComment(true);
      await addProposalComment({
        org_id: proposal.org_id,
        proposal_id: proposal.id,
        user_id: user.id,
        content: newComment.trim(),
      });
      setNewComment('');
      const updatedComments = await getProposalComments(proposal.id);
      setComments(updatedComments);
    } catch (err) {
      console.error('Failed to add comment:', err);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleSectionUpdate = async (sectionId: string, content: string) => {
    try {
      await updateProposalSection(sectionId, { content });
      loadProposal();
      setEditingSection(null);
    } catch (err) {
      console.error('Failed to update section:', err);
    }
  };

  const handleDeleteSection = async (sectionId: string) => {
    if (!confirm('Delete this section?')) return;
    try {
      await deleteProposalSection(sectionId);
      loadProposal();
    } catch (err) {
      console.error('Failed to delete section:', err);
    }
  };

  const copyPublicLink = () => {
    if (!proposal) return;
    const url = `${window.location.origin}/p/${proposal.public_token}`;
    navigator.clipboard.writeText(url);
  };

  const formatCurrency = (amount: number, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString();
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400">
        <FileText className="w-12 h-12 mb-4 opacity-50" />
        <p>Proposal not found</p>
        <Link to="/proposals" className="mt-4 text-cyan-400 hover:text-cyan-300">
          Back to Proposals
        </Link>
      </div>
    );
  }

  const statusStyle = STATUS_STYLES[proposal.status];
  const StatusIcon = statusStyle.icon;

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 border-b border-slate-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/proposals')}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-400" />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-semibold text-white">{proposal.title}</h1>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`}>
                  <StatusIcon className="w-3 h-3" />
                  {statusStyle.label}
                </span>
                {proposal.archived_at && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-500/20 text-slate-400 rounded-full text-xs">
                    <Archive className="w-3 h-3" />
                    Archived
                  </span>
                )}
                {proposal.ai_context?.generated_at && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-cyan-500/20 text-cyan-300 rounded-full text-xs">
                    <Sparkles className="w-3 h-3" />
                    AI Generated
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 mt-1 text-sm text-slate-400">
                <span className="flex items-center gap-1">
                  <User className="w-4 h-4" />
                  {proposal.contact?.company || `${proposal.contact?.first_name} ${proposal.contact?.last_name}`}
                </span>
                <span className="flex items-center gap-1">
                  <DollarSign className="w-4 h-4" />
                  {formatCurrency(proposal.total_value, proposal.currency)}
                </span>
                {proposal.valid_until && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    Valid until {formatDate(proposal.valid_until)}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canEdit && proposal.status === 'draft' && (
              <Link
                to={`/proposals/${proposal.id}/build`}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
              >
                <Sparkles className="w-4 h-4" />
                AI Builder
              </Link>
            )}
            {canSend && proposal.status === 'draft' && (
              <button
                onClick={handleSendProposal}
                className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors"
              >
                <Send className="w-4 h-4" />
                Send Proposal
              </button>
            )}
            {proposal.status === 'accepted' && hasPermission('payments.manage') && canAccessPayments && (
              <button
                onClick={() => setShowConvertModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors"
              >
                <DollarSign className="w-4 h-4" />
                Convert to Invoice
              </button>
            )}
            {proposal.status !== 'draft' && (
              <>
                <button
                  onClick={copyPublicLink}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
                >
                  <Copy className="w-4 h-4" />
                  Copy Link
                </button>
                <a
                  href={`/p/${proposal.public_token}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  Preview
                </a>
              </>
            )}
            <button
              onClick={handleExportPDF}
              disabled={isExportingPDF}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {isExportingPDF ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileDown className="w-4 h-4" />
              )}
              Export PDF
            </button>
            <div className="relative">
              <button
                onClick={() => setShowActionMenu(!showActionMenu)}
                className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
              >
                <MoreVertical className="w-5 h-5 text-slate-400" />
              </button>
              {showActionMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50">
                  {canEdit && (
                    <button
                      onClick={handleDuplicateProposal}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors"
                    >
                      <CopyIcon className="w-4 h-4" />
                      Duplicate
                    </button>
                  )}
                  {canEdit && !proposal.archived_at && (
                    <button
                      onClick={handleArchiveProposal}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors"
                    >
                      <Archive className="w-4 h-4" />
                      Archive
                    </button>
                  )}
                  {canEdit && proposal.archived_at && (
                    <button
                      onClick={handleUnarchiveProposal}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors"
                    >
                      <ArchiveRestore className="w-4 h-4" />
                      Unarchive
                    </button>
                  )}
                  {canDelete && (
                    <button
                      onClick={handleDeleteProposal}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-slate-700 transition-colors border-t border-slate-700"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 mt-4">
          {(['content', 'pricing', 'comments', 'activity'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              {tab === 'content' && <FileText className="w-4 h-4 inline mr-2" />}
              {tab === 'pricing' && <DollarSign className="w-4 h-4 inline mr-2" />}
              {tab === 'comments' && <MessageSquare className="w-4 h-4 inline mr-2" />}
              {tab === 'activity' && <Activity className="w-4 h-4 inline mr-2" />}
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {tab === 'comments' && comments.length > 0 && (
                <span className="ml-2 px-1.5 py-0.5 bg-cyan-500/20 text-cyan-300 rounded text-xs">
                  {comments.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {activeTab === 'content' && (
          <div className="max-w-4xl mx-auto space-y-6">
            {proposal.meeting_contexts && proposal.meeting_contexts.length > 0 && (
              <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                <h3 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
                  <Video className="w-4 h-4 text-cyan-400" />
                  Meeting Context
                </h3>
                <div className="space-y-2">
                  {proposal.meeting_contexts.map((ctx) => (
                    <div key={ctx.id} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
                      <div>
                        <p className="text-white text-sm">{ctx.meeting_transcription?.meeting_title}</p>
                        <p className="text-xs text-slate-400">
                          {formatDate(ctx.meeting_transcription?.meeting_date || null)}
                        </p>
                      </div>
                      {ctx.meeting_transcription?.recording_url && (
                        <a
                          href={ctx.meeting_transcription.recording_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300"
                        >
                          <Video className="w-3 h-3" />
                          View Recording
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {proposal.sections && proposal.sections.length > 0 ? (
              proposal.sections
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((section) => (
                  <div
                    key={section.id}
                    className="bg-slate-800/50 rounded-lg border border-slate-700 overflow-hidden"
                  >
                    <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <GripVertical className="w-4 h-4 text-slate-500" />
                        <h3 className="font-medium text-white">{section.title}</h3>
                        {section.ai_generated && (
                          <span className="px-1.5 py-0.5 bg-cyan-500/20 text-cyan-300 rounded text-xs">
                            AI
                          </span>
                        )}
                      </div>
                      {canEdit && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setEditingSection(section.id);
                              setSectionContent(section.content);
                            }}
                            className="p-1.5 hover:bg-slate-700 rounded transition-colors"
                          >
                            <Edit3 className="w-4 h-4 text-slate-400" />
                          </button>
                          <button
                            onClick={() => handleDeleteSection(section.id)}
                            className="p-1.5 hover:bg-slate-700 rounded transition-colors"
                          >
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      {editingSection === section.id ? (
                        <div className="space-y-3">
                          <textarea
                            value={sectionContent}
                            onChange={(e) => setSectionContent(e.target.value)}
                            className="w-full h-48 px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white resize-none focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => setEditingSection(null)}
                              className="px-3 py-1.5 text-slate-400 hover:text-white transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleSectionUpdate(section.id, sectionContent)}
                              className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors"
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="proposal-content max-w-none text-sm">
                          <div dangerouslySetInnerHTML={{ __html: section.content.replace(/\n/g, '<br>') }} />
                        </div>
                      )}
                    </div>
                  </div>
                ))
            ) : (
              <div className="text-center py-12 text-slate-400">
                <FileText className="w-10 h-10 mx-auto mb-3 opacity-50" />
                <p>No content sections yet</p>
                {canEdit && (
                  <Link
                    to={`/proposals/${proposal.id}/build`}
                    className="mt-4 inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300"
                  >
                    <Sparkles className="w-4 h-4" />
                    Generate with AI
                  </Link>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'pricing' && (
          <div className="max-w-4xl mx-auto">
            <div className="bg-slate-800/50 rounded-lg border border-slate-700 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase">Item</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase">Qty</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase">Unit Price</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase">Discount</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {proposal.line_items && proposal.line_items.length > 0 ? (
                    proposal.line_items.map((item) => {
                      const lineTotal = item.quantity * item.unit_price;
                      const discount = lineTotal * (item.discount_percent / 100);
                      const total = lineTotal - discount;

                      return (
                        <tr key={item.id}>
                          <td className="px-4 py-3">
                            <p className="text-white">{item.name}</p>
                            {item.description && (
                              <p className="text-sm text-slate-400">{item.description}</p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-300">{item.quantity}</td>
                          <td className="px-4 py-3 text-right text-slate-300">
                            {formatCurrency(item.unit_price, proposal.currency)}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-300">
                            {item.discount_percent > 0 ? `${item.discount_percent}%` : '-'}
                          </td>
                          <td className="px-4 py-3 text-right text-white font-medium">
                            {formatCurrency(total, proposal.currency)}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                        No line items added
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot className="border-t border-slate-600">
                  <tr>
                    <td colSpan={4} className="px-4 py-3 text-right text-white font-medium">
                      Total
                    </td>
                    <td className="px-4 py-3 text-right text-xl text-white font-semibold">
                      {formatCurrency(proposal.total_value, proposal.currency)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'comments' && (
          <div className="max-w-2xl mx-auto space-y-4">
            <div className="flex gap-3">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                className="flex-1 px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                rows={3}
              />
            </div>
            <div className="flex justify-end">
              <button
                onClick={handleAddComment}
                disabled={!newComment.trim() || isSubmittingComment}
                className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                {isSubmittingComment ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <MessageSquare className="w-4 h-4" />
                )}
                Add Comment
              </button>
            </div>

            <div className="space-y-4 mt-6">
              {comments.length === 0 ? (
                <p className="text-center text-slate-400 py-8">No comments yet</p>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
                        {comment.is_client_comment ? (
                          <User className="w-4 h-4 text-amber-400" />
                        ) : (
                          <span className="text-xs font-medium text-white">
                            {comment.user?.name?.[0] || 'U'}
                          </span>
                        )}
                      </div>
                      <div>
                        <p className="text-white text-sm font-medium">
                          {comment.is_client_comment
                            ? comment.client_name || 'Client'
                            : comment.user?.name || 'Unknown'}
                        </p>
                        <p className="text-xs text-slate-400">{formatDateTime(comment.created_at)}</p>
                      </div>
                    </div>
                    <p className="text-slate-300">{comment.content}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="max-w-2xl mx-auto">
            <div className="space-y-4">
              {activities.length === 0 ? (
                <p className="text-center text-slate-400 py-8">No activity recorded</p>
              ) : (
                activities.map((activity) => (
                  <div key={activity.id} className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center flex-shrink-0">
                      {activity.activity_type === 'created' && <Plus className="w-4 h-4 text-emerald-400" />}
                      {activity.activity_type === 'sent' && <Send className="w-4 h-4 text-cyan-400" />}
                      {activity.activity_type === 'viewed' && <Eye className="w-4 h-4 text-amber-400" />}
                      {activity.activity_type === 'status_changed' && <Activity className="w-4 h-4 text-slate-400" />}
                      {activity.activity_type === 'ai_generated' && <Sparkles className="w-4 h-4 text-cyan-400" />}
                      {activity.activity_type === 'updated' && <Edit3 className="w-4 h-4 text-slate-400" />}
                      {activity.activity_type === 'commented' && <MessageSquare className="w-4 h-4 text-slate-400" />}
                    </div>
                    <div className="flex-1 pb-4 border-b border-slate-700/50">
                      <p className="text-white">{activity.description}</p>
                      <div className="flex items-center gap-2 mt-1 text-sm text-slate-400">
                        {activity.actor?.name && <span>{activity.actor.name}</span>}
                        <span>{formatDateTime(activity.created_at)}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {showSendModal && proposal && (
        <SendProposalModal
          proposal={proposal}
          onClose={() => setShowSendModal(false)}
          onSent={handleSendComplete}
        />
      )}

      {showConvertModal && proposal && canAccessPayments && (
        <ConvertToInvoiceModal
          proposal={proposal}
          onClose={() => setShowConvertModal(false)}
          onConverted={() => {
            setShowConvertModal(false);
            loadProposal();
          }}
        />
      )}
    </div>
  );
}
