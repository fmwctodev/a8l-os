import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ConversationList } from '../../components/conversations/ConversationList';
import { MessageThread } from '../../components/conversations/MessageThread';
import { ContactPanel } from '../../components/conversations/ContactPanel';
import { ConversationFilters } from '../../components/conversations/ConversationFilters';
import { getConversations, getConversationById, markConversationAsRead } from '../../services/conversations';
import type { Conversation, ConversationFilters as FilterType, ConversationStatus, MessageChannel } from '../../types';
import { MessageSquare, Filter, X, PanelRightClose, PanelRight } from 'lucide-react';

export function Conversations() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);

  const [filters, setFilters] = useState<FilterType>({});
  const [showFilters, setShowFilters] = useState(false);
  const [showContactPanel, setShowContactPanel] = useState(true);

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

  return (
    <div className="h-[calc(100vh-64px)] flex">
      <div className="w-80 border-r border-gray-200 flex flex-col bg-white">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">Conversations</h2>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2 rounded-lg transition-colors ${
                showFilters || activeFilterCount > 0
                  ? 'bg-blue-100 text-blue-600'
                  : 'hover:bg-gray-100 text-gray-500'
              }`}
            >
              <Filter size={18} />
              {activeFilterCount > 0 && (
                <span className="ml-1 text-xs font-medium">{activeFilterCount}</span>
              )}
            </button>
          </div>

          <div className="flex gap-1">
            <button
              onClick={() => handleQuickFilter('all')}
              className={`flex-1 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                Object.keys(filters).length === 0
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              All
            </button>
            <button
              onClick={() => handleQuickFilter('unread')}
              className={`flex-1 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                filters.unreadOnly
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Unread
            </button>
            <button
              onClick={() => handleQuickFilter('mine')}
              className={`flex-1 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                filters.assignedUserId === user?.id
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
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

      <div className="flex-1 flex flex-col bg-gray-50">
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
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-1">
                Select a conversation
              </h3>
              <p className="text-gray-500">
                Choose a conversation from the list to view messages
              </p>
            </div>
          </div>
        )}
      </div>

      {selectedConversation && showContactPanel && (
        <div className="w-80 border-l border-gray-200 bg-white overflow-y-auto">
          <ContactPanel
            conversation={selectedConversation}
            onClose={() => setShowContactPanel(false)}
          />
        </div>
      )}
    </div>
  );
}
