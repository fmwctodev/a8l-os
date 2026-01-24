import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { User, ChevronDown, PanelRight, PanelRightClose, MoreVertical, UserPlus, Check } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { usePermission } from '../../hooks/usePermission';
import { updateConversationStatus, assignConversation } from '../../services/conversations';
import { getUsers } from '../../services/users';
import type { Conversation, ConversationStatus, User as UserType } from '../../types';

interface ConversationHeaderProps {
  conversation: Conversation;
  onConversationUpdate: () => void;
  onToggleContactPanel: () => void;
  showContactPanel: boolean;
}

const STATUS_OPTIONS: { value: ConversationStatus; label: string; color: string }[] = [
  { value: 'open', label: 'Open', color: 'bg-green-500' },
  { value: 'pending', label: 'Pending', color: 'bg-yellow-500' },
  { value: 'closed', label: 'Closed', color: 'bg-gray-400' },
];

export function ConversationHeader({
  conversation,
  onConversationUpdate,
  onToggleContactPanel,
  showContactPanel,
}: ConversationHeaderProps) {
  const { user } = useAuth();
  const canAssign = usePermission('conversations.assign');
  const canChangeStatus = usePermission('conversations.close');

  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showAssignMenu, setShowAssignMenu] = useState(false);
  const [users, setUsers] = useState<UserType[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const contact = conversation.contact;
  const contactName = contact
    ? `${contact.first_name} ${contact.last_name}`.trim()
    : 'Unknown';

  const currentStatus = STATUS_OPTIONS.find((s) => s.value === conversation.status) || STATUS_OPTIONS[0];

  useEffect(() => {
    async function loadUsers() {
      if (!showAssignMenu || !user?.organization_id) return;

      try {
        setLoadingUsers(true);
        const data = await getUsers(user.organization_id);
        setUsers(data.filter((u) => u.status === 'active'));
      } catch (error) {
        console.error('Failed to load users:', error);
      } finally {
        setLoadingUsers(false);
      }
    }
    loadUsers();
  }, [showAssignMenu, user?.organization_id]);

  const handleStatusChange = async (status: ConversationStatus) => {
    if (!user?.id) return;

    try {
      await updateConversationStatus(conversation.id, status, user.id);
      onConversationUpdate();
    } catch (error) {
      console.error('Failed to update status:', error);
    } finally {
      setShowStatusMenu(false);
    }
  };

  const handleAssign = async (userId: string | null) => {
    if (!user?.id) return;

    try {
      await assignConversation(conversation.id, userId, user.id);
      onConversationUpdate();
    } catch (error) {
      console.error('Failed to assign conversation:', error);
    } finally {
      setShowAssignMenu(false);
    }
  };

  return (
    <div className="px-4 py-3 border-b border-slate-700 bg-slate-800 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-slate-600 flex items-center justify-center text-white font-medium">
          {getInitials(contactName)}
        </div>
        <div>
          <Link
            to={`/contacts/${conversation.contact_id}`}
            className="font-semibold text-white hover:text-cyan-400 transition-colors"
          >
            {contactName}
          </Link>
          <div className="text-sm text-slate-400">
            {contact?.email || contact?.phone || 'No contact info'}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative">
          <button
            onClick={() => canChangeStatus && setShowStatusMenu(!showStatusMenu)}
            disabled={!canChangeStatus}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors ${
              canChangeStatus
                ? 'border-slate-600 hover:bg-slate-700 cursor-pointer'
                : 'border-slate-700 cursor-default'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${currentStatus.color}`} />
            <span className="text-sm font-medium text-slate-300">{currentStatus.label}</span>
            {canChangeStatus && <ChevronDown size={14} className="text-slate-500" />}
          </button>

          {showStatusMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowStatusMenu(false)}
              />
              <div className="absolute right-0 top-full mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-lg z-50 min-w-[140px]">
                {STATUS_OPTIONS.map((status) => (
                  <button
                    key={status.value}
                    onClick={() => handleStatusChange(status.value)}
                    className={`w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-slate-700 first:rounded-t-lg last:rounded-b-lg ${
                      status.value === conversation.status ? 'bg-slate-700' : ''
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${status.color}`} />
                    <span className="text-sm text-slate-300">{status.label}</span>
                    {status.value === conversation.status && (
                      <Check size={14} className="ml-auto text-cyan-400" />
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="relative">
          <button
            onClick={() => canAssign && setShowAssignMenu(!showAssignMenu)}
            disabled={!canAssign}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors ${
              canAssign
                ? 'border-slate-600 hover:bg-slate-700 cursor-pointer'
                : 'border-slate-700 cursor-default'
            }`}
          >
            {conversation.assigned_user ? (
              <>
                <div className="w-5 h-5 rounded-full bg-slate-500 flex items-center justify-center text-[10px] font-medium text-white">
                  {getInitials(conversation.assigned_user.name)}
                </div>
                <span className="text-sm text-slate-300">{conversation.assigned_user.name}</span>
              </>
            ) : (
              <>
                <UserPlus size={16} className="text-slate-500" />
                <span className="text-sm text-slate-400">Unassigned</span>
              </>
            )}
            {canAssign && <ChevronDown size={14} className="text-slate-500" />}
          </button>

          {showAssignMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowAssignMenu(false)}
              />
              <div className="absolute right-0 top-full mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-lg z-50 min-w-[200px] max-h-[300px] overflow-y-auto">
                <button
                  onClick={() => handleAssign(null)}
                  className="w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-slate-700 rounded-t-lg"
                >
                  <UserPlus size={16} className="text-slate-500" />
                  <span className="text-sm text-slate-300">Unassign</span>
                </button>
                <div className="border-t border-slate-700" />
                {loadingUsers ? (
                  <div className="px-4 py-3 text-sm text-slate-400">Loading...</div>
                ) : (
                  users.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => handleAssign(u.id)}
                      className={`w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-slate-700 last:rounded-b-lg ${
                        u.id === conversation.assigned_user_id ? 'bg-slate-700' : ''
                      }`}
                    >
                      <div className="w-6 h-6 rounded-full bg-slate-600 flex items-center justify-center text-xs font-medium text-white">
                        {getInitials(u.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-white truncate">{u.name}</div>
                        <div className="text-xs text-slate-400 truncate">{u.email}</div>
                      </div>
                      {u.id === conversation.assigned_user_id && (
                        <Check size={14} className="text-cyan-400" />
                      )}
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        <button
          onClick={onToggleContactPanel}
          className="p-2 rounded-lg hover:bg-slate-700 transition-colors"
          title={showContactPanel ? 'Hide contact panel' : 'Show contact panel'}
        >
          {showContactPanel ? (
            <PanelRightClose size={20} className="text-slate-400" />
          ) : (
            <PanelRight size={20} className="text-slate-400" />
          )}
        </button>
      </div>
    </div>
  );
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);
}
