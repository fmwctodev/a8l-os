import { useState, useRef, useEffect } from 'react';
import {
  Search,
  ChevronDown,
  X,
  Check,
  Plus,
  LayoutGrid,
  ExternalLink,
  Facebook,
  Instagram,
  Linkedin,
  Youtube,
  MapPin,
  Music2,
  MessageSquare,
} from 'lucide-react';
import type { SocialAccount, SocialAccountGroup, SocialProvider } from '../../types';

const PROVIDER_ICONS: Record<SocialProvider, React.ElementType> = {
  facebook: Facebook,
  instagram: Instagram,
  linkedin: Linkedin,
  google_business: MapPin,
  tiktok: Music2,
  youtube: Youtube,
  reddit: MessageSquare,
};

const PROVIDER_COLORS: Record<SocialProvider, string> = {
  facebook: '#1877F2',
  instagram: '#E4405F',
  linkedin: '#0A66C2',
  google_business: '#4285F4',
  tiktok: '#000000',
  youtube: '#FF0000',
  reddit: '#FF4500',
};

interface AccountSelectorProps {
  accounts: SocialAccount[];
  groups: SocialAccountGroup[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  onCreateGroup: () => void;
  onAddAccount: () => void;
}

export function AccountSelector({
  accounts,
  groups,
  selectedIds,
  onSelectionChange,
  onCreateGroup,
  onAddAccount,
}: AccountSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredAccounts = accounts.filter(
    (a) =>
      a.display_name.toLowerCase().includes(search.toLowerCase()) ||
      a.provider.toLowerCase().includes(search.toLowerCase())
  );

  const filteredGroups = groups.filter((g) =>
    g.name.toLowerCase().includes(search.toLowerCase())
  );

  const selectedAccounts = accounts.filter((a) => selectedIds.includes(a.id));

  const toggleAccount = (accountId: string) => {
    if (selectedIds.includes(accountId)) {
      onSelectionChange(selectedIds.filter((id) => id !== accountId));
    } else {
      onSelectionChange([...selectedIds, accountId]);
    }
  };

  const toggleGroup = (group: SocialAccountGroup) => {
    const groupAccountIds = group.account_ids.filter((id) =>
      accounts.some((a) => a.id === id)
    );
    const allSelected = groupAccountIds.every((id) => selectedIds.includes(id));

    if (allSelected) {
      onSelectionChange(selectedIds.filter((id) => !groupAccountIds.includes(id)));
    } else {
      const newSelection = new Set([...selectedIds, ...groupAccountIds]);
      onSelectionChange(Array.from(newSelection));
    }
  };

  const selectAll = () => {
    onSelectionChange(accounts.map((a) => a.id));
  };

  const clearAll = () => {
    onSelectionChange([]);
  };

  const isGroupSelected = (group: SocialAccountGroup) => {
    const groupAccountIds = group.account_ids.filter((id) =>
      accounts.some((a) => a.id === id)
    );
    return groupAccountIds.length > 0 && groupAccountIds.every((id) => selectedIds.includes(id));
  };

  const isGroupPartiallySelected = (group: SocialAccountGroup) => {
    const groupAccountIds = group.account_ids.filter((id) =>
      accounts.some((a) => a.id === id)
    );
    const selectedCount = groupAccountIds.filter((id) => selectedIds.includes(id)).length;
    return selectedCount > 0 && selectedCount < groupAccountIds.length;
  };

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-sm font-medium text-gray-700 mb-2">Post to</label>

      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 bg-white border border-gray-300 rounded-lg hover:border-gray-400 transition-colors text-left"
      >
        {selectedAccounts.length === 0 ? (
          <span className="text-gray-500">Select a social account</span>
        ) : (
          <div className="flex items-center gap-1 flex-wrap">
            {selectedAccounts.slice(0, 8).map((account) => {
              const Icon = PROVIDER_ICONS[account.provider];
              const color = PROVIDER_COLORS[account.provider];
              return (
                <div
                  key={account.id}
                  className="relative w-8 h-8 rounded-full overflow-hidden border-2 border-white shadow-sm"
                  title={account.display_name}
                >
                  {account.profile_image_url ? (
                    <img
                      src={account.profile_image_url}
                      alt={account.display_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div
                      className="w-full h-full flex items-center justify-center"
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
              );
            })}
            {selectedAccounts.length > 8 && (
              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600">
                +{selectedAccounts.length - 8}
              </div>
            )}
          </div>
        )}
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {selectedIds.length > 0 && (
        <button
          onClick={clearAll}
          className="mt-1 text-xs text-gray-500 hover:text-gray-700"
        >
          Clear all
        </button>
      )}

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-96 overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search"
                className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoFocus
              />
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
            <button
              onClick={onCreateGroup}
              className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700"
            >
              <LayoutGrid className="w-4 h-4" />
              Create New Group
            </button>
            <div className="w-px h-4 bg-gray-200" />
            <button
              onClick={onAddAccount}
              className="flex items-center gap-1.5 text-sm text-green-600 hover:text-green-700"
            >
              <ExternalLink className="w-4 h-4" />
              Add New Social
            </button>
          </div>

          <div className="overflow-y-auto max-h-72">
            {filteredGroups.length > 0 && (
              <div className="px-3 py-2">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                  Groups
                </div>
                {filteredGroups.map((group) => (
                  <button
                    key={group.id}
                    onClick={() => toggleGroup(group)}
                    className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                        isGroupSelected(group)
                          ? 'bg-blue-600 border-blue-600'
                          : isGroupPartiallySelected(group)
                          ? 'bg-blue-100 border-blue-400'
                          : 'border-gray-300'
                      }`}
                    >
                      {(isGroupSelected(group) || isGroupPartiallySelected(group)) && (
                        <Check className="w-3 h-3 text-white" />
                      )}
                    </div>
                    <LayoutGrid className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-700">{group.name}</span>
                    <span className="text-xs text-gray-400 ml-auto">
                      {group.account_ids.length} accounts
                    </span>
                  </button>
                ))}
              </div>
            )}

            <div className="px-3 py-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  All Accounts
                </span>
                <button
                  onClick={selectAll}
                  className="text-xs text-blue-600 hover:text-blue-700"
                >
                  Select All
                </button>
              </div>

              {filteredAccounts.length === 0 ? (
                <div className="py-4 text-center text-sm text-gray-500">
                  No accounts found
                </div>
              ) : (
                filteredAccounts.map((account) => {
                  const Icon = PROVIDER_ICONS[account.provider];
                  const color = PROVIDER_COLORS[account.provider];
                  const isSelected = selectedIds.includes(account.id);

                  return (
                    <button
                      key={account.id}
                      onClick={() => toggleAccount(account.id)}
                      className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                          isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </div>

                      <div className="relative">
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
                        {account.external_account_id && (
                          <div className="text-xs text-blue-500 truncate max-w-[200px]">
                            {account.external_account_id}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
