import { useState, useEffect } from 'react';
import {
  LayoutGrid,
  List,
  Search,
  RefreshCw,
  Filter,
  ChevronRight,
  HardDrive,
  AlertCircle,
  X,
  Unplug,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getConnectionStatus, disconnectDrive, getDriveOAuthUrl } from '../../services/googleDrive';
import { getDriveFiles, getDriveFolders, getFolderPath } from '../../services/driveFiles';
import type { DriveFile, DriveFolder, DriveConnectionStatus } from '../../types';
import FolderTree from '../../components/media/FolderTree';
import FileGrid from '../../components/media/FileGrid';
import FilePreviewPanel from '../../components/media/FilePreviewPanel';
import ConnectDrivePrompt from '../../components/media/ConnectDrivePrompt';

type ViewMode = 'grid' | 'list';
type FileTypeFilter = 'all' | 'images' | 'documents' | 'videos' | 'spreadsheets';

const FILE_TYPE_FILTERS: Record<FileTypeFilter, string[]> = {
  all: [],
  images: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
  documents: [
    'application/pdf',
    'application/vnd.google-apps.document',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'text/plain',
  ],
  videos: ['video/mp4', 'video/webm', 'video/quicktime', 'application/vnd.google-apps.video'],
  spreadsheets: [
    'application/vnd.google-apps.spreadsheet',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
  ],
};

export function MediaStorage() {
  const { user, refreshUser, isSuperAdmin } = useAuth();
  const [connectionStatus, setConnectionStatus] = useState<DriveConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedFolderName, setSelectedFolderName] = useState<string>('All Files');
  const [folderPath, setFolderPath] = useState<DriveFolder[]>([]);

  const [files, setFiles] = useState<DriveFile[]>([]);
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);

  const [selectedFile, setSelectedFile] = useState<DriveFile | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<FileTypeFilter>('all');
  const [showUnavailable, setShowUnavailable] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  const userId = user?.id || '';

  useEffect(() => {
    checkConnection();
  }, [userId]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('drive_connected') === 'true') {
      const url = new URL(window.location.href);
      url.searchParams.delete('drive_connected');
      url.searchParams.delete('email');
      window.history.replaceState({}, '', url.toString());
      refreshUser();
      checkConnection();
    }
  }, []);

  useEffect(() => {
    if (connectionStatus?.connected) {
      loadFilesAndFolders();
    }
  }, [selectedFolderId, connectionStatus?.connected]);

  const checkConnection = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const status = await getConnectionStatus(userId);
      setConnectionStatus(status);
    } catch (err) {
      console.error('Failed to check connection:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = () => {
    setConnecting(true);
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

    if (!clientId || !supabaseUrl) {
      alert('Google Drive integration is not configured. Please contact your administrator.');
      setConnecting(false);
      return;
    }

    const oauthRedirectUri = `${supabaseUrl}/functions/v1/drive-oauth-callback`;
    const appRedirectUri = `${window.location.origin}/media`;

    const state = btoa(
      JSON.stringify({
        user_id: userId,
        redirect_uri: appRedirectUri,
        oauth_redirect_uri: oauthRedirectUri,
      })
    );

    window.location.href = getDriveOAuthUrl(clientId, oauthRedirectUri, state);
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect Google Drive? Your files will remain in Google Drive but will no longer be accessible from the CRM.')) {
      return;
    }
    setDisconnecting(true);
    try {
      await disconnectDrive(userId);
      await refreshUser();
      setConnectionStatus(null);
      setFiles([]);
      setFolders([]);
      setSelectedFile(null);
      await checkConnection();
    } catch (err) {
      console.error('Failed to disconnect Drive:', err);
    } finally {
      setDisconnecting(false);
    }
  };

  const loadFilesAndFolders = async () => {
    setLoadingFiles(true);
    try {
      const [filesData, foldersData] = await Promise.all([
        getDriveFiles(userId, {
          folderId: selectedFolderId,
          showDeleted: false,
          showUnavailable,
        }),
        selectedFolderId
          ? getDriveFolders(userId, selectedFolderId)
          : [],
      ]);
      setFiles(filesData);
      setFolders(foldersData);

      if (selectedFolderId && selectedFolderId !== 'root') {
        const path = await getFolderPath(userId, selectedFolderId);
        setFolderPath(path);
      } else {
        setFolderPath([]);
      }
    } catch (err) {
      console.error('Failed to load files:', err);
    } finally {
      setLoadingFiles(false);
    }
  };

  const handleSelectFolder = (folderId: string | null, folderName: string) => {
    setSelectedFolderId(folderId);
    setSelectedFolderName(folderName);
    setSelectedFile(null);
  };

  const handleRefresh = () => {
    loadFilesAndFolders();
  };

  const filteredFiles = files.filter((file) => {
    if (search && !file.name.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    if (!showUnavailable && (file.is_deleted || file.access_revoked)) {
      return false;
    }
    if (typeFilter !== 'all') {
      const allowedTypes = FILE_TYPE_FILTERS[typeFilter];
      if (!allowedTypes.some((t) => file.mime_type.includes(t) || file.mime_type === t)) {
        return false;
      }
    }
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!connectionStatus?.connected) {
    return (
      <ConnectDrivePrompt
        onConnect={handleConnect}
        loading={connecting}
      />
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">File Manager</h1>
          <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
            <HardDrive className="w-4 h-4" />
            <span>Connected to {connectionStatus.email}</span>
            {connectionStatus.tokenExpired && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs">
                <AlertCircle className="w-3 h-3" />
                Token expired
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={loadingFiles}
            className="p-2 hover:bg-gray-100 rounded-md transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-5 h-5 text-gray-500 ${loadingFiles ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleDisconnect}
            disabled={disconnecting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
            title="Disconnect Google Drive"
          >
            <Unplug className="w-4 h-4" />
            {disconnecting ? 'Disconnecting...' : 'Disconnect'}
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-64 border-r border-gray-200 bg-gray-50 overflow-y-auto">
          <FolderTree
            userId={userId}
            selectedFolderId={selectedFolderId}
            onSelectFolder={handleSelectFolder}
          />
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center gap-4 px-4 py-3 border-b border-gray-200 bg-white">
            <div className="flex items-center gap-1 text-sm text-gray-600">
              <button
                onClick={() => handleSelectFolder(null, 'All Files')}
                className="hover:text-blue-600"
              >
                All Files
              </button>
              {folderPath.map((folder) => (
                <span key={folder.id} className="flex items-center gap-1">
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                  <button
                    onClick={() => handleSelectFolder(folder.drive_folder_id, folder.name)}
                    className="hover:text-blue-600"
                  >
                    {folder.name}
                  </button>
                </span>
              ))}
              {selectedFolderName && selectedFolderId && (
                <span className="flex items-center gap-1">
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                  <span className="font-medium text-gray-900">{selectedFolderName}</span>
                </span>
              )}
            </div>

            <div className="flex-1" />

            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search files..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-64 pl-9 pr-4 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="relative">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`p-2 rounded-md transition-colors ${
                  showFilters || typeFilter !== 'all'
                    ? 'bg-blue-100 text-blue-600'
                    : 'hover:bg-gray-100 text-gray-500'
                }`}
              >
                <Filter className="w-5 h-5" />
              </button>
              {showFilters && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                  <div className="px-3 py-2 border-b border-gray-100">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-500 uppercase">
                        File Type
                      </span>
                      <button
                        onClick={() => setShowFilters(false)}
                        className="p-1 hover:bg-gray-100 rounded"
                      >
                        <X className="w-3 h-3 text-gray-400" />
                      </button>
                    </div>
                  </div>
                  {(['all', 'images', 'documents', 'videos', 'spreadsheets'] as FileTypeFilter[]).map(
                    (type) => (
                      <button
                        key={type}
                        onClick={() => setTypeFilter(type)}
                        className={`w-full px-3 py-1.5 text-left text-sm ${
                          typeFilter === type
                            ? 'bg-blue-50 text-blue-700'
                            : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </button>
                    )
                  )}
                  <div className="border-t border-gray-100 mt-2 pt-2 px-3">
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showUnavailable}
                        onChange={(e) => setShowUnavailable(e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      Show unavailable files
                    </label>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center border border-gray-300 rounded-md">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 ${
                  viewMode === 'grid'
                    ? 'bg-gray-100 text-gray-900'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 ${
                  viewMode === 'list'
                    ? 'bg-gray-100 text-gray-900'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto bg-gray-50">
            <FileGrid
              files={filteredFiles}
              selectedFileId={selectedFile?.id || null}
              onSelectFile={setSelectedFile}
              onOpenFile={(file) => {
                if (file.web_view_link) {
                  window.open(file.web_view_link, '_blank');
                }
              }}
              loading={loadingFiles}
            />
          </div>
        </div>

        {selectedFile && (
          <div className="w-80 flex-shrink-0">
            <FilePreviewPanel
              file={selectedFile}
              onClose={() => setSelectedFile(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
