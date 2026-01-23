import { useState, useEffect } from 'react';
import {
  Paperclip,
  File,
  FileText,
  FileImage,
  FileSpreadsheet,
  ExternalLink,
  Trash2,
  AlertCircle,
  Plus,
  FolderOpen,
} from 'lucide-react';
import type { Contact } from '../../types';
import { getAttachments, detachFile, type FileAttachmentWithFile } from '../../services/fileAttachments';
import { formatFileSize, getFileTypeCategory } from '../../services/googleDrive';
import { isFileAvailable, getFileStatus } from '../../services/driveFiles';
import { useAuth } from '../../contexts/AuthContext';
import { usePermission } from '../../hooks/usePermission';
import AttachFileModal from '../media/AttachFileModal';

interface ContactFilesTabProps {
  contact: Contact;
  onUpdate: () => void;
}

function getFileIcon(mimeType: string) {
  const category = getFileTypeCategory(mimeType);
  switch (category) {
    case 'image':
      return FileImage;
    case 'spreadsheet':
      return FileSpreadsheet;
    case 'document':
    case 'pdf':
      return FileText;
    default:
      return File;
  }
}

function getFileIconColor(mimeType: string): string {
  const category = getFileTypeCategory(mimeType);
  switch (category) {
    case 'image':
      return 'text-emerald-500';
    case 'spreadsheet':
      return 'text-green-600';
    case 'pdf':
      return 'text-red-500';
    case 'document':
      return 'text-blue-500';
    default:
      return 'text-gray-500';
  }
}

export default function ContactFilesTab({ contact, onUpdate }: ContactFilesTabProps) {
  const { user } = useAuth();
  const canManage = usePermission('media.manage');
  const [attachments, setAttachments] = useState<FileAttachmentWithFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAttachModal, setShowAttachModal] = useState(false);
  const [detaching, setDetaching] = useState<string | null>(null);

  useEffect(() => {
    loadAttachments();
  }, [contact.id]);

  const loadAttachments = async () => {
    setLoading(true);
    try {
      const data = await getAttachments('contacts', contact.id);
      setAttachments(data);
    } catch (err) {
      console.error('Failed to load attachments:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDetach = async (attachmentId: string) => {
    if (!confirm('Are you sure you want to detach this file? The file will remain in Google Drive.')) {
      return;
    }

    setDetaching(attachmentId);
    try {
      await detachFile(attachmentId);
      await loadAttachments();
      onUpdate();
    } catch (err) {
      console.error('Failed to detach file:', err);
    } finally {
      setDetaching(null);
    }
  };

  const handleAttached = () => {
    loadAttachments();
    onUpdate();
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4" />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-medium text-gray-900">Files</h3>
        {canManage && (
          <button
            onClick={() => setShowAttachModal(true)}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Attach File
          </button>
        )}
      </div>

      {attachments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-gray-500 border-2 border-dashed border-gray-200 rounded-lg">
          <FolderOpen className="w-12 h-12 text-gray-300 mb-3" />
          <p className="text-lg font-medium mb-1">No files attached</p>
          <p className="text-sm text-gray-400 mb-4">
            Attach files from Google Drive to keep them organized with this contact
          </p>
          {canManage && (
            <button
              onClick={() => setShowAttachModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100"
            >
              <Paperclip className="w-4 h-4" />
              Attach Files
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {attachments.map((attachment) => {
            const file = attachment.drive_file;
            const Icon = getFileIcon(file.mime_type);
            const iconColor = getFileIconColor(file.mime_type);
            const available = isFileAvailable(file);
            const status = getFileStatus(file);

            return (
              <div
                key={attachment.id}
                className={`relative group bg-white rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all ${
                  !available ? 'opacity-60' : ''
                }`}
              >
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        available ? 'bg-gray-50' : 'bg-gray-100'
                      }`}
                    >
                      {file.thumbnail_url && available ? (
                        <img
                          src={file.thumbnail_url}
                          alt={file.name}
                          className="w-8 h-8 object-cover rounded"
                        />
                      ) : (
                        <Icon className={`w-5 h-5 ${available ? iconColor : 'text-gray-400'}`} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4
                        className={`text-sm font-medium truncate ${
                          available ? 'text-gray-900' : 'text-gray-500'
                        }`}
                        title={file.name}
                      >
                        {file.name}
                      </h4>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {formatFileSize(file.size_bytes)}
                      </p>
                      {attachment.note && (
                        <p className="text-xs text-gray-400 mt-1 truncate" title={attachment.note}>
                          {attachment.note}
                        </p>
                      )}
                    </div>
                  </div>

                  {!available && (
                    <div className="mt-3 flex items-center gap-1 text-xs text-amber-600">
                      <AlertCircle className="w-3 h-3" />
                      <span>
                        {status === 'deleted' ? 'File deleted' : 'Access revoked'}
                      </span>
                    </div>
                  )}
                </div>

                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                  {available && file.web_view_link && (
                    <a
                      href={file.web_view_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 bg-white rounded shadow-sm border border-gray-200 hover:bg-gray-50"
                      title="Open in Google Drive"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-gray-500" />
                    </a>
                  )}
                  {canManage && (
                    <button
                      onClick={() => handleDetach(attachment.id)}
                      disabled={detaching === attachment.id}
                      className="p-1.5 bg-white rounded shadow-sm border border-gray-200 hover:bg-red-50 hover:border-red-200"
                      title="Detach file"
                    >
                      {detaching === attachment.id ? (
                        <div className="w-3.5 h-3.5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5 text-gray-500 hover:text-red-500" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AttachFileModal
        isOpen={showAttachModal}
        onClose={() => setShowAttachModal(false)}
        entityType="contacts"
        entityId={contact.id}
        organizationId={contact.organization_id}
        onAttached={handleAttached}
      />
    </div>
  );
}
