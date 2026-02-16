import { useState, useEffect, useCallback, useRef } from 'react';
import {
  X,
  Search,
  Paperclip,
  File,
  FileText,
  FileImage,
  FileSpreadsheet,
  Folder,
  Check,
  AlertCircle,
  ChevronRight,
  HardDrive,
  Users,
  Loader2,
} from 'lucide-react';
import type { FileAttachmentEntityType } from '../../types';
import type { GoogleDriveFileInfo } from '../../services/googleDrive';
import {
  listDriveFilesViaApi,
  listSharedWithMeViaApi,
  searchDriveFilesViaApi,
  getConnectionStatus,
  formatFileSize,
  getFileTypeCategory,
  isFolder,
} from '../../services/googleDrive';
import { upsertDriveFile } from '../../services/driveFiles';
import { attachFile } from '../../services/fileAttachments';
import { useAuth } from '../../contexts/AuthContext';

interface AttachFileModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: FileAttachmentEntityType;
  entityId: string;
  organizationId: string;
  onAttached: () => void;
}

type TabId = 'my-drive' | 'shared';

interface BreadcrumbItem {
  id: string;
  name: string;
}

function getFileIcon(mimeType: string) {
  const category = getFileTypeCategory(mimeType);
  switch (category) {
    case 'image': return FileImage;
    case 'spreadsheet': return FileSpreadsheet;
    case 'document':
    case 'pdf': return FileText;
    default: return File;
  }
}

function getFileIconColor(mimeType: string): string {
  const category = getFileTypeCategory(mimeType);
  switch (category) {
    case 'image': return 'text-emerald-400';
    case 'spreadsheet': return 'text-green-400';
    case 'pdf': return 'text-red-400';
    case 'document': return 'text-blue-400';
    case 'presentation': return 'text-orange-400';
    case 'video': return 'text-pink-400';
    case 'audio': return 'text-cyan-400';
    default: return 'text-gray-400';
  }
}

export default function AttachFileModal({
  isOpen,
  onClose,
  entityType,
  entityId,
  organizationId,
  onAttached,
}: AttachFileModalProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('my-drive');
  const [files, setFiles] = useState<GoogleDriveFileInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<Map<string, GoogleDriveFileInfo>>(new Map());
  const [attaching, setAttaching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [nextPageToken, setNextPageToken] = useState<string | undefined>();
  const [loadingMore, setLoadingMore] = useState(false);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([]);
  const [driveConnected, setDriveConnected] = useState<boolean | null>(null);
  const [checkingConnection, setCheckingConnection] = useState(true);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (isOpen) {
      setSelectedFiles(new Map());
      setNote('');
      setError(null);
      setSearch('');
      setDebouncedSearch('');
      setBreadcrumbs([]);
      setActiveTab('my-drive');
      checkConnection();
    }
  }, [isOpen]);

  useEffect(() => {
    if (driveConnected && isOpen) {
      loadFiles();
    }
  }, [activeTab, debouncedSearch, driveConnected, isOpen]);

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(search);
    }, 400);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [search]);

  const checkConnection = async () => {
    if (!user) return;
    setCheckingConnection(true);
    try {
      const status = await getConnectionStatus(user.id);
      setDriveConnected(status.connected && !status.tokenExpired);
    } catch {
      setDriveConnected(false);
    } finally {
      setCheckingConnection(false);
    }
  };

  const loadFiles = async () => {
    setLoading(true);
    setError(null);
    setFiles([]);
    setNextPageToken(undefined);

    try {
      if (debouncedSearch) {
        const results = await searchDriveFilesViaApi(debouncedSearch);
        setFiles(results);
        setNextPageToken(undefined);
      } else if (activeTab === 'my-drive') {
        const folderId = breadcrumbs.length > 0
          ? breadcrumbs[breadcrumbs.length - 1].id
          : 'root';
        const result = await listDriveFilesViaApi(folderId);
        setFiles(result.files);
        setNextPageToken(result.nextPageToken);
      } else {
        const result = await listSharedWithMeViaApi();
        setFiles(result.files);
        setNextPageToken(result.nextPageToken);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load files';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMore = async () => {
    if (!nextPageToken || loadingMore) return;
    setLoadingMore(true);
    try {
      let result: { files: GoogleDriveFileInfo[]; nextPageToken?: string };
      if (activeTab === 'my-drive') {
        const folderId = breadcrumbs.length > 0
          ? breadcrumbs[breadcrumbs.length - 1].id
          : 'root';
        result = await listDriveFilesViaApi(folderId, nextPageToken);
      } else {
        result = await listSharedWithMeViaApi(nextPageToken);
      }
      setFiles((prev) => [...prev, ...result.files]);
      setNextPageToken(result.nextPageToken);
    } catch (err) {
      console.error('Failed to load more files:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  const navigateToFolder = useCallback((folder: GoogleDriveFileInfo) => {
    setBreadcrumbs((prev) => [...prev, { id: folder.id, name: folder.name }]);
    setSearch('');
    setDebouncedSearch('');
  }, []);

  const navigateToBreadcrumb = useCallback((index: number) => {
    if (index < 0) {
      setBreadcrumbs([]);
    } else {
      setBreadcrumbs((prev) => prev.slice(0, index + 1));
    }
    setSearch('');
    setDebouncedSearch('');
  }, []);

  useEffect(() => {
    if (driveConnected && isOpen && !debouncedSearch) {
      loadFiles();
    }
  }, [breadcrumbs]);

  const toggleFile = (file: GoogleDriveFileInfo) => {
    if (isFolder(file.mimeType)) {
      navigateToFolder(file);
      return;
    }
    const newSelected = new Map(selectedFiles);
    if (newSelected.has(file.id)) {
      newSelected.delete(file.id);
    } else {
      newSelected.set(file.id, file);
    }
    setSelectedFiles(newSelected);
  };

  const handleAttach = async () => {
    if (selectedFiles.size === 0 || !user) return;

    setAttaching(true);
    setError(null);

    try {
      for (const [, file] of selectedFiles) {
        const driveFile = await upsertDriveFile(user.id, organizationId, file);
        await attachFile(
          organizationId,
          driveFile.id,
          entityType,
          entityId,
          user.id,
          note || undefined
        );
      }
      onAttached();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to attach files';
      setError(msg);
    } finally {
      setAttaching(false);
    }
  };

  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab);
    setBreadcrumbs([]);
    setSearch('');
    setDebouncedSearch('');
  };

  if (!isOpen) return null;

  const isSearching = debouncedSearch.length > 0;
  const displayFiles = files.filter((f) => !isSearching || !isFolder(f.mimeType));

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
        <div
          className="fixed inset-0 bg-black/60 transition-opacity"
          onClick={onClose}
        />

        <div className="relative inline-block w-full max-w-2xl my-8 overflow-hidden text-left align-middle transition-all transform bg-gray-900 shadow-2xl rounded-xl border border-gray-700/50">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700/50">
            <h3 className="text-lg font-semibold text-gray-100">Attach Files</h3>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          <div className="p-5">
            {checkingConnection ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
              </div>
            ) : !driveConnected ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-14 h-14 bg-gray-800 rounded-full flex items-center justify-center mb-4">
                  <HardDrive className="w-7 h-7 text-gray-500" />
                </div>
                <p className="text-gray-300 font-medium mb-1">Google Drive not connected</p>
                <p className="text-sm text-gray-500 mb-4">
                  Connect your Google Drive in Settings to browse and attach files
                </p>
                <a
                  href="/settings/integrations"
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-400 bg-blue-500/10 rounded-lg hover:bg-blue-500/20 transition-colors"
                >
                  <HardDrive className="w-4 h-4" />
                  Go to Settings
                </a>
              </div>
            ) : (
              <>
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    placeholder="Search all files..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 placeholder-gray-500 focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40 transition-colors text-sm"
                  />
                </div>

                {!isSearching && (
                  <div className="flex gap-1 mb-4">
                    <button
                      onClick={() => handleTabChange('my-drive')}
                      className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                        activeTab === 'my-drive'
                          ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                          : 'text-gray-400 hover:bg-gray-800 border border-transparent'
                      }`}
                    >
                      <HardDrive className="w-4 h-4" />
                      My Drive
                    </button>
                    <button
                      onClick={() => handleTabChange('shared')}
                      className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                        activeTab === 'shared'
                          ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                          : 'text-gray-400 hover:bg-gray-800 border border-transparent'
                      }`}
                    >
                      <Users className="w-4 h-4" />
                      Shared Files
                    </button>
                  </div>
                )}

                {isSearching && (
                  <div className="mb-3">
                    <p className="text-xs text-gray-500">
                      Searching all of Google Drive for "{debouncedSearch}"
                    </p>
                  </div>
                )}

                {!isSearching && activeTab === 'my-drive' && (
                  <div className="flex items-center gap-1 mb-3 text-sm overflow-x-auto">
                    <button
                      onClick={() => navigateToBreadcrumb(-1)}
                      className={`flex-shrink-0 px-1.5 py-0.5 rounded transition-colors ${
                        breadcrumbs.length === 0
                          ? 'text-gray-300 font-medium'
                          : 'text-gray-500 hover:text-gray-300'
                      }`}
                    >
                      My Drive
                    </button>
                    {breadcrumbs.map((crumb, i) => (
                      <div key={crumb.id} className="flex items-center gap-1 flex-shrink-0">
                        <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
                        <button
                          onClick={() => navigateToBreadcrumb(i)}
                          className={`px-1.5 py-0.5 rounded transition-colors truncate max-w-[140px] ${
                            i === breadcrumbs.length - 1
                              ? 'text-gray-300 font-medium'
                              : 'text-gray-500 hover:text-gray-300'
                          }`}
                          title={crumb.name}
                        >
                          {crumb.name}
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {error && (
                  <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-400">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span className="text-sm">{error}</span>
                  </div>
                )}

                <div className="border border-gray-700/50 rounded-lg max-h-80 overflow-y-auto bg-gray-800/50">
                  {loading ? (
                    <div className="p-10 text-center">
                      <Loader2 className="w-6 h-6 text-blue-400 animate-spin mx-auto" />
                      <p className="text-sm text-gray-500 mt-3">Loading files...</p>
                    </div>
                  ) : displayFiles.length === 0 ? (
                    <div className="p-10 text-center">
                      <Folder className="w-10 h-10 mx-auto text-gray-600 mb-2" />
                      <p className="text-gray-400 font-medium">
                        {isSearching ? 'No results found' : 'No files found'}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        {isSearching
                          ? 'Try a different search term'
                          : activeTab === 'my-drive'
                            ? 'This folder is empty'
                            : 'No files have been shared with you'
                        }
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-700/40">
                      {displayFiles.map((file) => {
                        const isFolderItem = isFolder(file.mimeType);
                        const isSelected = selectedFiles.has(file.id);
                        const Icon = isFolderItem ? Folder : getFileIcon(file.mimeType);
                        const iconColor = isFolderItem ? 'text-blue-400' : getFileIconColor(file.mimeType);

                        return (
                          <div
                            key={file.id}
                            onClick={() => toggleFile(file)}
                            className={`flex items-center gap-3 px-3.5 py-2.5 cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-blue-500/10'
                                : 'hover:bg-gray-700/40'
                            }`}
                          >
                            {!isFolderItem && (
                              <div
                                className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                                  isSelected
                                    ? 'bg-blue-500 border-blue-500'
                                    : 'border-gray-600 hover:border-gray-500'
                                }`}
                              >
                                {isSelected && (
                                  <Check className="w-3 h-3 text-white" />
                                )}
                              </div>
                            )}
                            <Icon className={`w-5 h-5 flex-shrink-0 ${iconColor}`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-200 truncate">
                                {file.name}
                              </p>
                              <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                                {!isFolderItem && file.size && (
                                  <span>{formatFileSize(parseInt(file.size, 10))}</span>
                                )}
                                {file.modifiedTime && (
                                  <span>
                                    {new Date(file.modifiedTime).toLocaleDateString()}
                                  </span>
                                )}
                                {file.owners?.[0]?.emailAddress && activeTab === 'shared' && (
                                  <span className="truncate">
                                    {file.owners[0].emailAddress}
                                  </span>
                                )}
                              </div>
                            </div>
                            {isFolderItem && (
                              <ChevronRight className="w-4 h-4 text-gray-600 flex-shrink-0" />
                            )}
                          </div>
                        );
                      })}

                      {nextPageToken && !isSearching && (
                        <div className="p-3 text-center">
                          <button
                            onClick={handleLoadMore}
                            disabled={loadingMore}
                            className="inline-flex items-center gap-2 px-4 py-1.5 text-sm text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors disabled:opacity-50"
                          >
                            {loadingMore ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Loading...
                              </>
                            ) : (
                              'Load more'
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {selectedFiles.size > 0 && (
                  <div className="mt-4">
                    <input
                      type="text"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Add a note (optional)..."
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 placeholder-gray-500 focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40 text-sm"
                    />
                  </div>
                )}
              </>
            )}
          </div>

          <div className="flex items-center justify-between px-6 py-4 bg-gray-800/50 border-t border-gray-700/50">
            <p className="text-sm text-gray-500">
              {selectedFiles.size} file{selectedFiles.size !== 1 ? 's' : ''} selected
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-gray-200 hover:bg-gray-700/50 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAttach}
                disabled={selectedFiles.size === 0 || attaching}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {attaching ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Attaching...
                  </>
                ) : (
                  <>
                    <Paperclip className="w-4 h-4" />
                    Attach Files
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
