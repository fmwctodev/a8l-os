import { useState } from 'react';
import { X, Loader2, Copy, Check, ChevronRight, ChevronLeft, Play, Plus, Trash2, Code } from 'lucide-react';
import { createWebhook, updateWebhook, testWebhook } from '../../../services/webhooks';
import type { OutgoingWebhook, WebhookEventType } from '../../../types';
import { WEBHOOK_EVENT_LABELS } from '../../../types';

interface WebhookFormDrawerProps {
  webhook?: OutgoingWebhook | null;
  onClose: () => void;
}

const eventGroups = [
  {
    label: 'Contacts',
    events: ['contact_created', 'contact_updated', 'contact_deleted'] as WebhookEventType[],
  },
  {
    label: 'Opportunities',
    events: ['opportunity_created', 'opportunity_stage_changed', 'opportunity_won', 'opportunity_lost'] as WebhookEventType[],
  },
  {
    label: 'Calendar',
    events: ['appointment_booked', 'appointment_cancelled'] as WebhookEventType[],
  },
  {
    label: 'Messages',
    events: ['message_received', 'message_sent'] as WebhookEventType[],
  },
  {
    label: 'Payments',
    events: ['payment_completed', 'invoice_created'] as WebhookEventType[],
  },
  {
    label: 'Marketing',
    events: ['form_submitted', 'survey_submitted'] as WebhookEventType[],
  },
  {
    label: 'Scoring',
    events: ['score_updated'] as WebhookEventType[],
  },
];

const samplePayloads: Record<string, object> = {
  contact_created: {
    event: 'contact_created',
    timestamp: '2026-01-25T10:30:00Z',
    data: {
      id: 'uuid-here',
      email: 'john@example.com',
      first_name: 'John',
      last_name: 'Doe',
      phone: '+1234567890',
      created_at: '2026-01-25T10:30:00Z',
    },
  },
  opportunity_created: {
    event: 'opportunity_created',
    timestamp: '2026-01-25T10:30:00Z',
    data: {
      id: 'uuid-here',
      title: 'New Deal',
      value: 5000,
      stage: 'lead',
      contact_id: 'contact-uuid',
      created_at: '2026-01-25T10:30:00Z',
    },
  },
};

export function WebhookFormDrawer({ webhook, onClose }: WebhookFormDrawerProps) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState(webhook?.name || '');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState(webhook?.url || '');
  const [selectedEvents, setSelectedEvents] = useState<WebhookEventType[]>(webhook?.events || []);
  const [headers, setHeaders] = useState<{ key: string; value: string }[]>(
    webhook?.headers ? Object.entries(webhook.headers).map(([key, value]) => ({ key, value })) : []
  );
  const [authType, setAuthType] = useState<'none' | 'bearer' | 'basic'>('none');
  const [authValue, setAuthValue] = useState('');
  const [retryCount, setRetryCount] = useState(webhook?.retry_count || 3);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signingSecret, setSigningSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const isEditing = !!webhook;
  const totalSteps = 4;

  const handleEventToggle = (event: WebhookEventType) => {
    setSelectedEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  };

  const handleSelectAll = (events: WebhookEventType[]) => {
    const allSelected = events.every((e) => selectedEvents.includes(e));
    if (allSelected) {
      setSelectedEvents((prev) => prev.filter((e) => !events.includes(e)));
    } else {
      setSelectedEvents((prev) => [...new Set([...prev, ...events])]);
    }
  };

  const handleAddHeader = () => {
    setHeaders([...headers, { key: '', value: '' }]);
  };

  const handleRemoveHeader = (index: number) => {
    setHeaders(headers.filter((_, i) => i !== index));
  };

  const handleHeaderChange = (index: number, field: 'key' | 'value', value: string) => {
    const newHeaders = [...headers];
    newHeaders[index][field] = value;
    setHeaders(newHeaders);
  };

  const validateStep = (stepNum: number): boolean => {
    setError(null);
    switch (stepNum) {
      case 1:
        if (!name.trim()) {
          setError('Name is required');
          return false;
        }
        return true;
      case 2:
        if (selectedEvents.length === 0) {
          setError('Select at least one event');
          return false;
        }
        return true;
      case 3:
        if (!url.trim()) {
          setError('URL is required');
          return false;
        }
        try {
          new URL(url);
        } catch {
          setError('Invalid URL format');
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    setError(null);
    setStep(step - 1);
  };

  const handleSubmit = async () => {
    if (!validateStep(3)) return;

    const headersObject = headers.reduce((acc, h) => {
      if (h.key.trim()) {
        acc[h.key] = h.value;
      }
      return acc;
    }, {} as Record<string, string>);

    if (authType === 'bearer' && authValue) {
      headersObject['Authorization'] = `Bearer ${authValue}`;
    } else if (authType === 'basic' && authValue) {
      headersObject['Authorization'] = `Basic ${btoa(authValue)}`;
    }

    try {
      setSaving(true);
      setError(null);

      if (isEditing && webhook) {
        await updateWebhook(webhook.id, {
          name,
          url,
          events: selectedEvents,
          headers: headersObject,
          retry_count: retryCount,
        });
        onClose();
      } else {
        const result = await createWebhook({
          name,
          url,
          events: selectedEvents,
          headers: headersObject,
          retry_count: retryCount,
        });
        if ((result as any).signing_secret) {
          setSigningSecret((result as any).signing_secret);
        } else {
          onClose();
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save webhook');
    } finally {
      setSaving(false);
    }
  };

  const handleTestWebhook = async () => {
    if (!webhook) return;
    try {
      setTesting(true);
      await testWebhook(webhook.id);
    } catch (err) {
      console.error('Test failed:', err);
    } finally {
      setTesting(false);
    }
  };

  const handleCopySecret = async () => {
    if (signingSecret) {
      await navigator.clipboard.writeText(signingSecret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getSamplePayload = (): object => {
    const firstEvent = selectedEvents[0];
    return samplePayloads[firstEvent] || {
      event: firstEvent || 'event_type',
      timestamp: new Date().toISOString(),
      data: { id: 'uuid', ...{} },
    };
  };

  if (signingSecret) {
    return (
      <>
        <div className="fixed inset-0 z-40 bg-black/60" onClick={onClose} />
        <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg overflow-y-auto bg-slate-900 shadow-xl">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-700 bg-slate-900 px-6 py-4">
            <h2 className="text-lg font-semibold text-white">Webhook Created</h2>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
              <p className="text-sm text-emerald-400">
                Save your signing secret now. You won&apos;t be able to see it again.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300">Signing Secret</label>
              <div className="mt-2 flex items-center gap-2">
                <code className="flex-1 rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 font-mono text-sm text-cyan-400 break-all">
                  {signingSecret}
                </code>
                <button
                  onClick={handleCopySecret}
                  className="rounded-lg border border-slate-700 bg-slate-800 p-2 text-slate-400 hover:text-white"
                >
                  {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Use this secret to verify webhook signatures in your endpoint.
              </p>
            </div>

            <button
              onClick={onClose}
              className="w-full rounded-lg bg-gradient-to-r from-cyan-500 to-teal-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-cyan-500/25"
            >
              Done
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg overflow-y-auto bg-slate-900 shadow-xl">
        <div className="sticky top-0 z-10 border-b border-slate-700 bg-slate-900">
          <div className="flex items-center justify-between px-6 py-4">
            <h2 className="text-lg font-semibold text-white">
              {isEditing ? 'Edit Webhook' : 'Create Webhook'}
            </h2>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="px-6 pb-4">
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4].map((s) => (
                <div key={s} className="flex items-center flex-1">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                      s === step
                        ? 'bg-cyan-500 text-white'
                        : s < step
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    {s < step ? <Check className="h-4 w-4" /> : s}
                  </div>
                  {s < totalSteps && (
                    <div
                      className={`mx-2 h-0.5 flex-1 ${
                        s < step ? 'bg-emerald-500/40' : 'bg-slate-700'
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-between text-xs text-slate-500">
              <span>Basics</span>
              <span>Events</span>
              <span>Endpoint</span>
              <span>Preview</span>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
              {error}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300">
                  Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="My Webhook"
                  className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional description..."
                  rows={3}
                  className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300">Direction</label>
                <div className="mt-2 flex gap-3">
                  <div className="flex-1 rounded-lg border border-cyan-500 bg-cyan-500/10 p-3">
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 rounded-full border-2 border-cyan-500 flex items-center justify-center">
                        <div className="h-2 w-2 rounded-full bg-cyan-500" />
                      </div>
                      <span className="text-sm font-medium text-white">Outbound</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">Send events to external systems</p>
                  </div>
                  <div className="flex-1 rounded-lg border border-slate-700 bg-slate-800 p-3 opacity-50 cursor-not-allowed">
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 rounded-full border-2 border-slate-600" />
                      <span className="text-sm font-medium text-slate-400">Inbound</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">Coming soon</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-slate-400">
                Select which events should trigger this webhook
              </p>
              {eventGroups.map((group) => (
                <div key={group.label} className="rounded-lg border border-slate-700 bg-slate-800 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-white">{group.label}</span>
                    <button
                      type="button"
                      onClick={() => handleSelectAll(group.events)}
                      className="text-xs text-cyan-400 hover:text-cyan-300"
                    >
                      {group.events.every((e) => selectedEvents.includes(e))
                        ? 'Deselect all'
                        : 'Select all'}
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {group.events.map((event) => (
                      <label
                        key={event}
                        className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedEvents.includes(event)}
                          onChange={() => handleEventToggle(event)}
                          className="h-4 w-4 rounded border-slate-600 bg-slate-700 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-slate-900"
                        />
                        {WEBHOOK_EVENT_LABELS[event]}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300">
                  Endpoint URL <span className="text-red-400">*</span>
                </label>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com/webhook"
                  className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
                <p className="mt-1 text-xs text-slate-500">Must be a valid HTTPS URL</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300">Authentication</label>
                <select
                  value={authType}
                  onChange={(e) => setAuthType(e.target.value as 'none' | 'bearer' | 'basic')}
                  className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                >
                  <option value="none">None</option>
                  <option value="bearer">Bearer Token</option>
                  <option value="basic">Basic Auth</option>
                </select>
                {authType !== 'none' && (
                  <input
                    type="password"
                    value={authValue}
                    onChange={(e) => setAuthValue(e.target.value)}
                    placeholder={authType === 'bearer' ? 'Enter bearer token' : 'username:password'}
                    className="mt-2 block w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                )}
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-slate-300">Custom Headers</label>
                  <button
                    type="button"
                    onClick={handleAddHeader}
                    className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300"
                  >
                    <Plus className="h-3 w-3" />
                    Add Header
                  </button>
                </div>
                {headers.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {headers.map((header, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={header.key}
                          onChange={(e) => handleHeaderChange(index, 'key', e.target.value)}
                          placeholder="Header name"
                          className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                        />
                        <input
                          type="text"
                          value={header.value}
                          onChange={(e) => handleHeaderChange(index, 'value', e.target.value)}
                          placeholder="Value"
                          className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveHeader(index)}
                          className="rounded p-2 text-slate-400 hover:bg-slate-800 hover:text-red-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300">Retry Count</label>
                <select
                  value={retryCount}
                  onChange={(e) => setRetryCount(Number(e.target.value))}
                  className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                >
                  <option value={0}>No retries</option>
                  <option value={1}>1 retry</option>
                  <option value={3}>3 retries</option>
                  <option value={5}>5 retries</option>
                </select>
                <p className="mt-1 text-xs text-slate-500">
                  Number of retry attempts if delivery fails
                </p>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-slate-300">Configuration Summary</h3>
                <div className="mt-3 rounded-lg border border-slate-700 bg-slate-800 p-4 space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-400">Name</span>
                    <span className="text-sm text-white">{name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-400">URL</span>
                    <span className="text-sm text-white truncate max-w-[200px]">{url}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-400">Events</span>
                    <span className="text-sm text-white">{selectedEvents.length} selected</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-400">Retries</span>
                    <span className="text-sm text-white">{retryCount}</span>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Code className="h-4 w-4 text-slate-400" />
                  <h3 className="text-sm font-medium text-slate-300">Sample Payload</h3>
                </div>
                <pre className="overflow-x-auto rounded-lg border border-slate-700 bg-slate-950 p-4 text-xs text-cyan-400">
                  {JSON.stringify(getSamplePayload(), null, 2)}
                </pre>
              </div>

              {isEditing && webhook && (
                <button
                  type="button"
                  onClick={handleTestWebhook}
                  disabled={testing || !webhook.enabled}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                >
                  {testing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  Test Webhook
                </button>
              )}
            </div>
          )}
        </div>

        <div className="sticky bottom-0 border-t border-slate-700 bg-slate-900 p-4">
          <div className="flex gap-3">
            {step > 1 && (
              <button
                type="button"
                onClick={handleBack}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-700"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </button>
            )}
            {step < totalSteps ? (
              <button
                type="button"
                onClick={handleNext}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-cyan-500/25"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-cyan-500/25 disabled:opacity-50"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {isEditing ? 'Save Changes' : 'Create Webhook'}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
