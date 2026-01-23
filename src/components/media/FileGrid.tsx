import {
  File,
  FileText,
  FileSpreadsheet,
  FileImage,
  FileVideo,
  FileAudio,
  Presentation,
  Folder,
  MoreVertical,
  Download,
  Link,
  Trash2,
  Eye,
  AlertCircle,
} from 'lucide-react';
import type { DriveFile } from '../../types';
import { getFileStatus, isFileAvailable } from '../../services/driveFiles';
import { formatFileSize, getFileTypeCategory } from '../../services/googleDrive';

interface FileGridProps {
  files: DriveFile[];
  selectedFileId: string | null;
  onSelectFile: (file: DriveFile) => void;
  onOpenFile: (file: DriveFile) => void;
  onDeleteFile?: (file: DriveFile) => void;
  loading?: boolean;
}

function getFileIcon(mimeType: string) {
  const category = getFileTypeCategory(mimeType);
  switch (category) {
    case 'image':
      return FileImage;
    case 'video':
      return FileVideo;
    case 'audio':
      return FileAudio;
    case 'pdf':
      return FileText;
    case 'spreadsheet':
      return FileSpreadsheet;
    case 'document':
      return FileText;
    case 'presentation':
      return Presentation;
    default:
      if (mimeType === 'application/vnd.google-apps.folder') {
        return Folder;
      }
      return File;
  }
}

function getFileIconColor(mimeType: string): string {
  const category = getFileTypeCategory(mimeType);
  switch (category) {
    case 'image':
      return 'text-emerald-500';
    case 'video':
      return 'text-purple-500';
    case 'audio':
      return 'text-pink-500';
    case 'pdf':
      return 'text-red-500';
    case 'spreadsheet':
      return 'text-green-600';
    case 'document':
      return 'text-blue-500';
    case 'presentation':
      return 'text-orange-500';
    default:
      if (mimeType === 'application/vnd.google-apps.folder') {
        return 'text-yellow-500';
      }
      return 'text-gray-500';
  }
}

interface FileCardProps {
  file: DriveFile;
  selected: boolean;
  onSelect: () => void;
  onOpen: () => void;
  onDelete?: () => void;
}

function FileCard({ file, selected, onSelect, onOpen, onDelete }: FileCardProps) {
  const Icon = getFileIcon(file.mime_type);
  const iconColor = getFileIconColor(file.mime_type);
  const status = getFileStatus(file);
  const available = isFileAvailable(file);
  const isFolder = file.mime_type === 'application/vnd.google-apps.folder';

  return (
    <div
      className={`group relative bg-white rounded-lg border transition-all cursor-pointer ${
        selected
          ? 'border-blue-500 ring-2 ring-blue-200'
          : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
      } ${!available ? 'opacity-60' : ''}`}
      onClick={onSelect}
      onDoubleClick={onOpen}
    >
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div
            className={`w-12 h-12 rounded-lg flex items-center justify-center ${
              available ? 'bg-gray-50' : 'bg-gray-100'
            }`}
          >
            {file.thumbnail_url && available ? (
              <img
                src={file.thumbnail_url}
                alt={file.name}
                className="w-10 h-10 object-cover rounded"
              />
            ) : (
              <Icon className={`w-6 h-6 ${available ? iconColor : 'text-gray-400'}`} />
            )}
          </div>
          {!available && (
            <div className="flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs">
              <AlertCircle className="w-3 h-3" />
              <span>Unavailable</span>
            </div>
          )}
        </div>
        <h4
          className={`text-sm font-medium truncate ${
            available ? 'text-gray-900' : 'text-gray-500'
          }`}
          title={file.name}
        >
          {file.name}
        </h4>
        <p className="text-xs text-gray-500 mt-1">
          {isFolder ? 'Folder' : formatFileSize(file.size_bytes)}
        </p>
      </div>
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
            }}
            className="p-1.5 bg-white rounded-md shadow-sm border border-gray-200 hover:bg-gray-50"
          >
            <MoreVertical className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>
      {status === 'access_revoked' && (
        <div className="absolute inset-0 bg-gray-900/5 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="text-xs text-gray-600 bg-white px-2 py-1 rounded shadow">
            Access revoked in Google Drive
          </span>
        </div>
      )}
    </div>
  );
}

export default function FileGrid({
  files,
  selectedFileId,
  onSelectFile,
  onOpenFile,
  onDeleteFile,
  loading,
}: FileGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 p-4">
        {[...Array(10)].map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="bg-gray-200 rounded-lg h-32" />
          </div>
        ))}
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-500">
        <Folder className="w-16 h-16 text-gray-300 mb-4" />
        <p className="text-lg font-medium">No files found</p>
        <p className="text-sm mt-1">This folder is empty or no files match your filters</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 p-4">
      {files.map((file) => (
        <FileCard
          key={file.id}
          file={file}
          selected={selectedFileId === file.id}
          onSelect={() => onSelectFile(file)}
          onOpen={() => onOpenFile(file)}
          onDelete={onDeleteFile ? () => onDeleteFile(file) : undefined}
        />
      ))}
    </div>
  );
}
