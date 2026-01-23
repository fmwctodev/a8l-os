import { useState, useEffect } from 'react';
import { X, Search, Paperclip, File, Folder, Check, AlertCircle } from 'lucide-react';
import type { DriveFile, FileAttachmentEntityType } from '../../types';
import { getDriveFiles, isFileAvailable } from '../../services/driveFiles';
import { attachFile, isFileAttached } from '../../services/fileAttachments';
import { formatFileSize, getFileTypeCategory } from '../../services/googleDrive';
import { useAuth } from '../../contexts/AuthContext';

interface AttachFileModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: FileAttachmentEntityType;
  entityId: string;
  organizationId: string;
  onAttached: () => void;
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
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [attaching, setAttaching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alreadyAttached, setAlreadyAttached] = useState<Set<string>>(new Set());
  const [note, setNote] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadFiles();
      setSelectedFiles(new Set());
      setNote('');
      setError(null);
    }
  }, [isOpen, organizationId]);

  const loadFiles = async () => {
    setLoading(true);
    try {
      const data = await getDriveFiles(organizationId, { showUnavailable: false });
      setFiles(data.filter((f) => f.mime_type !== 'application/vnd.google-apps.folder'));

      const attachedSet = new Set<string>();
      for (const file of data) {
        const attached = await isFileAttached(file.id, entityType, entityId);
        if (attached) {
          attachedSet.add(file.id);
        }
      }
      setAlreadyAttached(attachedSet);
    } catch (err) {
      console.error('Failed to load files:', err);
      setError('Failed to load files');
    } finally {
      setLoading(false);
    }
  };

  const filteredFiles = files.filter((file) =>
    file.name.toLowerCase().includes(search.toLowerCase())
  );

  const toggleFile = (fileId: string) => {
    if (alreadyAttached.has(fileId)) return;

    const newSelected = new Set(selectedFiles);
    if (newSelected.has(fileId)) {
      newSelected.delete(fileId);
    } else {
      newSelected.add(fileId);
    }
    setSelectedFiles(newSelected);
  };

  const handleAttach = async () => {
    if (selectedFiles.size === 0 || !user) return;

    setAttaching(true);
    setError(null);

    try {
      for (const fileId of selectedFiles) {
        await attachFile(
          organizationId,
          fileId,
          entityType,
          entityId,
          user.id,
          note || undefined
        );
      }
      onAttached();
      onClose();
    } catch (err) {
      console.error('Failed to attach files:', err);
      setError(err instanceof Error ? err.message : 'Failed to attach files');
    } finally {
      setAttaching(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
        <div
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={onClose}
        />

        <div className="relative inline-block w-full max-w-2xl my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-lg">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Attach Files</h3>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-md"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          <div className="p-6">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search files..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-center gap-2 text-red-700">
                <AlertCircle className="w-5 h-5" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            <div className="border border-gray-200 rounded-md max-h-80 overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center">
                  <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-sm text-gray-500 mt-2">Loading files...</p>
                </div>
              ) : filteredFiles.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <Folder className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                  <p>No files found</p>
                  <p className="text-sm mt-1">
                    Upload files to Google Drive first, then attach them here
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {filteredFiles.map((file) => {
                    const isSelected = selectedFiles.has(file.id);
                    const isAttached = alreadyAttached.has(file.id);
                    const available = isFileAvailable(file);

                    return (
                      <div
                        key={file.id}
                        onClick={() => toggleFile(file.id)}
                        className={`flex items-center gap-3 p-3 cursor-pointer transition-colors ${
                          isAttached
                            ? 'bg-gray-50 cursor-not-allowed'
                            : isSelected
                            ? 'bg-blue-50'
                            : 'hover:bg-gray-50'
                        } ${!available ? 'opacity-50' : ''}`}
                      >
                        <div
                          className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 ${
                            isAttached
                              ? 'bg-gray-200 border-gray-300'
                              : isSelected
                              ? 'bg-blue-600 border-blue-600'
                              : 'border-gray-300'
                          }`}
                        >
                          {(isSelected || isAttached) && (
                            <Check className="w-3 h-3 text-white" />
                          )}
                        </div>
                        <File className="w-5 h-5 text-gray-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {file.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatFileSize(file.size_bytes)}
                            {isAttached && ' • Already attached'}
                            {!available && ' • Unavailable'}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {selectedFiles.size > 0 && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Note (optional)
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Add a note about these files..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            )}
          </div>

          <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-t border-gray-200">
            <p className="text-sm text-gray-500">
              {selectedFiles.size} file{selectedFiles.size !== 1 ? 's' : ''} selected
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={handleAttach}
                disabled={selectedFiles.size === 0 || attaching}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {attaching ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
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
