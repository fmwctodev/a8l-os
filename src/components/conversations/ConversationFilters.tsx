import { useState, useEffect } from 'react';
import { X, Phone, Mail, PhoneCall, MessageCircle, Share2, Search, Mic, Bot } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getUsers } from '../../services/users';
import { getDepartments } from '../../services/departments';
import type { ConversationFilters as FilterType, MessageChannel, ConversationStatus, User, Department } from '../../types';

interface ConversationFiltersProps {
  filters: FilterType;
  onChange: (filters: FilterType) => void;
  onClose: () => void;
}

const CHANNELS: { value: MessageChannel; label: string; icon: React.ReactNode }[] = [
  { value: 'sms', label: 'SMS', icon: <Phone size={14} /> },
  { value: 'email', label: 'Email', icon: <Mail size={14} /> },
  { value: 'voice', label: 'Voice', icon: <PhoneCall size={14} /> },
  { value: 'webchat', label: 'Webchat', icon: <MessageCircle size={14} /> },
  { value: 'social_dm', label: 'Social DMs', icon: <Share2 size={14} /> },
  { value: 'vapi_voice', label: 'Vapi Voice', icon: <Mic size={14} /> },
  { value: 'vapi_sms', label: 'Vapi SMS', icon: <Bot size={14} /> },
  { value: 'vapi_webchat', label: 'Vapi Chat', icon: <Bot size={14} /> },
];

const PROVIDERS = [
  { value: '', label: 'All sources' },
  { value: 'vapi', label: 'Vapi AI only' },
  { value: 'non-vapi', label: 'Non-Vapi only' },
];

const STATUSES: { value: ConversationStatus; label: string; color: string }[] = [
  { value: 'open', label: 'Open', color: 'bg-green-500' },
  { value: 'pending', label: 'Pending', color: 'bg-yellow-500' },
  { value: 'closed', label: 'Closed', color: 'bg-gray-400' },
];

export function ConversationFilters({ filters, onChange, onClose }: ConversationFiltersProps) {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [searchQuery, setSearchQuery] = useState(filters.search || '');

  useEffect(() => {
    async function loadData() {
      if (!user?.organization_id) return;

      try {
        const [usersData, deptsData] = await Promise.all([
          getUsers(user.organization_id),
          getDepartments(user.organization_id),
        ]);
        setUsers(usersData);
        setDepartments(deptsData);
      } catch (error) {
        console.error('Failed to load filter data:', error);
      }
    }
    loadData();
  }, [user?.organization_id]);

  const handleChannelToggle = (channel: MessageChannel) => {
    const currentChannels = filters.channels || [];
    const newChannels = currentChannels.includes(channel)
      ? currentChannels.filter((c) => c !== channel)
      : [...currentChannels, channel];

    onChange({
      ...filters,
      channels: newChannels.length > 0 ? newChannels : undefined,
    });
  };

  const handleStatusToggle = (status: ConversationStatus) => {
    const currentStatuses = filters.status || [];
    const newStatuses = currentStatuses.includes(status)
      ? currentStatuses.filter((s) => s !== status)
      : [...currentStatuses, status];

    onChange({
      ...filters,
      status: newStatuses.length > 0 ? newStatuses : undefined,
    });
  };

  const handleAssignedUserChange = (userId: string) => {
    onChange({
      ...filters,
      assignedUserId: userId || undefined,
    });
  };

  const handleDepartmentChange = (departmentId: string) => {
    onChange({
      ...filters,
      departmentId: departmentId || undefined,
    });
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
  };

  const handleSearchSubmit = () => {
    onChange({
      ...filters,
      search: searchQuery || undefined,
    });
  };

  const handleClearAll = () => {
    setSearchQuery('');
    onChange({});
  };

  const handleProviderChange = (value: string) => {
    onChange({
      ...filters,
      provider: value || undefined,
    });
  };

  const hasActiveFilters =
    (filters.channels && filters.channels.length > 0) ||
    (filters.status && filters.status.length > 0) ||
    filters.assignedUserId ||
    filters.departmentId ||
    filters.unreadOnly ||
    filters.search ||
    filters.provider;

  return (
    <div className="border-b border-slate-700 bg-slate-800/50 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-white">Filters</h3>
        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <button
              onClick={handleClearAll}
              className="text-xs text-cyan-400 hover:text-cyan-300"
            >
              Clear all
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-700"
          >
            <X size={16} className="text-slate-400" />
          </button>
        </div>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearchSubmit()}
          onBlur={handleSearchSubmit}
          placeholder="Search contacts..."
          className="w-full pl-9 pr-3 py-2 text-sm bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-400 mb-2">Channel</label>
        <div className="flex flex-wrap gap-2">
          {CHANNELS.map((channel) => {
            const isSelected = filters.channels?.includes(channel.value);
            return (
              <button
                key={channel.value}
                onClick={() => handleChannelToggle(channel.value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full border transition-colors ${
                  isSelected
                    ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400'
                    : 'bg-slate-700 border-slate-600 text-slate-300 hover:border-slate-500'
                }`}
              >
                {channel.icon}
                {channel.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-400 mb-2">Status</label>
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((status) => {
            const isSelected = filters.status?.includes(status.value);
            return (
              <button
                key={status.value}
                onClick={() => handleStatusToggle(status.value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full border transition-colors ${
                  isSelected
                    ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400'
                    : 'bg-slate-700 border-slate-600 text-slate-300 hover:border-slate-500'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${status.color}`} />
                {status.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-400 mb-2">Assigned to</label>
        <select
          value={filters.assignedUserId || ''}
          onChange={(e) => handleAssignedUserChange(e.target.value)}
          className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
        >
          <option value="">All users</option>
          <option value="unassigned">Unassigned</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </div>

      {departments.length > 1 && (
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-2">Department</label>
          <select
            value={filters.departmentId || ''}
            onChange={(e) => handleDepartmentChange(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
          >
            <option value="">All departments</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-slate-400 mb-2">Source</label>
        <select
          value={filters.provider || ''}
          onChange={(e) => handleProviderChange(e.target.value)}
          className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
        >
          {PROVIDERS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
