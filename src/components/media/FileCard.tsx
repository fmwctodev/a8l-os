import { useState, useRef, useEffect } from 'react';
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
  ExternalLink,
  Download,
  Share2,
  Trash2,
} from 'lucide-react';
import type { GoogleDriveFileInfo } from '../../services/googleDrive';
import { getFileTypeCategory } from '../../services/googleDrive';

interface FileCardProps {
  file: GoogleDriveFileInfo;
  onOpen: (file: GoogleDriveFileInfo) => void;
  onDownload: (file: GoogleDriveFileInfo) => void;
  onShare: (file: GoogleDriveFileInfo) => void;
  onDelete: (file: GoogleDriveFileInfo) => void;
  onNavigateFolder?: (folderId: string, folderName: string) => void;
}

function getFileIcon(mimeType: string) {
  const category = getFileTypeCategory(mimeType);
  switch (category) {
    case 'image': return FileImage;
    case 'video': return FileVideo;
    case 'audio': return FileAudio;
    case 'pdf': return FileText;
    case 'spreadsheet': return FileSpreadsheet;
    case 'document': return FileText;
    case 'presentation': return Presentation;
    default:
      if (mimeType === 'application/vnd.google-apps.folder') return Folder;
      return File;
  }
}

function getFileIconColor(mimeType: string): string {
  const category = getFileTypeCategory(mimeType);
  switch (category) {
    case 'image': return 'text-emerald-500';
    case 'video': return 'text-rose-500';
    case 'audio': return 'text-pink-500';
    case 'pdf': return 'text-red-500';
    case 'spreadsheet': return 'text-green-600';
    case 'document': return 'text-blue-500';
    case 'presentation': return 'text-orange-500';
    default:
      if (mimeType === 'application/vnd.google-apps.folder') return 'text-gray-500';
      return 'text-gray-400';
  }
}

function getIconBgColor(mimeType: string): string {
  const category = getFileTypeCategory(mimeType);
  switch (category) {
    case 'image': return 'bg-emerald-50';
    case 'video': return 'bg-rose-50';
    case 'audio': return 'bg-pink-50';
    case 'pdf': return 'bg-red-50';
    case 'spreadsheet': return 'bg-green-50';
    case 'document': return 'bg-blue-50';
    case 'presentation': return 'bg-orange-50';
    default:
      if (mimeType === 'application/vnd.google-apps.folder') return 'bg-gray-100';
      return 'bg-gray-50';
  }
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
}

function getMimeLabel(mimeType: string): string {
  if (mimeType === 'application/vnd.google-apps.folder') return 'Folder';
  if (mimeType === 'application/vnd.google-apps.document') return 'Google Doc';
  if (mimeType === 'application/vnd.google-apps.spreadsheet') return 'Google Sheet';
  if (mimeType === 'application/vnd.google-apps.presentation') return 'Google Slides';
  if (mimeType === 'application/pdf') return 'PDF';
  if (mimeType === 'text/plain') return 'Text File';
  if (mimeType.startsWith('image/')) return mimeType.split('/')[1].toUpperCase();
  if (mimeType.startsWith('video/')) return 'Video';
  if (mimeType.startsWith('audio/')) return 'Audio';
  const parts = mimeType.split('/');
  return parts.length > 1 ? parts[1].split('.').pop()?.toUpperCase() || mimeType : mimeType;
}

export default function FileCard({
  file,
  onOpen,
  onDownload,
  onShare,
  onDelete,
  onNavigateFolder,
}: FileCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const Icon = getFileIcon(file.mimeType);
  const iconColor = getFileIconColor(file.mimeType);
  const iconBg = getIconBgColor(file.mimeType);
  const isFolderType = file.mimeType === 'application/vnd.google-apps.folder';

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [menuOpen]);

  const handleClick = () => {
    if (isFolderType && onNavigateFolder) {
      onNavigateFolder(file.id, file.name);
    }
  };

  const handleDoubleClick = () => {
    if (!isFolderType) {
      onOpen(file);
    }
  };

  return (
    <div
      className="group relative bg-white rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all cursor-pointer overflow-hidden"
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      <div className={`relative h-36 ${iconBg} flex items-center justify-center`}>
        {file.thumbnailLink && !isFolderType ? (
          <img
            src={file.thumbnailLink}
            alt={file.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <Icon className={`w-12 h-12 ${iconColor}`} />
        )}

        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity" ref={menuRef}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen(!menuOpen);
            }}
            className="p-1.5 bg-white/90 backdrop-blur-sm rounded-lg shadow-sm border border-gray-200 hover:bg-white transition-colors"
          >
            <MoreVertical className="w-4 h-4 text-gray-600" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-50">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  onOpen(file);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <ExternalLink className="w-4 h-4 text-gray-400" />
                Open in Google Drive
              </button>
              {!isFolderType && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    onDownload(file);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Download className="w-4 h-4 text-gray-400" />
                  Download
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  onShare(file);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <Share2 className="w-4 h-4 text-gray-400" />
                Share
              </button>
              <div className="border-t border-gray-100 my-1" />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  onDelete(file);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4 text-red-400" />
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="px-3 py-3">
        <p className="text-xs text-gray-400 mb-1">{getMimeLabel(file.mimeType)}</p>
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-medium text-gray-900 truncate" title={file.name}>
            {file.name}
          </h4>
        </div>
        <p className="text-xs text-gray-400 mt-1">{formatDate(file.modifiedTime || file.createdTime)}</p>
      </div>
    </div>
  );
}
