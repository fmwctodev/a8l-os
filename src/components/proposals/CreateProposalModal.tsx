import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { createProposal, getProposalTemplates } from '../../services/proposals';
import { getContacts } from '../../services/contacts';
import { getOpportunitiesByContact } from '../../services/opportunities';
import type { Contact, Opportunity, ProposalTemplate } from '../../types';
import {
  X,
  FileText,
  User,
  Loader2,
  Search,
  ChevronRight,
  Sparkles,
  Layout,
  Plus,
} from 'lucide-react';
import { InlineCreateContactForm } from '../shared/InlineCreateContactForm';

interface CreateProposalModalProps {
  onClose: () => void;
  onCreated: () => void;
  preselectedContactId?: string;
  preselectedOpportunityId?: string;
}

export function CreateProposalModal({
  onClose,
  onCreated,
  preselectedContactId,
  preselectedOpportunityId,
}: CreateProposalModalProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState<'contact' | 'details'>('contact');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactSearch, setContactSearch] = useState('');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [showNewContactForm, setShowNewContactForm] = useState(false);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null);
  const [templates, setTemplates] = useState<ProposalTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<ProposalTemplate | null>(null);
  const [title, setTitle] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [useAI, setUseAI] = useState(true);

  useEffect(() => {
    if (!user?.organization_id) return;
    loadTemplates();
    if (preselectedContactId) {
      loadPreselectedContact();
    } else {
      searchContacts('');
    }
  }, [user?.organization_id]);

  useEffect(() => {
    if (selectedContact) {
      loadOpportunities(selectedContact.id);
    }
  }, [selectedContact]);

  const loadTemplates = async () => {
    try {
      const data = await getProposalTemplates();
      setTemplates(data);
      const defaultTemplate = data.find(t => t.is_default);
      if (defaultTemplate) {
        setSelectedTemplate(defaultTemplate);
      }
    } catch (err) {
      console.error('Failed to load templates:', err);
    }
  };

  const loadPreselectedContact = async () => {
    if (!user?.organization_id) return;
    try {
      const data = await getContacts(user.organization_id, { search: '' });
      const contact = data.find(c => c.id === preselectedContactId);
      if (contact) {
        setSelectedContact(contact);
        setStep('details');
      }
    } catch (err) {
      console.error('Failed to load contact:', err);
    }
  };

  const searchContacts = async (query: string) => {
    if (!user?.organization_id) return;
    try {
      setIsLoadingContacts(true);
      const data = await getContacts(user.organization_id, { search: query });
      setContacts(data.slice(0, 20));
    } catch (err) {
      console.error('Failed to search contacts:', err);
    } finally {
      setIsLoadingContacts(false);
    }
  };

  const loadOpportunities = async (contactId: string) => {
    try {
      const data = await getOpportunitiesByContact(contactId);
      setOpportunities(data.filter(o => o.status === 'open'));
      if (preselectedOpportunityId) {
        const preselected = data.find(o => o.id === preselectedOpportunityId);
        if (preselected) {
          setSelectedOpportunity(preselected);
        }
      }
    } catch (err) {
      console.error('Failed to load opportunities:', err);
    }
  };

  const handleContactSelect = (contact: Contact) => {
    setSelectedContact(contact);
    setTitle(`Proposal for ${contact.company || `${contact.first_name} ${contact.last_name}`}`);
    setStep('details');
  };

  const handleSubmit = async () => {
    if (!selectedContact || !user || !title) return;

    try {
      setIsSubmitting(true);

      const proposal = await createProposal({
        org_id: user.organization_id,
        contact_id: selectedContact.id,
        opportunity_id: selectedOpportunity?.id || null,
        title,
        valid_until: validUntil || null,
        created_by: user.id,
        template_id: selectedTemplate?.id || null,
      });

      if (useAI) {
        navigate(`/proposals/${proposal.id}/build`);
      } else {
        navigate(`/proposals/${proposal.id}`);
      }

      onCreated();
    } catch (err) {
      console.error('Failed to create proposal:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const defaultValidUntil = () => {
    const date = new Date();
    date.setDate(date.getDate() + 30);
    return date.toISOString().split('T')[0];
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-xl border border-slate-700 w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-cyan-400" />
              Create New Proposal
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              {step === 'contact' ? 'Select a client' : 'Configure proposal details'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {step === 'contact' ? (
            <div className="space-y-4">
              {showNewContactForm && user ? (
                <InlineCreateContactForm
                  orgId={user.organization_id}
                  currentUser={user}
                  initialFirstName={contactSearch}
                  onCreated={(contact) => {
                    setContacts((prev) => [contact, ...prev]);
                    setShowNewContactForm(false);
                    handleContactSelect(contact);
                  }}
                  onCancel={() => setShowNewContactForm(false)}
                />
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search contacts..."
                        value={contactSearch}
                        onChange={(e) => {
                          setContactSearch(e.target.value);
                          searchContacts(e.target.value);
                        }}
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                      />
                    </div>
                    <button
                      onClick={() => setShowNewContactForm(true)}
                      className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-cyan-400 hover:bg-slate-700 text-sm whitespace-nowrap transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      New Contact
                    </button>
                  </div>

                  {isLoadingContacts ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
                    </div>
                  ) : contacts.length === 0 ? (
                    <div className="text-center py-12 text-slate-400">
                      <User className="w-10 h-10 mx-auto mb-3 opacity-50" />
                      <p>No contacts found</p>
                      <button
                        onClick={() => setShowNewContactForm(true)}
                        className="mt-3 flex items-center gap-1.5 px-4 py-2 bg-cyan-600 text-white rounded-lg text-sm hover:bg-cyan-700 transition-colors mx-auto"
                      >
                        <Plus className="w-4 h-4" />
                        Create New Contact
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {contacts.map((contact) => (
                        <button
                          key={contact.id}
                          onClick={() => handleContactSelect(contact)}
                          className="w-full flex items-center justify-between p-4 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 rounded-lg transition-colors group"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center">
                              <span className="text-sm font-medium text-white">
                                {contact.first_name?.[0]}{contact.last_name?.[0]}
                              </span>
                            </div>
                            <div className="text-left">
                              <p className="text-white font-medium">
                                {contact.first_name} {contact.last_name}
                              </p>
                              <p className="text-sm text-slate-400">
                                {contact.company || contact.email || 'No company'}
                              </p>
                            </div>
                          </div>
                          <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-cyan-400 transition-colors" />
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center gap-3 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center">
                  <span className="text-sm font-medium text-white">
                    {selectedContact?.first_name?.[0]}{selectedContact?.last_name?.[0]}
                  </span>
                </div>
                <div>
                  <p className="text-white font-medium">
                    {selectedContact?.first_name} {selectedContact?.last_name}
                  </p>
                  <p className="text-sm text-slate-400">
                    {selectedContact?.company || selectedContact?.email}
                  </p>
                </div>
                <button
                  onClick={() => setStep('contact')}
                  className="ml-auto text-sm text-cyan-400 hover:text-cyan-300"
                >
                  Change
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Proposal Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter proposal title..."
                  className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                />
              </div>

              {opportunities.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Link to Opportunity (Optional)
                  </label>
                  <select
                    value={selectedOpportunity?.id || ''}
                    onChange={(e) => {
                      const opp = opportunities.find(o => o.id === e.target.value);
                      setSelectedOpportunity(opp || null);
                    }}
                    className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                  >
                    <option value="">No opportunity linked</option>
                    {opportunities.map((opp) => (
                      <option key={opp.id} value={opp.id}>
                        {opp.pipeline?.name} - {opp.stage?.name} (${opp.value_amount.toLocaleString()})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Template
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {templates.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => setSelectedTemplate(template)}
                      className={`p-4 rounded-lg border text-left transition-colors ${
                        selectedTemplate?.id === template.id
                          ? 'border-cyan-500 bg-cyan-500/10'
                          : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Layout className="w-4 h-4 text-cyan-400" />
                        <span className="text-white font-medium text-sm">{template.name}</span>
                      </div>
                      {template.description && (
                        <p className="text-xs text-slate-400 line-clamp-2">{template.description}</p>
                      )}
                    </button>
                  ))}
                  <button
                    onClick={() => setSelectedTemplate(null)}
                    className={`p-4 rounded-lg border text-left transition-colors ${
                      selectedTemplate === null
                        ? 'border-cyan-500 bg-cyan-500/10'
                        : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <FileText className="w-4 h-4 text-slate-400" />
                      <span className="text-white font-medium text-sm">Blank</span>
                    </div>
                    <p className="text-xs text-slate-400">Start from scratch</p>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Valid Until (Optional)
                </label>
                <input
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  placeholder={defaultValidUntil()}
                  className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                />
              </div>

              <div className="p-4 rounded-lg border border-cyan-500/30 bg-cyan-500/5">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useAI}
                    onChange={(e) => setUseAI(e.target.checked)}
                    className="w-5 h-5 rounded border-slate-600 bg-slate-700 text-cyan-500 focus:ring-cyan-500/50"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-cyan-400" />
                      <span className="text-white font-medium">Use AI to generate content</span>
                    </div>
                    <p className="text-sm text-slate-400 mt-1">
                      Open the AI-powered builder to generate proposal content from meeting notes and contact history
                    </p>
                  </div>
                </label>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-700 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-300 hover:text-white transition-colors"
          >
            Cancel
          </button>
          {step === 'details' && (
            <button
              onClick={handleSubmit}
              disabled={!title || isSubmitting}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : useAI ? (
                <Sparkles className="w-4 h-4" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
              {useAI ? 'Continue to Builder' : 'Create Proposal'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
