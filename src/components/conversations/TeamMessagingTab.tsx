import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { GoogleChatConnectionPrompt } from './GoogleChatConnectionPrompt';
import { GoogleChatSpacesList } from './GoogleChatSpacesList';
import { GoogleChatMessageThread } from './GoogleChatMessageThread';
import {
  checkConnectionStatus,
  getCachedSpaces,
  syncSpaces,
  getMessages,
  getCachedMessages,
  sendMessage,
  markCachedMessagesAsRead,
  subscribeToMessages,
  type GoogleChatConnectionStatus,
  type GoogleChatSpaceCache,
  type GoogleChatMessageCache,
} from '../../services/googleChat';
import { MessageSquare, Loader2, AlertCircle, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';

export function TeamMessagingTab() {
  const { user } = useAuth();

  const [connectionStatus, setConnectionStatus] = useState<GoogleChatConnectionStatus | null>(null);
  const [checkingConnection, setCheckingConnection] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const [spaces, setSpaces] = useState<GoogleChatSpaceCache[]>([]);
  const [spacesLoading, setSpacesLoading] = useState(false);
  const [spacesRefreshing, setSpacesRefreshing] = useState(false);

  const [selectedSpace, setSelectedSpace] = useState<GoogleChatSpaceCache | null>(null);
  const [messages, setMessages] = useState<GoogleChatMessageCache[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesRefreshing, setMessagesRefreshing] = useState(false);

  const loadConnectionStatus = useCallback(async () => {
    try {
      setCheckingConnection(true);
      setConnectionError(null);
      const status = await checkConnectionStatus();
      setConnectionStatus(status);
    } catch (error) {
      console.error('Failed to check connection:', error);
      setConnectionError('Failed to check connection status');
      setConnectionStatus({ connected: false, email: null, connectedAt: null, scopes: null });
    } finally {
      setCheckingConnection(false);
    }
  }, []);

  const loadSpaces = useCallback(async (showRefreshing = false) => {
    try {
      if (showRefreshing) {
        setSpacesRefreshing(true);
      } else {
        setSpacesLoading(true);
      }

      await syncSpaces();
      const cachedSpaces = await getCachedSpaces();
      setSpaces(cachedSpaces);
    } catch (error: unknown) {
      console.error('Failed to load spaces:', error);
      if (error instanceof Error && error.message === 'NOT_CONNECTED') {
        setConnectionStatus({ connected: false, email: null, connectedAt: null, scopes: null });
      }
    } finally {
      setSpacesLoading(false);
      setSpacesRefreshing(false);
    }
  }, []);

  const loadMessages = useCallback(async (space: GoogleChatSpaceCache, showRefreshing = false) => {
    try {
      if (showRefreshing) {
        setMessagesRefreshing(true);
      } else {
        setMessagesLoading(true);
      }

      await getMessages(space.space_id);
      const cachedMessages = await getCachedMessages(space.id);
      setMessages(cachedMessages);

      await markCachedMessagesAsRead(space.id);

      const updatedSpaces = spaces.map(s =>
        s.id === space.id ? { ...s, unread_count: 0 } : s
      );
      setSpaces(updatedSpaces);
    } catch (error) {
      console.error('Failed to load messages:', error);
    } finally {
      setMessagesLoading(false);
      setMessagesRefreshing(false);
    }
  }, [spaces]);

  const handleSelectSpace = useCallback((space: GoogleChatSpaceCache) => {
    setSelectedSpace(space);
    loadMessages(space);
  }, [loadMessages]);

  const handleSendMessage = useCallback(async (text: string, threadId?: string) => {
    if (!selectedSpace) return;

    await sendMessage(selectedSpace.space_id, text, threadId);

    const cachedMessages = await getCachedMessages(selectedSpace.id);
    setMessages(cachedMessages);
  }, [selectedSpace]);

  const handleRefreshSpaces = useCallback(() => {
    loadSpaces(true);
  }, [loadSpaces]);

  const handleRefreshMessages = useCallback(() => {
    if (selectedSpace) {
      loadMessages(selectedSpace, true);
    }
  }, [selectedSpace, loadMessages]);

  useEffect(() => {
    loadConnectionStatus();
  }, [loadConnectionStatus]);

  useEffect(() => {
    if (connectionStatus?.connected) {
      loadSpaces();
    }
  }, [connectionStatus?.connected, loadSpaces]);

  useEffect(() => {
    if (!user?.id || !connectionStatus?.connected) return;

    const unsubscribe = subscribeToMessages(user.id, (newMessage) => {
      if (selectedSpace && newMessage.space_cache_id === selectedSpace.id) {
        setMessages(prev => {
          const exists = prev.some(m => m.id === newMessage.id);
          if (exists) return prev;
          return [...prev, newMessage];
        });
      }

      setSpaces(prev => prev.map(space => {
        if (space.id === newMessage.space_cache_id) {
          const isCurrentSpace = selectedSpace?.id === space.id;
          return {
            ...space,
            unread_count: isCurrentSpace ? 0 : (space.unread_count || 0) + 1,
          };
        }
        return space;
      }));
    });

    return () => unsubscribe();
  }, [user?.id, connectionStatus?.connected, selectedSpace]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected') === 'true') {
      loadConnectionStatus();
      const newUrl = window.location.pathname + '?tab=team-messaging';
      window.history.replaceState({}, '', newUrl);
    }
  }, [loadConnectionStatus]);

  if (checkingConnection) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-cyan-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Checking connection status...</p>
        </div>
      </div>
    );
  }

  if (connectionError) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-900">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-red-500/20 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <h3 className="text-lg font-medium text-white mb-2">Connection Error</h3>
          <p className="text-slate-400 mb-4">{connectionError}</p>
          <button
            onClick={loadConnectionStatus}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!connectionStatus?.connected) {
    return (
      <div className="flex-1 flex bg-slate-900">
        <GoogleChatConnectionPrompt />
      </div>
    );
  }

  return (
    <div className="flex-1 flex bg-slate-900">
      <div className="w-72 border-r border-slate-700 flex flex-col bg-slate-800">
        <div className="p-3 border-b border-slate-700">
          <div className="flex items-center gap-2 text-sm">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-slate-300 truncate flex-1">
              {connectionStatus.email || 'Connected'}
            </span>
            <Link
              to="/settings/integrations?tab=connected"
              className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              title="Manage connection"
            >
              <Settings size={14} />
            </Link>
          </div>
        </div>

        <GoogleChatSpacesList
          spaces={spaces}
          selectedSpaceId={selectedSpace?.space_id || null}
          loading={spacesLoading}
          onSelectSpace={handleSelectSpace}
          onRefresh={handleRefreshSpaces}
          refreshing={spacesRefreshing}
        />
      </div>

      <div className="flex-1 flex flex-col">
        {selectedSpace ? (
          <GoogleChatMessageThread
            space={selectedSpace}
            messages={messages}
            loading={messagesLoading}
            onSendMessage={handleSendMessage}
            onRefreshMessages={handleRefreshMessages}
            refreshing={messagesRefreshing}
            currentUserEmail={connectionStatus.email}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="w-8 h-8 text-slate-500" />
              </div>
              <h3 className="text-lg font-medium text-white mb-1">
                Select a space
              </h3>
              <p className="text-slate-400">
                Choose a space from the list to view messages
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
