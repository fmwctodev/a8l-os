import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Settings, ExternalLink, Key, Shield, Book, CheckCircle, XCircle, Loader2, Copy, Check, Webhook, Globe,
  MessageSquare, UserPlus, FileAudio, FileText, Wrench,
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { callEdgeFunction } from '../../../lib/edgeFunction';
import { getVapiConversationSettings, upsertVapiConversationSettings } from '../../../services/vapiConversations';
import type { VapiConversationSettings } from '../../../types';

interface ConnectionStatus {
  connected: boolean;
  has_public_key: boolean;
  has_webhook_secret: boolean;
  environment: string;
}

const links = [
  {
    label: 'Vapi Integration',
    description: 'Manage your Vapi API key and connection status',
    icon: Key,
    path: '/settings/integrations',
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
  },
  {
    label: 'AI Agent Settings',
    description: 'Configure global AI agent preferences and defaults',
    icon: Settings,
    path: '/settings/ai-agents',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
  },
  {
    label: 'Permissions',
    description: 'Manage voice AI permissions for your team roles',
    icon: Shield,
    path: '/settings/staff',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
  },
  {
    label: 'Vapi Documentation',
    description: 'Learn about Vapi API capabilities and configuration',
    icon: Book,
    path: '',
    external: 'https://docs.vapi.ai',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
  },
];

export function VapiSettingsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [convSettings, setConvSettings] = useState<VapiConversationSettings | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const webhookUrl = `${supabaseUrl}/functions/v1/vapi-webhook`;
  const toolGatewayUrl = `${supabaseUrl}/functions/v1/vapi-tool-gateway`;

  useEffect(() => {
    loadStatus();
    loadConvSettings();
  }, []);

  const loadStatus = async () => {
    try {
      setLoading(true);
      const res = await callEdgeFunction('vapi-client', { action: 'get_connection_status' });
      if (res.ok) {
        const json = await res.json();
        setStatus(json.data || json);
      }
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const loadConvSettings = async () => {
    if (!user?.organization_id) return;
    try {
      const settings = await getVapiConversationSettings(user.organization_id);
      setConvSettings(settings);
    } catch {
      // Settings don't exist yet, defaults apply
    }
  };

  const handleToggleSetting = async (key: keyof Pick<VapiConversationSettings, 'auto_create_contacts' | 'store_call_recordings' | 'store_call_summaries' | 'show_tool_events'>) => {
    if (!user?.organization_id || savingSettings) return;
    const currentValue = convSettings?.[key] ?? getDefaultForKey(key);
    try {
      setSavingSettings(true);
      const updated = await upsertVapiConversationSettings(user.organization_id, {
        [key]: !currentValue,
      });
      setConvSettings(updated);
    } catch {
      showToast('warning', 'Save failed', 'Could not update conversation settings.');
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">Voice AI Settings</h2>
        <p className="text-sm text-slate-400 mt-0.5">
          Configure your Vapi integration and manage Voice AI settings
        </p>
      </div>

      <div className="rounded-xl border border-slate-700 bg-slate-800/60 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/10">
              <Globe className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Connection Status</h3>
              <p className="text-xs text-slate-400">Vapi API integration health</p>
            </div>
          </div>
          {loading ? (
            <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
          ) : status?.connected ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-medium text-emerald-400">Connected</span>
            </div>
          ) : (
            <button
              onClick={() => navigate('/settings/integrations')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-colors"
            >
              <XCircle className="w-4 h-4 text-red-400" />
              <span className="text-xs font-medium text-red-400">Not Connected</span>
            </button>
          )}
        </div>

        {!loading && status?.connected && (
          <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${status.has_public_key ? 'bg-emerald-400' : 'bg-slate-600'}`} />
              <span className="text-xs text-slate-300">Public Key</span>
              <span className={`text-xs ${status.has_public_key ? 'text-emerald-400' : 'text-slate-500'}`}>
                {status.has_public_key ? 'Set' : 'Not set'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${status.has_webhook_secret ? 'bg-emerald-400' : 'bg-slate-600'}`} />
              <span className="text-xs text-slate-300">Webhook Secret</span>
              <span className={`text-xs ${status.has_webhook_secret ? 'text-emerald-400' : 'text-slate-500'}`}>
                {status.has_webhook_secret ? 'Set' : 'Not set'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-cyan-400" />
              <span className="text-xs text-slate-300">Environment</span>
              <span className="text-xs text-cyan-400 capitalize">{status.environment}</span>
            </div>
          </div>
        )}

        {!loading && !status?.connected && (
          <div className="px-5 py-4">
            <p className="text-sm text-slate-400">
              Connect your Vapi API key in{' '}
              <button onClick={() => navigate('/settings/integrations')} className="text-cyan-400 hover:underline">
                Settings &gt; Integrations
              </button>{' '}
              to enable Voice AI features.
            </p>
          </div>
        )}
      </div>

      {!loading && status?.connected && supabaseUrl && (
        <div className="rounded-xl border border-slate-700 bg-slate-800/60 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-700 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Webhook className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Vapi Dashboard Configuration</h3>
              <p className="text-xs text-slate-400">Copy these URLs into your Vapi dashboard settings</p>
            </div>
          </div>
          <div className="px-5 py-4 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Server URL (Webhook)</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 font-mono truncate">
                  {webhookUrl}
                </code>
                <button
                  onClick={() => copyToClipboard(webhookUrl, 'webhook')}
                  className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors shrink-0"
                >
                  {copiedField === 'webhook' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-1">Paste this in Vapi Dashboard &gt; Account Settings &gt; Server URL</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Tool Gateway URL</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 font-mono truncate">
                  {toolGatewayUrl}
                </code>
                <button
                  onClick={() => copyToClipboard(toolGatewayUrl, 'tool')}
                  className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors shrink-0"
                >
                  {copiedField === 'tool' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-1">Use this as the server URL for Vapi tool/function definitions</p>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-slate-700 bg-slate-800/60 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-700 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-teal-500/10">
            <MessageSquare className="w-5 h-5 text-teal-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Conversation Sync</h3>
            <p className="text-xs text-slate-400">Control how Vapi calls appear in your Unified Inbox</p>
          </div>
        </div>
        <div className="divide-y divide-slate-700/50">
          <ConvSyncToggle
            icon={<UserPlus className="w-4 h-4 text-cyan-400" />}
            label="Auto-create contacts"
            description="Automatically create a contact record when a new caller reaches your Vapi assistant"
            checked={convSettings?.auto_create_contacts ?? true}
            onChange={() => handleToggleSetting('auto_create_contacts')}
            disabled={savingSettings}
          />
          <ConvSyncToggle
            icon={<FileAudio className="w-4 h-4 text-teal-400" />}
            label="Store call recordings"
            description="Save recording URLs in conversation metadata for playback from the inbox"
            checked={convSettings?.store_call_recordings ?? true}
            onChange={() => handleToggleSetting('store_call_recordings')}
            disabled={savingSettings}
          />
          <ConvSyncToggle
            icon={<FileText className="w-4 h-4 text-emerald-400" />}
            label="Store call summaries"
            description="Save AI-generated call summaries as messages in the conversation thread"
            checked={convSettings?.store_call_summaries ?? true}
            onChange={() => handleToggleSetting('store_call_summaries')}
            disabled={savingSettings}
          />
          <ConvSyncToggle
            icon={<Wrench className="w-4 h-4 text-amber-400" />}
            label="Show tool events"
            description="Include tool-call and tool-result messages in the conversation log"
            checked={convSettings?.show_tool_events ?? false}
            onChange={() => handleToggleSetting('show_tool_events')}
            disabled={savingSettings}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {links.map((link) => {
          const Icon = link.icon;

          const handleClick = () => {
            if (link.external) {
              window.open(link.external, '_blank');
            } else if (link.path) {
              navigate(link.path);
            }
          };

          return (
            <button
              key={link.label}
              onClick={handleClick}
              className="flex items-start gap-4 p-5 bg-slate-800 border border-slate-700 rounded-xl hover:border-slate-600 hover:bg-slate-800/80 transition-colors text-left group"
            >
              <div className={`p-2.5 rounded-lg ${link.bg}`}>
                <Icon className={`w-5 h-5 ${link.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-white">{link.label}</h3>
                  {link.external && (
                    <ExternalLink className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300 transition-colors" />
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-1">{link.description}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ConvSyncToggle({
  icon,
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
  disabled: boolean;
}) {
  return (
    <div className="px-5 py-4 flex items-center justify-between gap-4">
      <div className="flex items-start gap-3 min-w-0">
        <div className="mt-0.5 shrink-0">{icon}</div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-white">{label}</p>
          <p className="text-xs text-slate-400 mt-0.5">{description}</p>
        </div>
      </div>
      <button
        onClick={onChange}
        disabled={disabled}
        className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
          checked ? 'bg-teal-500' : 'bg-slate-600'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}

function getDefaultForKey(key: string): boolean {
  if (key === 'show_tool_events') return false;
  return true;
}
