import { useState, useRef, useEffect } from 'react';
import { Send, Phone, Mail, PhoneCall, MessageCircle, ChevronDown, Bot } from 'lucide-react';
import { calculateSMSSegments } from '../../services/channels/twilio';
import { useAuth } from '../../contexts/AuthContext';
import { AskAIModal } from './AskAIModal';
import type { MessageChannel, Contact, Conversation } from '../../types';

interface MessageComposerProps {
  onSend: (body: string, subject?: string) => Promise<void>;
  sending: boolean;
  disabled: boolean;
  availableChannels: { channel: MessageChannel; identifier: string }[];
  selectedChannel: MessageChannel;
  onChannelChange: (channel: MessageChannel) => void;
  showSubject: boolean;
  contact?: Contact;
  conversation?: Conversation;
}

export function MessageComposer({
  onSend,
  sending,
  disabled,
  availableChannels,
  selectedChannel,
  onChannelChange,
  showSubject,
  contact,
  conversation,
}: MessageComposerProps) {
  const { hasPermission, hasFeatureAccess } = useAuth();
  const [body, setBody] = useState('');
  const [subject, setSubject] = useState('');
  const [showChannelMenu, setShowChannelMenu] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const canUseAI = hasPermission('ai_agents.run') && hasFeatureAccess('ai_agents');

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [body]);

  const handleSubmit = async () => {
    if (!body.trim() || sending || disabled) return;

    await onSend(body.trim(), showSubject ? subject.trim() : undefined);
    setBody('');
    setSubject('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const smsInfo = selectedChannel === 'sms' ? calculateSMSSegments(body) : null;

  const selectedChannelConfig = availableChannels.find((c) => c.channel === selectedChannel);

  if (disabled) {
    return (
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="text-center text-gray-500 text-sm py-2">
          This conversation is closed. Reopen it to send messages.
        </div>
      </div>
    );
  }

  if (availableChannels.length === 0) {
    return (
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="text-center text-gray-500 text-sm py-2">
          No contact channels available. Add a phone number or email to the contact to send messages.
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 border-t border-gray-200 bg-white">
      {showSubject && (
        <div className="mb-3">
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject..."
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      )}

      <div className="flex items-end gap-3">
        <div className="relative">
          <button
            onClick={() => setShowChannelMenu(!showChannelMenu)}
            className="flex items-center gap-2 px-3 py-2.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <ChannelIcon channel={selectedChannel} />
            <ChevronDown size={14} className="text-gray-400" />
          </button>

          {canUseAI && contact && (
            <button
              onClick={() => setShowAIModal(true)}
              className="absolute -top-10 left-0 flex items-center gap-1 px-2 py-1.5 text-xs bg-gradient-to-r from-cyan-500 to-teal-600 text-white rounded-lg hover:from-cyan-600 hover:to-teal-700 transition-colors"
              title="Ask AI Assistant"
            >
              <Bot size={14} />
              Ask AI
            </button>
          )}

          {showChannelMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowChannelMenu(false)}
              />
              <div className="absolute bottom-full left-0 mb-2 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-[200px]">
                {availableChannels.map((channel) => (
                  <button
                    key={channel.channel}
                    onClick={() => {
                      onChannelChange(channel.channel);
                      setShowChannelMenu(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg ${
                      channel.channel === selectedChannel ? 'bg-blue-50' : ''
                    }`}
                  >
                    <ChannelIcon channel={channel.channel} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 capitalize">
                        {channel.channel}
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        {channel.identifier}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={1}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            style={{ maxHeight: '120px' }}
          />

          {smsInfo && body.length > 0 && (
            <div className="absolute right-3 bottom-2 text-xs text-gray-400">
              {body.length} / {smsInfo.segments} segment{smsInfo.segments !== 1 ? 's' : ''}
            </div>
          )}
        </div>

        <button
          onClick={handleSubmit}
          disabled={!body.trim() || sending}
          className="p-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {sending ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Send size={20} />
          )}
        </button>
      </div>

      {selectedChannelConfig && (
        <div className="mt-2 text-xs text-gray-400">
          Sending via {selectedChannel} to {selectedChannelConfig.identifier}
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
            if (channel === 'sms' && availableChannels.some(c => c.channel === 'sms')) {
              onChannelChange('sms');
            } else if (channel === 'email' && availableChannels.some(c => c.channel === 'email')) {
              onChannelChange('email');
            }
            setShowAIModal(false);
          }}
        />
      )}
    </div>
  );
}

function ChannelIcon({ channel }: { channel: MessageChannel }) {
  const iconClass = "w-5 h-5 text-gray-600";

  switch (channel) {
    case 'sms':
      return <Phone className={iconClass} />;
    case 'email':
      return <Mail className={iconClass} />;
    case 'voice':
      return <PhoneCall className={iconClass} />;
    case 'webchat':
      return <MessageCircle className={iconClass} />;
    default:
      return <MessageCircle className={iconClass} />;
  }
}
