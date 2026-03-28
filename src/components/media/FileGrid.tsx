import {
  File,
  FileText,
  FileSpreadsheet,
  FileImage,
  FileVideo,
  FileAudio,
  Presentation,
  Folder,
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
      return 'text-emerald-400';
    case 'video':
      return 'text-rose-400';
    case 'audio':
      return 'text-pink-400';
    case 'pdf':
      return 'text-red-400';
    case 'spreadsheet':
      return 'text-green-400';
    case 'document':
      return 'text-blue-400';
    case 'presentation':
      return 'text-orange-400';
    default:
      if (mimeType === 'application/vnd.google-apps.folder') {
        return 'text-yellow-400';
      }
      return 'text-slate-400';
  }
}

interface FileCardProps {
  file: DriveFile;
  selected: boolean;
  onSelect: () => void;
  onOpen: () => void;
  onDelete?: () => void;
}

function FileCard({ file, selected, onSelect, onOpen }: FileCardProps) {
  const Icon = getFileIcon(file.mime_type);
  const iconColor = getFileIconColor(file.mime_type);
  const status = getFileStatus(file);
  const available = isFileAvailable(file);
  const isFolder = file.mime_type === 'application/vnd.google-apps.folder';

  return (
    <div
      className={`group relative bg-slate-800 rounded-lg border transition-all cursor-pointer ${
        selected
          ? 'border-cyan-500 ring-2 ring-cyan-500/20'
          : 'border-slate-700 hover:border-slate-500 hover:bg-slate-750'
      } ${!available ? 'opacity-60' : ''}`}
      onClick={onSelect}
      onDoubleClick={onOpen}
    >
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div
            className={`w-12 h-12 rounded-lg flex items-center justify-center ${
              available ? 'bg-slate-700/50' : 'bg-slate-700/30'
            }`}
          >
            {file.thumbnail_url && available ? (
              <img
                src={file.thumbnail_url}
                alt={file.name}
                className="w-10 h-10 object-cover rounded"
              />
            ) : (
              <Icon className={`w-6 h-6 ${available ? iconColor : 'text-slate-500'}`} />
            )}
          </div>
          {!available && (
            <div className="flex items-center gap-1 px-2 py-0.5 bg-amber-500/10 text-amber-400 rounded text-xs border border-amber-500/20">
              <AlertCircle className="w-3 h-3" />
              <span>Unavailable</span>
            </div>
          )}
        </div>
        <h4
          className={`text-sm font-medium truncate ${
            available ? 'text-white' : 'text-slate-500'
          }`}
          title={file.name}
        >
          {file.name}
        </h4>
        <p className="text-xs text-slate-500 mt-1">
          {isFolder ? 'Folder' : formatFileSize(file.size_bytes)}
        </p>
      </div>
      {status === 'access_revoked' && (
        <div className="absolute inset-0 bg-slate-900/60 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="text-xs text-slate-300 bg-slate-800 px-2 py-1 rounded shadow border border-slate-700">
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
            <div className="bg-slate-700 rounded-lg h-32" />
          </div>
        ))}
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-500">
        <Folder className="w-16 h-16 text-slate-600 mb-4" />
        <p className="text-lg font-medium text-slate-400">No files found</p>
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
