import { useState, useEffect, useCallback } from 'react';
import {
  Mail,
  MessageSquare,
  Send,
  Clock,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Loader2,
  AlertCircle,
  Edit3,
  CalendarClock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  getFollowUpsByMeeting,
  approveAndScheduleFollowUp,
  cancelFollowUp,
  sendFollowUpNow,
  updateFollowUp,
  regenerateFollowUp,
  type MeetingFollowUp,
} from '../../services/meetingFollowUps';

interface MeetingFollowUpsPanelProps {
  meetingTranscriptionId: string;
  orgId: string;
  currentUserId: string;
}

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  draft: { bg: 'bg-amber-500/10', text: 'text-amber-400', label: 'Draft' },
  approved: { bg: 'bg-blue-500/10', text: 'text-blue-400', label: 'Approved' },
  scheduled: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', label: 'Scheduled' },
  sent: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: 'Sent' },
  cancelled: { bg: 'bg-slate-500/10', text: 'text-slate-400', label: 'Cancelled' },
  failed: { bg: 'bg-red-500/10', text: 'text-red-400', label: 'Failed' },
};

export function MeetingFollowUpsPanel({
  meetingTranscriptionId,
  orgId,
  currentUserId,
}: MeetingFollowUpsPanelProps) {
  const [followUps, setFollowUps] = useState<MeetingFollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editSubject, setEditSubject] = useState('');
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [scheduleId, setScheduleId] = useState<string | null>(null);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');

  const loadFollowUps = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getFollowUpsByMeeting(meetingTranscriptionId);
      setFollowUps(data);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [meetingTranscriptionId]);

  useEffect(() => {
    loadFollowUps();
  }, [loadFollowUps]);

  const addProcessing = (id: string) =>
    setProcessingIds((prev) => new Set(prev).add(id));
  const removeProcessing = (id: string) =>
    setProcessingIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleApproveSchedule = async (id: string) => {
    if (!scheduleDate || !scheduleTime) return;
    addProcessing(id);
    try {
      const scheduledFor = new Date(`${scheduleDate}T${scheduleTime}`).toISOString();
      const updated = await approveAndScheduleFollowUp(id, currentUserId, scheduledFor);
      setFollowUps((prev) => prev.map((f) => (f.id === id ? updated : f)));
      setScheduleId(null);
    } finally {
      removeProcessing(id);
    }
  };

  const handleSendNow = async (id: string) => {
    addProcessing(id);
    try {
      const updated = await sendFollowUpNow(id, currentUserId);
      setFollowUps((prev) => prev.map((f) => (f.id === id ? updated : f)));
    } finally {
      removeProcessing(id);
    }
  };

  const handleCancel = async (id: string) => {
    addProcessing(id);
    try {
      const updated = await cancelFollowUp(id);
      setFollowUps((prev) => prev.map((f) => (f.id === id ? updated : f)));
    } finally {
      removeProcessing(id);
    }
  };

  const handleRegenerate = async (id: string) => {
    addProcessing(id);
    try {
      const updated = await regenerateFollowUp(id, orgId);
      setFollowUps((prev) => prev.map((f) => (f.id === id ? updated : f)));
    } finally {
      removeProcessing(id);
    }
  };

  const handleStartEdit = (followUp: MeetingFollowUp) => {
    setEditingId(followUp.id);
    setEditContent(followUp.ai_draft_content);
    setEditSubject(followUp.ai_draft_subject || '');
    setExpandedIds((prev) => new Set(prev).add(followUp.id));
  };

  const handleSaveEdit = async (id: string) => {
    addProcessing(id);
    try {
      const updates: Partial<{ ai_draft_content: string; ai_draft_subject: string | null }> = {
        ai_draft_content: editContent,
      };
      if (editSubject) updates.ai_draft_subject = editSubject;
      const updated = await updateFollowUp(id, updates);
      setFollowUps((prev) => prev.map((f) => (f.id === id ? updated : f)));
      setEditingId(null);
    } finally {
      removeProcessing(id);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-red-400 py-4 px-3">
        <AlertCircle className="w-4 h-4 flex-shrink-0" />
        <span className="text-sm">{error}</span>
      </div>
    );
  }

  if (followUps.length === 0) {
    return (
      <div className="text-center py-6 text-slate-500 text-sm">
        No follow-up messages generated for this meeting.
      </div>
    );
  }

  const grouped = new Map<string, MeetingFollowUp[]>();
  for (const fu of followUps) {
    const contactName = fu.contact
      ? `${fu.contact.first_name || ''} ${fu.contact.last_name || ''}`.trim() || fu.contact.email
      : fu.contact_id;
    const existing = grouped.get(contactName) || [];
    existing.push(fu);
    grouped.set(contactName, existing);
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
        <Send className="w-4 h-4 text-cyan-400" />
        Follow-Up Messages
        <span className="text-xs text-slate-500">
          ({followUps.filter((f) => f.status === 'draft').length} pending review)
        </span>
      </h3>

      <div className="space-y-3">
        {Array.from(grouped.entries()).map(([contactName, items]) => (
          <div key={contactName} className="space-y-2">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">{contactName}</p>
            {items.map((fu) => {
              const isExpanded = expandedIds.has(fu.id);
              const isProcessing = processingIds.has(fu.id);
              const isEditing = editingId === fu.id;
              const isScheduling = scheduleId === fu.id;
              const statusStyle = STATUS_STYLES[fu.status] || STATUS_STYLES.draft;

              return (
                <div
                  key={fu.id}
                  className={`rounded-lg border transition-colors ${
                    fu.status === 'sent'
                      ? 'border-emerald-500/20 bg-emerald-500/5'
                      : fu.status === 'cancelled'
                      ? 'border-slate-700/50 bg-slate-800/30 opacity-60'
                      : 'border-slate-700 bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center gap-3 p-3">
                    <div className="flex-shrink-0">
                      {fu.channel === 'email' ? (
                        <Mail className="w-4 h-4 text-blue-400" />
                      ) : (
                        <MessageSquare className="w-4 h-4 text-emerald-400" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-200 capitalize">{fu.channel}</span>
                        <span
                          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${statusStyle.bg} ${statusStyle.text}`}
                        >
                          {statusStyle.label}
                        </span>
                        {fu.scheduled_for && fu.status === 'scheduled' && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-slate-400">
                            <CalendarClock className="w-3 h-3" />
                            {new Date(fu.scheduled_for).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                            })}
                          </span>
                        )}
                        {fu.sent_at && (
                          <span className="text-[10px] text-slate-500">
                            Sent {new Date(fu.sent_at).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                            })}
                          </span>
                        )}
                      </div>
                      {fu.ai_draft_subject && (
                        <p className="text-xs text-slate-400 mt-0.5 truncate">{fu.ai_draft_subject}</p>
                      )}
                      {fu.error_message && (
                        <p className="text-xs text-red-400 mt-0.5">{fu.error_message}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      {fu.status === 'draft' && !isProcessing && (
                        <>
                          <button
                            onClick={() => handleSendNow(fu.id)}
                            className="p-1 rounded hover:bg-cyan-500/20 text-cyan-400 transition-colors"
                            title="Send now"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setScheduleId(isScheduling ? null : fu.id);
                              const d = new Date(Date.now() + 2 * 60 * 60 * 1000);
                              setScheduleDate(d.toISOString().split('T')[0]);
                              setScheduleTime(d.toTimeString().slice(0, 5));
                            }}
                            className="p-1 rounded hover:bg-amber-500/20 text-amber-400 transition-colors"
                            title="Schedule"
                          >
                            <Clock className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleStartEdit(fu)}
                            className="p-1 rounded hover:bg-slate-600/50 text-slate-400 transition-colors"
                            title="Edit"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleRegenerate(fu.id)}
                            className="p-1 rounded hover:bg-slate-600/50 text-slate-400 transition-colors"
                            title="Regenerate"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleCancel(fu.id)}
                            className="p-1 rounded hover:bg-red-500/20 text-red-400/60 transition-colors"
                            title="Cancel"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </>
                      )}

                      {fu.status === 'scheduled' && !isProcessing && (
                        <button
                          onClick={() => handleCancel(fu.id)}
                          className="p-1 rounded hover:bg-red-500/20 text-red-400/60 transition-colors"
                          title="Cancel"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      )}

                      {isProcessing && <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />}

                      <button
                        onClick={() => toggleExpand(fu.id)}
                        className="p-1 rounded hover:bg-slate-600/50 text-slate-500 transition-colors"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {isScheduling && (
                    <div className="px-3 pb-3 flex items-center gap-2">
                      <input
                        type="date"
                        value={scheduleDate}
                        onChange={(e) => setScheduleDate(e.target.value)}
                        className="px-2 py-1 text-sm rounded bg-slate-700 border border-slate-600 text-white"
                      />
                      <input
                        type="time"
                        value={scheduleTime}
                        onChange={(e) => setScheduleTime(e.target.value)}
                        className="px-2 py-1 text-sm rounded bg-slate-700 border border-slate-600 text-white"
                      />
                      <button
                        onClick={() => handleApproveSchedule(fu.id)}
                        disabled={isProcessing}
                        className="px-3 py-1 text-xs font-medium rounded bg-cyan-600 hover:bg-cyan-500 text-white transition-colors disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 inline mr-1" />
                        Approve
                      </button>
                      <button
                        onClick={() => setScheduleId(null)}
                        className="px-2 py-1 text-xs text-slate-400 hover:text-white transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  {isExpanded && (
                    <div className="px-3 pb-3 border-t border-slate-700/50 pt-2">
                      {isEditing ? (
                        <div className="space-y-2">
                          {fu.channel === 'email' && (
                            <input
                              type="text"
                              value={editSubject}
                              onChange={(e) => setEditSubject(e.target.value)}
                              placeholder="Subject line"
                              className="w-full px-3 py-1.5 text-sm rounded bg-slate-700 border border-slate-600 text-white placeholder-slate-500"
                            />
                          )}
                          <textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            rows={fu.channel === 'sms' ? 3 : 8}
                            className="w-full px-3 py-2 text-sm rounded bg-slate-700 border border-slate-600 text-white placeholder-slate-500 resize-y"
                          />
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleSaveEdit(fu.id)}
                              disabled={isProcessing}
                              className="px-3 py-1 text-xs font-medium rounded bg-cyan-600 hover:bg-cyan-500 text-white transition-colors disabled:opacity-50"
                            >
                              Save Changes
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="px-2 py-1 text-xs text-slate-400 hover:text-white transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-slate-900/50 rounded-lg p-3">
                          <pre className="text-xs text-slate-300 whitespace-pre-wrap font-sans">
                            {fu.ai_draft_content}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
