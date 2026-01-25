import { useState, useEffect } from 'react';
import { Plus, Trash2, Power, Play, ExternalLink, CheckCircle, XCircle, Clock, ChevronDown, ChevronUp, Loader2, Edit2, ArrowUpRight } from 'lucide-react';
import { getWebhooks, deleteWebhook, toggleWebhook, testWebhook, getWebhookDeliveries } from '../../../services/webhooks';
import type { OutgoingWebhook, WebhookDelivery } from '../../../types';
import { WEBHOOK_EVENT_LABELS } from '../../../types';
import { WebhookFormDrawer } from './WebhookFormDrawer';

interface WebhooksTabProps {
  onSuccess?: () => void;
}

export function WebhooksTab({ onSuccess }: WebhooksTabProps) {
  const [webhooks, setWebhooks] = useState<OutgoingWebhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDrawer, setShowDrawer] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<OutgoingWebhook | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [loadingDeliveries, setLoadingDeliveries] = useState(false);

  useEffect(() => {
    loadWebhooks();
  }, []);

  useEffect(() => {
    if (expandedId) {
      loadDeliveries(expandedId);
    }
  }, [expandedId]);

  const loadWebhooks = async () => {
    try {
      setLoading(true);
      const data = await getWebhooks();
      setWebhooks(data);
    } catch (error) {
      console.error('Failed to load webhooks:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDeliveries = async (webhookId: string) => {
    try {
      setLoadingDeliveries(true);
      const data = await getWebhookDeliveries({ webhookId });
      setDeliveries(data);
    } catch (error) {
      console.error('Failed to load deliveries:', error);
    } finally {
      setLoadingDeliveries(false);
    }
  };

  const handleTest = async (webhook: OutgoingWebhook) => {
    try {
      setTestingId(webhook.id);
      await testWebhook(webhook.id);
      if (expandedId === webhook.id) {
        loadDeliveries(webhook.id);
      }
    } catch (error) {
      console.error('Test failed:', error);
    } finally {
      setTestingId(null);
    }
  };

  const handleToggle = async (webhook: OutgoingWebhook) => {
    try {
      setTogglingId(webhook.id);
      await toggleWebhook(webhook.id, !webhook.enabled);
      loadWebhooks();
      onSuccess?.();
    } catch (error) {
      console.error('Toggle failed:', error);
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (webhook: OutgoingWebhook) => {
    if (!confirm(`Are you sure you want to delete the webhook "${webhook.name}"?`)) {
      return;
    }
    try {
      setDeletingId(webhook.id);
      await deleteWebhook(webhook.id);
      loadWebhooks();
      onSuccess?.();
    } catch (error) {
      console.error('Delete failed:', error);
    } finally {
      setDeletingId(null);
    }
  };

  const handleEdit = (webhook: OutgoingWebhook) => {
    setEditingWebhook(webhook);
    setShowDrawer(true);
  };

  const handleDrawerClose = () => {
    setShowDrawer(false);
    setEditingWebhook(null);
    loadWebhooks();
    onSuccess?.();
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'delivered':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400">
            <CheckCircle className="h-3 w-3" />
            Delivered
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-400">
            <XCircle className="h-3 w-3" />
            Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-400">
            <Clock className="h-3 w-3" />
            Pending
          </span>
        );
    }
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
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">
          Configure outgoing webhooks to send event data to external systems in real-time.
        </p>
        <button
          onClick={() => setShowDrawer(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-cyan-500/25 transition-all hover:shadow-cyan-500/40"
        >
          <Plus className="h-4 w-4" />
          Create Webhook
        </button>
      </div>

      {webhooks.length === 0 ? (
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-12 text-center">
          <ExternalLink className="mx-auto h-12 w-12 text-slate-600" />
          <h3 className="mt-4 text-lg font-medium text-white">No Webhooks Configured</h3>
          <p className="mt-2 text-sm text-slate-400">
            Create a webhook to start sending event notifications to external systems.
          </p>
          <button
            onClick={() => setShowDrawer(true)}
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-cyan-500/25 transition-all hover:shadow-cyan-500/40"
          >
            <Plus className="h-4 w-4" />
            Create Webhook
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {webhooks.map((webhook) => (
            <div
              key={webhook.id}
              className="overflow-hidden rounded-lg border border-slate-700 bg-slate-800"
            >
              <div className="flex items-center justify-between px-6 py-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <h4 className="font-medium text-white">{webhook.name}</h4>
                    {webhook.enabled ? (
                      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400">
                        Active
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-700 px-2 py-0.5 text-xs font-medium text-slate-400">
                        Disabled
                      </span>
                    )}
                    <span className="rounded bg-cyan-500/10 px-2 py-0.5 text-xs font-medium text-cyan-400">
                      <ArrowUpRight className="mr-1 inline h-3 w-3" />
                      Outbound
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500 truncate max-w-lg">{webhook.url}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {webhook.events.slice(0, 3).map((event) => (
                      <span
                        key={event}
                        className="rounded bg-slate-700 px-2 py-0.5 text-xs text-slate-400"
                      >
                        {WEBHOOK_EVENT_LABELS[event] || event}
                      </span>
                    ))}
                    {webhook.events.length > 3 && (
                      <span className="rounded bg-slate-700 px-2 py-0.5 text-xs text-slate-400">
                        +{webhook.events.length - 3} more
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleTest(webhook)}
                    disabled={testingId === webhook.id || !webhook.enabled}
                    className="rounded p-2 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white disabled:opacity-50"
                    title="Test Webhook"
                  >
                    <Play className={`h-4 w-4 ${testingId === webhook.id ? 'animate-pulse' : ''}`} />
                  </button>
                  <button
                    onClick={() => handleEdit(webhook)}
                    className="rounded p-2 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
                    title="Edit Webhook"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleToggle(webhook)}
                    disabled={togglingId === webhook.id}
                    className={`rounded p-2 transition-colors hover:bg-slate-700 disabled:opacity-50 ${
                      webhook.enabled ? 'text-emerald-400' : 'text-slate-500'
                    }`}
                    title={webhook.enabled ? 'Disable' : 'Enable'}
                  >
                    <Power className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(webhook)}
                    disabled={deletingId === webhook.id}
                    className="rounded p-2 text-slate-400 transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setExpandedId(expandedId === webhook.id ? null : webhook.id)}
                    className="rounded p-2 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
                    title="View Deliveries"
                  >
                    {expandedId === webhook.id ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {expandedId === webhook.id && (
                <div className="border-t border-slate-700 bg-slate-900 px-6 py-4">
                  <h5 className="text-sm font-medium text-slate-300">Recent Deliveries</h5>
                  {loadingDeliveries ? (
                    <div className="py-4 text-center">
                      <Loader2 className="inline-block h-5 w-5 animate-spin text-cyan-500" />
                    </div>
                  ) : deliveries.length === 0 ? (
                    <p className="mt-2 text-sm text-slate-500">No deliveries yet</p>
                  ) : (
                    <div className="mt-3 overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-700/50">
                        <thead>
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                              Event
                            </th>
                            <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                              Status
                            </th>
                            <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                              Response
                            </th>
                            <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                              Attempts
                            </th>
                            <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                              Timestamp
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/30">
                          {deliveries.slice(0, 10).map((delivery) => (
                            <tr key={delivery.id} className="hover:bg-slate-800/50">
                              <td className="whitespace-nowrap px-3 py-2 text-sm text-white">
                                {WEBHOOK_EVENT_LABELS[delivery.event_type] || delivery.event_type}
                              </td>
                              <td className="whitespace-nowrap px-3 py-2">
                                {getStatusBadge(delivery.status)}
                              </td>
                              <td className="whitespace-nowrap px-3 py-2 text-sm text-slate-400">
                                {delivery.response_code || '-'}
                              </td>
                              <td className="whitespace-nowrap px-3 py-2 text-sm text-slate-400">
                                {delivery.attempts}
                              </td>
                              <td className="whitespace-nowrap px-3 py-2 text-sm text-slate-500">
                                {formatDate(delivery.created_at)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showDrawer && (
        <WebhookFormDrawer
          webhook={editingWebhook}
          onClose={handleDrawerClose}
        />
      )}
    </div>
  );
}
