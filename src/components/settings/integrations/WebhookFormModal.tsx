import { useState } from 'react';
import { X, Loader2, Copy, Check } from 'lucide-react';
import { createWebhook, updateWebhook } from '../../../services/webhooks';
import type { OutgoingWebhook, WebhookEventType } from '../../../types';
import { WEBHOOK_EVENT_LABELS } from '../../../types';

interface WebhookFormModalProps {
  webhook?: OutgoingWebhook | null;
  onClose: () => void;
}

const allEvents: WebhookEventType[] = [
  'contact_created',
  'contact_updated',
  'contact_deleted',
  'opportunity_created',
  'opportunity_stage_changed',
  'opportunity_won',
  'opportunity_lost',
  'appointment_booked',
  'appointment_cancelled',
  'message_received',
  'message_sent',
  'payment_completed',
  'invoice_created',
  'form_submitted',
  'survey_submitted',
  'score_updated',
];

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

export function WebhookFormModal({ webhook, onClose }: WebhookFormModalProps) {
  const [name, setName] = useState(webhook?.name || '');
  const [url, setUrl] = useState(webhook?.url || '');
  const [selectedEvents, setSelectedEvents] = useState<WebhookEventType[]>(webhook?.events || []);
  const [retryCount, setRetryCount] = useState(webhook?.retry_count || 3);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signingSecret, setSigningSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const isEditing = !!webhook;

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    if (!url.trim()) {
      setError('URL is required');
      return;
    }
    try {
      new URL(url);
    } catch {
      setError('Invalid URL format');
      return;
    }
    if (selectedEvents.length === 0) {
      setError('Select at least one event');
      return;
    }

    try {
      setSaving(true);
      if (isEditing) {
        await updateWebhook(webhook.id, {
          name,
          url,
          events: selectedEvents,
          retry_count: retryCount,
        });
        onClose();
      } else {
        const result = await createWebhook({
          name,
          url,
          events: selectedEvents,
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

  const handleCopySecret = async () => {
    if (signingSecret) {
      await navigator.clipboard.writeText(signingSecret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (signingSecret) {
    return (
      <>
        <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900">Webhook Created</h2>
              <p className="mt-2 text-sm text-gray-600">
                Save your signing secret now. You won&apos;t be able to see it again.
              </p>
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700">Signing Secret</label>
                <div className="mt-1 flex items-center gap-2">
                  <code className="flex-1 rounded bg-gray-100 px-3 py-2 font-mono text-sm text-gray-800 break-all">
                    {signingSecret}
                  </code>
                  <button
                    onClick={handleCopySecret}
                    className="rounded-lg border border-gray-300 p-2 text-gray-500 hover:bg-gray-50"
                  >
                    {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Use this secret to verify webhook signatures in your endpoint.
                </p>
              </div>
              <div className="mt-6">
                <button
                  onClick={onClose}
                  className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">
              {isEditing ? 'Edit Webhook' : 'Create Webhook'}
            </h2>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Webhook"
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Endpoint URL</label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/webhook"
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-gray-500">Must be a valid HTTPS URL</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Events</label>
              <p className="mt-1 text-xs text-gray-500">Select which events should trigger this webhook</p>
              <div className="mt-3 space-y-4">
                {eventGroups.map((group) => (
                  <div key={group.label}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-600">{group.label}</span>
                      <button
                        type="button"
                        onClick={() => handleSelectAll(group.events)}
                        className="text-xs text-blue-600 hover:text-blue-700"
                      >
                        {group.events.every((e) => selectedEvents.includes(e))
                          ? 'Deselect all'
                          : 'Select all'}
                      </button>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {group.events.map((event) => (
                        <label
                          key={event}
                          className="flex items-center gap-2 text-sm text-gray-700"
                        >
                          <input
                            type="checkbox"
                            checked={selectedEvents.includes(event)}
                            onChange={() => handleEventToggle(event)}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          {WEBHOOK_EVENT_LABELS[event]}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Retry Count</label>
              <select
                value={retryCount}
                onChange={(e) => setRetryCount(Number(e.target.value))}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value={0}>No retries</option>
                <option value={1}>1 retry</option>
                <option value={3}>3 retries</option>
                <option value={5}>5 retries</option>
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Number of retry attempts if delivery fails
              </p>
            </div>

            <div className="flex justify-end gap-3 border-t border-gray-200 pt-6">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {isEditing ? 'Save Changes' : 'Create Webhook'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
