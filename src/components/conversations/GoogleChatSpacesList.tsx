import { useState, useMemo } from 'react';
import { Search, Users, User, MessageSquare, Hash, RefreshCw, Loader2 } from 'lucide-react';
import type { GoogleChatSpaceCache } from '../../services/googleChat';

interface GoogleChatSpacesListProps {
  spaces: GoogleChatSpaceCache[];
  selectedSpaceId: string | null;
  loading: boolean;
  onSelectSpace: (space: GoogleChatSpaceCache) => void;
  onRefresh: () => void;
  refreshing: boolean;
}

export function GoogleChatSpacesList({
  spaces,
  selectedSpaceId,
  loading,
  onSelectSpace,
  onRefresh,
  refreshing,
}: GoogleChatSpacesListProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredSpaces = useMemo(() => {
    if (!searchQuery.trim()) return spaces;
    const query = searchQuery.toLowerCase();
    return spaces.filter(space =>
      space.display_name?.toLowerCase().includes(query) ||
      space.space_name?.toLowerCase().includes(query)
    );
  }, [spaces, searchQuery]);

  const groupedSpaces = useMemo(() => {
    const rooms: GoogleChatSpaceCache[] = [];
    const dms: GoogleChatSpaceCache[] = [];
    const other: GoogleChatSpaceCache[] = [];

    filteredSpaces.forEach(space => {
      const type = space.space_type?.toUpperCase();
      if (type === 'ROOM' || type === 'SPACE') {
        rooms.push(space);
      } else if (type === 'DM' || type === 'DIRECT_MESSAGE' || space.single_user_bot_dm) {
        dms.push(space);
      } else {
        other.push(space);
      }
    });

    return { rooms, dms, other };
  }, [filteredSpaces]);

  const getSpaceIcon = (space: GoogleChatSpaceCache) => {
    const type = space.space_type?.toUpperCase();
    if (type === 'DM' || type === 'DIRECT_MESSAGE' || space.single_user_bot_dm) {
      return <User size={16} className="text-slate-400" />;
    }
    if (type === 'ROOM' || type === 'SPACE') {
      return <Hash size={16} className="text-slate-400" />;
    }
    return <Users size={16} className="text-slate-400" />;
  };

  const SpaceItem = ({ space }: { space: GoogleChatSpaceCache }) => {
    const isSelected = space.space_id === selectedSpaceId;
    const hasUnread = (space.unread_count || 0) > 0;

    return (
      <button
        onClick={() => onSelectSpace(space)}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left ${
          isSelected
            ? 'bg-slate-600 text-white'
            : 'text-slate-300 hover:bg-slate-700/50'
        }`}
      >
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
          isSelected ? 'bg-slate-500' : 'bg-slate-700'
        }`}>
          {getSpaceIcon(space)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`truncate text-sm ${hasUnread ? 'font-semibold' : 'font-medium'}`}>
              {space.display_name || 'Unnamed Space'}
            </span>
            {hasUnread && (
              <span className="flex-shrink-0 min-w-[20px] h-5 px-1.5 rounded-full bg-cyan-500 text-white text-xs font-medium flex items-center justify-center">
                {space.unread_count}
              </span>
            )}
          </div>
        </div>
      </button>
    );
  };

  const SpaceGroup = ({ title, spaces: groupSpaces }: { title: string; spaces: GoogleChatSpaceCache[] }) => {
    if (groupSpaces.length === 0) return null;

    return (
      <div className="mb-4">
        <div className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
          {title}
        </div>
        <div className="space-y-0.5">
          {groupSpaces.map(space => (
            <SpaceItem key={space.id} space={space} />
          ))}
        </div>
      </div>
    );
  };

  if (loading && spaces.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-slate-500 animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-400">Loading spaces...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-slate-700">
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-sm font-semibold text-white flex-1">Spaces</h3>
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors disabled:opacity-50"
            title="Refresh spaces"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search spaces..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {filteredSpaces.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center mx-auto mb-3">
              <MessageSquare className="w-6 h-6 text-slate-500" />
            </div>
            <p className="text-sm text-slate-400">
              {searchQuery ? 'No spaces match your search' : 'No spaces found'}
            </p>
          </div>
        ) : (
          <>
            <SpaceGroup title="Rooms" spaces={groupedSpaces.rooms} />
            <SpaceGroup title="Direct Messages" spaces={groupedSpaces.dms} />
            <SpaceGroup title="Other" spaces={groupedSpaces.other} />
          </>
        )}
      </div>
    </div>
  );
}
