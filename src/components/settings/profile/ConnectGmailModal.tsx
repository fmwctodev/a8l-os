import { useState } from 'react';
import { X, CheckCircle, Loader2, Shield, Lock } from 'lucide-react';
import { initiateGmailOAuth } from '../../../services/gmailApi';

interface ConnectGmailModalProps {
  onClose: () => void;
}

const FEATURES = [
  'Two-way email sync between Gmail and your CRM inbox',
  'Send and receive emails directly from conversations',
  'Auto-save drafts to Gmail as you compose',
  'Real-time push notifications for new emails',
  'Thread-based email conversations with contacts',
  'Archive and manage emails from either platform',
  'Full email history synced to contact timelines',
];

export function ConnectGmailModal({ onClose }: ConnectGmailModalProps) {
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    setConnecting(true);
    setError(null);

    try {
      const authUrl = await initiateGmailOAuth();
      window.location.href = authUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start Gmail connection');
      setConnecting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 rounded-2xl border border-slate-700 max-w-lg w-full shadow-2xl overflow-hidden">
        <div className="relative bg-gradient-to-br from-slate-800 to-slate-900 px-6 pt-6 pb-5 border-b border-slate-700">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
          >
            <X size={18} />
          </button>

          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 rounded-xl bg-white shadow-lg">
              <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Connect Gmail</h2>
              <p className="text-sm text-slate-400">Sync your email with your CRM</p>
            </div>
          </div>

          <p className="text-sm text-slate-300 leading-relaxed">
            Connect your Gmail account to enable two-way email synchronization. Emails you send
            and receive will automatically appear in your CRM conversations, keeping everything
            in one place.
          </p>
        </div>

        <div className="px-6 py-5 space-y-5">
          <div>
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <CheckCircle size={16} className="text-emerald-400" />
              What you get
            </h3>
            <ul className="space-y-2.5">
              {FEATURES.map((feature, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-slate-300">
                  <CheckCircle size={14} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700/50">
            <div className="flex items-start gap-2.5">
              <Shield size={16} className="text-cyan-400 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="text-sm font-medium text-white mb-1">Access & Permissions</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Connecting Gmail grants read and send access to your email. This allows the CRM
                  to sync your inbox, send emails on your behalf, and manage drafts. We use
                  Google's OAuth 2.0 protocol and never store your Google password.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <Lock size={14} className="text-slate-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-slate-500 leading-relaxed">
              Your data is encrypted in transit and at rest. You can disconnect Gmail at any time
              from your profile settings, which immediately revokes all access. Previously synced
              messages remain in the CRM.
            </p>
          </div>

          {error && (
            <div className="bg-red-900/30 border border-red-800/50 rounded-lg p-3">
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}
        </div>

        <div className="px-6 pb-6 pt-2 flex flex-col gap-3">
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="w-full flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl bg-white text-slate-900 font-semibold text-sm hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-white/10"
          >
            {connecting ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
            )}
            {connecting ? 'Connecting...' : 'Connect Gmail'}
          </button>

          <button
            onClick={onClose}
            className="w-full px-5 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>

          <p className="text-center text-xs text-slate-500">
            By connecting, you agree to grant email access to this application in
            accordance with Google's API Services User Data Policy.
          </p>
        </div>
      </div>
    </div>
  );
}
