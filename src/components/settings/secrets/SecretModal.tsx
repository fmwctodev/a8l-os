import { useState, useEffect } from 'react';
import { X, Key, Eye, EyeOff, Link2, AlertCircle, HelpCircle } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import * as secretsService from '../../../services/secrets';
import type { Secret, SecretCategory, DynamicRef } from '../../../services/secrets';

interface Props {
  secret: Secret | null;
  categories: SecretCategory[];
  onClose: () => void;
  onSuccess: () => void;
}

export function SecretModal({ secret, categories, onClose, onSuccess }: Props) {
  const { user, hasPermission } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showValue, setShowValue] = useState(false);
  const [loadingValue, setLoadingValue] = useState(false);

  const [name, setName] = useState(secret?.name || '');
  const [key, setKey] = useState(secret?.key || '');
  const [value, setValue] = useState('');
  const [categoryId, setCategoryId] = useState(secret?.category_id || '');
  const [valueType, setValueType] = useState<'static' | 'dynamic' | 'rotating'>(secret?.value_type || 'static');
  const [description, setDescription] = useState(secret?.description || '');
  const [expiresAt, setExpiresAt] = useState(secret?.expires_at?.split('T')[0] || '');

  const [dynamicRef, setDynamicRef] = useState<DynamicRef | null>(null);
  const [refPath, setRefPath] = useState('');
  const [sourceTable, setSourceTable] = useState('');
  const [sourceFilter, setSourceFilter] = useState('{}');
  const [transform, setTransform] = useState('');

  const canManageDynamicRefs = hasPermission('secrets.dynamic_refs');
  const isEditing = !!secret;

  useEffect(() => {
    if (secret && user?.organization_id) {
      loadExistingValue();
      if (secret.value_type === 'dynamic') {
        loadDynamicRef();
      }
    }
  }, [secret, user?.organization_id]);

  const loadExistingValue = async () => {
    if (!secret || !user?.organization_id || !hasPermission('secrets.reveal')) return;

    try {
      setLoadingValue(true);
      const result = await secretsService.revealSecretValue(user.organization_id, secret.id);
      if (result.value) {
        setValue(result.value);
      }
    } catch (err) {
      console.error('Failed to load secret value:', err);
    } finally {
      setLoadingValue(false);
    }
  };

  const loadDynamicRef = async () => {
    if (!secret || !user?.organization_id) return;

    try {
      const ref = await secretsService.getDynamicRef(user.organization_id, secret.id);
      if (ref) {
        setDynamicRef(ref);
        setRefPath(ref.ref_path);
        setSourceTable(ref.source_table);
        setSourceFilter(JSON.stringify(ref.source_filter, null, 2));
        setTransform(ref.transform || '');
      }
    } catch (err) {
      console.error('Failed to load dynamic ref:', err);
    }
  };

  const handleKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = secretsService.formatSecretKey(e.target.value);
    setKey(formatted);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.organization_id) return;

    setError(null);
    setLoading(true);

    try {
      const secretData = {
        name,
        key,
        value: value || undefined,
        category_id: categoryId || undefined,
        value_type: valueType,
        description: description || undefined,
        expires_at: expiresAt || undefined,
      };

      let savedSecret: Secret;

      if (isEditing) {
        savedSecret = await secretsService.updateSecret(user.organization_id, secret.id, secretData);
      } else {
        savedSecret = await secretsService.createSecret(user.organization_id, secretData);
      }

      if (valueType === 'dynamic' && canManageDynamicRefs && refPath && sourceTable) {
        let parsedFilter = {};
        try {
          parsedFilter = JSON.parse(sourceFilter);
        } catch {
          parsedFilter = {};
        }

        await secretsService.setDynamicRef(user.organization_id, savedSecret.id, {
          ref_path: refPath,
          source_table: sourceTable,
          source_filter: parsedFilter,
          transform: transform || undefined,
        });
      } else if (valueType !== 'dynamic' && dynamicRef) {
        await secretsService.deleteDynamicRef(user.organization_id, savedSecret.id);
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save secret');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl max-w-2xl w-full mx-4 shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Key className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {isEditing ? 'Edit Secret' : 'Add New Secret'}
              </h2>
              <p className="text-sm text-gray-500">
                {isEditing ? 'Update secret configuration' : 'Create a new API key or secret'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Stripe API Key"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Key Identifier <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={key}
                  onChange={handleKeyChange}
                  placeholder="e.g., STRIPE_SECRET_KEY"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="mt-1 text-xs text-gray-500">Used to reference this secret in code</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">No category</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={valueType}
                  onChange={(e) => setValueType(e.target.value as 'static' | 'dynamic' | 'rotating')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="static">Static - Fixed value</option>
                  {canManageDynamicRefs && <option value="dynamic">Dynamic - From reference</option>}
                  <option value="rotating">Rotating - Auto-rotated</option>
                </select>
              </div>
            </div>

            {valueType === 'static' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Secret Value {!isEditing && <span className="text-red-500">*</span>}
                </label>
                <div className="relative">
                  <input
                    type={showValue ? 'text' : 'password'}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder={isEditing ? 'Leave blank to keep existing value' : 'Enter the secret value'}
                    required={!isEditing}
                    disabled={loadingValue}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowValue(!showValue)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                  >
                    {showValue ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  This value will be encrypted with AES-256 before storage
                </p>
              </div>
            )}

            {valueType === 'dynamic' && canManageDynamicRefs && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-4">
                <div className="flex items-center gap-2 text-blue-700 font-medium">
                  <Link2 className="h-4 w-4" />
                  Dynamic Reference Configuration
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Source Table <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={sourceTable}
                      onChange={(e) => setSourceTable(e.target.value)}
                      placeholder="e.g., channel_configurations"
                      required={valueType === 'dynamic'}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Reference Path <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={refPath}
                      onChange={(e) => setRefPath(e.target.value)}
                      placeholder="e.g., config.api_key"
                      required={valueType === 'dynamic'}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="flex items-center gap-1 text-sm font-medium text-gray-700 mb-1">
                    Source Filter (JSON)
                    <button type="button" className="text-gray-400 hover:text-gray-600">
                      <HelpCircle className="h-3.5 w-3.5" />
                    </button>
                  </label>
                  <textarea
                    value={sourceFilter}
                    onChange={(e) => setSourceFilter(e.target.value)}
                    placeholder='{"channel_type": "twilio"}'
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    org_id/organization_id is automatically applied
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Transform</label>
                  <select
                    value={transform}
                    onChange={(e) => setTransform(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">None</option>
                    <option value="uppercase">Uppercase</option>
                    <option value="lowercase">Lowercase</option>
                    <option value="trim">Trim whitespace</option>
                    <option value="base64_encode">Base64 Encode</option>
                    <option value="base64_decode">Base64 Decode</option>
                  </select>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this secret used for?"
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Expiration Date</label>
              <input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="mt-1 text-xs text-gray-500">
                Optional. You'll be notified when secrets are about to expire.
              </p>
            </div>
          </div>

          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />}
              {isEditing ? 'Save Changes' : 'Create Secret'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
