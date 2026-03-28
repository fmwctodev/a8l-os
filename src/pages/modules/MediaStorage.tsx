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
import { useToast } from '../../contexts/ToastContext';
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
  const { showToast } = useToast();
  const [connectionStatus, setConnectionStatus] = useState<DriveConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

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
    setConnectError(null);
    try {
      const authUrl = await initiateDriveOAuth(`${window.location.origin}/media`);
      window.location.href = authUrl;
    } catch (err) {
      console.error('Failed to start Drive OAuth:', err);
      const message = (err as Error).message || 'Failed to connect Google Drive.';
      setConnectError(message);
      showToast('warning', 'Connection Failed', message);
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
        <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!connectionStatus?.connected) {
    return <ConnectDrivePrompt onConnect={handleConnect} loading={connecting} error={connectError} />;
  }

  const showSharedDrivesList = activeTab === 'shared-drives' && !selectedDriveId;

  return (
    <div className="h-full flex flex-col bg-slate-900">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700">
        <div className="px-6 pt-6 pb-0">
          <div className="flex items-center justify-between mb-5">
            <h1 className="text-2xl font-bold text-white">File Manager</h1>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs text-slate-400 mr-2">
                <HardDrive className="w-3.5 h-3.5" />
                <span>{connectionStatus.email}</span>
              </div>
              <button
                onClick={() => activeTab === 'my-drive' ? loadFiles() : (selectedDriveId ? loadFiles() : loadSharedDrives())}
                disabled={loadingFiles || loadingDrives}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                title="Refresh"
              >
                <RefreshCw className={`w-4 h-4 text-slate-400 ${loadingFiles || loadingDrives ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors disabled:opacity-50"
              >
                <Unplug className="w-3.5 h-3.5" />
                {disconnecting ? 'Disconnecting...' : 'Disconnect'}
              </button>
            </div>
          </div>

          <div className="flex gap-1">
            <button
              onClick={() => handleTabChange('my-drive')}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-t-lg text-sm font-medium transition-colors ${
                activeTab === 'my-drive'
                  ? 'bg-slate-900 text-white border-t border-l border-r border-slate-700'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Cloud className="w-4 h-4" />
              My Drive
            </button>
            <button
              onClick={() => handleTabChange('shared-drives')}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-t-lg text-sm font-medium transition-colors ${
                activeTab === 'shared-drives'
                  ? 'bg-slate-900 text-white border-t border-l border-r border-slate-700'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Users className="w-4 h-4" />
              Shared Drives
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="bg-slate-800/50 border-b border-slate-700">
          <div className="flex items-center justify-between px-6 py-3">
            <div className="flex items-center gap-3 flex-1">
              <div className="relative w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search files..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm border border-slate-600 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 bg-slate-900 text-white placeholder-slate-500"
                />
              </div>

              <div className="relative">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`inline-flex items-center gap-2 px-3 py-2 text-sm border rounded-lg transition-colors ${
                    showFilters || typeFilter !== 'all'
                      ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
                      : 'border-slate-600 text-slate-400 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  <Filter className="w-4 h-4" />
                  Filter & sort
                </button>
                {showFilters && (
                  <div className="absolute left-0 top-full mt-2 w-52 bg-slate-800 rounded-xl shadow-xl border border-slate-700 py-2 z-50">
                    <div className="px-3 py-2 border-b border-slate-700 flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">File Type</span>
                      <button onClick={() => setShowFilters(false)} className="p-0.5 hover:bg-slate-700 rounded">
                        <X className="w-3.5 h-3.5 text-slate-400" />
                      </button>
                    </div>
                    {(['all', 'images', 'documents', 'videos', 'spreadsheets'] as FileTypeFilter[]).map((type) => (
                      <button
                        key={type}
                        onClick={() => { setTypeFilter(type); setShowFilters(false); }}
                        className={`w-full px-3 py-2 text-left text-sm transition-colors ${
                          typeFilter === type ? 'bg-cyan-500/10 text-cyan-400 font-medium' : 'text-slate-300 hover:bg-slate-700'
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
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border border-slate-600 text-slate-300 rounded-lg hover:bg-slate-700 hover:text-white transition-colors"
                  >
                    <FolderPlus className="w-4 h-4" />
                    Create Folder
                  </button>
                  <button
                    onClick={() => setShowUpload(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-500 rounded-lg transition-colors"
                  >
                    <Upload className="w-4 h-4" />
                    Upload Files
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Breadcrumbs */}
        <div className="px-6 py-3">
          <div className="flex items-center gap-1 text-sm">
            <button
              onClick={() => navigateToBreadcrumb(-1)}
              className="text-slate-400 hover:text-white font-medium transition-colors"
            >
              Home
            </button>
            {breadcrumbs.map((crumb, index) => (
              <span key={crumb.id} className="flex items-center gap-1">
                <ChevronRight className="w-4 h-4 text-slate-600" />
                {index === breadcrumbs.length - 1 ? (
                  <span className="font-medium text-white">{crumb.name}</span>
                ) : (
                  <button
                    onClick={() => navigateToBreadcrumb(index)}
                    className="text-slate-400 hover:text-white font-medium transition-colors"
                  >
                    {crumb.name}
                  </button>
                )}
              </span>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {showSharedDrivesList ? (
            <SharedDrivesList
              drives={sharedDrives}
              loading={loadingDrives}
              onSelect={handleSelectSharedDrive}
            />
          ) : loadingFiles ? (
            <div>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Files</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="bg-slate-700 rounded-xl h-48" />
                  </div>
                ))}
              </div>
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Folder className="w-16 h-16 mb-4 text-slate-600" />
              <p className="text-lg font-medium text-slate-400">No files found</p>
              <p className="text-sm mt-1 text-slate-500">
                {search ? 'Try a different search term' : 'This folder is empty'}
              </p>
            </div>
          ) : (
            <div>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Files</h3>
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
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Shared Drives</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="bg-slate-700 rounded-xl h-36" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (drives.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Users className="w-16 h-16 mb-4 text-slate-600" />
        <p className="text-lg font-medium text-slate-400">No shared drives</p>
        <p className="text-sm mt-1 text-slate-500">You don't have access to any shared drives</p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Shared Drives</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {drives.map((drive) => (
          <button
            key={drive.id}
            onClick={() => onSelect(drive)}
            className="group bg-slate-800 rounded-xl border border-slate-700 hover:border-slate-500 hover:bg-slate-700 transition-all text-left overflow-hidden"
          >
            <div className="h-28 bg-slate-700/50 flex items-center justify-center">
              <HardDrive className="w-10 h-10 text-slate-500 group-hover:text-slate-300 transition-colors" />
            </div>
            <div className="px-3 py-3">
              <h4 className="text-sm font-medium text-white truncate">{drive.name}</h4>
              <p className="text-xs text-slate-500 mt-0.5">Shared Drive</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
