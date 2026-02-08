import { useState, useEffect, useCallback } from 'react';
import {
  Search,
  RefreshCw,
  Filter,
  ChevronRight,
  Cloud,
  Users,
  Upload,
  FolderPlus,
  Folder,
  Unplug,
  HardDrive,
  X,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  getConnectionStatus,
  disconnectDrive,
  initiateDriveOAuth,
  listDriveFilesViaApi,
  listSharedDrives,
  deleteDriveFileViaApi,
  downloadDriveFile,
  isFolder,
} from '../../services/googleDrive';
import type { GoogleDriveFileInfo, SharedDriveInfo } from '../../services/googleDrive';
import type { DriveConnectionStatus } from '../../types';
import ConnectDrivePrompt from '../../components/media/ConnectDrivePrompt';
import FileCard from '../../components/media/FileCard';
import ShareFileModal from '../../components/media/ShareFileModal';
import UploadFilesModal from '../../components/media/UploadFilesModal';
import CreateFolderModal from '../../components/media/CreateFolderModal';

type ActiveTab = 'my-drive' | 'shared-drives';
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

interface BreadcrumbItem {
  id: string;
  name: string;
}

export function MediaStorage() {
  const { user, refreshUser } = useAuth();
  const [connectionStatus, setConnectionStatus] = useState<DriveConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const [activeTab, setActiveTab] = useState<ActiveTab>('my-drive');
  const [files, setFiles] = useState<GoogleDriveFileInfo[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<FileTypeFilter>('all');
  const [showFilters, setShowFilters] = useState(false);

  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string>('root');

  const [sharedDrives, setSharedDrives] = useState<SharedDriveInfo[]>([]);
  const [selectedDriveId, setSelectedDriveId] = useState<string | undefined>(undefined);
  const [loadingDrives, setLoadingDrives] = useState(false);

  const [shareFile, setShareFile] = useState<GoogleDriveFileInfo | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [showCreateFolder, setShowCreateFolder] = useState(false);

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
      if (activeTab === 'my-drive') {
        loadFiles();
      } else {
        if (!selectedDriveId) {
          loadSharedDrives();
        } else {
          loadFiles();
        }
      }
    }
  }, [connectionStatus?.connected, activeTab, currentFolderId, selectedDriveId]);

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

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const authUrl = await initiateDriveOAuth(`${window.location.origin}/media`);
      window.location.href = authUrl;
    } catch (err) {
      console.error('Failed to start Drive OAuth:', err);
      alert((err as Error).message || 'Failed to connect Google Drive.');
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Disconnect Google Drive? Your files will remain in Google Drive but won\'t be accessible from the CRM.')) return;
    setDisconnecting(true);
    try {
      await disconnectDrive(userId);
      await refreshUser();
      setConnectionStatus(null);
      setFiles([]);
      setSharedDrives([]);
      await checkConnection();
    } catch (err) {
      console.error('Failed to disconnect Drive:', err);
    } finally {
      setDisconnecting(false);
    }
  };

  const loadFiles = useCallback(async () => {
    setLoadingFiles(true);
    try {
      const result = await listDriveFilesViaApi(currentFolderId, undefined, selectedDriveId);
      setFiles(result.files);
    } catch (err) {
      console.error('Failed to load files:', err);
    } finally {
      setLoadingFiles(false);
    }
  }, [currentFolderId, selectedDriveId]);

  const loadSharedDrives = async () => {
    setLoadingDrives(true);
    try {
      const drives = await listSharedDrives();
      setSharedDrives(drives);
    } catch (err) {
      console.error('Failed to load shared drives:', err);
    } finally {
      setLoadingDrives(false);
    }
  };

  const navigateToFolder = (folderId: string, folderName: string) => {
    setBreadcrumbs((prev) => [...prev, { id: folderId, name: folderName }]);
    setCurrentFolderId(folderId);
  };

  const navigateToBreadcrumb = (index: number) => {
    if (index === -1) {
      setBreadcrumbs([]);
      setCurrentFolderId('root');
      if (activeTab === 'shared-drives') {
        setSelectedDriveId(undefined);
      }
    } else {
      const crumb = breadcrumbs[index];
      setBreadcrumbs(breadcrumbs.slice(0, index + 1));
      setCurrentFolderId(crumb.id);
    }
  };

  const handleTabChange = (tab: ActiveTab) => {
    setActiveTab(tab);
    setFiles([]);
    setBreadcrumbs([]);
    setCurrentFolderId('root');
    setSelectedDriveId(undefined);
    setSearch('');
    setTypeFilter('all');
  };

  const handleSelectSharedDrive = (drive: SharedDriveInfo) => {
    setSelectedDriveId(drive.id);
    setCurrentFolderId(drive.id);
    setBreadcrumbs([{ id: drive.id, name: drive.name }]);
  };

  const handleOpenFile = (file: GoogleDriveFileInfo) => {
    if (file.webViewLink) {
      window.open(file.webViewLink, '_blank');
    }
  };

  const handleDownloadFile = async (file: GoogleDriveFileInfo) => {
    try {
      await downloadDriveFile(file.id, file.name);
    } catch (err) {
      console.error('Download failed:', err);
      alert('Failed to download file. It may be a Google Workspace file - try opening in Drive instead.');
    }
  };

  const handleDeleteFile = async (file: GoogleDriveFileInfo) => {
    const label = isFolder(file.mimeType) ? 'folder' : 'file';
    if (!confirm(`Delete this ${label}? It will be permanently removed from Google Drive.`)) return;
    try {
      await deleteDriveFileViaApi(file.id);
      loadFiles();
    } catch (err) {
      console.error('Delete failed:', err);
      alert('Failed to delete. You may not have permission.');
    }
  };

  const filteredFiles = files.filter((file) => {
    if (search && !file.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (typeFilter !== 'all') {
      const allowed = FILE_TYPE_FILTERS[typeFilter];
      if (!allowed.some((t) => file.mimeType.includes(t) || file.mimeType === t)) return false;
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
    return <ConnectDrivePrompt onConnect={handleConnect} loading={connecting} />;
  }

  const showSharedDrivesList = activeTab === 'shared-drives' && !selectedDriveId;

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 pt-6 pb-0">
          <div className="flex items-center justify-between mb-5">
            <h1 className="text-2xl font-bold text-gray-900">File Manager</h1>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs text-gray-400 mr-2">
                <HardDrive className="w-3.5 h-3.5" />
                <span>{connectionStatus.email}</span>
              </div>
              <button
                onClick={() => activeTab === 'my-drive' ? loadFiles() : (selectedDriveId ? loadFiles() : loadSharedDrives())}
                disabled={loadingFiles || loadingDrives}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Refresh"
              >
                <RefreshCw className={`w-4 h-4 text-gray-500 ${loadingFiles || loadingDrives ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
              >
                <Unplug className="w-3.5 h-3.5" />
                {disconnecting ? 'Disconnecting...' : 'Disconnect'}
              </button>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => handleTabChange('my-drive')}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-t-lg text-sm font-medium transition-colors ${
                activeTab === 'my-drive'
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <Cloud className="w-4 h-4" />
              My Drive
            </button>
            <button
              onClick={() => handleTabChange('shared-drives')}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-t-lg text-sm font-medium transition-colors ${
                activeTab === 'shared-drives'
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <Users className="w-4 h-4" />
              Shared Drives
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-white border-b border-gray-200">
          <div className="flex items-center justify-between px-6 py-3">
            <div className="flex items-center gap-3 flex-1">
              <div className="relative w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search files..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50"
                />
              </div>

              <div className="relative">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`inline-flex items-center gap-2 px-3 py-2 text-sm border rounded-lg transition-colors ${
                    showFilters || typeFilter !== 'all'
                      ? 'bg-blue-50 border-blue-200 text-blue-700'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Filter className="w-4 h-4" />
                  Filter & sort
                </button>
                {showFilters && (
                  <div className="absolute left-0 top-full mt-2 w-52 bg-white rounded-xl shadow-xl border border-gray-200 py-2 z-50">
                    <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">File Type</span>
                      <button onClick={() => setShowFilters(false)} className="p-0.5 hover:bg-gray-100 rounded">
                        <X className="w-3.5 h-3.5 text-gray-400" />
                      </button>
                    </div>
                    {(['all', 'images', 'documents', 'videos', 'spreadsheets'] as FileTypeFilter[]).map((type) => (
                      <button
                        key={type}
                        onClick={() => { setTypeFilter(type); setShowFilters(false); }}
                        className={`w-full px-3 py-2 text-left text-sm transition-colors ${
                          typeFilter === type ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {!showSharedDrivesList && (
                <>
                  <button
                    onClick={() => setShowCreateFolder(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <FolderPlus className="w-4 h-4 text-gray-500" />
                    Create Folder
                  </button>
                  <button
                    onClick={() => setShowUpload(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                  >
                    <Upload className="w-4 h-4" />
                    Upload Files
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="px-6 py-3">
          <div className="flex items-center gap-1 text-sm">
            <button
              onClick={() => navigateToBreadcrumb(-1)}
              className="text-gray-500 hover:text-gray-900 font-medium transition-colors"
            >
              Home
            </button>
            {breadcrumbs.map((crumb, index) => (
              <span key={crumb.id} className="flex items-center gap-1">
                <ChevronRight className="w-4 h-4 text-gray-300" />
                {index === breadcrumbs.length - 1 ? (
                  <span className="font-medium text-gray-900">{crumb.name}</span>
                ) : (
                  <button
                    onClick={() => navigateToBreadcrumb(index)}
                    className="text-gray-500 hover:text-gray-900 font-medium transition-colors"
                  >
                    {crumb.name}
                  </button>
                )}
              </span>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {showSharedDrivesList ? (
            <SharedDrivesList
              drives={sharedDrives}
              loading={loadingDrives}
              onSelect={handleSelectSharedDrive}
            />
          ) : loadingFiles ? (
            <div>
              <h3 className="text-sm font-semibold text-gray-500 mb-4">Files</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="bg-gray-200 rounded-xl h-48" />
                  </div>
                ))}
              </div>
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <Folder className="w-16 h-16 mb-4 text-gray-300" />
              <p className="text-lg font-medium text-gray-500">No files found</p>
              <p className="text-sm mt-1">
                {search ? 'Try a different search term' : 'This folder is empty'}
              </p>
            </div>
          ) : (
            <div>
              <h3 className="text-sm font-semibold text-gray-500 mb-4">Files</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {filteredFiles.map((file) => (
                  <FileCard
                    key={file.id}
                    file={file}
                    onOpen={handleOpenFile}
                    onDownload={handleDownloadFile}
                    onShare={(f) => setShareFile(f)}
                    onDelete={handleDeleteFile}
                    onNavigateFolder={navigateToFolder}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {shareFile && (
        <ShareFileModal
          file={shareFile}
          isOpen={true}
          onClose={() => setShareFile(null)}
        />
      )}

      <UploadFilesModal
        isOpen={showUpload}
        onClose={() => setShowUpload(false)}
        parentId={currentFolderId}
        driveId={selectedDriveId}
        onUploadComplete={loadFiles}
      />

      <CreateFolderModal
        isOpen={showCreateFolder}
        onClose={() => setShowCreateFolder(false)}
        parentId={currentFolderId}
        driveId={selectedDriveId}
        onCreated={loadFiles}
      />
    </div>
  );
}

function SharedDrivesList({
  drives,
  loading,
  onSelect,
}: {
  drives: SharedDriveInfo[];
  loading: boolean;
  onSelect: (drive: SharedDriveInfo) => void;
}) {
  if (loading) {
    return (
      <div>
        <h3 className="text-sm font-semibold text-gray-500 mb-4">Shared Drives</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="bg-gray-200 rounded-xl h-36" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (drives.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <Users className="w-16 h-16 mb-4 text-gray-300" />
        <p className="text-lg font-medium text-gray-500">No shared drives</p>
        <p className="text-sm mt-1">You don't have access to any shared drives</p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-500 mb-4">Shared Drives</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {drives.map((drive) => (
          <button
            key={drive.id}
            onClick={() => onSelect(drive)}
            className="group bg-white rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all text-left overflow-hidden"
          >
            <div className="h-28 bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center">
              <HardDrive className="w-10 h-10 text-gray-400 group-hover:text-gray-500 transition-colors" />
            </div>
            <div className="px-3 py-3">
              <h4 className="text-sm font-medium text-gray-900 truncate">{drive.name}</h4>
              <p className="text-xs text-gray-400 mt-0.5">Shared Drive</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
