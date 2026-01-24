import { useState, useEffect } from 'react';
import { Plus, CheckCircle, XCircle, Clock, RefreshCw, Trash2, Copy, ChevronRight, X } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { getDomains, addDomain, verifyDomain, deleteDomain, syncDomains } from '../../../services/emailDomains';
import type { EmailDomain } from '../../../types';

export function DomainsTab() {
  const { user, hasPermission } = useAuth();
  const [domains, setDomains] = useState<EmailDomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState<EmailDomain | null>(null);
  const [newDomain, setNewDomain] = useState('');
  const [adding, setAdding] = useState(false);
  const [verifying, setVerifying] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = hasPermission('email.settings.manage');

  useEffect(() => {
    loadDomains();
  }, [user?.organization_id]);

  const loadDomains = async () => {
    if (!user?.organization_id) return;
    try {
      const data = await getDomains(user.organization_id);
      setDomains(data);
    } catch (err) {
      console.error('Failed to load domains:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setError(null);
    try {
      await syncDomains();
      await loadDomains();
    } catch (err) {
      setError('Failed to sync domains');
    } finally {
      setSyncing(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    setError(null);
    try {
      const result = await addDomain(newDomain);
      if (result.success) {
        setShowAddModal(false);
        setNewDomain('');
        await loadDomains();
        if (result.domain) {
          setSelectedDomain(result.domain);
        }
      } else {
        setError(result.error || 'Failed to add domain');
      }
    } catch (err) {
      setError('Failed to add domain');
    } finally {
      setAdding(false);
    }
  };

  const handleVerify = async (domainId: string) => {
    setVerifying(domainId);
    setError(null);
    try {
      const result = await verifyDomain(domainId);
      await loadDomains();
      if (selectedDomain?.id === domainId) {
        const updated = domains.find(d => d.id === domainId);
        if (updated) setSelectedDomain(updated);
      }
    } catch (err) {
      setError('Failed to verify domain');
    } finally {
      setVerifying(null);
    }
  };

  const handleDelete = async (domainId: string) => {
    if (!confirm('Are you sure you want to delete this domain?')) return;
    setDeleting(domainId);
    try {
      const result = await deleteDomain(domainId);
      if (result.success) {
        if (selectedDomain?.id === domainId) {
          setSelectedDomain(null);
        }
        await loadDomains();
      } else {
        setError(result.error || 'Failed to delete domain');
      }
    } catch (err) {
      setError('Failed to delete domain');
    } finally {
      setDeleting(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const getStatusBadge = (status: EmailDomain['status']) => {
    switch (status) {
      case 'verified':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle className="h-3 w-3 mr-1" />
            Verified
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
            <XCircle className="h-3 w-3 mr-1" />
            Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500" />
      </div>
    );
  }

  return (
    <div className="flex gap-6">
      <div className={`${selectedDomain ? 'w-1/2' : 'w-full'}`}>
        <div className="bg-slate-800 border border-slate-700 rounded-lg">
          <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
            <h3 className="text-lg font-medium text-white">Authenticated Domains</h3>
            <div className="flex items-center space-x-2">
              {isAdmin && (
                <>
                  <button
                    onClick={handleSync}
                    disabled={syncing}
                    className="inline-flex items-center px-3 py-1.5 border border-slate-600 text-sm font-medium rounded-md text-slate-300 bg-slate-700 hover:bg-slate-600 disabled:opacity-50"
                  >
                    <RefreshCw className={`h-4 w-4 mr-1.5 ${syncing ? 'animate-spin' : ''}`} />
                    Sync
                  </button>
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-cyan-600 hover:bg-cyan-500"
                  >
                    <Plus className="h-4 w-4 mr-1.5" />
                    Add Domain
                  </button>
                </>
              )}
            </div>
          </div>

          {error && (
            <div className="px-6 py-3 bg-red-500/10 border-b border-red-500/20">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {domains.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-slate-400">No domains configured</p>
              {isAdmin && (
                <button
                  onClick={() => setShowAddModal(true)}
                  className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-cyan-600 hover:bg-cyan-500"
                >
                  Add Your First Domain
                </button>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-slate-700">
              {domains.map((domain) => (
                <li
                  key={domain.id}
                  onClick={() => setSelectedDomain(domain)}
                  className={`px-6 py-4 hover:bg-slate-700/50 cursor-pointer flex items-center justify-between ${
                    selectedDomain?.id === domain.id ? 'bg-slate-700/50' : ''
                  }`}
                >
                  <div>
                    <p className="text-sm font-medium text-white">{domain.domain}</p>
                    <p className="text-xs text-slate-500">
                      {domain.last_checked_at
                        ? `Last verified: ${new Date(domain.last_checked_at).toLocaleDateString()}`
                        : 'Never verified'}
                    </p>
                  </div>
                  <div className="flex items-center space-x-3">
                    {getStatusBadge(domain.status)}
                    <ChevronRight className="h-5 w-5 text-slate-500" />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {selectedDomain && (
        <div className="w-1/2">
          <div className="bg-slate-800 border border-slate-700 rounded-lg">
            <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-white">{selectedDomain.domain}</h3>
                <div className="mt-1">{getStatusBadge(selectedDomain.status)}</div>
              </div>
              <button
                onClick={() => setSelectedDomain(null)}
                className="text-slate-400 hover:text-slate-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-6 py-4">
              <h4 className="text-sm font-medium text-white mb-4">DNS Records</h4>
              {selectedDomain.dns_records.length === 0 ? (
                <p className="text-sm text-slate-400">No DNS records available</p>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-slate-400">
                    Add these records to your DNS provider to authenticate this domain:
                  </p>
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead>
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">Type</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">Host</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">Value</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700">
                        {selectedDomain.dns_records.map((record, index) => (
                          <tr key={index}>
                            <td className="px-3 py-2 text-sm text-white">{record.type}</td>
                            <td className="px-3 py-2">
                              <div className="flex items-center">
                                <span className="text-xs font-mono text-slate-300 truncate max-w-[150px]">
                                  {record.host}
                                </span>
                                <button
                                  onClick={() => copyToClipboard(record.host)}
                                  className="ml-2 text-slate-500 hover:text-slate-300"
                                >
                                  <Copy className="h-3 w-3" />
                                </button>
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center">
                                <span className="text-xs font-mono text-slate-300 truncate max-w-[150px]">
                                  {record.value}
                                </span>
                                <button
                                  onClick={() => copyToClipboard(record.value)}
                                  className="ml-2 text-slate-500 hover:text-slate-300"
                                >
                                  <Copy className="h-3 w-3" />
                                </button>
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              {record.valid ? (
                                <CheckCircle className="h-4 w-4 text-emerald-400" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-400" />
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {isAdmin && (
              <div className="px-6 py-4 bg-slate-700/30 rounded-b-lg flex justify-between">
                <button
                  onClick={() => handleVerify(selectedDomain.id)}
                  disabled={verifying === selectedDomain.id}
                  className="inline-flex items-center px-4 py-2 border border-slate-600 text-sm font-medium rounded-md text-slate-300 bg-slate-700 hover:bg-slate-600 disabled:opacity-50"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${verifying === selectedDomain.id ? 'animate-spin' : ''}`} />
                  Verify Now
                </button>
                <button
                  onClick={() => handleDelete(selectedDomain.id)}
                  disabled={deleting === selectedDomain.id}
                  className="inline-flex items-center px-4 py-2 border border-red-500/30 text-sm font-medium rounded-md text-red-400 bg-red-500/10 hover:bg-red-500/20 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-black/60 transition-opacity" onClick={() => setShowAddModal(false)} />
            <span className="hidden sm:inline-block sm:h-screen sm:align-middle">&#8203;</span>
            <div className="inline-block transform overflow-hidden rounded-lg bg-slate-800 border border-slate-700 px-4 pt-5 pb-4 text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6 sm:align-middle">
              <form onSubmit={handleAdd}>
                <div>
                  <h3 className="text-lg font-medium text-white">Add Domain</h3>
                  <p className="mt-1 text-sm text-slate-400">
                    Enter the domain you want to authenticate for sending emails.
                  </p>
                  <div className="mt-4">
                    <label htmlFor="domain" className="block text-sm font-medium text-slate-300">
                      Domain
                    </label>
                    <input
                      type="text"
                      id="domain"
                      value={newDomain}
                      onChange={(e) => setNewDomain(e.target.value)}
                      placeholder="example.com"
                      required
                      className="mt-1 block w-full bg-slate-900 border-slate-600 rounded-md text-white placeholder-slate-500 focus:ring-cyan-500 focus:border-cyan-500 sm:text-sm"
                    />
                  </div>
                </div>
                <div className="mt-5 sm:mt-6 sm:flex sm:flex-row-reverse gap-3">
                  <button
                    type="submit"
                    disabled={adding || !newDomain}
                    className="inline-flex w-full justify-center rounded-md border border-transparent bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-50 sm:w-auto"
                  >
                    {adding ? 'Adding...' : 'Add Domain'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="mt-3 inline-flex w-full justify-center rounded-md border border-slate-600 bg-slate-700 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-600 sm:mt-0 sm:w-auto"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
