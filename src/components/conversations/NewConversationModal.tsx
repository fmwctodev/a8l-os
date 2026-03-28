import { useState, useEffect } from 'react';
import {
  X, Search, MessageSquarePlus, Loader2, ArrowLeft,
  Mail, Send, AlertCircle, Plus
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getContacts } from '../../services/contacts';
import { InlineCreateContactForm } from '../shared/InlineCreateContactForm';
import { findOrCreateConversation } from '../../services/conversations';
import { createMessage } from '../../services/messages';
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

  const [messageBody, setMessageBody] = useState('');
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

  const canSend = !!selectedContact?.email && messageBody.trim().length > 0 && !sending;

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
        {},
        'New message'
      );

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
                onClick={() => { setStep('contact'); setSelectedContact(null); setSendError(null); setMessageBody(''); }}
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
            messageBody={messageBody}
            onMessageBodyChange={setMessageBody}
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
  messageBody: string;
  onMessageBodyChange: (v: string) => void;
  canSend: boolean;
  sending: boolean;
  sendError: string | null;
  onSend: () => void;
  onClose: () => void;
}

function ComposeStep({
  contact, messageBody, onMessageBodyChange, canSend, sending, sendError, onSend, onClose
}: ComposeStepProps) {
  const fullName = `${contact.first_name} ${contact.last_name}`.trim();
  const initials = getInitials(fullName);
  const avatarColor = getAvatarColor(fullName);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="px-5 py-4 border-b border-slate-700 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium ${avatarColor} flex-shrink-0`}>
            {initials}
          </div>
          <div>
            <p className="text-white font-medium text-sm">{fullName}</p>
            {contact.email && (
              <span className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                <Mail size={11} />
                {contact.email}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="px-5 py-4 space-y-4 flex-1 overflow-y-auto">
        {contact.email ? (
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg">
            <Mail size={15} className="text-cyan-400 flex-shrink-0" />
            <span className="text-sm text-slate-300">Sending via Email to <span className="text-white">{contact.email}</span></span>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-2 bg-rose-500/10 border border-rose-500/20 rounded-lg">
            <AlertCircle size={15} className="text-rose-400 flex-shrink-0" />
            <span className="text-sm text-rose-400">This contact has no email address. Add an email to start a conversation.</span>
          </div>
        )}

        {contact.email && (
          <div>
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wider block mb-2">Message</label>
            <textarea
              value={messageBody}
              onChange={e => onMessageBodyChange(e.target.value)}
              placeholder="Type your message..."
              rows={5}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg text-white text-sm px-3 py-2.5 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
              autoFocus
            />
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
