import { useState, useEffect } from 'react';
import { Search, MessageSquare, Mail } from 'lucide-react';
import { Drawer } from '../layouts/Drawer';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { createMessage } from '../../services/messages';
import { logActivity } from '../../services/activityLog';

interface ComposeMessageDrawerProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
}

type Channel = 'sms' | 'email';

export function ComposeMessageDrawer({ open, onClose, onSuccess }: ComposeMessageDrawerProps) {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [channel, setChannel] = useState<Channel>('sms');
  const [message, setMessage] = useState('');
  const [subject, setSubject] = useState('');
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setSearchQuery('');
      setContacts([]);
      setSelectedContact(null);
      setChannel('sms');
      setMessage('');
      setSubject('');
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.length >= 2 && user?.organization_id) {
        searchContacts();
      } else {
        setContacts([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, user?.organization_id]);

  async function searchContacts() {
    setSearching(true);
    const { data } = await supabase
      .from('contacts')
      .select('id, first_name, last_name, email, phone')
      .eq('organization_id', user?.organization_id)
      .eq('status', 'active')
      .or(
        `first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`
      )
      .limit(10);

    setContacts(data || []);
    setSearching(false);
  }

  async function handleSend() {
    if (!user || !user.organization_id || !selectedContact) return;

    const canSend =
      (channel === 'sms' && selectedContact.phone) ||
      (channel === 'email' && selectedContact.email);

    if (!canSend) {
      setError(`Contact has no ${channel === 'sms' ? 'phone number' : 'email address'}`);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: conversation } = await supabase
        .from('conversations')
        .select('id')
        .eq('contact_id', selectedContact.id)
        .eq('channel', channel)
        .eq('status', 'open')
        .maybeSingle();

      let conversationId = conversation?.id;

      if (!conversationId) {
        const { data: newConv, error: convError } = await supabase
          .from('conversations')
          .insert({
            organization_id: user.organization_id,
            contact_id: selectedContact.id,
            channel,
            status: 'open',
            assigned_to: user.id,
          })
          .select('id')
          .single();

        if (convError) throw convError;
        conversationId = newConv.id;
      }

      const msg = await createMessage(
        user.organization_id,
        conversationId,
        selectedContact.id,
        channel,
        'outbound',
        message,
        {},
        channel === 'email' ? subject : undefined
      );

      await logActivity({
        organizationId: user.organization_id,
        userId: user.id,
        eventType: 'message_sent',
        entityType: 'conversation',
        entityId: conversationId,
        contactId: selectedContact.id,
        summary: `Sent ${channel} to ${selectedContact.first_name} ${selectedContact.last_name}`.trim(),
        payload: { channel, message_id: msg.id },
      });

      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="New Message"
      subtitle="Send a message to a contact"
      footer={
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={loading || !selectedContact || !message.trim()}
            className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Sending...' : 'Send Message'}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">To</label>
          {selectedContact ? (
            <div className="flex items-center justify-between p-3 bg-slate-800 border border-slate-700 rounded-lg">
              <div>
                <p className="text-sm font-medium text-white">
                  {selectedContact.first_name} {selectedContact.last_name}
                </p>
                <p className="text-xs text-slate-400">
                  {channel === 'sms' ? selectedContact.phone : selectedContact.email}
                </p>
              </div>
              <button
                onClick={() => setSelectedContact(null)}
                className="text-xs text-cyan-400 hover:text-cyan-300"
              >
                Change
              </button>
            </div>
          ) : (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search contacts..."
                className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
              />
              {(contacts.length > 0 || searching) && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-10 max-h-48 overflow-y-auto">
                  {searching ? (
                    <div className="p-3 text-sm text-slate-400">Searching...</div>
                  ) : (
                    contacts.map((contact) => (
                      <button
                        key={contact.id}
                        onClick={() => {
                          setSelectedContact(contact);
                          setSearchQuery('');
                          setContacts([]);
                        }}
                        className="w-full p-3 text-left hover:bg-slate-700 transition-colors"
                      >
                        <p className="text-sm font-medium text-white">
                          {contact.first_name} {contact.last_name}
                        </p>
                        <p className="text-xs text-slate-400">
                          {contact.email || contact.phone || 'No contact info'}
                        </p>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Channel</label>
          <div className="flex gap-2">
            <button
              onClick={() => setChannel('sms')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border transition-colors ${
                channel === 'sms'
                  ? 'bg-cyan-500/10 border-cyan-500/50 text-cyan-400'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
              }`}
            >
              <MessageSquare className="h-4 w-4" />
              <span className="text-sm font-medium">SMS</span>
            </button>
            <button
              onClick={() => setChannel('email')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border transition-colors ${
                channel === 'email'
                  ? 'bg-cyan-500/10 border-cyan-500/50 text-cyan-400'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
              }`}
            >
              <Mail className="h-4 w-4" />
              <span className="text-sm font-medium">Email</span>
            </button>
          </div>
        </div>

        {channel === 'email' && (
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject..."
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Message</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            placeholder="Type your message..."
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 resize-none"
          />
          <p className="mt-1.5 text-xs text-slate-500">{message.length} characters</p>
        </div>
      </div>
    </Drawer>
  );
}
