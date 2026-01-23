import { useState, useEffect } from 'react';
import { Plus, Trash2, Power, Play, ExternalLink, CheckCircle, XCircle, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { getWebhooks, deleteWebhook, toggleWebhook, testWebhook, getWebhookDeliveries } from '../../../services/webhooks';
import type { OutgoingWebhook, WebhookDelivery } from '../../../types';
import { WEBHOOK_EVENT_LABELS } from '../../../types';
import { WebhookFormModal } from './WebhookFormModal';

interface WebhooksTabProps {
  onSuccess?: () => void;
}

export function WebhooksTab({ onSuccess }: WebhooksTabProps) {
  const [webhooks, setWebhooks] = useState<OutgoingWebhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
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

  const handleModalClose = () => {
    setShowModal(false);
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
          <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
            <CheckCircle className="h-3 w-3" />
            Delivered
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
            <XCircle className="h-3 w-3" />
            Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
            <Clock className="h-3 w-3" />
            Pending
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Configure outgoing webhooks to send event data to external systems in real-time.
        </p>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Create Webhook
        </button>
      </div>

      {webhooks.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
          <ExternalLink className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">No Webhooks Configured</h3>
          <p className="mt-2 text-sm text-gray-500">
            Create a webhook to start sending event notifications to external systems.
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
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
              className="overflow-hidden rounded-lg border border-gray-200 bg-white"
            >
              <div className="flex items-center justify-between px-6 py-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h4 className="font-medium text-gray-900">{webhook.name}</h4>
                    {webhook.enabled ? (
                      <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                        Active
                      </span>
                    ) : (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                        Disabled
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-gray-500 truncate max-w-md">{webhook.url}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {webhook.events.slice(0, 3).map((event) => (
                      <span
                        key={event}
                        className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                      >
                        {WEBHOOK_EVENT_LABELS[event] || event}
                      </span>
                    ))}
                    {webhook.events.length > 3 && (
                      <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                        +{webhook.events.length - 3} more
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleTest(webhook)}
                    disabled={testingId === webhook.id || !webhook.enabled}
                    className="rounded p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
                    title="Test Webhook"
                  >
                    <Play className={`h-4 w-4 ${testingId === webhook.id ? 'animate-pulse' : ''}`} />
                  </button>
                  <button
                    onClick={() => handleToggle(webhook)}
                    disabled={togglingId === webhook.id}
                    className={`rounded p-2 hover:bg-gray-100 disabled:opacity-50 ${
                      webhook.enabled ? 'text-green-500' : 'text-gray-400'
                    }`}
                    title={webhook.enabled ? 'Disable' : 'Enable'}
                  >
                    <Power className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(webhook)}
                    disabled={deletingId === webhook.id}
                    className="rounded p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setExpandedId(expandedId === webhook.id ? null : webhook.id)}
                    className="rounded p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
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
                <div className="border-t border-gray-200 bg-gray-50 px-6 py-4">
                  <h5 className="text-sm font-medium text-gray-700">Recent Deliveries</h5>
                  {loadingDeliveries ? (
                    <div className="py-4 text-center">
                      <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
                    </div>
                  ) : deliveries.length === 0 ? (
                    <p className="mt-2 text-sm text-gray-500">No deliveries yet</p>
                  ) : (
                    <div className="mt-3 overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead>
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">
                              Event
                            </th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">
                              Status
                            </th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">
                              Response
                            </th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">
                              Attempts
                            </th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">
                              Timestamp
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {deliveries.slice(0, 10).map((delivery) => (
                            <tr key={delivery.id}>
                              <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-900">
                                {WEBHOOK_EVENT_LABELS[delivery.event_type] || delivery.event_type}
                              </td>
                              <td className="whitespace-nowrap px-3 py-2">
                                {getStatusBadge(delivery.status)}
                              </td>
                              <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-500">
                                {delivery.response_code || '-'}
                              </td>
                              <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-500">
                                {delivery.attempts}
                              </td>
                              <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-500">
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

      {showModal && (
        <WebhookFormModal
          webhook={editingWebhook}
          onClose={handleModalClose}
        />
      )}
    </div>
  );
}
