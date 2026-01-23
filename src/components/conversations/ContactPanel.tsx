import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { X, Mail, Phone, Building2, Briefcase, MapPin, ExternalLink, Tag, Brain, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getContactAIInsights } from '../../services/aiAgents';
import type { Conversation, Contact, Tag as TagType, AIAgentMemory, AIAgentRun } from '../../types';

interface ContactPanelProps {
  conversation: Conversation;
  onClose: () => void;
}

export function ContactPanel({ conversation, onClose }: ContactPanelProps) {
  const { hasPermission, hasFeatureAccess } = useAuth();
  const contact = conversation.contact as Contact | undefined;

  const [aiInsights, setAiInsights] = useState<{
    memories: AIAgentMemory[];
    recentRuns: AIAgentRun[];
  } | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [showAIInsights, setShowAIInsights] = useState(true);

  const canViewAI = hasPermission('ai_agents.view') && hasFeatureAccess('ai_agents');

  useEffect(() => {
    async function loadAIInsights() {
      if (!contact?.id || !canViewAI) return;

      try {
        setLoadingInsights(true);
        const data = await getContactAIInsights(contact.id);
        setAiInsights(data);
      } catch (err) {
        console.error('Failed to load AI insights:', err);
      } finally {
        setLoadingInsights(false);
      }
    }

    loadAIInsights();
  }, [contact?.id, canViewAI]);

  if (!contact) {
    return (
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Contact</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100">
            <X size={18} className="text-gray-500" />
          </button>
        </div>
        <p className="text-gray-500 text-sm">Contact information not available</p>
      </div>
    );
  }

  const contactName = `${contact.first_name} ${contact.last_name}`.trim();
  const tags = (contact.tags || []) as TagType[];

  const addressParts = [
    contact.address_line1,
    contact.address_line2,
    contact.city,
    contact.state,
    contact.postal_code,
    contact.country,
  ].filter(Boolean);
  const fullAddress = addressParts.length > 0 ? addressParts.join(', ') : null;

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Contact Info</h3>
        <button onClick={onClose} className="p-1 rounded hover:bg-gray-100">
          <X size={18} className="text-gray-500" />
        </button>
      </div>

      <div className="flex flex-col items-center mb-6">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-xl font-semibold mb-3">
          {getInitials(contactName)}
        </div>
        <h4 className="text-lg font-semibold text-gray-900">{contactName}</h4>
        {contact.company && (
          <p className="text-sm text-gray-500">{contact.company}</p>
        )}
      </div>

      <div className="space-y-4">
        {contact.email && (
          <div className="flex items-start gap-3">
            <Mail size={18} className="text-gray-400 mt-0.5" />
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Email</p>
              <a
                href={`mailto:${contact.email}`}
                className="text-sm text-blue-600 hover:underline"
              >
                {contact.email}
              </a>
            </div>
          </div>
        )}

        {contact.phone && (
          <div className="flex items-start gap-3">
            <Phone size={18} className="text-gray-400 mt-0.5" />
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Phone</p>
              <a
                href={`tel:${contact.phone}`}
                className="text-sm text-blue-600 hover:underline"
              >
                {formatPhoneNumber(contact.phone)}
              </a>
            </div>
          </div>
        )}

        {contact.company && (
          <div className="flex items-start gap-3">
            <Building2 size={18} className="text-gray-400 mt-0.5" />
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Company</p>
              <p className="text-sm text-gray-900">{contact.company}</p>
            </div>
          </div>
        )}

        {contact.job_title && (
          <div className="flex items-start gap-3">
            <Briefcase size={18} className="text-gray-400 mt-0.5" />
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Job Title</p>
              <p className="text-sm text-gray-900">{contact.job_title}</p>
            </div>
          </div>
        )}

        {fullAddress && (
          <div className="flex items-start gap-3">
            <MapPin size={18} className="text-gray-400 mt-0.5" />
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Address</p>
              <p className="text-sm text-gray-900">{fullAddress}</p>
            </div>
          </div>
        )}

        {tags.length > 0 && (
          <div className="flex items-start gap-3">
            <Tag size={18} className="text-gray-400 mt-0.5" />
            <div>
              <p className="text-xs text-gray-500 mb-1.5">Tags</p>
              <div className="flex flex-wrap gap-1">
                {tags.map((tag) => (
                  <span
                    key={tag.id}
                    className="px-2 py-0.5 text-xs rounded-full"
                    style={{
                      backgroundColor: `${tag.color}20`,
                      color: tag.color,
                    }}
                  >
                    {tag.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {contact.owner && (
          <div className="pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-500 mb-1">Assigned Owner</p>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600">
                {getInitials(contact.owner.name)}
              </div>
              <span className="text-sm text-gray-900">{contact.owner.name}</span>
            </div>
          </div>
        )}

        {conversation.department && (
          <div className="pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-500 mb-1">Department</p>
            <p className="text-sm text-gray-900">{conversation.department.name}</p>
          </div>
        )}

        {canViewAI && (
          <div className="pt-4 border-t border-gray-100">
            <button
              onClick={() => setShowAIInsights(!showAIInsights)}
              className="flex items-center justify-between w-full text-left"
            >
              <div className="flex items-center gap-2">
                <Brain size={16} className="text-cyan-500" />
                <p className="text-xs font-medium text-gray-700">AI Insights</p>
              </div>
              {showAIInsights ? (
                <ChevronUp size={14} className="text-gray-400" />
              ) : (
                <ChevronDown size={14} className="text-gray-400" />
              )}
            </button>

            {showAIInsights && (
              <div className="mt-3 space-y-3">
                {loadingInsights ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 size={16} className="animate-spin text-cyan-500" />
                  </div>
                ) : aiInsights && aiInsights.memories.length > 0 ? (
                  <>
                    {aiInsights.memories.slice(0, 2).map((memory) => (
                      <div key={memory.id} className="p-2.5 rounded-lg bg-cyan-50 border border-cyan-100">
                        <p className="text-xs font-medium text-cyan-700 mb-1.5">
                          {(memory.agent as { name?: string })?.name || 'AI Agent'}
                        </p>
                        {memory.lead_stage && (
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-xs text-gray-500">Stage:</span>
                            <span className="px-1.5 py-0.5 text-xs rounded bg-cyan-100 text-cyan-700 capitalize">
                              {memory.lead_stage}
                            </span>
                          </div>
                        )}
                        {memory.key_facts && Object.keys(memory.key_facts).length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(memory.key_facts).slice(0, 3).map(([key, value]) => (
                              <span
                                key={key}
                                className="px-1.5 py-0.5 text-xs rounded bg-gray-100 text-gray-600"
                                title={`${key}: ${value}`}
                              >
                                {value.substring(0, 20)}{value.length > 20 ? '...' : ''}
                              </span>
                            ))}
                          </div>
                        )}
                        <p className="text-xs text-gray-400 mt-1.5">
                          Updated {new Date(memory.last_updated_at).toLocaleDateString()}
                        </p>
                      </div>
                    ))}
                  </>
                ) : (
                  <p className="text-xs text-gray-400 text-center py-2">
                    No AI insights available yet
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <Link
        to={`/contacts/${contact.id}`}
        className="mt-6 flex items-center justify-center gap-2 w-full py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
      >
        View Full Profile
        <ExternalLink size={14} />
      </Link>
    </div>
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

function formatPhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');

  if (digits.length === 11 && digits.startsWith('1')) {
    const areaCode = digits.slice(1, 4);
    const exchange = digits.slice(4, 7);
    const number = digits.slice(7);
    return `(${areaCode}) ${exchange}-${number}`;
  }

  return phone;
}
