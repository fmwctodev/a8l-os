import { Users, Hash, RefreshCw, Plus, MessageCircle } from 'lucide-react';
import { ChannelWithDetails } from '../../services/teamMessaging';
import { formatDistanceToNow } from '../../utils/dateUtils';

interface ChannelsListProps {
  channels: ChannelWithDetails[];
  selectedChannelId: string | null;
  loading: boolean;
  refreshing: boolean;
  onSelectChannel: (channel: ChannelWithDetails) => void;
  onRefresh: () => void;
  onNewMessage: () => void;
  onCreateGroup: () => void;
  canCreateGroup: boolean;
}

export function ChannelsList({
  channels,
  selectedChannelId,
  loading,
  refreshing,
  onSelectChannel,
  onRefresh,
  onNewMessage,
  onCreateGroup,
  canCreateGroup,
}: ChannelsListProps) {
  const getChannelDisplay = (channel: ChannelWithDetails) => {
    if (channel.type === 'direct') {
      const otherMember = channel.members?.find(m => m.user_id !== channel.created_by);
      return {
        name: otherMember?.name || 'Unknown User',
        avatar: otherMember?.avatar_url,
        icon: null,
      };
    }

    return {
      name: channel.name || 'Unnamed Group',
      avatar: channel.avatar_url,
      icon: <Hash className="w-4 h-4" />,
    };
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-6 h-6 text-cyan-500 animate-spin mx-auto mb-2" />
          <p className="text-sm text-slate-400">Loading channels...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="p-3 border-b border-slate-700 space-y-2">
        <button
          onClick={onNewMessage}
          className="w-full px-3 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2 text-sm font-medium"
        >
          <MessageCircle size={16} />
          New Message
        </button>
        {canCreateGroup && (
          <button
            onClick={onCreateGroup}
            className="w-full px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors flex items-center justify-center gap-2 text-sm font-medium"
          >
            <Plus size={16} />
            Create Group
          </button>
        )}
      </div>

      <div className="flex items-center justify-between p-3 border-b border-slate-700">
        <h3 className="text-sm font-medium text-white">Messages</h3>
        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors disabled:opacity-50"
          title="Refresh channels"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {channels.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center mx-auto mb-3">
              <MessageCircle className="w-6 h-6 text-slate-500" />
            </div>
            <p className="text-sm text-slate-400 mb-1">No conversations yet</p>
            <p className="text-xs text-slate-500">
              Click "New Message" to start chatting
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-700">
            {channels.map((channel) => {
              const display = getChannelDisplay(channel);
              const isSelected = channel.id === selectedChannelId;

              return (
                <button
                  key={channel.id}
                  onClick={() => onSelectChannel(channel)}
                  className={`w-full p-3 hover:bg-slate-700/50 transition-colors text-left ${
                    isSelected ? 'bg-slate-700/70' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="relative flex-shrink-0">
                      {display.avatar ? (
                        <img
                          src={display.avatar}
                          alt={display.name}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                          {display.icon || (
                            <span className="text-white text-sm font-medium">
                              {display.name.charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                      )}
                      {channel.type === 'group' && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-slate-800 flex items-center justify-center">
                          <Users className="w-2.5 h-2.5 text-slate-400" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="text-sm font-medium text-white truncate">
                          {display.name}
                        </h4>
                        {channel.last_message && (
                          <span className="text-xs text-slate-500 flex-shrink-0 ml-2">
                            {formatDistanceToNow(new Date(channel.last_message.created_at))}
                          </span>
                        )}
                      </div>
                      {channel.last_message && (
                        <p className="text-xs text-slate-400 truncate">
                          {channel.last_message.is_deleted
                            ? 'Message deleted'
                            : channel.last_message.content}
                        </p>
                      )}
                      {channel.type === 'group' && (
                        <p className="text-xs text-slate-500 mt-1">
                          {channel.member_count} member{channel.member_count !== 1 ? 's' : ''}
                        </p>
                      )}
                    </div>

                    {channel.unread_count > 0 && (
                      <div className="flex-shrink-0 mt-1">
                        <div className="px-2 py-0.5 rounded-full bg-cyan-600 text-white text-xs font-medium min-w-[20px] text-center">
                          {channel.unread_count > 99 ? '99+' : channel.unread_count}
                        </div>
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
