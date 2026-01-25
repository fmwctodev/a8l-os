import { useState, useEffect } from 'react';
import { Search, Filter, ExternalLink, CheckCircle, XCircle, AlertCircle, Settings, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getIntegrations } from '../../../services/integrations';
import type { Integration, IntegrationCategory } from '../../../types';
import { INTEGRATION_CATEGORY_LABELS } from '../../../types';
import { IntegrationDetailPanel } from './IntegrationDetailPanel';

interface AllIntegrationsTabProps {
  onSuccess?: () => void;
}

const categoryOptions: { value: IntegrationCategory | ''; label: string }[] = [
  { value: '', label: 'All Categories' },
  { value: 'Channels', label: 'Communication Channels' },
  { value: 'Advertising', label: 'Advertising' },
  { value: 'AI_LLM', label: 'AI & LLM' },
  { value: 'Calendars', label: 'Calendars' },
  { value: 'CRM_Data', label: 'CRM & Data' },
  { value: 'Email', label: 'Email' },
  { value: 'Payments', label: 'Payments' },
  { value: 'Phone', label: 'Phone' },
  { value: 'Storage', label: 'Storage' },
  { value: 'Other', label: 'Other' },
];

function getIntegrationIcon(key: string): string {
  const icons: Record<string, string> = {
    gmail: 'https://www.gstatic.com/images/branding/product/2x/gmail_2020q4_48dp.png',
    webchat: 'https://www.gstatic.com/images/branding/product/2x/chat_2020q4_48dp.png',
    google_workspace: 'https://www.gstatic.com/images/branding/product/2x/drive_2020q4_48dp.png',
    google_calendar: 'https://www.gstatic.com/images/branding/product/2x/calendar_2020q4_48dp.png',
    twilio: 'https://www.twilio.com/assets/icons/twilio-icon-512.png',
    sendgrid: 'https://sendgrid.com/content/dam/sendgrid/legacy/themes/flavor/1.0.0-flavor.0/images/SG_Twilio_Lockup_RGB-small.png',
    quickbooks_online: 'https://quickbooks.intuit.com/oidam/intuit/ic/en_us/images/qb-logo-63x63.png',
    openai: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/OpenAI_Logo.svg/512px-OpenAI_Logo.svg.png',
    anthropic: 'https://www.anthropic.com/images/icons/apple-touch-icon.png',
    elevenlabs: 'https://elevenlabs.io/favicon.ico',
    meta_ads: 'https://www.facebook.com/images/fb_icon_325x325.png',
    google_ads: 'https://www.gstatic.com/adsense/publishers/ui/images/apub/ae/ae-home-advert-icon-x2.png',
    zapier: 'https://cdn.zapier.com/zapier/images/logos/zapier-logo.png',
    slack: 'https://a.slack-edge.com/80588/marketing/img/icons/icon_slack_hash_colored.png',
    stripe: 'https://images.ctfassets.net/fzn2n1nzq965/HTTOloNPhisV9P4hlMPNA/cacf1bb88b9fc492dfad34378d844280/Stripe_icon_-_square.svg',
  };
  return icons[key] || '';
}

export function AllIntegrationsTab({ onSuccess }: AllIntegrationsTabProps) {
  const navigate = useNavigate();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<IntegrationCategory | ''>('');
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);

  useEffect(() => {
    loadIntegrations();
  }, [category]);

  const loadIntegrations = async () => {
    try {
      setLoading(true);
      const data = await getIntegrations({
        category: category || undefined,
      });
      setIntegrations(data);
    } catch (error) {
      console.error('Failed to load integrations:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredIntegrations = integrations.filter((int) => {
    if (search) {
      const searchLower = search.toLowerCase();
      return (
        int.name.toLowerCase().includes(searchLower) ||
        int.description?.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  const groupedIntegrations = filteredIntegrations.reduce((acc, int) => {
    if (!acc[int.category]) {
      acc[int.category] = [];
    }
    acc[int.category].push(int);
    return acc;
  }, {} as Record<string, Integration[]>);

  const handleIntegrationClick = (integration: Integration) => {
    if (integration.settings_path) {
      navigate(integration.settings_path);
    } else {
      setSelectedIntegration(integration);
    }
  };

  const handlePanelClose = () => {
    setSelectedIntegration(null);
    loadIntegrations();
    onSuccess?.();
  };

  const getStatusBadge = (integration: Integration) => {
    const status = integration.connection?.status;
    if (status === 'connected') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-400">
          <CheckCircle className="h-3 w-3" />
          Connected
        </span>
      );
    }
    if (status === 'error') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-1 text-xs font-medium text-red-400">
          <AlertCircle className="h-3 w-3" />
          Error
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-700 px-2 py-1 text-xs font-medium text-slate-400">
        <XCircle className="h-3 w-3" />
        Not Connected
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search integrations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 py-2 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-500" />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as IntegrationCategory | '')}
            className="rounded-lg border border-slate-700 bg-slate-800 py-2 pl-3 pr-8 text-sm text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          >
            {categoryOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {Object.keys(groupedIntegrations).length === 0 ? (
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-12 text-center">
          <Settings className="mx-auto h-12 w-12 text-slate-600" />
          <p className="mt-4 text-slate-400">No integrations found</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedIntegrations).map(([cat, ints]) => (
            <div key={cat}>
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">
                {INTEGRATION_CATEGORY_LABELS[cat as IntegrationCategory] || cat}
              </h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {ints.map((integration) => (
                  <button
                    key={integration.id}
                    onClick={() => handleIntegrationClick(integration)}
                    className="group relative flex flex-col rounded-lg border border-slate-700 bg-slate-800 p-4 text-left transition-all hover:border-cyan-500/50 hover:shadow-lg hover:shadow-cyan-500/5"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        {getIntegrationIcon(integration.key) ? (
                          <img
                            src={getIntegrationIcon(integration.key)}
                            alt={integration.name}
                            className="h-10 w-10 rounded-lg object-contain bg-white p-1"
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-700 text-slate-400">
                            <Settings className="h-5 w-5" />
                          </div>
                        )}
                        <div>
                          <h4 className="font-medium text-white">{integration.name}</h4>
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <span className="capitalize">{integration.scope}</span>
                            <span>-</span>
                            <span className="capitalize">{integration.connection_type.replace('_', ' ')}</span>
                          </div>
                        </div>
                      </div>
                      {integration.settings_path && (
                        <ExternalLink className="h-4 w-4 text-slate-600 opacity-0 transition-opacity group-hover:opacity-100" />
                      )}
                    </div>
                    <p className="mt-3 text-sm text-slate-400 line-clamp-2">
                      {integration.description}
                    </p>
                    <div className="mt-4 flex items-center justify-between">
                      {getStatusBadge(integration)}
                      {!integration.enabled && (
                        <span className="text-xs text-slate-600">Disabled</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedIntegration && (
        <IntegrationDetailPanel
          integration={selectedIntegration}
          onClose={handlePanelClose}
          onSuccess={handlePanelClose}
        />
      )}
    </div>
  );
}
