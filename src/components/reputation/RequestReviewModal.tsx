import { useState, useEffect } from 'react';
import { X, Mail, MessageSquare, Loader2, Search } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import type { Contact, ReputationSettings } from '../../types';
import { supabase } from '../../lib/supabase';
import { getSettings } from '../../services/reputationSettings';
import { createReviewRequest, sendReviewRequest } from '../../services/reviewRequests';

interface RequestReviewModalProps {
  contactId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function RequestReviewModal({ contactId, onClose, onSuccess }: RequestReviewModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<ReputationSettings | null>(null);
  const [selectedContactId, setSelectedContactId] = useState(contactId || '');
  const [channel, setChannel] = useState<'sms' | 'email'>('sms');
  const [messageTemplate, setMessageTemplate] = useState('');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactSearch, setContactSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Contact[]>([]);
  const [showContactSearch, setShowContactSearch] = useState(!contactId);

  useEffect(() => {
    loadSettings();
    if (!contactId) {
      loadContacts();
    }
  }, [contactId]);

  useEffect(() => {
    if (settings) {
      const template = channel === 'sms'
        ? settings.default_sms_template
        : settings.default_email_template;
      setMessageTemplate(template);
    }
  }, [channel, settings]);

  useEffect(() => {
    if (contactSearch) {
      const results = contacts.filter(c => {
        const fullName = `${c.first_name} ${c.last_name}`.toLowerCase();
        return fullName.includes(contactSearch.toLowerCase()) ||
          c.email?.toLowerCase().includes(contactSearch.toLowerCase()) ||
          c.phone?.includes(contactSearch);
      }).slice(0, 5);
      setSearchResults(results);
    } else {
      setSearchResults([]);
    }
  }, [contactSearch, contacts]);

  async function loadSettings() {
    if (!user?.organization_id) return;
    try {
      const data = await getSettings(user.organization_id);
      setSettings(data);
      setChannel(data.default_channel);
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }

  async function loadContacts() {
    if (!user?.organization_id) return;
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('id, first_name, last_name, email, phone')
        .eq('organization_id', user.organization_id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setContacts(data as Contact[]);
    } catch (error) {
      console.error('Failed to load contacts:', error);
    }
  }

  function renderMessage() {
    if (!settings) return messageTemplate;

    const brandName = settings.brand_name || 'us';
    const reviewLink = '{review_link}';

    return messageTemplate
      .replace(/{first_name}/g, 'John')
      .replace(/{company_name}/g, brandName)
      .replace(/{review_link}/g, reviewLink);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.organization_id || !selectedContactId) return;

    try {
      setLoading(true);

      const request = await createReviewRequest(
        user.organization_id,
        {
          contact_id: selectedContactId,
          channel,
          message_template: messageTemplate,
        },
        user.id
      );

      await sendReviewRequest(request.id, user.id);

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Failed to send review request:', error);
      alert('Failed to send review request. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const selectedContact = contacts.find(c => c.id === selectedContactId);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Request Review</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {showContactSearch && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Contact
              </label>
              <div className="relative">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={contactSearch}
                    onChange={(e) => setContactSearch(e.target.value)}
                    placeholder="Search contacts..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                {searchResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {searchResults.map((contact) => (
                      <button
                        key={contact.id}
                        type="button"
                        onClick={() => {
                          setSelectedContactId(contact.id);
                          setContactSearch(`${contact.first_name} ${contact.last_name}`);
                          setSearchResults([]);
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors"
                      >
                        <div className="font-medium text-gray-900">
                          {contact.first_name} {contact.last_name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {contact.email} {contact.phone && `• ${contact.phone}`}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {selectedContact && (
                  <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="font-medium text-gray-900">
                      {selectedContact.first_name} {selectedContact.last_name}
                    </div>
                    <div className="text-sm text-gray-600">
                      {selectedContact.email} {selectedContact.phone && `• ${selectedContact.phone}`}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Channel
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setChannel('sms')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 border rounded-lg transition-colors ${
                  channel === 'sms'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <MessageSquare className="w-5 h-5" />
                SMS
              </button>
              <button
                type="button"
                onClick={() => setChannel('email')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 border rounded-lg transition-colors ${
                  channel === 'email'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Mail className="w-5 h-5" />
                Email
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Message Template
            </label>
            <textarea
              value={messageTemplate}
              onChange={(e) => setMessageTemplate(e.target.value)}
              rows={5}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Enter your message template..."
              required
            />
            <div className="mt-2 text-xs text-gray-500">
              Available merge fields: {'{first_name}'}, {'{company_name}'}, {'{review_link}'}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Preview
            </label>
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                {renderMessage()}
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !selectedContactId}
              className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending...
                </>
              ) : (
                'Send Request'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
