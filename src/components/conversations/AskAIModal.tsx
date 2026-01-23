import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getAgents } from '../../services/aiAgents';
import { supabase } from '../../lib/supabase';
import type { AIAgent, Contact, Conversation, AIAgentChannel } from '../../types';
import {
  X,
  Loader2,
  Bot,
  Play,
  Check,
  Edit3,
  FileText,
  MessageSquare,
  Mail,
  AlertCircle,
  ChevronDown,
} from 'lucide-react';

interface AskAIModalProps {
  contact: Contact;
  conversation?: Conversation;
  onClose: () => void;
  onAcceptDraft: (draft: string, channel: AIAgentChannel, subject?: string) => void;
}

interface AgentRunResult {
  success: boolean;
  run_id: string;
  output_summary: string;
  actions_taken: string[];
  draft_message: string | null;
  draft_channel: AIAgentChannel | null;
  draft_subject: string | null;
  tool_calls_count: number;
  requires_approval: boolean;
  error?: string;
}

export function AskAIModal({ contact, conversation, onClose, onAcceptDraft }: AskAIModalProps) {
  const { user: currentUser } = useAuth();
  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [instructions, setInstructions] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<AgentRunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAgentDropdown, setShowAgentDropdown] = useState(false);
  const [editedDraft, setEditedDraft] = useState('');
  const [isEditingDraft, setIsEditingDraft] = useState(false);

  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    if (!currentUser?.organization_id) return;

    try {
      setIsLoading(true);
      const data = await getAgents(currentUser.organization_id, { enabled: true });
      setAgents(data);
      if (data.length > 0) {
        setSelectedAgentId(data[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load agents');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunAgent = async () => {
    if (!selectedAgentId || !currentUser) return;

    try {
      setIsRunning(true);
      setError(null);
      setResult(null);

      const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-agent-executor`;

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          agent_id: selectedAgentId,
          contact_id: contact.id,
          conversation_id: conversation?.id,
          instructions: instructions || undefined,
          triggered_by: 'user',
          user_id: currentUser.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to run agent');
      }

      setResult(data);
      if (data.draft_message) {
        setEditedDraft(data.draft_message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run agent');
    } finally {
      setIsRunning(false);
    }
  };

  const handleAcceptDraft = () => {
    if (!result?.draft_channel) return;
    const draftToSend = isEditingDraft ? editedDraft : (result.draft_message || '');
    onAcceptDraft(draftToSend, result.draft_channel, result.draft_subject || undefined);
  };

  const selectedAgent = agents.find(a => a.id === selectedAgentId);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500/20 to-teal-500/20 flex items-center justify-center">
              <Bot className="w-5 h-5 text-cyan-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Ask AI Assistant</h2>
              <p className="text-sm text-gray-500">
                Run an AI agent on {contact.first_name} {contact.last_name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
            </div>
          ) : agents.length === 0 ? (
            <div className="text-center py-12">
              <Bot className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 font-medium">No AI agents available</p>
              <p className="text-gray-400 text-sm">Create an agent first to use this feature</p>
            </div>
          ) : !result ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Agent
                </label>
                <div className="relative">
                  <button
                    onClick={() => setShowAgentDropdown(!showAgentDropdown)}
                    className="w-full flex items-center justify-between px-4 py-2.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Bot className="w-5 h-5 text-cyan-500" />
                      <div className="text-left">
                        <p className="text-sm font-medium text-gray-900">
                          {selectedAgent?.name || 'Select an agent'}
                        </p>
                        {selectedAgent?.description && (
                          <p className="text-xs text-gray-500 truncate max-w-[280px]">
                            {selectedAgent.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  </button>

                  {showAgentDropdown && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setShowAgentDropdown(false)}
                      />
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-[200px] overflow-y-auto">
                        {agents.map((agent) => (
                          <button
                            key={agent.id}
                            onClick={() => {
                              setSelectedAgentId(agent.id);
                              setShowAgentDropdown(false);
                            }}
                            className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 ${
                              agent.id === selectedAgentId ? 'bg-cyan-50' : ''
                            }`}
                          >
                            <Bot className={`w-5 h-5 ${
                              agent.id === selectedAgentId ? 'text-cyan-500' : 'text-gray-400'
                            }`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900">{agent.name}</p>
                              {agent.description && (
                                <p className="text-xs text-gray-500 truncate">{agent.description}</p>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Additional Instructions (Optional)
                </label>
                <textarea
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="e.g., Focus on qualifying this lead for our premium plan..."
                  rows={3}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                />
              </div>

              <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
                <p className="text-xs font-medium text-gray-600 mb-2">Contact Context</p>
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
                  <div>Name: {contact.first_name} {contact.last_name}</div>
                  <div>Email: {contact.email || 'N/A'}</div>
                  <div>Phone: {contact.phone || 'N/A'}</div>
                  <div>Company: {contact.company || 'N/A'}</div>
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-4">
              {result.output_summary && (
                <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
                  <p className="text-sm font-medium text-gray-700 mb-2">Summary</p>
                  <p className="text-sm text-gray-600">{result.output_summary}</p>
                </div>
              )}

              {result.actions_taken && result.actions_taken.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Actions Taken</p>
                  <ul className="space-y-1">
                    {result.actions_taken.map((action, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                        <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                        {action}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {result.draft_message && (
                <div className="p-4 rounded-lg bg-cyan-50 border border-cyan-200">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {result.draft_channel === 'sms' && <MessageSquare className="w-4 h-4 text-cyan-600" />}
                      {result.draft_channel === 'email' && <Mail className="w-4 h-4 text-cyan-600" />}
                      {result.draft_channel === 'internal_note' && <FileText className="w-4 h-4 text-cyan-600" />}
                      <p className="text-sm font-medium text-cyan-700">
                        Draft {result.draft_channel?.toUpperCase()}
                        {result.draft_subject && `: ${result.draft_subject}`}
                      </p>
                    </div>
                    <button
                      onClick={() => setIsEditingDraft(!isEditingDraft)}
                      className="p-1 rounded hover:bg-cyan-100 transition-colors"
                      title={isEditingDraft ? 'Cancel editing' : 'Edit draft'}
                    >
                      <Edit3 className="w-4 h-4 text-cyan-600" />
                    </button>
                  </div>

                  {isEditingDraft ? (
                    <textarea
                      value={editedDraft}
                      onChange={(e) => setEditedDraft(e.target.value)}
                      rows={4}
                      className="w-full px-3 py-2 border border-cyan-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-sm"
                    />
                  ) : (
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">
                      {result.draft_message}
                    </p>
                  )}

                  <p className="text-xs text-cyan-600 mt-2">
                    This draft requires your approval before sending.
                  </p>
                </div>
              )}

              {result.error && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-600">{result.error}</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200">
          {!result ? (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRunAgent}
                disabled={isRunning || !selectedAgentId}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-600 text-white font-medium hover:from-cyan-600 hover:to-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRunning ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Run Agent
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setResult(null)}
                className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
              >
                Run Again
              </button>
              {result.draft_message && result.draft_channel !== 'internal_note' && (
                <button
                  onClick={handleAcceptDraft}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-600 text-white font-medium hover:from-cyan-600 hover:to-teal-700 transition-colors"
                >
                  <Check className="w-4 h-4" />
                  Accept Draft
                </button>
              )}
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
              >
                Close
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
