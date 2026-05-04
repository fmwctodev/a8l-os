import { useState, useRef, useEffect, useCallback } from 'react';
import { Bot, Check } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { AskAIModal } from './AskAIModal';
import { SnippetPicker } from './SnippetPicker';
import { createGmailDraft, updateGmailDraft, deleteGmailDraft } from '../../services/gmailApi';
import { ComposerTabBar } from './composer/ComposerTabBar';
import { EmailComposerContent } from './composer/EmailComposerContent';
import { InternalCommentContent } from './composer/InternalCommentContent';
import type { ComposerTab } from './composer/ComposerTabBar';
import type { MessageChannel, Contact, Conversation } from '../../types';
import type { PlivoNumber } from '../../services/plivoNumbers';

interface EmailRecipient {
  email: string;
  name: string;
  contactId?: string;
}

interface MessageComposerProps {
  onSend: (body: string, subject?: string, metadata?: Record<string, unknown>) => Promise<void>;
  onSendInternalComment?: (body: string, mentions: string[]) => Promise<void>;
  sending: boolean;
  disabled: boolean;
  availableChannels: { channel: MessageChannel; identifier: string }[];
  selectedChannel: MessageChannel;
  onChannelChange: (channel: MessageChannel) => void;
  showSubject: boolean;
  contact?: Contact;
  conversation?: Conversation;
  gmailConnected?: boolean;
  fromNumbers?: PlivoNumber[];
}

export function MessageComposer({
  onSend,
  onSendInternalComment,
  sending,
  disabled,
  availableChannels,
  selectedChannel,
  onChannelChange,
  showSubject: _showSubject,
  contact,
  conversation,
  gmailConnected = false,
  fromNumbers = [],
}: MessageComposerProps) {
  const { user, hasPermission, isFeatureEnabled } = useAuth();
  const [body, setBody] = useState('');
  const [subject, setSubject] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [showSnippetPicker, setShowSnippetPicker] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [draftSaved, setDraftSaved] = useState(false);
  const [ccRecipients, setCcRecipients] = useState<EmailRecipient[]>([]);
  const [bccRecipients, setBccRecipients] = useState<EmailRecipient[]>([]);
  const [internalMentions, setInternalMentions] = useState<string[]>([]);
  const [uploading] = useState(false);
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const canUseAI = hasPermission('ai_agents.run') && isFeatureEnabled('ai_agents');
  const canUseSnippets = hasPermission('snippets.view') && isFeatureEnabled('snippets');

  const hasEmail = availableChannels.some((c) => c.channel === 'email');

  const [activeTab, setActiveTab] = useState<ComposerTab>(() => {
    if (hasEmail) return 'email';
    return 'internal_comment';
  });

  useEffect(() => {
    if (selectedChannel === 'email' && hasEmail) setActiveTab('email');
  }, [selectedChannel, hasEmail]);

  const isGmailEmail = gmailConnected && activeTab === 'email';

  const saveDraftToGmail = useCallback(async (draftBody: string, draftSubject: string) => {
    if (!isGmailEmail || !draftBody.trim()) return;
    const channelConfig = availableChannels.find((c) => c.channel === 'email');
    if (!channelConfig) return;

    try {
      if (draftId) {
        await updateGmailDraft({
          draftId,
          to: channelConfig.identifier,
          subject: draftSubject || undefined,
          htmlBody: draftBody,
        });
      } else {
        const result = await createGmailDraft({
          to: channelConfig.identifier,
          subject: draftSubject || undefined,
          htmlBody: draftBody,
        });
        if (result?.draftId) {
          setDraftId(result.draftId);
        }
      }
      setDraftSaved(true);
      setTimeout(() => setDraftSaved(false), 3000);
    } catch (err) {
      console.error('Failed to save Gmail draft:', err);
    }
  }, [isGmailEmail, draftId, availableChannels]);

  useEffect(() => {
    if (!isGmailEmail || !body.trim()) return;
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => {
      saveDraftToGmail(body, subject);
    }, 30000);
    return () => {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    };
  }, [body, subject, isGmailEmail, saveDraftToGmail]);

  useEffect(() => {
    return () => {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    };
  }, []);

  useEffect(() => {
    setDraftId(null);
    setDraftSaved(false);
  }, [conversation?.id]);

  const handleTabChange = (tab: ComposerTab) => {
    setActiveTab(tab);
    if (tab === 'email' && hasEmail) onChannelChange('email');
    setMediaFiles([]);
    setMediaError(null);
  };

  const handleSubmit = async () => {
    const hasContent = body.trim();
    if (!hasContent || sending || disabled || uploading) return;
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);

    try {
      if (activeTab === 'internal_comment') {
        if (onSendInternalComment) {
          await onSendInternalComment(body.trim(), internalMentions);
        }
      } else {
        const metadata: Record<string, unknown> = {};

        if (activeTab === 'email') {
          if (ccRecipients.length > 0) {
            metadata.cc = ccRecipients.map((r) => r.email).join(', ');
          }
          if (bccRecipients.length > 0) {
            metadata.bcc = bccRecipients.map((r) => r.email).join(', ');
          }
        }

        await onSend(
          body.trim(),
          activeTab === 'email' ? subject.trim() : undefined,
          Object.keys(metadata).length > 0 ? metadata : undefined
        );

        if (draftId) {
          deleteGmailDraft(draftId).catch(() => {});
          setDraftId(null);
        }
      }

      setBody('');
      setSubject('');
      setCcRecipients([]);
      setBccRecipients([]);
      setInternalMentions([]);
      setDraftSaved(false);
    } catch {
      // Keep input fields intact for retry
    }
  };

  const handleClear = () => {
    setBody('');
    setSubject('');
    setCcRecipients([]);
    setBccRecipients([]);
    setInternalMentions([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape' && showSnippetPicker) {
      setShowSnippetPicker(false);
    }
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 's') {
      e.preventDefault();
      if (canUseSnippets) setShowSnippetPicker(true);
    }
  };

  const handleSnippetSelect = (content: string) => {
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newBody = body.slice(0, start) + content + body.slice(end);
      setBody(newBody);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + content.length, start + content.length);
      }, 0);
    } else {
      setBody(body + content);
    }
    setShowSnippetPicker(false);
  };

  const emailChannel = availableChannels.find((c) => c.channel === 'email');

  if (disabled) {
    return (
      <div className="p-4 border-t border-slate-700 bg-slate-800">
        <div className="text-center text-slate-500 text-sm py-2">
          This conversation is closed. Reopen it to send messages.
        </div>
      </div>
    );
  }

  if (availableChannels.length === 0 && !onSendInternalComment) {
    return (
      <div className="p-4 border-t border-slate-700 bg-slate-800">
        <div className="text-center text-slate-500 text-sm py-2">
          No contact channels available. Add a phone number or email to the contact to send messages.
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-slate-700 bg-slate-800 relative">
      {canUseAI && contact && activeTab !== 'internal_comment' && (
        <div className="absolute -top-9 left-4 z-10">
          <button
            onClick={() => setShowAIModal(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-gradient-to-r from-cyan-500 to-teal-600 text-white rounded-lg hover:from-cyan-600 hover:to-teal-700 transition-colors shadow-sm"
          >
            <Bot size={14} />
            Ask AI
          </button>
        </div>
      )}

      <ComposerTabBar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        hasEmail={hasEmail}
        expanded={expanded}
        onToggleExpand={() => setExpanded(!expanded)}
      />

      {activeTab === 'email' && emailChannel && (
        <EmailComposerContent
          body={body}
          onBodyChange={setBody}
          subject={subject}
          onSubjectChange={setSubject}
          onSend={handleSubmit}
          onClear={handleClear}
          sending={sending}
          sendDisabled={!body.trim() || sending}
          expanded={expanded}
          fromName={user?.name || ''}
          fromEmail={user?.email || ''}
          toEmail={emailChannel.identifier}
          toName={contact ? `${contact.first_name} ${contact.last_name}`.trim() : ''}
          ccRecipients={ccRecipients}
          onCcChange={setCcRecipients}
          bccRecipients={bccRecipients}
          onBccChange={setBccRecipients}
          onKeyDown={handleKeyDown}
          onSnippetClick={() => setShowSnippetPicker(!showSnippetPicker)}
          canUseSnippets={canUseSnippets}
          textareaRef={textareaRef}
        />
      )}

      {activeTab === 'internal_comment' && (
        <InternalCommentContent
          body={body}
          onBodyChange={setBody}
          onSend={handleSubmit}
          onClear={handleClear}
          sending={sending}
          sendDisabled={!body.trim() || sending}
          expanded={expanded}
          mentions={internalMentions}
          onMentionsChange={setInternalMentions}
          currentUserId={user?.id}
        />
      )}

      {activeTab !== 'internal_comment' && draftSaved && isGmailEmail && (
        <div className="px-4 pb-2 flex items-center gap-1 text-xs text-emerald-600">
          <Check size={12} />
          Draft saved to Gmail
        </div>
      )}

      {showSnippetPicker && activeTab !== 'internal_comment' && (
        <div className="absolute bottom-full left-4 mb-2 z-50">
          <SnippetPicker
            channel={selectedChannel}
            contact={contact}
            onSelect={handleSnippetSelect}
            onClose={() => setShowSnippetPicker(false)}
          />
        </div>
      )}

      {showAIModal && contact && (
        <AskAIModal
          contact={contact}
          conversation={conversation}
          onClose={() => setShowAIModal(false)}
          onAcceptDraft={(draft, channel, draftSubject) => {
            setBody(draft);
            if (draftSubject) setSubject(draftSubject);
            if (channel === 'email' && hasEmail) {
              handleTabChange('email');
            }
            setShowAIModal(false);
          }}
        />
      )}
    </div>
  );
}
