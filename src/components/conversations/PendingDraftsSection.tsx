import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bot,
  ChevronDown,
  ChevronRight,
  Mail,
  MessageSquare,
  Phone,
  Workflow,
  Zap,
  User,
  Clock,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { getAllPendingDraftsWithContext } from '../../services/aiDrafts';
import type { AIDraft, AIDraftSource, MessageChannel, AIWorkflowActionType } from '../../types';

interface PendingDraftWithContext extends AIDraft {
  contact: {
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
  };
  conversation: {
    id: string;
    status: string;
  } | null;
}

interface PendingDraftsSectionProps {
  selectedConversationId?: string;
  onSelectConversation?: (conversationId: string) => void;
}

export function PendingDraftsSection({
  selectedConversationId,
  onSelectConversation,
}: PendingDraftsSectionProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(true);
  const [drafts, setDrafts] = useState<PendingDraftWithContext[]>([]);
  const [loading, setLoading] = useState(true);
  const [sourceFilter, setSourceFilter] = useState<AIDraftSource | 'all'>('all');

  const loadPendingDrafts = useCallback(async () => {
    if (!user?.organization_id) return;

    try {
      setLoading(true);
      const data = await getAllPendingDraftsWithContext(user.organization_id, {
        source: sourceFilter === 'all' ? undefined : sourceFilter,
        limit: 50,
      });
      setDrafts(data);
    } catch (error) {
      console.error('Failed to load pending drafts:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.organization_id, sourceFilter]);

  useEffect(() => {
    loadPendingDrafts();
  }, [loadPendingDrafts]);

  useEffect(() => {
    if (!user?.organization_id) return;

    const channel = supabase
      .channel(`ai-drafts:${user.organization_id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ai_messages',
          filter: `organization_id=eq.${user.organization_id}`,
        },
        () => {
          loadPendingDrafts();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user?.organization_id, loadPendingDrafts]);

  const handleSelectDraft = (draft: PendingDraftWithContext) => {
    if (draft.conversation_id) {
      if (onSelectConversation) {
        onSelectConversation(draft.conversation_id);
      } else {
        navigate(`/conversations/${draft.conversation_id}`);
      }
    }
  };

  const getSourceIcon = (draft: PendingDraftWithContext) => {
    if (draft.source_type === 'workflow') {
      return <Workflow size={12} className="text-amber-400" />;
    }
    if (draft.triggered_by_rule_id) {
      return <Zap size={12} className="text-blue-400" />;
    }
    return <User size={12} className="text-slate-400" />;
  };

  const getSourceLabel = (draft: PendingDraftWithContext) => {
    if (draft.source_type === 'workflow') {
      return 'Workflow';
    }
    if (draft.triggered_by_rule_id) {
      return 'Rule';
    }
    return 'Manual';
  };

  const getChannelIcon = (channel: MessageChannel) => {
    switch (channel) {
      case 'email':
        return <Mail size={12} className="text-cyan-400" />;
      case 'sms':
      case 'phone':
        return <Phone size={12} className="text-emerald-400" />;
      default:
        return <MessageSquare size={12} className="text-slate-400" />;
    }
  };

  const getActionTypeLabel = (actionType?: AIWorkflowActionType | null) => {
    if (!actionType) return null;

    const labels: Record<AIWorkflowActionType, string> = {
      ai_conversation_reply: 'Reply',
      ai_email_draft: 'Email',
      ai_follow_up_message: 'Follow-up',
      ai_lead_qualification: 'Qualify',
      ai_booking_assist: 'Booking',
      ai_decision_step: 'Decision',
    };
    return labels[actionType] || actionType;
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const workflowCount = drafts.filter(d => d.source_type === 'workflow').length;
  const ruleCount = drafts.filter(d => d.source_type === 'conversation' && d.triggered_by_rule_id).length;
  const manualCount = drafts.filter(d => !d.source_type || (d.source_type === 'conversation' && !d.triggered_by_rule_id)).length;

  if (!loading && drafts.length === 0 && sourceFilter === 'all') {
    return null;
  }

  return (
    <div className="border-b border-slate-700">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-700/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {expanded ? (
            <ChevronDown size={16} className="text-slate-400" />
          ) : (
            <ChevronRight size={16} className="text-slate-400" />
          )}
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-blue-400" />
            <span className="text-sm font-medium text-white">AI Drafts</span>
          </div>
        </div>
        {drafts.length > 0 && (
          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-500/20 text-blue-400">
            {drafts.length}
          </span>
        )}
      </button>

      {expanded && (
        <div className="pb-2">
          <div className="px-4 pb-2 flex items-center gap-1">
            <button
              onClick={() => setSourceFilter('all')}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                sourceFilter === 'all'
                  ? 'bg-slate-600 text-white'
                  : 'bg-slate-700/50 text-slate-400 hover:text-slate-300'
              }`}
            >
              All ({drafts.length})
            </button>
            {workflowCount > 0 && (
              <button
                onClick={() => setSourceFilter('workflow')}
                className={`px-2 py-1 text-xs rounded transition-colors flex items-center gap-1 ${
                  sourceFilter === 'workflow'
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'bg-slate-700/50 text-slate-400 hover:text-slate-300'
                }`}
              >
                <Workflow size={10} />
                {workflowCount}
              </button>
            )}
            {ruleCount > 0 && (
              <button
                onClick={() => setSourceFilter('conversation')}
                className={`px-2 py-1 text-xs rounded transition-colors flex items-center gap-1 ${
                  sourceFilter === 'conversation'
                    ? 'bg-blue-500/20 text-blue-400'
                    : 'bg-slate-700/50 text-slate-400 hover:text-slate-300'
                }`}
              >
                <Zap size={10} />
                {ruleCount}
              </button>
            )}
          </div>

          {loading ? (
            <div className="px-4 space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="p-2 rounded-lg bg-slate-700/30 animate-pulse">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-6 h-6 rounded-full bg-slate-600" />
                    <div className="h-3 w-24 bg-slate-600 rounded" />
                  </div>
                  <div className="h-2 w-full bg-slate-600/50 rounded" />
                </div>
              ))}
            </div>
          ) : drafts.length === 0 ? (
            <div className="px-4 py-4 text-center">
              <Bot size={24} className="mx-auto text-slate-600 mb-2" />
              <p className="text-xs text-slate-500">No pending AI drafts</p>
            </div>
          ) : (
            <div className="px-2 space-y-1 max-h-64 overflow-y-auto">
              {drafts.map((draft) => (
                <button
                  key={draft.id}
                  onClick={() => handleSelectDraft(draft)}
                  className={`w-full p-2 rounded-lg text-left transition-colors ${
                    draft.conversation_id === selectedConversationId
                      ? 'bg-blue-500/20 border border-blue-500/30'
                      : 'bg-slate-700/30 hover:bg-slate-700/50 border border-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center flex-shrink-0">
                        <Bot size={12} className="text-white" />
                      </div>
                      <span className="text-sm font-medium text-white truncate">
                        {draft.contact.first_name} {draft.contact.last_name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {getSourceIcon(draft)}
                      {getChannelIcon(draft.draft_channel)}
                    </div>
                  </div>

                  <p className="text-xs text-slate-400 line-clamp-2 mb-1.5 ml-8">
                    {draft.draft_content}
                  </p>

                  <div className="flex items-center justify-between ml-8">
                    <div className="flex items-center gap-2">
                      <span className={`px-1.5 py-0.5 text-[10px] rounded ${
                        draft.source_type === 'workflow'
                          ? 'bg-amber-500/10 text-amber-400'
                          : draft.triggered_by_rule_id
                          ? 'bg-blue-500/10 text-blue-400'
                          : 'bg-slate-600 text-slate-400'
                      }`}>
                        {getSourceLabel(draft)}
                      </span>
                      {draft.action_type && (
                        <span className="px-1.5 py-0.5 text-[10px] rounded bg-cyan-500/10 text-cyan-400">
                          {getActionTypeLabel(draft.action_type)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-slate-500">
                      <Clock size={10} />
                      {formatRelativeTime(draft.created_at)}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
