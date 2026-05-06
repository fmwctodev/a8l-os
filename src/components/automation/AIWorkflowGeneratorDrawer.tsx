import { useState, useCallback } from 'react';
import { X, Sparkles, Send, AlertCircle, CheckCircle2, RotateCcw, Wand2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { generateWorkflowFromPrompt } from '../../services/workflowAIGenerator';
import type { WorkflowDefinition } from '../../types';

interface Props {
  open: boolean;
  onClose: () => void;
  /** When the user accepts a generated workflow, this callback receives the
   *  full definition and is responsible for replacing or merging into the
   *  current workflow draft. */
  onAccept: (definition: WorkflowDefinition, suggestedName?: string) => void;
  /** Optional existing draft so AI generates iterative refinements. */
  existingDefinition?: WorkflowDefinition | null;
}

interface ChatMessage {
  role: 'user' | 'ai';
  content: string;
  definition?: WorkflowDefinition;
  validationErrors?: string[];
  suggestedName?: string;
}

const PROMPT_STARTERS = [
  'When a contact opts in for SMS, send a welcome with our capability statement',
  'Re-engage cold contacts after 60 days with a check-in email and tag if no reply',
  'When an opportunity is created in the government pipeline, place a Vapi voice qualification call',
  'When an appointment is booked, send 24h + 1h SMS reminders',
];

/**
 * AIWorkflowGeneratorDrawer — chat-style UI for generating and refining
 * workflow node graphs. Slides in from the right of the builder canvas.
 *
 * Flow:
 *   1. User types a natural-language description (or picks a starter prompt).
 *   2. Drawer calls workflow-ai-generator Edge Function via service.
 *   3. AI returns a WorkflowDefinition; we show node count + validation
 *      errors + suggested name in a "review" card.
 *   4. User can Accept (replaces draft) or Refine (sends a follow-up
 *      message that includes the previous definition as context).
 */
export function AIWorkflowGeneratorDrawer({
  open,
  onClose,
  onAccept,
  existingDefinition,
}: Props) {
  const { user } = useAuth();
  const orgId = user?.organization_id ?? null;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lastAiDefinition = [...messages].reverse().find((m) => m.role === 'ai' && m.definition)?.definition;

  const generate = useCallback(
    async (prompt: string) => {
      if (!orgId || !prompt.trim()) return;
      setError(null);
      setGenerating(true);
      const userMsg: ChatMessage = { role: 'user', content: prompt };
      setMessages((prev) => [...prev, userMsg]);
      try {
        const result = await generateWorkflowFromPrompt({
          prompt,
          orgId,
          existingDefinition: lastAiDefinition ?? existingDefinition ?? null,
        });
        setMessages((prev) => [
          ...prev,
          {
            role: 'ai',
            content: result.suggestedName
              ? `Generated workflow: ${result.suggestedName}`
              : 'Generated a workflow draft',
            definition: result.definition,
            validationErrors: result.validationErrors,
            suggestedName: result.suggestedName ?? undefined,
          },
        ]);
      } catch (err) {
        setError((err as Error).message);
        setMessages((prev) => [
          ...prev,
          {
            role: 'ai',
            content: `Sorry — I could not generate that workflow. ${(err as Error).message}`,
          },
        ]);
      } finally {
        setGenerating(false);
        setInput('');
      }
    },
    [orgId, existingDefinition, lastAiDefinition]
  );

  const acceptLast = useCallback(() => {
    const last = [...messages].reverse().find((m) => m.role === 'ai' && m.definition);
    if (last?.definition) {
      onAccept(last.definition, last.suggestedName);
      onClose();
    }
  }, [messages, onAccept, onClose]);

  const handleStarter = (starter: string) => {
    setInput(starter);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 sm:inset-y-0 sm:right-0 sm:left-auto z-40 w-full sm:w-[440px] bg-white shadow-2xl sm:border-l border-gray-200 flex flex-col">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
            <Wand2 className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900">AI Workflow Generator</h3>
            <p className="text-xs text-gray-500">Describe what you want — I will draft the graph</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-md">
          <X className="w-4.5 h-4.5 text-gray-400" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="space-y-3">
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-purple-800">
                Describe a workflow in plain English. I will generate a node graph using your
                organization's available actions, triggers, and templates. You can refine it
                iteratively before accepting.
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-700">Try one of these:</p>
              {PROMPT_STARTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => handleStarter(s)}
                  className="w-full text-left text-xs px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                m.role === 'user'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-900'
              }`}
            >
              <p className="whitespace-pre-wrap">{m.content}</p>
              {m.definition && (
                <div className="mt-2 pt-2 border-t border-gray-300/40 space-y-1.5">
                  <div className="text-[11px] text-gray-600">
                    {m.definition.nodes?.length ?? 0} nodes · {m.definition.edges?.length ?? 0} edges
                  </div>
                  {m.validationErrors && m.validationErrors.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded p-2">
                      <div className="flex items-center gap-1 text-amber-800 text-xs font-medium mb-1">
                        <AlertCircle className="w-3 h-3" /> {m.validationErrors.length} validation issue{m.validationErrors.length === 1 ? '' : 's'}
                      </div>
                      <ul className="text-[11px] text-amber-700 space-y-0.5">
                        {m.validationErrors.slice(0, 5).map((e, j) => (
                          <li key={j}>• {e}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {generating && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg px-3 py-2 text-sm flex items-center gap-2">
              <div className="w-3 h-3 border-2 border-purple-300 border-t-purple-600 rounded-full animate-spin" />
              <span className="text-xs text-gray-600">Generating…</span>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-red-800">{error}</div>
          </div>
        )}
      </div>

      {lastAiDefinition && (
        <div className="px-4 py-3 border-t border-gray-100 bg-emerald-50/50">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs text-gray-700">
              <CheckCircle2 className="w-3.5 h-3.5 inline mr-1 text-emerald-600" />
              Ready to drop on canvas?
            </div>
            <button
              onClick={acceptLast}
              className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700"
            >
              Accept latest
            </button>
          </div>
        </div>
      )}

      <div className="p-3 border-t border-gray-100 space-y-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={3}
          placeholder={lastAiDefinition
            ? 'Refine: "Make the email more friendly", "Add a 24h delay before the task", etc.'
            : 'Describe what should happen...'}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 resize-none"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              generate(input);
            }
          }}
        />
        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              setMessages([]);
              setError(null);
              setInput('');
            }}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 px-2 py-1"
          >
            <RotateCcw className="w-3 h-3" /> Reset chat
          </button>
          <button
            onClick={() => generate(input)}
            disabled={generating || !input.trim()}
            className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-3.5 h-3.5" />
            {lastAiDefinition ? 'Refine' : 'Generate'}
          </button>
        </div>
      </div>
    </div>
  );
}
