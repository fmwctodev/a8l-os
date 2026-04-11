import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  X, Mail, Phone, Building2, Briefcase, MapPin, ExternalLink, Tag, Brain,
  ChevronDown, ChevronUp, Loader2, Calendar, DollarSign, FileText, StickyNote,
  Plus, Pin, Clock, User
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getContactAIInsights } from '../../services/aiAgents';
import { getOpportunitiesByContact } from '../../services/opportunities';
import { getAppointmentsByContact } from '../../services/appointments';
import { getAttachments } from '../../services/fileAttachments';
import { getContactNotes, createNote } from '../../services/contactNotes';
import type { Conversation, Contact, Tag as TagType, AIAgentMemory, AIAgentRun, Opportunity, Appointment, ContactNote } from '../../types';
import type { FileAttachmentWithFile } from '../../services/fileAttachments';

function normalizeTagsArray(rawTags: unknown): TagType[] {
  if (!rawTags || !Array.isArray(rawTags)) return [];
  return rawTags
    .map((item) => {
      if (item && typeof item === 'object' && 'tag' in item && item.tag) {
        return item.tag as TagType;
      }
      return item as TagType;
    })
    .filter((tag): tag is TagType => tag !== null && tag !== undefined && typeof tag?.id === 'string');
}

interface ContactPanelProps {
  conversation: Conversation;
  onClose: () => void;
}

type TabId = 'overview' | 'opportunities' | 'appointments' | 'files' | 'notes';

export function ContactPanel({ conversation, onClose }: ContactPanelProps) {
  const { hasPermission, isFeatureEnabled } = useAuth();
  const contact = conversation.contact as Contact | undefined;

  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [aiInsights, setAiInsights] = useState<{
    memories: AIAgentMemory[];
    recentRuns: AIAgentRun[];
  } | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);

  const canViewAI = hasPermission('ai_agents.view') && isFeatureEnabled('ai_agents');
  const canViewOpportunities = hasPermission('opportunities.view') && isFeatureEnabled('opportunities');
  const canViewCalendars = hasPermission('calendars.view') && isFeatureEnabled('calendars');

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
          <h3 className="font-semibold text-white">Contact</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-700">
            <X size={18} className="text-slate-400" />
          </button>
        </div>
        <p className="text-slate-400 text-sm">Contact information not available</p>
      </div>
    );
  }

  const contactName = `${contact.first_name} ${contact.last_name}`.trim();
  const tags = normalizeTagsArray(contact.tags);

  const tabs = [
    { id: 'overview' as TabId, label: 'Overview' },
    ...(canViewOpportunities ? [{ id: 'opportunities' as TabId, label: 'Deals' }] : []),
    ...(canViewCalendars ? [{ id: 'appointments' as TabId, label: 'Appts' }] : []),
    { id: 'files' as TabId, label: 'Files' },
    { id: 'notes' as TabId, label: 'Notes' },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-white">Contact Info</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-700">
            <X size={18} className="text-slate-400" />
          </button>
        </div>

        <div className="flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center text-white text-xl font-semibold mb-3">
            {getInitials(contactName)}
          </div>
          <h4 className="text-lg font-semibold text-white">{contactName}</h4>
          {contact.company && (
            <p className="text-sm text-slate-400">{contact.company}</p>
          )}
        </div>

        <div className="flex justify-center gap-2 mt-4">
          {contact.phone && (
            <a
              href={`tel:${contact.phone}`}
              className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
              title="Call"
            >
              <Phone size={18} className="text-teal-400" />
            </a>
          )}
          {contact.email && (
            <a
              href={`mailto:${contact.email}`}
              className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
              title="Email"
            >
              <Mail size={18} className="text-blue-400" />
            </a>
          )}
          <Link
            to={`/opportunities/new?contact_id=${contact.id}`}
            className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
            title="Create Opportunity"
          >
            <DollarSign size={18} className="text-emerald-400" />
          </Link>
          <Link
            to={`/calendars?book=${contact.id}`}
            className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
            title="Book Appointment"
          >
            <Calendar size={18} className="text-amber-400" />
          </Link>
        </div>
      </div>

      <div className="border-b border-slate-700">
        <div className="flex">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-3 py-2.5 text-xs font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-cyan-400 border-b-2 border-cyan-400'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'overview' && (
          <OverviewTab
            contact={contact}
            conversation={conversation}
            tags={tags}
            canViewAI={canViewAI}
            loadingInsights={loadingInsights}
            aiInsights={aiInsights}
          />
        )}
        {activeTab === 'opportunities' && <OpportunitiesTab contactId={contact.id} />}
        {activeTab === 'appointments' && <AppointmentsTab contactId={contact.id} />}
        {activeTab === 'files' && <FilesTab conversationId={conversation.id} />}
        {activeTab === 'notes' && <NotesTab contactId={contact.id} />}
      </div>

      <div className="p-4 border-t border-slate-700">
        <Link
          to={`/contacts/${contact.id}`}
          className="flex items-center justify-center gap-2 w-full py-2.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium text-white transition-colors"
        >
          View Full Profile
          <ExternalLink size={14} />
        </Link>
      </div>
    </div>
  );
}

interface OverviewTabProps {
  contact: Contact;
  conversation: Conversation;
  tags: TagType[];
  canViewAI: boolean;
  loadingInsights: boolean;
  aiInsights: { memories: AIAgentMemory[]; recentRuns: AIAgentRun[] } | null;
}

function OverviewTab({ contact, conversation, tags, canViewAI, loadingInsights, aiInsights }: OverviewTabProps) {
  const hasInsights = aiInsights && aiInsights.memories.length > 0;
  const [showAIInsights, setShowAIInsights] = useState(hasInsights);

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
    <div className="space-y-4">
      {contact.email && (
        <InfoRow icon={Mail} label="Email" value={contact.email} isLink href={`mailto:${contact.email}`} />
      )}
      {contact.phone && (
        <InfoRow icon={Phone} label="Phone" value={formatPhoneNumber(contact.phone)} isLink href={`tel:${contact.phone}`} />
      )}
      {contact.company && (
        <InfoRow icon={Building2} label="Company" value={contact.company} />
      )}
      {contact.job_title && (
        <InfoRow icon={Briefcase} label="Job Title" value={contact.job_title} />
      )}
      {fullAddress && (
        <InfoRow icon={MapPin} label="Address" value={fullAddress} />
      )}

      {tags.length > 0 && (
        <div className="flex items-start gap-3">
          <Tag size={18} className="text-slate-500 mt-0.5" />
          <div>
            <p className="text-xs text-slate-500 mb-1.5">Tags</p>
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
        <div className="pt-4 border-t border-slate-700">
          <p className="text-xs text-slate-500 mb-1">Assigned Owner</p>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-slate-600 flex items-center justify-center text-xs font-medium text-slate-300">
              {getInitials(contact.owner.name)}
            </div>
            <span className="text-sm text-white">{contact.owner.name}</span>
          </div>
        </div>
      )}

      {conversation.department && (
        <div className="pt-4 border-t border-slate-700">
          <p className="text-xs text-slate-500 mb-1">Department</p>
          <p className="text-sm text-white">{conversation.department.name}</p>
        </div>
      )}

      {canViewAI && (
        <div className="pt-4 border-t border-slate-700">
          <button
            onClick={() => setShowAIInsights(!showAIInsights)}
            className="flex items-center justify-between w-full text-left"
          >
            <div className="flex items-center gap-2">
              <Brain size={16} className="text-cyan-400" />
              <p className="text-xs font-medium text-slate-300">AI Insights</p>
            </div>
            {showAIInsights ? (
              <ChevronUp size={14} className="text-slate-500" />
            ) : (
              <ChevronDown size={14} className="text-slate-500" />
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
                    <div key={memory.id} className="p-2.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                      <p className="text-xs font-medium text-cyan-400 mb-1.5">
                        {(memory.agent as { name?: string })?.name || 'AI Agent'}
                      </p>
                      {memory.lead_stage && (
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-xs text-slate-400">Stage:</span>
                          <span className="px-1.5 py-0.5 text-xs rounded bg-cyan-500/20 text-cyan-300 capitalize">
                            {memory.lead_stage}
                          </span>
                        </div>
                      )}
                      {memory.key_facts && Object.keys(memory.key_facts).length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(memory.key_facts).slice(0, 3).map(([key, value]) => (
                            <span
                              key={key}
                              className="px-1.5 py-0.5 text-xs rounded bg-slate-700 text-slate-300"
                              title={`${key}: ${value}`}
                            >
                              {value.substring(0, 20)}{value.length > 20 ? '...' : ''}
                            </span>
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-slate-500 mt-1.5">
                        Updated {new Date(memory.last_updated_at).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </>
              ) : (
                <p className="text-xs text-slate-500 text-center py-2">
                  No AI insights available yet
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function OpportunitiesTab({ contactId }: { contactId: string }) {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getOpportunitiesByContact(contactId);
        if (!cancelled) setOpportunities(data);
      } catch (err) {
        console.error('Failed to load opportunities:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [contactId]);

  if (loading) {
    return <div className="flex justify-center py-6"><Loader2 size={18} className="animate-spin text-slate-400" /></div>;
  }

  return (
    <div className="space-y-3">
      {opportunities.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-4">No opportunities yet</p>
      ) : (
        opportunities.map((opp) => (
          <Link
            key={opp.id}
            to={`/opportunities/${opp.id}`}
            className="block p-3 bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <div className="flex items-start justify-between mb-1">
              <p className="text-sm font-medium text-white">{opp.name}</p>
              <span className="text-sm font-semibold text-emerald-400">
                ${(opp.value || 0).toLocaleString()}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {opp.stage && (
                <span className="px-2 py-0.5 text-xs rounded bg-slate-600 text-slate-300">
                  {(opp.stage as { name?: string })?.name || 'Unknown'}
                </span>
              )}
              {opp.probability != null && (
                <span className="text-xs text-slate-400">{opp.probability}% likely</span>
              )}
            </div>
          </Link>
        ))
      )}
      <Link
        to={`/opportunities/new?contact_id=${contactId}`}
        className="w-full flex items-center justify-center gap-2 py-2 text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
      >
        <Plus size={14} />
        Create Opportunity
      </Link>
    </div>
  );
}

function AppointmentsTab({ contactId }: { contactId: string }) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getAppointmentsByContact(contactId);
        if (!cancelled) setAppointments(data);
      } catch (err) {
        console.error('Failed to load appointments:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [contactId]);

  if (loading) {
    return <div className="flex justify-center py-6"><Loader2 size={18} className="animate-spin text-slate-400" /></div>;
  }

  const statusColors: Record<string, string> = {
    scheduled: 'bg-blue-500/20 text-blue-400',
    confirmed: 'bg-emerald-500/20 text-emerald-400',
    completed: 'bg-slate-500/20 text-slate-400',
    cancelled: 'bg-red-500/20 text-red-400',
    no_show: 'bg-amber-500/20 text-amber-400',
  };

  return (
    <div className="space-y-3">
      {appointments.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-4">No appointments yet</p>
      ) : (
        appointments.map((appt) => (
          <div key={appt.id} className="p-3 bg-slate-700/50 rounded-lg">
            <div className="flex items-start justify-between mb-1">
              <p className="text-sm font-medium text-white">
                {(appt.appointment_type as { name?: string })?.name || 'Appointment'}
              </p>
              <span className={`px-2 py-0.5 text-xs rounded capitalize ${statusColors[appt.status] || 'bg-slate-500/20 text-slate-400'}`}>
                {appt.status.replace('_', ' ')}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Calendar size={12} />
              {new Date(appt.start_at_utc).toLocaleDateString()}
              <Clock size={12} />
              {new Date(appt.start_at_utc).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
            </div>
          </div>
        ))
      )}
      <Link
        to={`/calendars?book=${contactId}`}
        className="w-full flex items-center justify-center gap-2 py-2 text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
      >
        <Plus size={14} />
        Book Appointment
      </Link>
    </div>
  );
}

function FilesTab({ conversationId }: { conversationId: string }) {
  const [files, setFiles] = useState<FileAttachmentWithFile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getAttachments('conversations', conversationId);
        if (!cancelled) setFiles(data);
      } catch (err) {
        console.error('Failed to load files:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [conversationId]);

  if (loading) {
    return <div className="flex justify-center py-6"><Loader2 size={18} className="animate-spin text-slate-400" /></div>;
  }

  return (
    <div className="space-y-2">
      {files.length > 0 ? (
        files.map((attachment) => (
          <div
            key={attachment.id}
            className="flex items-center gap-3 p-3 bg-slate-700/50 hover:bg-slate-700 rounded-lg cursor-pointer transition-colors"
          >
            <div className="w-10 h-10 rounded-lg bg-slate-600 flex items-center justify-center">
              <FileText className="w-5 h-5 text-slate-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{attachment.drive_file?.name || 'File'}</p>
              <p className="text-xs text-slate-400">
                {formatFileSize(attachment.drive_file?.size_bytes || 0)} - {new Date(attachment.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
        ))
      ) : (
        <p className="text-sm text-slate-400 text-center py-4">No files shared yet</p>
      )}
    </div>
  );
}

function NotesTab({ contactId }: { contactId: string }) {
  const { user } = useAuth();
  const [notes, setNotes] = useState<ContactNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState('');
  const [saving, setSaving] = useState(false);

  const loadNotes = useCallback(async () => {
    try {
      const data = await getContactNotes(contactId);
      setNotes(data);
    } catch (err) {
      console.error('Failed to load notes:', err);
    } finally {
      setLoading(false);
    }
  }, [contactId]);

  useEffect(() => { loadNotes(); }, [loadNotes]);

  const handleAddNote = async () => {
    if (!newNote.trim() || !user || saving) return;
    try {
      setSaving(true);
      await createNote(contactId, newNote.trim(), user as Parameters<typeof createNote>[2]);
      setNewNote('');
      await loadNotes();
    } catch (err) {
      console.error('Failed to create note:', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-6"><Loader2 size={18} className="animate-spin text-slate-400" /></div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          type="text"
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAddNote(); }}
          placeholder="Add a note..."
          className="flex-1 px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
        />
        <button
          onClick={handleAddNote}
          disabled={!newNote.trim() || saving}
          className="px-3 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
        </button>
      </div>

      {notes.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-4">No notes yet</p>
      ) : (
        notes.map((note) => (
          <div
            key={note.id}
            className={`p-3 rounded-lg ${
              note.is_pinned ? 'bg-cyan-500/10 border border-cyan-500/20' : 'bg-slate-700/50'
            }`}
          >
            {note.is_pinned && (
              <div className="flex items-center gap-1 text-xs text-cyan-400 mb-2">
                <Pin size={10} />
                Pinned
              </div>
            )}
            <p className="text-sm text-white mb-2">{note.content}</p>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <User size={10} />
              {(note.user as { name?: string })?.name || 'Unknown'}
              <span>-</span>
              {new Date(note.created_at).toLocaleDateString()}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  isLink,
  href
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  isLink?: boolean;
  href?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon size={18} className="text-slate-500 mt-0.5" />
      <div>
        <p className="text-xs text-slate-500 mb-0.5">{label}</p>
        {isLink && href ? (
          <a href={href} className="text-sm text-cyan-400 hover:underline">
            {value}
          </a>
        ) : (
          <p className="text-sm text-white">{value}</p>
        )}
      </div>
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

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
