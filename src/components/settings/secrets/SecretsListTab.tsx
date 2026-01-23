import { useState, useEffect } from 'react';
import {
  Key, Plus, Search, Filter, Eye, EyeOff, Pencil, Trash2,
  AlertTriangle, Clock, CheckCircle, XCircle, Copy, MoreVertical,
  Link2, RefreshCw
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import * as secretsService from '../../../services/secrets';
import type { Secret, SecretCategory, SecretFilters } from '../../../services/secrets';
import { SecretModal } from './SecretModal';

interface Props {
  onSuccess?: () => void;
}

export function SecretsListTab({ onSuccess }: Props) {
  const { user, hasPermission } = useAuth();
  const [loading, setLoading] = useState(true);
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [categories, setCategories] = useState<SecretCategory[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<SecretFilters>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [revealedSecrets, setRevealedSecrets] = useState<Record<string, string>>({});
  const [revealingId, setRevealingId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSecret, setEditingSecret] = useState<Secret | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [actionMenu, setActionMenu] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const canCreate = hasPermission('secrets.create');
  const canEdit = hasPermission('secrets.edit');
  const canDelete = hasPermission('secrets.delete');
  const canReveal = hasPermission('secrets.reveal');

  useEffect(() => {
    if (user?.organization_id) {
      loadData();
    }
  }, [user?.organization_id, page, filters]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters(prev => ({ ...prev, search: searchQuery || undefined }));
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadData = async () => {
    if (!user?.organization_id) return;

    try {
      setLoading(true);
      const [secretsResult, categoriesResult] = await Promise.all([
        secretsService.getSecrets(user.organization_id, filters, { page, limit: 20 }),
        secretsService.getCategories(user.organization_id),
      ]);

      setSecrets(secretsResult.data);
      setTotalCount(secretsResult.pagination.total);
      setCategories(categoriesResult);
    } catch (err) {
      console.error('Failed to load secrets:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleReveal = async (secretId: string) => {
    if (!user?.organization_id || !canReveal) return;

    if (revealedSecrets[secretId]) {
      setRevealedSecrets(prev => {
        const next = { ...prev };
        delete next[secretId];
        return next;
      });
      return;
    }

    try {
      setRevealingId(secretId);
      const result = await secretsService.revealSecretValue(user.organization_id, secretId);
      if (result.value) {
        setRevealedSecrets(prev => ({ ...prev, [secretId]: result.value! }));
        setTimeout(() => {
          setRevealedSecrets(prev => {
            const next = { ...prev };
            delete next[secretId];
            return next;
          });
        }, 30000);
      }
    } catch (err) {
      console.error('Failed to reveal secret:', err);
    } finally {
      setRevealingId(null);
    }
  };

  const handleCopy = async (secretId: string) => {
    const value = revealedSecrets[secretId];
    if (!value) return;

    try {
      await navigator.clipboard.writeText(value);
      setCopiedId(secretId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleDelete = async (secretId: string) => {
    if (!user?.organization_id || !canDelete) return;

    try {
      await secretsService.deleteSecret(user.organization_id, secretId);
      setDeleteConfirm(null);
      loadData();
      onSuccess?.();
    } catch (err) {
      console.error('Failed to delete secret:', err);
    }
  };

  const handleSaveSuccess = () => {
    setModalOpen(false);
    setEditingSecret(null);
    loadData();
    onSuccess?.();
  };

  const getStatusBadge = (secret: Secret) => {
    if (secretsService.isSecretExpired(secret.expires_at)) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
          <XCircle className="h-3 w-3" />
          Expired
        </span>
      );
    }
    if (secretsService.isSecretExpiringSoon(secret.expires_at)) {
      const days = secretsService.getDaysUntilExpiry(secret.expires_at);
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
          <AlertTriangle className="h-3 w-3" />
          {days}d left
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
        <CheckCircle className="h-3 w-3" />
        Active
      </span>
    );
  };

  const getTypeBadge = (type: string) => {
    const styles: Record<string, string> = {
      static: 'bg-gray-100 text-gray-700',
      dynamic: 'bg-blue-100 text-blue-700',
      rotating: 'bg-purple-100 text-purple-700',
    };
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${styles[type] || styles.static}`}>
        {type === 'dynamic' && <Link2 className="h-3 w-3" />}
        {type === 'rotating' && <RefreshCw className="h-3 w-3" />}
        {type.charAt(0).toUpperCase() + type.slice(1)}
      </span>
    );
  };

  const totalPages = Math.ceil(totalCount / 20);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search secrets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${
              showFilters ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Filter className="h-4 w-4" />
            Filters
          </button>
        </div>
        {canCreate && (
          <button
            onClick={() => {
              setEditingSecret(null);
              setModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Secret
          </button>
        )}
      </div>

      {showFilters && (
        <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
            <select
              value={filters.category_id || ''}
              onChange={(e) => {
                setFilters(prev => ({ ...prev, category_id: e.target.value || undefined }));
                setPage(1);
              }}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Categories</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
            <select
              value={filters.value_type || ''}
              onChange={(e) => {
                setFilters(prev => ({ ...prev, value_type: e.target.value || undefined }));
                setPage(1);
              }}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Types</option>
              <option value="static">Static</option>
              <option value="dynamic">Dynamic</option>
              <option value="rotating">Rotating</option>
            </select>
          </div>
          <div className="flex items-center gap-2 mt-4">
            <input
              type="checkbox"
              id="include_expired"
              checked={filters.include_expired || false}
              onChange={(e) => {
                setFilters(prev => ({ ...prev, include_expired: e.target.checked }));
                setPage(1);
              }}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="include_expired" className="text-sm text-gray-600">Include expired</label>
          </div>
          <button
            onClick={() => {
              setFilters({});
              setSearchQuery('');
              setPage(1);
            }}
            className="mt-4 text-sm text-gray-500 hover:text-gray-700"
          >
            Clear filters
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : secrets.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl border border-gray-200">
          <Key className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-4 text-sm font-medium text-gray-900">No secrets found</h3>
          <p className="mt-1 text-sm text-gray-500">
            {searchQuery || Object.keys(filters).length > 0
              ? 'Try adjusting your search or filters'
              : 'Get started by adding your first API key or secret'}
          </p>
          {canCreate && !searchQuery && Object.keys(filters).length === 0 && (
            <button
              onClick={() => {
                setEditingSecret(null);
                setModalOpen(true);
              }}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Add Secret
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Secret
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Key
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Value
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {secrets.map((secret) => (
                <tr key={secret.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                        <Key className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{secret.name}</div>
                        {secret.secret_categories && (
                          <div className="text-xs text-gray-500">{secret.secret_categories.name}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <code className="px-2 py-1 bg-gray-100 rounded text-xs font-mono text-gray-700">
                      {secret.key}
                    </code>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {revealedSecrets[secret.id] ? (
                        <>
                          <code className="px-2 py-1 bg-gray-100 rounded text-xs font-mono text-gray-700 max-w-[200px] truncate">
                            {revealedSecrets[secret.id]}
                          </code>
                          <button
                            onClick={() => handleCopy(secret.id)}
                            className="p-1 text-gray-400 hover:text-gray-600"
                            title="Copy"
                          >
                            {copiedId === secret.id ? (
                              <CheckCircle className="h-4 w-4 text-emerald-500" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </button>
                        </>
                      ) : (
                        <span className="text-gray-400 font-mono text-xs">{'*'.repeat(16)}</span>
                      )}
                      {canReveal && (
                        <button
                          onClick={() => handleReveal(secret.id)}
                          disabled={revealingId === secret.id}
                          className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                          title={revealedSecrets[secret.id] ? 'Hide' : 'Reveal'}
                        >
                          {revealingId === secret.id ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600" />
                          ) : revealedSecrets[secret.id] ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {getTypeBadge(secret.value_type)}
                  </td>
                  <td className="px-6 py-4">
                    {getStatusBadge(secret)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="relative inline-block">
                      <button
                        onClick={() => setActionMenu(actionMenu === secret.id ? null : secret.id)}
                        className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                      >
                        <MoreVertical className="h-5 w-5" />
                      </button>
                      {actionMenu === secret.id && (
                        <>
                          <div
                            className="fixed inset-0 z-10"
                            onClick={() => setActionMenu(null)}
                          />
                          <div className="absolute right-0 z-20 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1">
                            {canEdit && (
                              <button
                                onClick={() => {
                                  setEditingSecret(secret);
                                  setModalOpen(true);
                                  setActionMenu(null);
                                }}
                                className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                              >
                                <Pencil className="h-4 w-4" />
                                Edit
                              </button>
                            )}
                            {canReveal && (
                              <button
                                onClick={() => {
                                  handleReveal(secret.id);
                                  setActionMenu(null);
                                }}
                                className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                              >
                                <Eye className="h-4 w-4" />
                                {revealedSecrets[secret.id] ? 'Hide Value' : 'Reveal Value'}
                              </button>
                            )}
                            {canDelete && !secret.is_system && (
                              <button
                                onClick={() => {
                                  setDeleteConfirm(secret.id);
                                  setActionMenu(null);
                                }}
                                className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                                Delete
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="px-6 py-3 border-t border-gray-200 flex items-center justify-between">
              <div className="text-sm text-gray-500">
                Showing {((page - 1) * 20) + 1} to {Math.min(page * 20, totalCount)} of {totalCount}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 border border-gray-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-600">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1 border border-gray-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <AlertTriangle className="h-6 w-6" />
              <h3 className="text-lg font-semibold">Delete Secret</h3>
            </div>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this secret? This action cannot be undone and any systems using this secret will lose access.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
              >
                Delete Secret
              </button>
            </div>
          </div>
        </div>
      )}

      {modalOpen && (
        <SecretModal
          secret={editingSecret}
          categories={categories}
          onClose={() => {
            setModalOpen(false);
            setEditingSecret(null);
          }}
          onSuccess={handleSaveSuccess}
        />
      )}
    </div>
  );
}
