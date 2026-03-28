import { useState, useEffect } from 'react';
import {
  X,
  Download,
  ExternalLink,
  FileText,
  FileImage,
  FileVideo,
  Paperclip,
  AlertCircle,
  Clock,
  User,
  HardDrive,
} from 'lucide-react';
import type { DriveFile, FileAttachment } from '../../types';
import { getFileStatus, isFileAvailable } from '../../services/driveFiles';
import { formatFileSize, getFileTypeCategory } from '../../services/googleDrive';
import { getEntitiesByFile } from '../../services/fileAttachments';

interface FilePreviewPanelProps {
  file: DriveFile;
  onClose: () => void;
}

export default function FilePreviewPanel({ file, onClose }: FilePreviewPanelProps) {
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [loadingAttachments, setLoadingAttachments] = useState(true);

  const status = getFileStatus(file);
  const available = isFileAvailable(file);
  const category = getFileTypeCategory(file.mime_type);

  useEffect(() => {
    loadAttachments();
  }, [file.id]);

  const loadAttachments = async () => {
    setLoadingAttachments(true);
    try {
      const data = await getEntitiesByFile(file.id);
      setAttachments(data);
    } catch (err) {
      console.error('Failed to load attachments:', err);
    } finally {
      setLoadingAttachments(false);
    }
  };

  const renderPreview = () => {
    if (!available) {
      return (
        <div className="flex flex-col items-center justify-center h-48 bg-slate-900/50 rounded-lg border border-slate-700">
          <AlertCircle className="w-12 h-12 text-amber-400 mb-2" />
          <p className="text-sm text-slate-400 text-center px-4">
            {status === 'deleted'
              ? 'This file has been deleted from Google Drive'
              : 'Access to this file has been revoked'}
          </p>
        </div>
      );
    }

    if (category === 'image' && file.thumbnail_url) {
      return (
        <div className="relative bg-slate-900/50 rounded-lg overflow-hidden border border-slate-700">
          <img
            src={file.thumbnail_url.replace('=s220', '=s400')}
            alt={file.name}
            className="w-full h-48 object-contain"
          />
        </div>
      );
    }

    if (file.web_view_link && (category === 'document' || category === 'spreadsheet' || category === 'presentation' || category === 'pdf')) {
      return (
        <div className="bg-slate-900/50 rounded-lg p-6 flex flex-col items-center justify-center h-48 border border-slate-700">
          <FileText className="w-12 h-12 text-blue-400 mb-2" />
          <p className="text-sm text-slate-400 mb-3">Preview in Google Drive</p>
          <a
            href={file.web_view_link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-cyan-600 text-white text-sm rounded-md hover:bg-cyan-500"
          >
            <ExternalLink className="w-4 h-4" />
            Open in Drive
          </a>
        </div>
      );
    }

    return (
      <div className="bg-slate-900/50 rounded-lg p-6 flex flex-col items-center justify-center h-48 border border-slate-700">
        {category === 'video' ? (
          <FileVideo className="w-12 h-12 text-rose-400 mb-2" />
        ) : category === 'image' ? (
          <FileImage className="w-12 h-12 text-emerald-400 mb-2" />
        ) : (
          <FileText className="w-12 h-12 text-slate-500 mb-2" />
        )}
        <p className="text-sm text-slate-500">Preview not available</p>
      </div>
    );
  };

  const getEntityTypeLabel = (type: string) => {
    switch (type) {
      case 'contacts':
        return 'Contact';
      case 'opportunities':
        return 'Opportunity';
      case 'conversations':
        return 'Conversation';
      case 'invoices':
        return 'Invoice';
      default:
        return type;
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-800 border-l border-slate-700">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
        <h3 className="font-medium text-white truncate">{file.name}</h3>
        <button
          onClick={onClose}
          className="p-1 hover:bg-slate-700 rounded"
        >
          <X className="w-5 h-5 text-slate-400" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {renderPreview()}

        {!available && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-300">File Unavailable</p>
                <p className="text-xs text-amber-400 mt-1">
                  {status === 'deleted'
                    ? 'This file was deleted from Google Drive but is still referenced in your records.'
                    : 'Access to this file was revoked in Google Drive. Contact the file owner to regain access.'}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <h4 className="text-sm font-medium text-slate-300">Details</h4>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <HardDrive className="w-4 h-4 text-slate-500" />
              <span className="text-slate-500">Size:</span>
              <span className="text-white">{formatFileSize(file.size_bytes)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <FileText className="w-4 h-4 text-slate-500" />
              <span className="text-slate-500">Type:</span>
              <span className="text-white truncate">{file.mime_type}</span>
            </div>
            {file.drive_owner_email && (
              <div className="flex items-center gap-2 text-sm">
                <User className="w-4 h-4 text-slate-500" />
                <span className="text-slate-500">Owner:</span>
                <span className="text-white truncate">{file.drive_owner_email}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-slate-500" />
              <span className="text-slate-500">Synced:</span>
              <span className="text-white">
                {new Date(file.last_synced_at).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="text-sm font-medium text-slate-300">Attached To</h4>
          {loadingAttachments ? (
            <div className="animate-pulse space-y-2">
              <div className="h-8 bg-slate-700 rounded" />
              <div className="h-8 bg-slate-700 rounded" />
            </div>
          ) : attachments.length === 0 ? (
            <p className="text-sm text-slate-500">Not attached to any records</p>
          ) : (
            <div className="space-y-2">
              {attachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="flex items-center gap-2 p-2 bg-slate-900/50 rounded-md border border-slate-700"
                >
                  <Paperclip className="w-4 h-4 text-slate-500" />
                  <span className="text-sm text-slate-300">
                    {getEntityTypeLabel(attachment.entity_type)}
                  </span>
                  {attachment.note && (
                    <span className="text-xs text-slate-500 truncate">
                      - {attachment.note}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="p-4 border-t border-slate-700 space-y-2">
        {available && file.web_view_link && (
          <a
            href={file.web_view_link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-cyan-600 text-white rounded-md hover:bg-cyan-500 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            Open in Google Drive
          </a>
        )}
      </div>
    </div>
  );
}
