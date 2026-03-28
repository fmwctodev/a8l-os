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
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden border border-slate-700">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-cyan-500/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Share</h3>
              <p className="text-xs text-slate-400 truncate max-w-[240px]">{file.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <label className="text-sm font-medium text-slate-300 mb-2 block">Share with people</label>
            <div className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                className="flex-1 px-3 py-2 text-sm border border-slate-600 rounded-lg bg-slate-900 text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                onKeyDown={(e) => e.key === 'Enter' && handleShare()}
              />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="px-3 py-2 text-sm border border-slate-600 rounded-lg bg-slate-900 text-white focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
              >
                <option value="reader">Viewer</option>
                <option value="commenter">Commenter</option>
                <option value="writer">Editor</option>
              </select>
            </div>
            <button
              onClick={handleShare}
              disabled={sharing || !email.trim()}
              className="mt-3 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-cyan-600 text-white text-sm font-medium rounded-lg hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="w-4 h-4" />
              {sharing ? 'Sharing...' : 'Send'}
            </button>
          </div>

          <div className="border-t border-slate-700 pt-5">
            <label className="text-sm font-medium text-slate-300 mb-2 block">Get shareable link</label>
            {shareLink ? (
              <div className="flex items-center gap-2">
                <div className="flex-1 px-3 py-2 text-sm bg-slate-900 border border-slate-600 rounded-lg text-slate-300 truncate">
                  {shareLink}
                </div>
                <button
                  onClick={handleCopyLink}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors text-slate-300"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-400" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            ) : (
              <button
                onClick={handleGetLink}
                disabled={linkLoading}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border border-slate-600 rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-colors text-slate-300"
              >
                <Link2 className="w-4 h-4 text-slate-400" />
                {linkLoading ? 'Creating link...' : 'Create link'}
              </button>
            )}
          </div>

          {success && (
            <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-sm text-emerald-400">
              <Check className="w-4 h-4" />
              {success}
            </div>
          )}

          {error && (
            <div className="px-3 py-2 bg-rose-500/10 border border-rose-500/30 rounded-lg text-sm text-rose-400">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
