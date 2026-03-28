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
    case 'image': return 'bg-emerald-900/20';
    case 'video': return 'bg-rose-900/20';
    case 'audio': return 'bg-pink-900/20';
    case 'pdf': return 'bg-red-900/20';
    case 'spreadsheet': return 'bg-green-900/20';
    case 'document': return 'bg-blue-900/20';
    case 'presentation': return 'bg-orange-900/20';
    default:
      if (mimeType === 'application/vnd.google-apps.folder') return 'bg-slate-700/50';
      return 'bg-slate-700/30';
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
      className="group relative bg-slate-800 rounded-xl border border-slate-700 hover:border-slate-500 hover:bg-slate-750 transition-all cursor-pointer overflow-hidden"
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
            className="p-1.5 bg-slate-700/90 backdrop-blur-sm rounded-lg shadow-sm border border-slate-600 hover:bg-slate-600 transition-colors"
          >
            <MoreVertical className="w-4 h-4 text-slate-300" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-slate-800 rounded-lg shadow-xl border border-slate-700 py-1 z-50">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  onOpen(file);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700"
              >
                <ExternalLink className="w-4 h-4 text-slate-500" />
                Open in Google Drive
              </button>
              {!isFolderType && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    onDownload(file);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700"
                >
                  <Download className="w-4 h-4 text-slate-500" />
                  Download
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  onShare(file);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700"
              >
                <Share2 className="w-4 h-4 text-slate-500" />
                Share
              </button>
              <div className="border-t border-slate-700 my-1" />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  onDelete(file);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-rose-400 hover:bg-rose-500/10"
              >
                <Trash2 className="w-4 h-4 text-rose-400" />
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="px-3 py-3">
        <p className="text-xs text-slate-500 mb-1">{getMimeLabel(file.mimeType)}</p>
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-medium text-white truncate" title={file.name}>
            {file.name}
          </h4>
        </div>
        <p className="text-xs text-slate-500 mt-1">{formatDate(file.modifiedTime || file.createdTime)}</p>
      </div>
    </div>
  );
}
