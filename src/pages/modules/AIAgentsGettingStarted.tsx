import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  CheckCircle2,
  Circle,
  Bot,
  Database,
  MessageSquare,
  Mic,
  Zap,
  ArrowRight,
  BookOpen,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  completed: boolean;
  action?: () => void;
  actionLabel?: string;
}

export function AIAgentsGettingStarted() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [checklist, setChecklist] = useState<ChecklistItem[]>([
    {
      id: 'ai_models',
      label: 'Connect AI Models',
      description: 'Configure OpenAI or other AI providers',
      completed: false,
      action: () => navigate('/settings/ai-agents'),
      actionLabel: 'Configure AI',
    },
    {
      id: 'knowledge_base',
      label: 'Create Knowledge Base',
      description: 'Add knowledge sources for your agents',
      completed: false,
      action: () => navigate('/ai-agents/knowledge'),
      actionLabel: 'Add Knowledge',
    },
    {
      id: 'first_agent',
      label: 'Create Your First Agent',
      description: 'Build a voice or conversation agent',
      completed: false,
      action: () => navigate('/ai-agents/conversation?create=true'),
      actionLabel: 'Create Agent',
    },
    {
      id: 'channels',
      label: 'Assign Channels',
      description: 'Connect phone numbers or messaging channels',
      completed: false,
      action: () => navigate('/settings/phone-system'),
      actionLabel: 'Configure Channels',
    },
    {
      id: 'test_agent',
      label: 'Test Your Agent',
      description: 'Run a test conversation to verify setup',
      completed: false,
    },
  ]);

  const [showBestPractices, setShowBestPractices] = useState(false);

  const useCases = [
    {
      title: 'AI Sales Assistant',
      description: 'Qualify leads, answer product questions, and schedule demos automatically',
      icon: Mic,
      color: 'cyan',
      action: () => navigate('/ai-agents/templates?useCase=sales'),
    },
    {
      title: 'AI Support Agent',
      description: 'Handle common support questions and route complex issues to your team',
      icon: MessageSquare,
      color: 'blue',
      action: () => navigate('/ai-agents/templates?useCase=support'),
    },
    {
      title: 'AI Appointment Booker',
      description: 'Schedule appointments via voice or chat, check availability in real-time',
      icon: Bot,
      color: 'emerald',
      action: () => navigate('/ai-agents/templates?useCase=booking'),
    },
    {
      title: 'AI Follow-Up Agent',
      description: 'Send personalized follow-up messages based on conversation history',
      icon: Zap,
      color: 'purple',
      action: () => navigate('/ai-agents/templates?useCase=followup'),
    },
  ];

  const completedCount = checklist.filter((item) => item.completed).length;
  const progress = (completedCount / checklist.length) * 100;

  return (
    <div className="space-y-8">
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-8">
        <div className="max-w-3xl">
          <h2 className="text-2xl font-bold text-white mb-3">What Is an AI Agent?</h2>
          <p className="text-slate-300 mb-6 leading-relaxed">
            AI Agents are intelligent assistants that can understand conversations, access your CRM data,
            and take actions on your behalf. They can handle customer inquiries via voice or chat,
            qualify leads, schedule appointments, and even draft personalized messages for your review.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-start gap-3 p-4 bg-slate-900/50 rounded-lg border border-slate-700">
              <div className="p-2 bg-cyan-500/10 rounded-lg">
                <Database className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <h3 className="font-medium text-white mb-1">Access Data</h3>
                <p className="text-sm text-slate-400">Read contacts, conversations, and calendar</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-slate-900/50 rounded-lg border border-slate-700">
              <div className="p-2 bg-cyan-500/10 rounded-lg">
                <Zap className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <h3 className="font-medium text-white mb-1">Take Actions</h3>
                <p className="text-sm text-slate-400">Send messages, create tasks, update records</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-slate-900/50 rounded-lg border border-slate-700">
              <div className="p-2 bg-cyan-500/10 rounded-lg">
                <Bot className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <h3 className="font-medium text-white mb-1">Human Oversight</h3>
                <p className="text-sm text-slate-400">Review and approve before sending</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Setup Checklist</h2>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-400">
              {completedCount} of {checklist.length} completed
            </span>
            <div className="w-32 h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-cyan-500 transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {checklist.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-4 p-4 bg-slate-900/50 rounded-lg border border-slate-700 hover:border-slate-600 transition-colors"
            >
              {item.completed ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              ) : (
                <Circle className="w-5 h-5 text-slate-600 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-white">{item.label}</h3>
                <p className="text-sm text-slate-400">{item.description}</p>
              </div>
              {item.action && item.actionLabel && !item.completed && (
                <button
                  onClick={item.action}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-cyan-400 hover:text-cyan-300 hover:bg-slate-800 rounded-lg transition-colors"
                >
                  {item.actionLabel}
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
        <button
          onClick={() => setShowBestPractices(!showBestPractices)}
          className="w-full flex items-center justify-between p-6 hover:bg-slate-700/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <BookOpen className="w-5 h-5 text-cyan-400" />
            <h2 className="text-xl font-bold text-white">Prompting Best Practices</h2>
          </div>
          {showBestPractices ? (
            <ChevronUp className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          )}
        </button>

        {showBestPractices && (
          <div className="p-6 pt-0 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="font-semibold text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Do This
                </h3>
                <ul className="space-y-3 text-slate-300">
                  <li className="flex gap-2">
                    <span className="text-cyan-400">•</span>
                    <span>Be specific about the agent's role and purpose</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-cyan-400">•</span>
                    <span>Provide clear examples of desired behavior</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-cyan-400">•</span>
                    <span>Define boundaries and what not to do</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-cyan-400">•</span>
                    <span>Use merge fields for personalization</span>
                  </li>
                </ul>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold text-red-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Avoid This
                </h3>
                <ul className="space-y-3 text-slate-300">
                  <li className="flex gap-2">
                    <span className="text-red-400">•</span>
                    <span>Vague instructions like "be helpful"</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-red-400">•</span>
                    <span>Contradictory rules that confuse the agent</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-red-400">•</span>
                    <span>Overly complex prompts with too many conditions</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-red-400">•</span>
                    <span>Asking the agent to make decisions it shouldn't</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-700">
              <h4 className="font-medium text-white mb-2">Example Prompt Structure</h4>
              <pre className="text-sm text-slate-300 font-mono whitespace-pre-wrap">
{`You are a friendly sales assistant for [Company Name].

Your role:
- Answer questions about our products
- Qualify leads by asking about budget and timeline
- Schedule discovery calls when appropriate

Guidelines:
- Always be polite and professional
- Don't make pricing commitments
- If unsure, offer to connect them with a specialist

Available merge fields:
{{contact.first_name}}, {{contact.company}}`}
              </pre>
            </div>
          </div>
        )}
      </div>

      <div>
        <h2 className="text-xl font-bold text-white mb-4">Example Use Cases</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {useCases.map((useCase) => {
            const Icon = useCase.icon;
            return (
              <button
                key={useCase.title}
                onClick={useCase.action}
                className="flex items-start gap-4 p-6 bg-slate-800 border border-slate-700 rounded-lg hover:border-cyan-500 transition-all text-left group"
              >
                <div className={`p-3 bg-${useCase.color}-500/10 rounded-lg group-hover:bg-${useCase.color}-500/20 transition-colors`}>
                  <Icon className={`w-6 h-6 text-${useCase.color}-400`} />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-white mb-2 group-hover:text-cyan-400 transition-colors">
                    {useCase.title}
                  </h3>
                  <p className="text-sm text-slate-400">{useCase.description}</p>
                  <div className="flex items-center gap-2 mt-3 text-sm text-cyan-400">
                    View Template
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
