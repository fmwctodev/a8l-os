import { useState } from 'react';
import {
  X,
  Check,
  Facebook,
  Instagram,
  Linkedin,
  Youtube,
  MapPin,
  Music2,
} from 'lucide-react';
import type { SocialAccount, SocialProvider } from '../../types';

const PROVIDER_ICONS: Record<SocialProvider, React.ElementType> = {
  facebook: Facebook,
  instagram: Instagram,
  linkedin: Linkedin,
  google_business: MapPin,
  tiktok: Music2,
  youtube: Youtube,
};

const PROVIDER_COLORS: Record<SocialProvider, string> = {
  facebook: '#1877F2',
  instagram: '#E4405F',
  linkedin: '#0A66C2',
  google_business: '#4285F4',
  tiktok: '#000000',
  youtube: '#FF0000',
};

interface CreateGroupModalProps {
  accounts: SocialAccount[];
  onClose: () => void;
  onSave: (name: string, accountIds: string[], description?: string) => Promise<void>;
}

export function CreateGroupModal({ accounts, onClose, onSave }: CreateGroupModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const toggleAccount = (accountId: string) => {
    setSelectedIds((prev) =>
      prev.includes(accountId)
        ? prev.filter((id) => id !== accountId)
        : [...prev, accountId]
    );
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Please enter a group name');
      return;
    }
    if (selectedIds.length === 0) {
      setError('Please select at least one account');
      return;
    }

    setSaving(true);
    setError('');

    try {
      await onSave(name.trim(), selectedIds, description.trim() || undefined);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create group');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Create Account Group</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Group Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Client A Accounts, Marketing Team"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description (optional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this group"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Accounts <span className="text-red-500">*</span>
            </label>
            <div className="border border-gray-200 rounded-lg max-h-60 overflow-y-auto">
              {accounts.length === 0 ? (
                <div className="p-4 text-center text-sm text-gray-500">
                  No accounts available
                </div>
              ) : (
                accounts.map((account) => {
                  const Icon = PROVIDER_ICONS[account.provider];
                  const color = PROVIDER_COLORS[account.provider];
                  const isSelected = selectedIds.includes(account.id);

                  return (
                    <button
                      key={account.id}
                      type="button"
                      onClick={() => toggleAccount(account.id)}
                      className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
                    >
                      <div
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                          isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </div>

                      <div className="relative flex-shrink-0">
                        {account.profile_image_url ? (
                          <img
                            src={account.profile_image_url}
                            alt={account.display_name}
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        ) : (
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center"
                            style={{ backgroundColor: color + '20' }}
                          >
                            <Icon className="w-4 h-4" style={{ color }} />
                          </div>
                        )}
                        <div
                          className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center border border-white"
                          style={{ backgroundColor: color }}
                        >
                          <Icon className="w-2.5 h-2.5 text-white" />
                        </div>
                      </div>

                      <div className="flex-1 text-left">
                        <div className="text-sm font-medium text-gray-900">
                          {account.display_name}
                        </div>
                        <div className="text-xs text-gray-500 capitalize">
                          {account.provider.replace('_', ' ')}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
            <div className="mt-1 text-xs text-gray-500">
              {selectedIds.length} account{selectedIds.length !== 1 ? 's' : ''} selected
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim() || selectedIds.length === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Creating...' : 'Create Group'}
          </button>
        </div>
      </div>
    </div>
  );
}
