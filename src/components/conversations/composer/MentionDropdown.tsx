import { useState, useEffect, useRef, useCallback } from 'react';
import { getOrganizationUsers } from '../../../services/teamMessaging';

interface MentionUser {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
}

interface MentionDropdownProps {
  query: string;
  position: { top: number; left: number };
  onSelect: (user: MentionUser) => void;
  onClose: () => void;
  excludeUserId?: string;
}

export function MentionDropdown({
  query,
  position,
  onSelect,
  onClose,
  excludeUserId,
}: MentionDropdownProps) {
  const [users, setUsers] = useState<MentionUser[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<MentionUser[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadUsers() {
      try {
        const data = await getOrganizationUsers(excludeUserId);
        setUsers(data.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          avatar_url: u.avatar_url,
        })));
        setLoaded(true);
      } catch {
        setLoaded(true);
      }
    }
    loadUsers();
  }, [excludeUserId]);

  useEffect(() => {
    if (!loaded) return;
    const q = query.toLowerCase();
    const filtered = users.filter(
      (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
    setFilteredUsers(filtered.slice(0, 8));
    setSelectedIndex(0);
  }, [query, users, loaded]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, filteredUsers.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      if (filteredUsers[selectedIndex]) {
        onSelect(filteredUsers[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  }, [filteredUsers, selectedIndex, onSelect, onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  if (!loaded || filteredUsers.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className="absolute bg-white border border-gray-200 rounded-lg shadow-lg z-50 w-64 max-h-48 overflow-y-auto"
      style={{ bottom: position.top, left: position.left }}
    >
      {filteredUsers.map((user, index) => (
        <button
          key={user.id}
          onClick={() => onSelect(user)}
          className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
            index === selectedIndex ? 'bg-blue-50' : 'hover:bg-gray-50'
          }`}
        >
          <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-medium shrink-0">
            {user.avatar_url ? (
              <img src={user.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" />
            ) : (
              user.name.charAt(0).toUpperCase()
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-gray-800 truncate">{user.name}</div>
            <div className="text-gray-400 text-xs truncate">{user.email}</div>
          </div>
        </button>
      ))}
    </div>
  );
}
