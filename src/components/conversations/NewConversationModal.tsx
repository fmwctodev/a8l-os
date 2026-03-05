import { useState, useEffect, useRef, useCallback } from 'react';
import {
  X, Search, MessageSquarePlus, Loader2, ArrowLeft,
  MessageSquare, Mail, Phone, Paperclip, Send, AlertCircle, Plus
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getContacts } from '../../services/contacts';
import { InlineCreateContactForm } from '../shared/InlineCreateContactForm';
import { findOrCreateConversation } from '../../services/conversations';
import { createMessage } from '../../services/messages';
import { getNumbers, TwilioNumber } from '../../services/phoneNumbers';
import { uploadMessageMedia, sendSms, MMS_MAX_FILES, MMS_MAX_FILE_SIZE } from '../../services/sendSms';
import { supabase } from '../../lib/supabase';
import type { Contact } from '../../types';

type Channel = 'sms' | 'email';
type Step = 'contact' | 'compose';

interface NewConversationModalProps {
  onClose: () => void;
  onSelectContact: (contactId: string) => void;
}

export function NewConversationModal({ onClose, onSelectContact }: NewConversationModalProps) {
  const { user } = useAuth();

  const [step, setStep] = useState<Step>('contact');
  const [searchQuery, setSearchQuery] = useState('');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [showNewContactForm, setShowNewContactForm] = useState(false);

  const [channel, setChannel] = useState<Channel | null>(null);
  const [twilioNumbers, setTwilioNumbers] = useState<TwilioNumber[]>([]);
  const [fromNumberId, setFromNumberId] = useState<string>('');
  const [messageBody, setMessageBody] = useState('');
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadContacts() {
      if (!user?.organization_id) return;
      try {
        setLoading(true);
        const data = await getContacts(user.organization_id, {
          status: 'active',
          sortBy: 'name',
          sortOrder: 'asc'
        });
        setContacts(data);
        setFilteredContacts(data);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    loadContacts();
  }, [user?.organization_id]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredContacts(contacts);
      return;
    }
    const q = searchQuery.toLowerCase();
    setFilteredContacts(contacts.filter(c => {
      const name = `${c.first_name} ${c.last_name}`.toLowerCase();
      return name.includes(q) || c.email?.toLowerCase().includes(q) ||
        c.phone?.includes(q) || c.company?.toLowerCase().includes(q);
    }));
  }, [searchQuery, contacts]);

  useEffect(() => {
    if (step === 'compose' && selectedContact?.phone) {
      getNumbers().then(nums => {
        setTwilioNumbers(nums.filter(n => n.status === 'active'));
        const def = nums.find(n => n.is_default_sms && n.status === 'active');
        if (def) setFromNumberId(def.id);
        else {
          const first = nums.find(n => n.status === 'active');
          if (first) setFromNumberId(first.id);
        }
      }).catch(() => {});
    }
  }, [step, selectedContact]);

  const handleContactSelect = (contact: Contact) => {
    setSelectedContact(contact);
    const hasPhone = !!contact.phone;
    const hasEmail = !!contact.email;
    if (hasPhone && !hasEmail) setChannel('sms');
    else if (hasEmail && !hasPhone) setChannel('email');
    else setChannel(null);
    setStep('compose');
  };

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    if (!selected.length) return;
    const combined = [...mediaFiles, ...selected];
    if (combined.length > MMS_MAX_FILES) {
      setMediaError(`Maximum ${MMS_MAX_FILES} attachments allowed`);
      e.target.value = '';
      return;
    }
    const oversized = selected.find(f => f.size > MMS_MAX_FILE_SIZE);
    if (oversized) {
      setMediaError(`"${oversized.name}" exceeds the 5 MB limit`);
      e.target.value = '';
      return;
    }
    setMediaError(null);
    setMediaFiles(combined);
    e.target.value = '';
  }, [mediaFiles]);

  const removeMedia = (idx: number) => {
    setMediaFiles(prev => prev.filter((_, i) => i !== idx));
    setMediaError(null);
  };

  const selectedNumber = twilioNumbers.find(n => n.id === fromNumberId);
  const canSendMms = selectedNumber?.capabilities?.mms ?? false;

  const canSend = !!channel && (messageBody.trim().length > 0 || (channel === 'sms' && mediaFiles.length > 0)) && !sending;

  const handleSend = async () => {
    if (!selectedContact || !channel || !user?.organization_id) return;
    setSending(true);
    setSendError(null);
    try {
      const conversation = await findOrCreateConversation(
        user.organization_id,
        selectedContact.id,
        user.department_id
      );

      let mediaUrls: string[] = [];
      if (channel === 'sms' && mediaFiles.length > 0) {
        mediaUrls = await Promise.all(mediaFiles.map(f => uploadMessageMedia(f, user.organization_id!)));
      }

      const metadata: Record<string, unknown> = {};
      if (channel === 'sms') {
        if (selectedContact.phone) metadata.to_number = selectedContact.phone;
        if (selectedNumber?.phone_number) metadata.from_number = selectedNumber.phone_number;
      }

      const newMessage = await createMessage(
        user.organization_id,
        conversation.id,
        selectedContact.id,
        channel,
        'outbound',
        messageBody.trim(),
        metadata,
        channel === 'email' ? 'New message' : undefined
      );

      if (channel === 'sms' && mediaUrls.length > 0) {
        await supabase.from('messages').update({ media_urls: mediaUrls }).eq('id', newMessage.id);
      }

      if (channel === 'sms') {
        sendSms(newMessage.id).catch(() => {});
      }

      onSelectContact(selectedContact.id);
      onClose();
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl shadow-2xl w-full max-w-2xl flex flex-col border border-slate-700"
        style={{ maxHeight: '85vh' }}>

        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 flex-shrink-0">
          <div className="flex items-center gap-2">
            {step === 'compose' && (
              <button
                onClick={() => { setStep('contact'); setSelectedContact(null); setChannel(null); setMediaFiles([]); setSendError(null); }}
                className="p-1 hover:bg-slate-700 rounded transition-colors mr-1"
              >
                <ArrowLeft size={18} className="text-slate-400" />
              </button>
            )}
            <MessageSquarePlus className="w-5 h-5 text-cyan-400" />
            <h2 className="text-lg font-semibold text-white">
              {step === 'contact' ? 'New Conversation' : 'Compose Message'}
            </h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-700 rounded transition-colors">
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        {step === 'contact' ? (
          <>
            {showNewContactForm && user ? (
              <div className="flex-1 overflow-y-auto p-5">
                <InlineCreateContactForm
                  orgId={user.organization_id}
                  currentUser={user}
                  initialFirstName={searchQuery}
                  onCreated={(contact) => {
                    setContacts((prev) => [contact, ...prev]);
                    setFilteredContacts((prev) => [contact, ...prev]);
                    setShowNewContactForm(false);
                    handleContactSelect(contact);
                  }}
                  onCancel={() => setShowNewContactForm(false)}
                />
              </div>
            ) : (
              <>
                <div className="px-5 py-3 border-b border-slate-700 flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search contacts by name, email, phone, or company..."
                        className="w-full pl-9 pr-4 py-2.5 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                        autoFocus
                      />
                    </div>
                    <button
                      onClick={() => setShowNewContactForm(true)}
                      className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-900 border border-slate-600 rounded-lg text-cyan-400 hover:bg-slate-700 text-sm whitespace-nowrap transition-colors"
                    >
                      <Plus size={15} />
                      New
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                  {loading ? (
                    <div className="flex items-center justify-center py-16">
                      <Loader2 className="w-7 h-7 text-cyan-400 animate-spin" />
                    </div>
                  ) : filteredContacts.length === 0 ? (
                    <div className="text-center py-16">
                      <MessageSquarePlus className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                      <p className="text-slate-400 text-sm mb-4">
                        {contacts.length === 0
                          ? 'No contacts found.'
                          : 'No contacts match your search.'}
                      </p>
                      <button
                        onClick={() => setShowNewContactForm(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg text-sm hover:bg-cyan-700 transition-colors mx-auto"
                      >
                        <Plus size={15} />
                        Create New Contact
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {filteredContacts.map(contact => (
                        <ContactItem key={contact.id} contact={contact} onSelect={handleContactSelect} />
                      ))}
                    </div>
                  )}
                </div>

                <div className="px-5 py-3 border-t border-slate-700 flex justify-end flex-shrink-0">
                  <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">
                    Cancel
                  </button>
                </div>
              </>
            )}
          </>
        ) : (
          <ComposeStep
            contact={selectedContact!}
            channel={channel}
            onChannelChange={setChannel}
            twilioNumbers={twilioNumbers}
            fromNumberId={fromNumberId}
            onFromNumberChange={setFromNumberId}
            messageBody={messageBody}
            onMessageBodyChange={setMessageBody}
            mediaFiles={mediaFiles}
            mediaError={mediaError}
            onMediaError={setMediaError}
            fileInputRef={fileInputRef}
            onFileSelect={handleFileSelect}
            onRemoveMedia={removeMedia}
            canSendMms={canSendMms}
            canSend={canSend}
            sending={sending}
            sendError={sendError}
            onSend={handleSend}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  );
}

interface ComposeStepProps {
  contact: Contact;
  channel: Channel | null;
  onChannelChange: (c: Channel) => void;
  twilioNumbers: TwilioNumber[];
  fromNumberId: string;
  onFromNumberChange: (id: string) => void;
  messageBody: string;
  onMessageBodyChange: (v: string) => void;
  mediaFiles: File[];
  mediaError: string | null;
  onMediaError: (e: string | null) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveMedia: (idx: number) => void;
  canSendMms: boolean;
  canSend: boolean;
  sending: boolean;
  sendError: string | null;
  onSend: () => void;
  onClose: () => void;
}

function ComposeStep({
  contact, channel, onChannelChange, twilioNumbers, fromNumberId, onFromNumberChange,
  messageBody, onMessageBodyChange, mediaFiles, mediaError, onMediaError,
  fileInputRef, onFileSelect, onRemoveMedia, canSendMms, canSend, sending, sendError, onSend, onClose
}: ComposeStepProps) {
  const fullName = `${contact.first_name} ${contact.last_name}`.trim();
  const initials = getInitials(fullName);
  const avatarColor = getAvatarColor(fullName);
  const hasPhone = !!contact.phone;
  const hasEmail = !!contact.email;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="px-5 py-4 border-b border-slate-700 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium ${avatarColor} flex-shrink-0`}>
            {initials}
          </div>
          <div>
            <p className="text-white font-medium text-sm">{fullName}</p>
            <div className="flex items-center gap-3 mt-0.5">
              {contact.phone && (
                <span className="flex items-center gap-1 text-xs text-slate-400">
                  <Phone size={11} />
                  {contact.phone}
                </span>
              )}
              {contact.email && (
                <span className="flex items-center gap-1 text-xs text-slate-400">
                  <Mail size={11} />
                  {contact.email}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="px-5 py-4 space-y-4 flex-1 overflow-y-auto">
        <div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Send via</p>
          <div className="flex gap-2">
            {hasPhone && (
              <ChannelButton
                active={channel === 'sms'}
                onClick={() => onChannelChange('sms')}
                icon={<MessageSquare size={16} />}
                label="SMS"
                detail={contact.phone!}
              />
            )}
            {hasEmail && (
              <ChannelButton
                active={channel === 'email'}
                onClick={() => onChannelChange('email')}
                icon={<Mail size={16} />}
                label="Email"
                detail={contact.email!}
              />
            )}
            {!hasPhone && !hasEmail && (
              <p className="text-sm text-slate-400">This contact has no phone number or email address.</p>
            )}
          </div>
        </div>

        {channel === 'sms' && twilioNumbers.length > 0 && (
          <div>
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wider block mb-2">From number</label>
            <select
              value={fromNumberId}
              onChange={e => onFromNumberChange(e.target.value)}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg text-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              {twilioNumbers.map(n => (
                <option key={n.id} value={n.id}>
                  {n.friendly_name || n.phone_number}
                  {n.capabilities?.mms ? ' (MMS)' : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {channel && (
          <div>
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wider block mb-2">Message</label>
            <textarea
              value={messageBody}
              onChange={e => onMessageBodyChange(e.target.value)}
              placeholder={channel === 'sms' && mediaFiles.length > 0 ? 'Add a caption (optional)' : 'Type your message...'}
              rows={4}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg text-white text-sm px-3 py-2.5 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
              autoFocus
            />

            {channel === 'sms' && (
              <>
                {mediaFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {mediaFiles.map((file, i) => (
                      <MediaChip key={i} file={file} onRemove={() => onRemoveMedia(i)} />
                    ))}
                  </div>
                )}
                {mediaError && (
                  <p className="text-xs text-rose-400 mt-1.5 flex items-center gap-1">
                    <AlertCircle size={12} />
                    {mediaError}
                  </p>
                )}
                <div className="mt-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*,video/mp4,audio/mpeg,audio/ogg,application/pdf"
                    className="hidden"
                    onChange={onFileSelect}
                  />
                  <button
                    type="button"
                    disabled={!canSendMms}
                    onClick={() => fileInputRef.current?.click()}
                    title={canSendMms ? 'Attach files (MMS)' : 'Selected number does not support MMS'}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                      canSendMms
                        ? 'border-slate-600 text-slate-300 hover:bg-slate-700 hover:border-slate-500'
                        : 'border-slate-700 text-slate-600 cursor-not-allowed'
                    }`}
                  >
                    <Paperclip size={13} />
                    Attach files
                    {!canSendMms && <span className="text-slate-600">(MMS not supported)</span>}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {sendError && (
          <div className="flex items-center gap-2 text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
            <AlertCircle size={15} />
            {sendError}
          </div>
        )}
      </div>

      <div className="px-5 py-4 border-t border-slate-700 flex items-center justify-between flex-shrink-0">
        <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">
          Cancel
        </button>
        <button
          onClick={onSend}
          disabled={!canSend}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all ${
            canSend
              ? 'bg-cyan-500 hover:bg-cyan-400 text-white shadow-lg shadow-cyan-500/20'
              : 'bg-slate-700 text-slate-500 cursor-not-allowed'
          }`}
        >
          {sending ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <Send size={15} />
          )}
          {sending ? 'Sending...' : 'Start Conversation'}
        </button>
      </div>
    </div>
  );
}

interface ChannelButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  detail: string;
}

function ChannelButton({ active, onClick, icon, label, detail }: ChannelButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2.5 px-4 py-2.5 rounded-lg border transition-all text-left flex-1 ${
        active
          ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400'
          : 'border-slate-600 bg-slate-900 text-slate-300 hover:border-slate-500 hover:bg-slate-700'
      }`}
    >
      <span className={active ? 'text-cyan-400' : 'text-slate-400'}>{icon}</span>
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className={`text-xs truncate max-w-[140px] ${active ? 'text-cyan-300/70' : 'text-slate-500'}`}>{detail}</p>
      </div>
    </button>
  );
}

function MediaChip({ file, onRemove }: { file: File; onRemove: () => void }) {
  const isImage = file.type.startsWith('image/');
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!isImage) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file, isImage]);

  return (
    <div className="relative flex items-center gap-1.5 bg-slate-700 rounded-lg overflow-hidden pr-1 pl-1 py-1 border border-slate-600 max-w-[160px]">
      {preview ? (
        <img src={preview} alt={file.name} className="w-8 h-8 rounded object-cover flex-shrink-0" />
      ) : (
        <div className="w-8 h-8 rounded bg-slate-600 flex items-center justify-center flex-shrink-0">
          <Paperclip size={12} className="text-slate-400" />
        </div>
      )}
      <span className="text-xs text-slate-300 truncate flex-1 min-w-0">{file.name}</span>
      <button
        onClick={onRemove}
        className="ml-1 p-0.5 hover:bg-slate-600 rounded transition-colors flex-shrink-0"
      >
        <X size={12} className="text-slate-400" />
      </button>
    </div>
  );
}

interface ContactItemProps {
  contact: Contact;
  onSelect: (contact: Contact) => void;
}

function ContactItem({ contact, onSelect }: ContactItemProps) {
  const fullName = `${contact.first_name} ${contact.last_name}`.trim();
  const initials = getInitials(fullName);
  const avatarColor = getAvatarColor(fullName);

  return (
    <button
      onClick={() => onSelect(contact)}
      className="w-full p-3 rounded-lg hover:bg-slate-700 transition-colors text-left flex items-center gap-3 group"
    >
      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium ${avatarColor} flex-shrink-0`}>
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-white text-sm font-medium group-hover:text-cyan-400 transition-colors truncate">
          {fullName}
        </h3>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {contact.company && <span className="text-xs text-slate-400 truncate">{contact.company}</span>}
          {contact.company && (contact.email || contact.phone) && <span className="text-slate-600 text-xs">•</span>}
          {contact.phone && (
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <Phone size={10} />
              {contact.phone}
            </span>
          )}
          {contact.email && (
            <span className="text-xs text-slate-500 truncate">{contact.email}</span>
          )}
        </div>
      </div>
      <MessageSquarePlus className="w-4 h-4 text-slate-600 group-hover:text-cyan-400 transition-colors flex-shrink-0" />
    </button>
  );
}

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
}

function getAvatarColor(name: string): string {
  const colors = ['bg-blue-600', 'bg-emerald-600', 'bg-amber-600', 'bg-rose-600', 'bg-cyan-600', 'bg-teal-600'];
  const index = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return colors[index % colors.length];
}
