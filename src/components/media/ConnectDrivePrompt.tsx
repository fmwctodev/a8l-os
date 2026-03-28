import { HardDrive, Shield, FolderSync, Link2, AlertTriangle } from 'lucide-react';

interface ConnectDrivePromptProps {
  onConnect: () => void;
  loading?: boolean;
  error?: string | null;
}

export default function ConnectDrivePrompt({
  onConnect,
  loading,
  error,
}: ConnectDrivePromptProps) {
  return (
    <div className="flex-1 flex items-center justify-center bg-slate-900 p-8">
      <div className="max-w-md w-full text-center">
        <div className="w-20 h-20 bg-cyan-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-cyan-500/20">
          <HardDrive className="w-10 h-10 text-cyan-400" />
        </div>
        <h2 className="text-2xl font-semibold text-white mb-3">
          Connect Google Drive
        </h2>

        <p className="text-slate-400 mb-8">
          Connect your Google Drive to browse, organize, and attach files directly
          from the CRM. Your files stay in your Drive &mdash; we just help you
          organize and attach them to your records.
        </p>

        <div className="grid grid-cols-1 gap-4 mb-8 text-left">
          <div className="flex items-start gap-3 p-4 bg-slate-800 rounded-lg border border-slate-700">
            <FolderSync className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-white">Use Your Folder Structure</h3>
              <p className="text-sm text-slate-400 mt-0.5">
                Browse and use your existing Google Drive folders - no new structure required
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-4 bg-slate-800 rounded-lg border border-slate-700">
            <Link2 className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-white">Attach to Records</h3>
              <p className="text-sm text-slate-400 mt-0.5">
                Link files to contacts, opportunities, and other records for easy access
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-4 bg-slate-800 rounded-lg border border-slate-700">
            <Shield className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-white">Secure & Private</h3>
              <p className="text-sm text-slate-400 mt-0.5">
                Files remain in your Google Drive. We only store references, not your actual files.
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-start gap-3 text-left">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-300">Unable to connect</p>
              <p className="text-sm text-amber-400 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        <button
          onClick={onConnect}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-cyan-600 text-white font-medium rounded-lg hover:bg-cyan-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              <HardDrive className="w-5 h-5" />
              Connect Google Drive
            </>
          )}
        </button>

        <p className="text-xs text-slate-500 mt-4">
          By connecting, you agree to grant this application access to view and manage files
          in your Google Drive that you select.
        </p>
      </div>
    </div>
  );
}
