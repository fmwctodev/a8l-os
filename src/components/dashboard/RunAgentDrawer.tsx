import { useState, useEffect } from 'react';
import { Search, Bot, Play } from 'lucide-react';
import { Drawer } from '../layouts/Drawer';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { logActivity } from '../../services/activityLog';

interface RunAgentDrawerProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface AIAgent {
  id: string;
  name: string;
  description: string | null;
  agent_type: string;
}

interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
}

export function RunAgentDrawer({ open, onClose, onSuccess }: RunAgentDrawerProps) {
  const { user } = useAuth();
  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [contextType, setContextType] = useState<'none' | 'contact'>('none');
  const [instructions, setInstructions] = useState('');
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    if (open && user?.organization_id) {
      fetchAgents();
    }
  }, [open, user?.organization_id]);

  useEffect(() => {
    if (!open) {
      setSelectedAgent('');
      setSearchQuery('');
      setContacts([]);
      setSelectedContact(null);
      setContextType('none');
      setInstructions('');
      setError(null);
      setResult(null);
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

  async function fetchAgents() {
    const { data } = await supabase
      .from('ai_agents')
      .select('id, name, description, agent_type')
      .eq('organization_id', user?.organization_id)
      .eq('is_active', true)
      .order('name');

    if (data) {
      setAgents(data);
      if (data.length > 0) {
        setSelectedAgent(data[0].id);
      }
    }
  }

  async function searchContacts() {
    setSearching(true);
    const { data } = await supabase
      .from('contacts')
      .select('id, first_name, last_name, email')
      .eq('organization_id', user?.organization_id)
      .eq('status', 'active')
      .or(
        `first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`
      )
      .limit(10);

    setContacts(data || []);
    setSearching(false);
  }

  async function handleRun() {
    if (!user || !user.organization_id || !selectedAgent) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const agent = agents.find((a) => a.id === selectedAgent);
      const runId = crypto.randomUUID();

      const { error: runError } = await supabase.from('ai_agent_runs').insert({
        id: runId,
        organization_id: user.organization_id,
        agent_id: selectedAgent,
        contact_id: contextType === 'contact' && selectedContact ? selectedContact.id : null,
        status: 'pending',
        input_data: {
          instructions,
          context_type: contextType,
          contact_id: selectedContact?.id,
        },
        triggered_by: user.id,
      });

      if (runError) throw runError;

      await logActivity({
        organizationId: user.organization_id,
        userId: user.id,
        eventType: 'ai_agent_run',
        entityType: 'ai_agent',
        entityId: selectedAgent,
        contactId: selectedContact?.id,
        summary: `Started ${agent?.name} agent`,
        payload: {
          run_id: runId,
          agent_type: agent?.agent_type,
          has_contact_context: contextType === 'contact',
        },
      });

      setResult(`Agent "${agent?.name}" has been triggered. Run ID: ${runId.slice(0, 8)}...`);
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run agent');
    } finally {
      setLoading(false);
    }
  }

  const currentAgent = agents.find((a) => a.id === selectedAgent);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Run AI Agent"
      subtitle="Execute an AI agent task"
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
            onClick={handleRun}
            disabled={loading || !selectedAgent}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Play className="h-4 w-4" />
            {loading ? 'Running...' : 'Run Agent'}
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

        {result && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-sm text-emerald-400">
            {result}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Select Agent <span className="text-red-400">*</span>
          </label>
          {agents.length === 0 ? (
            <div className="p-4 bg-slate-800 border border-slate-700 rounded-lg text-center">
              <Bot className="h-8 w-8 text-slate-600 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No AI agents available</p>
            </div>
          ) : (
            <div className="space-y-2">
              {agents.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => setSelectedAgent(agent.id)}
                  className={`w-full flex items-start gap-3 p-3 rounded-lg border transition-colors text-left ${
                    selectedAgent === agent.id
                      ? 'bg-cyan-500/10 border-cyan-500/50'
                      : 'bg-slate-800 border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <div
                    className={`p-2 rounded-lg ${
                      selectedAgent === agent.id
                        ? 'bg-cyan-500/20 text-cyan-400'
                        : 'bg-slate-700 text-slate-400'
                    }`}
                  >
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm font-medium ${
                        selectedAgent === agent.id ? 'text-cyan-400' : 'text-white'
                      }`}
                    >
                      {agent.name}
                    </p>
                    {agent.description && (
                      <p className="text-xs text-slate-500 truncate">{agent.description}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {currentAgent && (
          <>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Context</label>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setContextType('none');
                    setSelectedContact(null);
                  }}
                  className={`flex-1 px-4 py-2.5 rounded-lg border transition-colors text-sm font-medium ${
                    contextType === 'none'
                      ? 'bg-cyan-500/10 border-cyan-500/50 text-cyan-400'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  No Context
                </button>
                <button
                  onClick={() => setContextType('contact')}
                  className={`flex-1 px-4 py-2.5 rounded-lg border transition-colors text-sm font-medium ${
                    contextType === 'contact'
                      ? 'bg-cyan-500/10 border-cyan-500/50 text-cyan-400'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  Contact
                </button>
              </div>
            </div>

            {contextType === 'contact' && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Select Contact
                </label>
                {selectedContact ? (
                  <div className="flex items-center justify-between p-3 bg-slate-800 border border-slate-700 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-white">
                        {selectedContact.first_name} {selectedContact.last_name}
                      </p>
                      <p className="text-xs text-slate-400">
                        {selectedContact.email || 'No email'}
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
                                {contact.email || 'No email'}
                              </p>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Instructions (Optional)
              </label>
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                rows={4}
                placeholder="Add any specific instructions for this agent run..."
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 resize-none"
              />
            </div>
          </>
        )}
      </div>
    </Drawer>
  );
}
