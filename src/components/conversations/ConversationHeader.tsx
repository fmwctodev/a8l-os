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
    <div className="px-4 py-3 border-b border-gray-200 bg-white flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-medium">
          {getInitials(contactName)}
        </div>
        <div>
          <Link
            to={`/contacts/${conversation.contact_id}`}
            className="font-semibold text-gray-900 hover:text-blue-600 transition-colors"
          >
            {contactName}
          </Link>
          <div className="text-sm text-gray-500">
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
                ? 'border-gray-200 hover:bg-gray-50 cursor-pointer'
                : 'border-gray-100 cursor-default'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${currentStatus.color}`} />
            <span className="text-sm font-medium text-gray-700">{currentStatus.label}</span>
            {canChangeStatus && <ChevronDown size={14} className="text-gray-400" />}
          </button>

          {showStatusMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowStatusMenu(false)}
              />
              <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-[140px]">
                {STATUS_OPTIONS.map((status) => (
                  <button
                    key={status.value}
                    onClick={() => handleStatusChange(status.value)}
                    className={`w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg ${
                      status.value === conversation.status ? 'bg-blue-50' : ''
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${status.color}`} />
                    <span className="text-sm text-gray-700">{status.label}</span>
                    {status.value === conversation.status && (
                      <Check size={14} className="ml-auto text-blue-500" />
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
                ? 'border-gray-200 hover:bg-gray-50 cursor-pointer'
                : 'border-gray-100 cursor-default'
            }`}
          >
            {conversation.assigned_user ? (
              <>
                <div className="w-5 h-5 rounded-full bg-gray-300 flex items-center justify-center text-[10px] font-medium text-gray-700">
                  {getInitials(conversation.assigned_user.name)}
                </div>
                <span className="text-sm text-gray-700">{conversation.assigned_user.name}</span>
              </>
            ) : (
              <>
                <UserPlus size={16} className="text-gray-400" />
                <span className="text-sm text-gray-500">Unassigned</span>
              </>
            )}
            {canAssign && <ChevronDown size={14} className="text-gray-400" />}
          </button>

          {showAssignMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowAssignMenu(false)}
              />
              <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-[200px] max-h-[300px] overflow-y-auto">
                <button
                  onClick={() => handleAssign(null)}
                  className="w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-gray-50 rounded-t-lg"
                >
                  <UserPlus size={16} className="text-gray-400" />
                  <span className="text-sm text-gray-700">Unassign</span>
                </button>
                <div className="border-t border-gray-100" />
                {loadingUsers ? (
                  <div className="px-4 py-3 text-sm text-gray-500">Loading...</div>
                ) : (
                  users.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => handleAssign(u.id)}
                      className={`w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-gray-50 last:rounded-b-lg ${
                        u.id === conversation.assigned_user_id ? 'bg-blue-50' : ''
                      }`}
                    >
                      <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600">
                        {getInitials(u.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-gray-900 truncate">{u.name}</div>
                        <div className="text-xs text-gray-500 truncate">{u.email}</div>
                      </div>
                      {u.id === conversation.assigned_user_id && (
                        <Check size={14} className="text-blue-500" />
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
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          title={showContactPanel ? 'Hide contact panel' : 'Show contact panel'}
        >
          {showContactPanel ? (
            <PanelRightClose size={20} className="text-gray-500" />
          ) : (
            <PanelRight size={20} className="text-gray-500" />
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
