import { useState, useEffect, useRef } from 'react';
import {
  X, Search, MessageSquarePlus, Loader2, ArrowLeft,
  Mail, AlertCircle, Plus, ChevronDown, Type, FileText,
  Link2, Image, Code2, MoreHorizontal
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getContacts } from '../../services/contacts';
import { InlineCreateContactForm } from '../shared/InlineCreateContactForm';
import { findOrCreateConversation } from '../../services/conversations';
import { createMessage } from '../../services/messages';
import { getEmailDefaults } from '../../services/emailDefaults';
import type { Contact } from '../../types';

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

  const [fromName, setFromName] = useState('');
  const [fromEmail, setFromEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [messageBody, setMessageBody] = useState('');
  const [ccVisible, setCcVisible] = useState(false);
  const [bccVisible, setBccVisible] = useState(false);
  const [ccValue, setCcValue] = useState('');
  const [bccValue, setBccValue] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

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
    if (!user?.organization_id) return;
    setFromName(user.name || '');
    setFromEmail(user.email || '');
    getEmailDefaults(user.organization_id).then(defaults => {
      if (defaults?.default_from_address?.email) {
        setFromEmail(defaults.default_from_address.email);
      }
      if (defaults?.default_from_address?.display_name) {
        setFromName(defaults.default_from_address.display_name);
      }
    }).catch(() => {});
  }, [user]);

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

  const handleContactSelect = (contact: Contact) => {
    setSelectedContact(contact);
    setStep('compose');
  };

  const wordCount = messageBody.trim() ? messageBody.trim().split(/\s+/).length : 0;
  const canSend = !!selectedContact?.email && subject.trim().length > 0 && messageBody.trim().length > 0 && !sending;

  const handleSend = async () => {
    if (!selectedContact || !user?.organization_id || !selectedContact.email) return;
    setSending(true);
    setSendError(null);
    try {
      const conversation = await findOrCreateConversation(
        user.organization_id,
        selectedContact.id,
        user.department_id
      );

      await createMessage(
        user.organization_id,
        conversation.id,
        selectedContact.id,
        'email',
        'outbound',
        messageBody.trim(),
        { from_name: fromName, from_email: fromEmail, cc: ccValue || undefined, bcc: bccValue || undefined },
        subject.trim() || 'New message'
      );

      onSelectContact(selectedContact.id);
      onClose();
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleClear = () => {
    setSubject('');
    setMessageBody('');
    setCcValue('');
    setBccValue('');
    setCcVisible(false);
    setBccVisible(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl shadow-2xl w-full max-w-2xl flex flex-col border border-slate-700"
        style={{ maxHeight: '90vh' }}>

        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 flex-shrink-0">
          <div className="flex items-center gap-2">
            {step === 'compose' && (
              <button
                onClick={() => { setStep('contact'); setSelectedContact(null); setSendError(null); setSubject(''); setMessageBody(''); }}
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
                        {contacts.length === 0 ? 'No contacts found.' : 'No contacts match your search.'}
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
        ) : selectedContact ? (
          <EmailComposeStep
            contact={selectedContact}
            fromName={fromName}
            fromEmail={fromEmail}
            subject={subject}
            onSubjectChange={setSubject}
            messageBody={messageBody}
            onMessageBodyChange={setMessageBody}
            ccVisible={ccVisible}
            bccVisible={bccVisible}
            ccValue={ccValue}
            bccValue={bccValue}
            onCcToggle={() => setCcVisible(v => !v)}
            onBccToggle={() => setBccVisible(v => !v)}
            onCcChange={setCcValue}
            onBccChange={setBccValue}
            wordCount={wordCount}
            canSend={canSend}
            sending={sending}
            sendError={sendError}
            onSend={handleSend}
            onClear={handleClear}
            onClose={onClose}
          />
        ) : null}
      </div>
    </div>
  );
}

interface EmailComposeStepProps {
  contact: Contact;
  fromName: string;
  fromEmail: string;
  subject: string;
  onSubjectChange: (v: string) => void;
  messageBody: string;
  onMessageBodyChange: (v: string) => void;
  ccVisible: boolean;
  bccVisible: boolean;
  ccValue: string;
  bccValue: string;
  onCcToggle: () => void;
  onBccToggle: () => void;
  onCcChange: (v: string) => void;
  onBccChange: (v: string) => void;
  wordCount: number;
  canSend: boolean;
  sending: boolean;
  sendError: string | null;
  onSend: () => void;
  onClear: () => void;
  onClose: () => void;
}

function EmailComposeStep({
  contact, fromName, fromEmail, subject, onSubjectChange,
  messageBody, onMessageBodyChange, ccVisible, bccVisible, ccValue, bccValue,
  onCcToggle, onBccToggle, onCcChange, onBccChange,
  wordCount, canSend, sending, sendError, onSend, onClear, onClose
}: EmailComposeStepProps) {
  const fullName = `${contact.first_name} ${contact.last_name}`.trim();
  const initials = getInitials(fullName);
  const avatarColor = getAvatarColor(fullName);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const autoResize = () => {
    const el = bodyRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };

  if (!contact.email) {
    return (
      <div className="flex flex-col flex-1 min-h-0">
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <AlertCircle className="w-10 h-10 text-rose-400 mx-auto mb-3" />
            <p className="text-slate-300 text-sm">This contact has no email address.</p>
            <p className="text-slate-500 text-xs mt-1">Add an email to the contact to start a conversation.</p>
          </div>
        </div>
        <div className="px-5 py-4 border-t border-slate-700 flex justify-end flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">

        {/* From row */}
        <div className="flex items-center gap-6 px-5 py-3 border-b border-slate-700/60">
          <span className="text-xs text-slate-500 w-24 flex-shrink-0">From Name:</span>
          <span className="text-sm text-white font-medium flex-1 truncate">{fromName || 'Unknown'}</span>
          <span className="text-xs text-slate-500 flex-shrink-0">From email:</span>
          <span className="text-sm text-white font-medium truncate max-w-[200px]">{fromEmail}</span>
        </div>

        {/* To row */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-700/60">
          <span className="text-xs text-slate-500 flex-shrink-0 w-6">To:</span>
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-semibold ${avatarColor} flex-shrink-0`}>
            {initials}
          </div>
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <span className="text-sm text-white truncate">{contact.email}</span>
            <span className="text-xs text-slate-500 flex-shrink-0">(Primary)</span>
            <ChevronDown size={13} className="text-slate-500 flex-shrink-0" />
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <button
              onClick={onCcToggle}
              className={`text-xs font-medium transition-colors ${ccVisible ? 'text-cyan-400' : 'text-slate-400 hover:text-white'}`}
            >
              CC
            </button>
            <button
              onClick={onBccToggle}
              className={`text-xs font-medium transition-colors ${bccVisible ? 'text-cyan-400' : 'text-slate-400 hover:text-white'}`}
            >
              BCC
            </button>
          </div>
        </div>

        {/* CC row */}
        {ccVisible && (
          <div className="flex items-center gap-3 px-5 py-2.5 border-b border-slate-700/60">
            <span className="text-xs text-slate-500 flex-shrink-0 w-6">CC:</span>
            <input
              type="text"
              value={ccValue}
              onChange={e => onCcChange(e.target.value)}
              placeholder="Add CC recipients..."
              className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
              autoFocus
            />
          </div>
        )}

        {/* BCC row */}
        {bccVisible && (
          <div className="flex items-center gap-3 px-5 py-2.5 border-b border-slate-700/60">
            <span className="text-xs text-slate-500 flex-shrink-0 w-6">BCC:</span>
            <input
              type="text"
              value={bccValue}
              onChange={e => onBccChange(e.target.value)}
              placeholder="Add BCC recipients..."
              className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
              autoFocus={!ccVisible}
            />
          </div>
        )}

        {/* Subject row */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-700/60">
          <span className="text-xs text-slate-500 flex-shrink-0 w-12">Subject:</span>
          <input
            type="text"
            value={subject}
            onChange={e => onSubjectChange(e.target.value)}
            placeholder="Enter subject..."
            className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
          />
        </div>

        {/* Body */}
        <div className="flex-1 px-5 pt-3 pb-2 min-h-[160px]">
          <textarea
            ref={bodyRef}
            value={messageBody}
            onChange={e => { onMessageBodyChange(e.target.value); autoResize(); }}
            placeholder="Write your email..."
            className="w-full bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none resize-none min-h-[140px]"
            rows={6}
          />
        </div>

        {sendError && (
          <div className="mx-5 mb-3 flex items-center gap-2 text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
            <AlertCircle size={15} />
            {sendError}
          </div>
        )}
      </div>

      {/* Bottom toolbar */}
      <div className="border-t border-slate-700 px-4 py-3 flex items-center gap-2 flex-shrink-0">
        <div className="flex items-center gap-1 flex-1">
          <ToolbarBtn icon={<Type size={15} />} title="Text formatting" />
          <ToolbarBtn icon={<FileText size={15} />} title="Insert template" />
          <ToolbarBtn icon={<Link2 size={15} />} title="Insert link" />
          <ToolbarBtn icon={<Image size={15} />} title="Insert image" />
          <ToolbarBtn icon={<Code2 size={15} />} title="Insert variable" />
          <ToolbarBtn icon={<MoreHorizontal size={15} />} title="More options" />
        </div>
        <span className="text-xs text-slate-500 flex-shrink-0">{wordCount} {wordCount === 1 ? 'word' : 'words'}</span>
        <button
          onClick={onClear}
          className="px-3 py-1.5 rounded-lg text-sm text-slate-300 bg-slate-700 hover:bg-slate-600 border border-slate-600 transition-colors flex-shrink-0"
        >
          Clear
        </button>
        <button
          onClick={onSend}
          disabled={!canSend}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex-shrink-0 ${
            canSend
              ? 'bg-cyan-600 hover:bg-cyan-500 text-white'
              : 'bg-slate-700 text-slate-500 cursor-not-allowed'
          }`}
        >
          {sending ? <Loader2 size={14} className="animate-spin" /> : null}
          {sending ? 'Sending...' : 'Send'}
        </button>
      </div>
    </div>
  );
}

function ToolbarBtn({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <button
      title={title}
      className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
    >
      {icon}
    </button>
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
          {contact.company && contact.email && <span className="text-slate-600 text-xs">•</span>}
          {contact.email && (
            <span className="flex items-center gap-1 text-xs text-slate-500">
              <Mail size={10} />
              {contact.email}
            </span>
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
