import { useState, useEffect } from 'react';
import { X, Search, MessageSquarePlus, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getContacts } from '../../services/contacts';
import type { Contact } from '../../types';

interface NewConversationModalProps {
  onClose: () => void;
  onSelectContact: (contactId: string) => void;
}

export function NewConversationModal({ onClose, onSelectContact }: NewConversationModalProps) {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

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
      } catch (error) {
        console.error('Failed to load contacts:', error);
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

    const query = searchQuery.toLowerCase();
    const filtered = contacts.filter(contact => {
      const fullName = `${contact.first_name} ${contact.last_name}`.toLowerCase();
      return (
        fullName.includes(query) ||
        contact.email?.toLowerCase().includes(query) ||
        contact.phone?.includes(query) ||
        contact.company?.toLowerCase().includes(query)
      );
    });
    setFilteredContacts(filtered);
  }, [searchQuery, contacts]);

  const handleContactSelect = (contactId: string) => {
    onSelectContact(contactId);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <MessageSquarePlus className="w-5 h-5 text-cyan-400" />
            <h2 className="text-lg font-semibold text-white">New Conversation</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-700 rounded transition-colors"
          >
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        <div className="p-4 border-b border-slate-700">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search contacts by name, email, phone, or company..."
              className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              autoFocus
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquarePlus className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">
                {contacts.length === 0
                  ? 'No contacts found. Create a contact first to start a conversation.'
                  : 'No contacts match your search.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredContacts.map((contact) => (
                <ContactItem
                  key={contact.id}
                  contact={contact}
                  onSelect={handleContactSelect}
                />
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-300 hover:text-white transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

interface ContactItemProps {
  contact: Contact;
  onSelect: (contactId: string) => void;
}

function ContactItem({ contact, onSelect }: ContactItemProps) {
  const fullName = `${contact.first_name} ${contact.last_name}`.trim();
  const initials = getInitials(fullName);
  const avatarColor = getAvatarColor(fullName);

  return (
    <button
      onClick={() => onSelect(contact.id)}
      className="w-full p-3 rounded-lg hover:bg-slate-700 transition-colors text-left flex items-center gap-3 group"
    >
      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-medium ${avatarColor}`}>
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="text-white font-medium group-hover:text-cyan-400 transition-colors">
            {fullName}
          </h3>
        </div>
        <div className="flex items-center gap-2 mt-1">
          {contact.company && (
            <span className="text-sm text-slate-400">{contact.company}</span>
          )}
          {contact.company && contact.email && (
            <span className="text-slate-600">•</span>
          )}
          {contact.email && (
            <span className="text-sm text-slate-400 truncate">{contact.email}</span>
          )}
        </div>
        {contact.phone && (
          <p className="text-xs text-slate-500 mt-0.5">{contact.phone}</p>
        )}
      </div>
      <MessageSquarePlus className="w-5 h-5 text-slate-600 group-hover:text-cyan-400 transition-colors flex-shrink-0" />
    </button>
  );
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);
}

function getAvatarColor(name: string): string {
  const colors = [
    'bg-blue-600',
    'bg-emerald-600',
    'bg-amber-600',
    'bg-rose-600',
    'bg-cyan-600',
    'bg-teal-600',
  ];
  const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[index % colors.length];
}
