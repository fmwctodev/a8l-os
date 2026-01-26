import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ConversationList } from '../../components/conversations/ConversationList';
import { MessageThread } from '../../components/conversations/MessageThread';
import { ContactPanel } from '../../components/conversations/ContactPanel';
import { ConversationFilters } from '../../components/conversations/ConversationFilters';
import { TeamMessagingTab } from '../../components/conversations/TeamMessagingTab';
import { NewConversationModal } from '../../components/conversations/NewConversationModal';
import { getConversations, getConversationById, markConversationAsRead, findOrCreateConversation } from '../../services/conversations';
import type { Conversation, ConversationFilters as FilterType } from '../../types';
import { MessageSquare, Filter, Users, Inbox, Plus } from 'lucide-react';

type ConversationTabType = 'inbox' | 'team-messaging';

export function Conversations() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();

  const tabParam = searchParams.get('tab') as ConversationTabType | null;
  const [activeTab, setActiveTab] = useState<ConversationTabType>(tabParam === 'team-messaging' ? 'team-messaging' : 'inbox');

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);

  const [filters, setFilters] = useState<FilterType>({});
  const [showFilters, setShowFilters] = useState(false);
  const [showContactPanel, setShowContactPanel] = useState(true);
  const [showNewConversationModal, setShowNewConversationModal] = useState(false);
  const [creatingConversation, setCreatingConversation] = useState(false);

  const handleTabChange = (tab: ConversationTabType) => {
    setActiveTab(tab);
    if (tab === 'team-messaging') {
      setSearchParams({ tab: 'team-messaging' });
    } else {
      setSearchParams({});
    }
  };

  const loadConversations = useCallback(async () => {
    if (!user?.organization_id) return;

    try {
      setLoading(true);
      const { data, count } = await getConversations(user.organization_id, filters, page);
      setConversations(data);
      setTotalCount(count);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.organization_id, filters, page]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    async function loadSelectedConversation() {
      if (conversationId) {
        try {
          const conv = await getConversationById(conversationId);
          setSelectedConversation(conv);
          if (conv && conv.unread_count > 0) {
            await markConversationAsRead(conversationId);
            loadConversations();
          }
        } catch (error) {
          console.error('Failed to load conversation:', error);
        }
      } else {
        setSelectedConversation(null);
      }
    }
    loadSelectedConversation();
  }, [conversationId, loadConversations]);

  const handleSelectConversation = (conv: Conversation) => {
    navigate(`/conversations/${conv.id}`);
  };

  const handleFilterChange = (newFilters: FilterType) => {
    setFilters(newFilters);
    setPage(1);
  };

  const handleQuickFilter = (type: 'all' | 'unread' | 'mine') => {
    switch (type) {
      case 'all':
        setFilters({});
        break;
      case 'unread':
        setFilters({ unreadOnly: true });
        break;
      case 'mine':
        setFilters({ assignedUserId: user?.id });
        break;
    }
    setPage(1);
  };

  const activeFilterCount = Object.keys(filters).filter(
    (key) => filters[key as keyof FilterType] !== undefined && filters[key as keyof FilterType] !== null
  ).length;

  const handleCreateConversation = async (contactId: string) => {
    if (!user?.organization_id) return;

    try {
      setCreatingConversation(true);
      const conversation = await findOrCreateConversation(
        user.organization_id,
        contactId,
        user.department_id
      );

      await loadConversations();
      navigate(`/conversations/${conversation.id}`);
    } catch (error) {
      console.error('Failed to create conversation:', error);
    } finally {
      setCreatingConversation(false);
    }
  };

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col bg-slate-900 relative isolate">
      <div className="border-b border-slate-700 bg-slate-800 px-4">
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleTabChange('inbox')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'inbox'
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            <Inbox size={18} />
            Customer Inbox
          </button>
          <button
            onClick={() => handleTabChange('team-messaging')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'team-messaging'
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            <Users size={18} />
            Team Messaging
          </button>
        </div>
      </div>

      {activeTab === 'team-messaging' ? (
        <TeamMessagingTab />
      ) : (
        <div className="flex-1 flex">
          <div className="w-80 border-r border-slate-700 flex flex-col bg-slate-800">
            <div className="p-4 border-b border-slate-700">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-white">Conversations</h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowNewConversationModal(true)}
                    className="p-2 rounded-lg hover:bg-cyan-500/20 text-cyan-400 transition-colors"
                    title="New conversation"
                  >
                    <Plus size={18} />
                  </button>
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className={`p-2 rounded-lg transition-colors ${
                      showFilters || activeFilterCount > 0
                        ? 'bg-cyan-500/20 text-cyan-400'
                        : 'hover:bg-slate-700 text-slate-400'
                    }`}
                  >
                    <Filter size={18} />
                    {activeFilterCount > 0 && (
                      <span className="ml-1 text-xs font-medium">{activeFilterCount}</span>
                    )}
                  </button>
                </div>
              </div>

              <div className="flex gap-1">
                <button
                  onClick={() => handleQuickFilter('all')}
                  className={`flex-1 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    Object.keys(filters).length === 0
                      ? 'bg-slate-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => handleQuickFilter('unread')}
                  className={`flex-1 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    filters.unreadOnly
                      ? 'bg-slate-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  Unread
                </button>
                <button
                  onClick={() => handleQuickFilter('mine')}
                  className={`flex-1 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    filters.assignedUserId === user?.id
                      ? 'bg-slate-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  Mine
                </button>
              </div>
            </div>

            {showFilters && (
              <ConversationFilters
                filters={filters}
                onChange={handleFilterChange}
                onClose={() => setShowFilters(false)}
              />
            )}

            <ConversationList
              conversations={conversations}
              selectedId={conversationId}
              loading={loading}
              onSelect={handleSelectConversation}
              totalCount={totalCount}
              page={page}
              onPageChange={setPage}
            />
          </div>

          <div className="flex-1 flex flex-col bg-slate-900">
            {selectedConversation ? (
              <MessageThread
                conversation={selectedConversation}
                onConversationUpdate={loadConversations}
                onToggleContactPanel={() => setShowContactPanel(!showContactPanel)}
                showContactPanel={showContactPanel}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4">
                    <MessageSquare className="w-8 h-8 text-slate-500" />
                  </div>
                  <h3 className="text-lg font-medium text-white mb-1">
                    Select a conversation
                  </h3>
                  <p className="text-slate-400">
                    Choose a conversation from the list to view messages
                  </p>
                </div>
              </div>
            )}
          </div>

          {selectedConversation && showContactPanel && (
            <div className="w-80 border-l border-slate-700 bg-slate-800 overflow-y-auto">
              <ContactPanel
                conversation={selectedConversation}
                onClose={() => setShowContactPanel(false)}
              />
            </div>
          )}
        </div>
      )}

      {showNewConversationModal && (
        <NewConversationModal
          onClose={() => setShowNewConversationModal(false)}
          onSelectContact={handleCreateConversation}
        />
      )}
    </div>
  );
}
