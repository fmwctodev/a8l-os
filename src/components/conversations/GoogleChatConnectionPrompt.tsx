import { useState } from 'react';
import { MessageSquare, Link2, Shield, Users, ArrowRight, Loader2 } from 'lucide-react';
import { initiateConnection } from '../../services/googleChat';

interface GoogleChatConnectionPromptProps {
  onConnecting?: () => void;
}

export function GoogleChatConnectionPrompt({ onConnecting }: GoogleChatConnectionPromptProps) {
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    try {
      setConnecting(true);
      setError(null);
      onConnecting?.();
      await initiateConnection('/conversations?tab=team-messaging');
    } catch (err) {
      setError('Failed to initiate connection. Please try again.');
      setConnecting(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center mx-auto mb-6 border border-emerald-500/30">
            <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                stroke="url(#google-chat-gradient)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <defs>
                <linearGradient id="google-chat-gradient" x1="2" y1="2" x2="22" y2="22">
                  <stop stopColor="#10B981" />
                  <stop offset="1" stopColor="#14B8A6" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <h2 className="text-2xl font-semibold text-white mb-2">
            Connect Google Chat
          </h2>
          <p className="text-slate-400">
            Access your Google Chat spaces and messages directly within the CRM for seamless team collaboration.
          </p>
        </div>

        <div className="space-y-4 mb-8">
          <div className="flex items-start gap-4 p-4 rounded-xl bg-slate-800/50 border border-slate-700">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
              <MessageSquare className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="font-medium text-white mb-1">Unified Messaging</h3>
              <p className="text-sm text-slate-400">
                View and respond to team messages without switching apps
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4 p-4 rounded-xl bg-slate-800/50 border border-slate-700">
            <div className="w-10 h-10 rounded-lg bg-teal-500/20 flex items-center justify-center flex-shrink-0">
              <Users className="w-5 h-5 text-teal-400" />
            </div>
            <div>
              <h3 className="font-medium text-white mb-1">Real-time Sync</h3>
              <p className="text-sm text-slate-400">
                Messages sync instantly across all your devices
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4 p-4 rounded-xl bg-slate-800/50 border border-slate-700">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
              <Shield className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h3 className="font-medium text-white mb-1">Secure Connection</h3>
              <p className="text-sm text-slate-400">
                Your data stays protected with OAuth 2.0 authentication
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            {error}
          </div>
        )}

        <button
          onClick={handleConnect}
          disabled={connecting}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium rounded-xl hover:from-emerald-600 hover:to-teal-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/25"
        >
          {connecting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              <Link2 className="w-5 h-5" />
              Connect Google Account
              <ArrowRight className="w-4 h-4 ml-1" />
            </>
          )}
        </button>

        <p className="text-center text-xs text-slate-500 mt-4">
          By connecting, you grant access to view your Google Chat spaces and messages.
          You can disconnect at any time from settings.
        </p>
      </div>
    </div>
  );
}
