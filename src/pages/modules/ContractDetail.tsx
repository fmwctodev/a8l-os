import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { sanitizeHtml } from '../../utils/sanitizeHtml';
import {
  getContractById,
  updateContract,
  deleteContract,
  archiveContract,
  unarchiveContract,
  updateContractSection,
  deleteContractSection,
  addContractComment,
  getContractComments,
  getContractActivities,
  createContractActivity,
} from '../../services/contracts';
import {
  getContractSignatureRequest,
  getContractAuditEvents,
  voidContractSignatureRequest,
  resendContractSignatureRequest,
} from '../../services/contractSigning';
import { exportContractToPDF } from '../../services/contractPdfExport';
import { getBrandKits } from '../../services/brandboard';
import { SendContractForSignatureModal } from '../../components/contracts/SendContractForSignatureModal';
import type {
  Contract,
  ContractComment,
  ContractActivity,
  ContractSignatureRequest,
  ContractAuditEvent,
} from '../../types';
import {
  ArrowLeft,
  FileText,
  FileDown,
  Send,
  CreditCard as Edit3,
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
  GripVertical,
  Sparkles,
  ExternalLink,
  Copy,
  MoreVertical,
  PenTool,
  Shield,
  Ban,
  RefreshCw,
  Scale,
  Archive,
  ArchiveRestore,
  MapPin,
} from 'lucide-react';

const STATUS_STYLES: Record<string, { bg: string; text: string; icon: typeof Clock; label: string }> = {
  draft: { bg: 'bg-slate-500/20', text: 'text-slate-300', icon: Clock, label: 'Draft' },
  pending_review: { bg: 'bg-amber-500/20', text: 'text-amber-300', icon: Eye, label: 'Pending Review' },
  active: { bg: 'bg-emerald-500/20', text: 'text-emerald-300', icon: CheckCircle2, label: 'Active' },
  signed: { bg: 'bg-emerald-500/20', text: 'text-emerald-300', icon: PenTool, label: 'Signed' },
  declined: { bg: 'bg-red-500/20', text: 'text-red-300', icon: XCircle, label: 'Declined' },
  expired: { bg: 'bg-slate-700/50', text: 'text-slate-500', icon: AlertCircle, label: 'Expired' },
  voided: { bg: 'bg-slate-700/50', text: 'text-slate-500', icon: Ban, label: 'Voided' },
};

const SIG_STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  not_sent: { bg: 'bg-slate-500/20', text: 'text-slate-400', label: 'Not Sent' },
  pending_signature: { bg: 'bg-amber-500/20', text: 'text-amber-300', label: 'Pending Signature' },
  viewed: { bg: 'bg-cyan-500/20', text: 'text-cyan-300', label: 'Viewed' },
  signed: { bg: 'bg-emerald-500/20', text: 'text-emerald-300', label: 'Signed' },
  declined: { bg: 'bg-red-500/20', text: 'text-red-300', label: 'Declined' },
  expired: { bg: 'bg-slate-700/50', text: 'text-slate-500', label: 'Expired' },
  voided: { bg: 'bg-slate-700/50', text: 'text-slate-500', label: 'Voided' },
};

const AUDIT_ICONS: Record<string, { icon: typeof Clock; color: string }> = {
  sent_for_signature: { icon: Send, color: 'text-cyan-400' },
  viewed: { icon: Eye, color: 'text-amber-400' },
  signed: { icon: PenTool, color: 'text-emerald-400' },
  declined: { icon: XCircle, color: 'text-red-400' },
  voided: { icon: Ban, color: 'text-slate-400' },
  resent: { icon: RefreshCw, color: 'text-cyan-400' },
};

const CONTRACT_TYPE_LABELS: Record<string, string> = {
  freelance_service: 'Freelance Service Agreement',
  retainer: 'Retainer Agreement',
  partnership: 'Partnership Agreement',
  nda: 'Non-Disclosure Agreement',
};

type TabType = 'content' | 'signature' | 'comments' | 'activity';

function formatDateTime(d: string | null | undefined): string {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

function formatCurrency(val: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: currency || 'USD', minimumFractionDigits: 0,
  }).format(val);
}

export function ContractDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  const { showToast } = useToast();

  const [contract, setContract] = useState<Contract | null>(null);
  const [comments, setComments] = useState<ContractComment[]>([]);
  const [activities, setActivities] = useState<ContractActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('content');
  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [sectionContent, setSectionContent] = useState('');
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [signatureRequest, setSignatureRequest] = useState<ContractSignatureRequest | null>(null);
  const [auditEvents, setAuditEvents] = useState<ContractAuditEvent[]>([]);
  const [isVoiding, setIsVoiding] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const canEdit = hasPermission('contracts.edit');
  const canSend = hasPermission('contracts.send');
  const canDelete = hasPermission('contracts.delete');

  const loadContract = async () => {
    if (!id) return;
    try {
      setIsLoading(true);
      const [data, commentsData, activitiesData] = await Promise.all([
        getContractById(id),
        getContractComments(id),
        getContractActivities(id),
      ]);
      setContract(data);
      setComments(commentsData);
      setActivities(activitiesData);

      if (data) {
        const [sigReq, audit] = await Promise.all([
          getContractSignatureRequest(id),
          getContractAuditEvents(id),
        ]);
        setSignatureRequest(sigReq);
        setAuditEvents(audit);
      }
    } catch (err) {
      console.error('Failed to load contract:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadContract();
  }, [id]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="text-center py-16">
        <Scale className="w-12 h-12 mx-auto mb-4 text-slate-500" />
        <h2 className="text-xl font-semibold text-white mb-2">Contract Not Found</h2>
        <button onClick={() => navigate(-1)} className="text-cyan-400 hover:text-cyan-300 mt-2">
          Go Back
        </button>
      </div>
    );
  }

  const sigStatus = contract.signature_status || 'not_sent';
  const isFrozen = ['pending_signature', 'viewed', 'signed'].includes(sigStatus);
  const canRequestSignature = canSend && contract.status === 'draft' && !isFrozen;
  const statusStyle = STATUS_STYLES[contract.status] || STATUS_STYLES.draft;
  const StatusIcon = statusStyle.icon;
  const typeLabel = CONTRACT_TYPE_LABELS[contract.contract_type] || contract.contract_type;

  const handleSectionUpdate = async (sectionId: string, content: string) => {
    try {
      await updateContractSection(sectionId, contract.id, { content });
      loadContract();
      setEditingSection(null);
      showToast('Section updated', 'success');
    } catch (err) {
      console.error('Failed to update section:', err);
      showToast('Failed to update section', 'error');
    }
  };

  const handleDeleteSection = async (sectionId: string) => {
    if (!confirm('Delete this section?')) return;
    try {
      await deleteContractSection(sectionId, contract.id);
      loadContract();
      showToast('Section deleted', 'success');
    } catch (err) {
      console.error('Failed to delete section:', err);
      showToast('Failed to delete section', 'error');
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !user) return;
    try {
      setIsSubmittingComment(true);
      await addContractComment(user.organization_id, contract.id, user.id, newComment.trim());
      setNewComment('');
      const updated = await getContractComments(contract.id);
      setComments(updated);
    } catch (err) {
      console.error('Failed to add comment:', err);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleExportPDF = async () => {
    try {
      setIsExportingPDF(true);
      let brandKit = null;
      try {
        const kits = await getBrandKits(user!.organization_id, { active: true });
        if (kits.length > 0) brandKit = kits[0];
      } catch { /* continue */ }
      await exportContractToPDF(contract, brandKit);
    } catch (err) {
      console.error('Export failed:', err);
      showToast('Export failed. Allow pop-ups and try again.', 'error');
    } finally {
      setIsExportingPDF(false);
    }
  };

  const copyPublicLink = () => {
    if (!contract.public_token) return;
    navigator.clipboard.writeText(`${window.location.origin}/c/${contract.public_token}`);
    showToast('Public link copied', 'success');
  };

  const handleArchive = async () => {
    try {
      if (contract.archived_at) {
        await unarchiveContract(contract.id);
        showToast('Contract unarchived', 'success');
      } else {
        await archiveContract(contract.id);
        showToast('Contract archived', 'success');
      }
      loadContract();
    } catch { showToast('Action failed', 'error'); }
  };

  const handleDelete = async () => {
    if (!confirm('Permanently delete this contract?')) return;
    try {
      await deleteContract(contract.id);
      showToast('Contract deleted', 'success');
      navigate(-1);
    } catch { showToast('Delete failed', 'error'); }
  };

  const handleVoid = async () => {
    if (!signatureRequest || !user) return;
    try {
      setIsVoiding(true);
      await voidContractSignatureRequest(signatureRequest.id, contract.id, user.organization_id, user.id);
      showToast('Signature request voided', 'success');
      loadContract();
    } catch { showToast('Void failed', 'error'); }
    finally { setIsVoiding(false); }
  };

  const handleResend = async () => {
    if (!signatureRequest || !user) return;
    try {
      setIsResending(true);
      const { signingUrl } = await resendContractSignatureRequest(signatureRequest.id, contract.id, user.organization_id, user.id);
      navigator.clipboard.writeText(signingUrl);
      showToast('Resent. Signing link copied.', 'success');
      loadContract();
    } catch { showToast('Resend failed', 'error'); }
    finally { setIsResending(false); }
  };

  const handleSendForSignature = () => setShowSignatureModal(true);

  const sections = [...(contract.sections || [])].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-800 rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-400" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">{contract.title}</h1>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`}>
              <StatusIcon className="w-3.5 h-3.5" />
              {statusStyle.label}
            </span>
            {isFrozen && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-500/20 text-amber-300">
                <Shield className="w-3 h-3" />
                Locked
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 mt-1 text-sm text-slate-400">
            <span>{typeLabel}</span>
            {contract.contact && (
              <span>
                {contract.contact.first_name} {contract.contact.last_name}
                {contract.contact.company && ` (${contract.contact.company})`}
              </span>
            )}
            {contract.total_value > 0 && (
              <span className="font-medium text-emerald-400">
                {formatCurrency(contract.total_value, contract.currency)}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canRequestSignature && (
            <button onClick={handleSendForSignature} className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg transition-colors">
              <PenTool className="w-4 h-4" />
              Send for Signature
            </button>
          )}
          {contract.public_token && (
            <>
              <button onClick={copyPublicLink} className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors">
                <Copy className="w-4 h-4" />
                Copy Link
              </button>
              <a href={`/c/${contract.public_token}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors">
                <ExternalLink className="w-4 h-4" />
                Preview
              </a>
            </>
          )}
          <button onClick={handleExportPDF} disabled={isExportingPDF} className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors disabled:opacity-50">
            {isExportingPDF ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
            Export PDF
          </button>
          <div className="relative">
            <button onClick={() => setShowActionMenu(!showActionMenu)} className="p-2 hover:bg-slate-800 rounded-lg transition-colors">
              <MoreVertical className="w-5 h-5 text-slate-400" />
            </button>
            {showActionMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50">
                {canEdit && (
                  <button onClick={handleArchive} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors">
                    {contract.archived_at ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                    {contract.archived_at ? 'Unarchive' : 'Archive'}
                  </button>
                )}
                {contract.source_proposal && (
                  <Link to={`/proposals/${contract.proposal_id}`} onClick={() => setShowActionMenu(false)} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors">
                    <FileText className="w-4 h-4" />
                    View Source Proposal
                  </Link>
                )}
                {canDelete && (
                  <button onClick={handleDelete} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-slate-700 transition-colors">
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <Calendar className="w-3.5 h-3.5" />
            Effective Date
          </div>
          <p className="text-sm text-white">{contract.effective_date ? new Date(contract.effective_date).toLocaleDateString() : 'Upon signing'}</p>
        </div>
        <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <MapPin className="w-3.5 h-3.5" />
            Governing Law
          </div>
          <p className="text-sm text-white">{contract.governing_law_state || 'Not specified'}</p>
        </div>
        <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <DollarSign className="w-3.5 h-3.5" />
            Contract Value
          </div>
          <p className="text-sm text-white font-medium">{formatCurrency(contract.total_value || 0, contract.currency)}</p>
        </div>
      </div>

      {contract.party_a_name || contract.party_b_name ? (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
            <h3 className="text-xs font-medium text-cyan-400 uppercase tracking-wider mb-2">Party A (Service Provider)</h3>
            <p className="text-sm text-white font-medium">{contract.party_a_name || 'Not set'}</p>
            {contract.party_a_email && <p className="text-xs text-slate-400 mt-1">{contract.party_a_email}</p>}
          </div>
          <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
            <h3 className="text-xs font-medium text-cyan-400 uppercase tracking-wider mb-2">Party B (Client)</h3>
            <p className="text-sm text-white font-medium">{contract.party_b_name || contract.contact ? `${contract.contact?.first_name} ${contract.contact?.last_name}` : 'Not set'}</p>
            {(contract.party_b_email || contract.contact?.email) && (
              <p className="text-xs text-slate-400 mt-1">{contract.party_b_email || contract.contact?.email}</p>
            )}
          </div>
        </div>
      ) : null}

      <div className="flex items-center gap-1 mb-6">
        {(['content', 'signature', 'comments', 'activity'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            {tab === 'content' && <FileText className="w-4 h-4 inline mr-2" />}
            {tab === 'signature' && <PenTool className="w-4 h-4 inline mr-2" />}
            {tab === 'comments' && <MessageSquare className="w-4 h-4 inline mr-2" />}
            {tab === 'activity' && <Activity className="w-4 h-4 inline mr-2" />}
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
            {tab === 'comments' && comments.length > 0 && (
              <span className="ml-2 px-1.5 py-0.5 bg-cyan-500/20 text-cyan-300 rounded text-xs">{comments.length}</span>
            )}
            {tab === 'signature' && sigStatus === 'signed' && (
              <span className="ml-2 px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 rounded text-xs">Signed</span>
            )}
          </button>
        ))}
      </div>

      {activeTab === 'content' && (
        <div className="space-y-4">
          {sections.length > 0 ? (
            sections.map((section) => (
              <div key={section.id} className="bg-slate-800/50 rounded-lg border border-slate-700 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <GripVertical className="w-4 h-4 text-slate-500" />
                    <h3 className="font-medium text-white">{section.title}</h3>
                    {section.ai_generated && (
                      <span className="px-1.5 py-0.5 bg-cyan-500/20 text-cyan-300 rounded text-xs">AI</span>
                    )}
                  </div>
                  {canEdit && !isFrozen && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => { setEditingSection(section.id); setSectionContent(section.content); }}
                        className="p-1.5 hover:bg-slate-700 rounded transition-colors"
                      >
                        <Edit3 className="w-4 h-4 text-slate-400" />
                      </button>
                      <button onClick={() => handleDeleteSection(section.id)} className="p-1.5 hover:bg-slate-700 rounded transition-colors">
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  )}
                </div>
                {section.annotation && (
                  <div className="mx-4 mt-3 px-3 py-2 bg-slate-900/50 border-l-2 border-cyan-500/50 rounded-r-md">
                    <p className="text-xs text-slate-400 italic">{section.annotation}</p>
                  </div>
                )}
                <div className="p-4">
                  {editingSection === section.id ? (
                    <div className="space-y-3">
                      <textarea
                        value={sectionContent}
                        onChange={(e) => setSectionContent(e.target.value)}
                        className="w-full h-48 px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white resize-none focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                      />
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setEditingSection(null)} className="px-3 py-1.5 text-slate-400 hover:text-white transition-colors">Cancel</button>
                        <button onClick={() => handleSectionUpdate(section.id, sectionContent)} className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors">Save</button>
                      </div>
                    </div>
                  ) : (
                    <div className="proposal-content max-w-none text-sm">
                      <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(section.content) }} />
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12 text-slate-400">
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p>No contract sections yet</p>
              <p className="text-sm mt-1">Sections are generated when the contract is created with AI</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'signature' && (
        <div className="space-y-6">
          {!signatureRequest && sigStatus === 'not_sent' ? (
            <div className="text-center py-12 text-slate-400">
              <PenTool className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p>No signature request has been sent for this contract</p>
              {canRequestSignature && (
                <button onClick={handleSendForSignature} className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg transition-colors">
                  <PenTool className="w-4 h-4" />
                  Send for Signature
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-white flex items-center gap-2">
                    <PenTool className="w-5 h-5 text-cyan-400" />
                    Signature Status
                  </h3>
                  {SIG_STATUS_STYLES[sigStatus] && (
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${SIG_STATUS_STYLES[sigStatus].bg} ${SIG_STATUS_STYLES[sigStatus].text}`}>
                      {SIG_STATUS_STYLES[sigStatus].label}
                    </span>
                  )}
                </div>
                {signatureRequest && (
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-slate-400">Signer:</span>
                      <p className="text-white">{signatureRequest.signer_name}</p>
                    </div>
                    <div>
                      <span className="text-slate-400">Email:</span>
                      <p className="text-white">{signatureRequest.signer_email}</p>
                    </div>
                    <div>
                      <span className="text-slate-400">Expires:</span>
                      <p className="text-white">{formatDateTime(signatureRequest.expires_at)}</p>
                    </div>
                    {signatureRequest.viewed_at && (
                      <div>
                        <span className="text-slate-400">Viewed:</span>
                        <p className="text-white">{formatDateTime(signatureRequest.viewed_at)}</p>
                      </div>
                    )}
                    {signatureRequest.signed_at && (
                      <div>
                        <span className="text-slate-400">Signed:</span>
                        <p className="text-emerald-400">{formatDateTime(signatureRequest.signed_at)}</p>
                      </div>
                    )}
                    {signatureRequest.declined_at && (
                      <div>
                        <span className="text-slate-400">Declined:</span>
                        <p className="text-red-400">{formatDateTime(signatureRequest.declined_at)}</p>
                      </div>
                    )}
                    {signatureRequest.decline_reason && (
                      <div className="col-span-2">
                        <span className="text-slate-400">Reason:</span>
                        <p className="text-red-300">{signatureRequest.decline_reason}</p>
                      </div>
                    )}
                  </div>
                )}
                {signatureRequest && ['pending', 'viewed'].includes(signatureRequest.status) && canSend && (
                  <div className="flex items-center gap-2 pt-4 mt-4 border-t border-slate-700">
                    <button onClick={handleResend} disabled={isResending} className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors disabled:opacity-50">
                      {isResending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                      Resend
                    </button>
                    <button onClick={handleVoid} disabled={isVoiding} className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors disabled:opacity-50">
                      {isVoiding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
                      Void
                    </button>
                  </div>
                )}
              </div>

              {auditEvents.length > 0 && (
                <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-5">
                  <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                    <Shield className="w-5 h-5 text-cyan-400" />
                    Audit Trail
                  </h3>
                  <div className="space-y-3">
                    {auditEvents.map((evt) => {
                      const style = AUDIT_ICONS[evt.event_type] || { icon: Activity, color: 'text-slate-400' };
                      const EvtIcon = style.icon;
                      return (
                        <div key={evt.id} className="flex gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center flex-shrink-0">
                            <EvtIcon className={`w-4 h-4 ${style.color}`} />
                          </div>
                          <div className="flex-1 pb-3 border-b border-slate-700/50">
                            <p className="text-white text-sm">{evt.event_type.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}</p>
                            <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                              <span className="capitalize">{evt.actor_type}</span>
                              <span>{formatDateTime(evt.created_at)}</span>
                            </div>
                            {evt.metadata?.signer_email && (
                              <p className="text-xs text-slate-500 mt-1">
                                {String(evt.metadata.signer_name || '')} ({String(evt.metadata.signer_email)})
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
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
            <button onClick={handleAddComment} disabled={!newComment.trim() || isSubmittingComment} className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors">
              {isSubmittingComment ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
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
                        {comment.is_client_comment ? comment.client_name || 'Client' : comment.user?.name || 'Unknown'}
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
                    {activity.activity_type === 'created' && <Scale className="w-4 h-4 text-emerald-400" />}
                    {activity.activity_type === 'ai_generated' && <Sparkles className="w-4 h-4 text-cyan-400" />}
                    {activity.activity_type === 'updated' && <Edit3 className="w-4 h-4 text-slate-400" />}
                    {activity.activity_type === 'status_changed' && <Activity className="w-4 h-4 text-slate-400" />}
                    {activity.activity_type === 'commented' && <MessageSquare className="w-4 h-4 text-slate-400" />}
                    {activity.activity_type === 'sent' && <Send className="w-4 h-4 text-cyan-400" />}
                    {!['created', 'ai_generated', 'updated', 'status_changed', 'commented', 'sent'].includes(activity.activity_type) && (
                      <Activity className="w-4 h-4 text-slate-500" />
                    )}
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

      {showSignatureModal && contract && (
        <SendContractForSignatureModal
          contract={contract}
          onClose={() => setShowSignatureModal(false)}
          onSent={() => {
            setShowSignatureModal(false);
            loadContract();
          }}
        />
      )}
    </div>
  );
}
