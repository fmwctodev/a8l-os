import { useState } from 'react';
import { X, Link2, Copy, Check, Send, Users } from 'lucide-react';
import type { GoogleDriveFileInfo } from '../../services/googleDrive';
import { shareDriveFile, getShareLink } from '../../services/googleDrive';

interface ShareFileModalProps {
  file: GoogleDriveFileInfo;
  isOpen: boolean;
  onClose: () => void;
}

export default function ShareFileModal({ file, isOpen, onClose }: ShareFileModalProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('reader');
  const [sharing, setSharing] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [linkLoading, setLinkLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleShare = async () => {
    if (!email.trim()) return;
    setSharing(true);
    setError(null);
    setSuccess(null);
    try {
      await shareDriveFile(file.id, email.trim(), role);
      setSuccess(`Shared with ${email.trim()}`);
      setEmail('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSharing(false);
    }
  };

  const handleGetLink = async () => {
    setLinkLoading(true);
    setError(null);
    try {
      const link = await getShareLink(file.id);
      setShareLink(link);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLinkLoading(false);
    }
  };

  const handleCopyLink = async () => {
    if (!shareLink) return;
    await navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900">Share</h3>
              <p className="text-xs text-gray-500 truncate max-w-[240px]">{file.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">Share with people</label>
            <div className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                onKeyDown={(e) => e.key === 'Enter' && handleShare()}
              />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              >
                <option value="reader">Viewer</option>
                <option value="commenter">Commenter</option>
                <option value="writer">Editor</option>
              </select>
            </div>
            <button
              onClick={handleShare}
              disabled={sharing || !email.trim()}
              className="mt-3 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="w-4 h-4" />
              {sharing ? 'Sharing...' : 'Send'}
            </button>
          </div>

          <div className="border-t border-gray-100 pt-5">
            <label className="text-sm font-medium text-gray-700 mb-2 block">Get shareable link</label>
            {shareLink ? (
              <div className="flex items-center gap-2">
                <div className="flex-1 px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg text-gray-600 truncate">
                  {shareLink}
                </div>
                <button
                  onClick={handleCopyLink}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-gray-600" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            ) : (
              <button
                onClick={handleGetLink}
                disabled={linkLoading}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                <Link2 className="w-4 h-4 text-gray-500" />
                {linkLoading ? 'Creating link...' : 'Create link'}
              </button>
            )}
          </div>

          {success && (
            <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
              <Check className="w-4 h-4" />
              {success}
            </div>
          )}

          {error && (
            <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
