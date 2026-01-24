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
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="h-3 w-3 mr-1" />
            Verified
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <XCircle className="h-3 w-3 mr-1" />
            Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="flex gap-6">
      <div className={`${selectedDomain ? 'w-1/2' : 'w-full'}`}>
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">Authenticated Domains</h3>
            <div className="flex items-center space-x-2">
              {isAdmin && (
                <>
                  <button
                    onClick={handleSync}
                    disabled={syncing}
                    className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    <RefreshCw className={`h-4 w-4 mr-1.5 ${syncing ? 'animate-spin' : ''}`} />
                    Sync
                  </button>
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="inline-flex items-center px-3 py-1.5 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                  >
                    <Plus className="h-4 w-4 mr-1.5" />
                    Add Domain
                  </button>
                </>
              )}
            </div>
          </div>

          {error && (
            <div className="px-6 py-3 bg-red-50 border-b border-red-100">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {domains.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-gray-500">No domains configured</p>
              {isAdmin && (
                <button
                  onClick={() => setShowAddModal(true)}
                  className="mt-4 inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                  Add Your First Domain
                </button>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {domains.map((domain) => (
                <li
                  key={domain.id}
                  onClick={() => setSelectedDomain(domain)}
                  className={`px-6 py-4 hover:bg-gray-50 cursor-pointer flex items-center justify-between ${
                    selectedDomain?.id === domain.id ? 'bg-blue-50' : ''
                  }`}
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">{domain.domain}</p>
                    <p className="text-xs text-gray-500">
                      {domain.last_checked_at
                        ? `Last verified: ${new Date(domain.last_checked_at).toLocaleDateString()}`
                        : 'Never verified'}
                    </p>
                  </div>
                  <div className="flex items-center space-x-3">
                    {getStatusBadge(domain.status)}
                    <ChevronRight className="h-5 w-5 text-gray-400" />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {selectedDomain && (
        <div className="w-1/2">
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-gray-900">{selectedDomain.domain}</h3>
                {getStatusBadge(selectedDomain.status)}
              </div>
              <button
                onClick={() => setSelectedDomain(null)}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-6 py-4">
              <h4 className="text-sm font-medium text-gray-900 mb-4">DNS Records</h4>
              {selectedDomain.dns_records.length === 0 ? (
                <p className="text-sm text-gray-500">No DNS records available</p>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">
                    Add these records to your DNS provider to authenticate this domain:
                  </p>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead>
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Host</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Value</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {selectedDomain.dns_records.map((record, index) => (
                          <tr key={index}>
                            <td className="px-3 py-2 text-sm text-gray-900">{record.type}</td>
                            <td className="px-3 py-2">
                              <div className="flex items-center">
                                <span className="text-xs font-mono text-gray-700 truncate max-w-[150px]">
                                  {record.host}
                                </span>
                                <button
                                  onClick={() => copyToClipboard(record.host)}
                                  className="ml-2 text-gray-400 hover:text-gray-600"
                                >
                                  <Copy className="h-3 w-3" />
                                </button>
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center">
                                <span className="text-xs font-mono text-gray-700 truncate max-w-[150px]">
                                  {record.value}
                                </span>
                                <button
                                  onClick={() => copyToClipboard(record.value)}
                                  className="ml-2 text-gray-400 hover:text-gray-600"
                                >
                                  <Copy className="h-3 w-3" />
                                </button>
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              {record.valid ? (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-500" />
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
              <div className="px-6 py-4 bg-gray-50 rounded-b-lg flex justify-between">
                <button
                  onClick={() => handleVerify(selectedDomain.id)}
                  disabled={verifying === selectedDomain.id}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${verifying === selectedDomain.id ? 'animate-spin' : ''}`} />
                  Verify Now
                </button>
                <button
                  onClick={() => handleDelete(selectedDomain.id)}
                  disabled={deleting === selectedDomain.id}
                  className="inline-flex items-center px-4 py-2 border border-red-300 shadow-sm text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 disabled:opacity-50"
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
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowAddModal(false)} />
            <span className="hidden sm:inline-block sm:h-screen sm:align-middle">&#8203;</span>
            <div className="inline-block transform overflow-hidden rounded-lg bg-white px-4 pt-5 pb-4 text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6 sm:align-middle">
              <form onSubmit={handleAdd}>
                <div>
                  <h3 className="text-lg font-medium text-gray-900">Add Domain</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Enter the domain you want to authenticate for sending emails.
                  </p>
                  <div className="mt-4">
                    <label htmlFor="domain" className="block text-sm font-medium text-gray-700">
                      Domain
                    </label>
                    <input
                      type="text"
                      id="domain"
                      value={newDomain}
                      onChange={(e) => setNewDomain(e.target.value)}
                      placeholder="example.com"
                      required
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                  </div>
                </div>
                <div className="mt-5 sm:mt-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="submit"
                    disabled={adding || !newDomain}
                    className="inline-flex w-full justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                  >
                    {adding ? 'Adding...' : 'Add Domain'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:mt-0 sm:w-auto sm:text-sm"
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
