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
    <div className="flex-1 flex items-center justify-center bg-gray-50 p-8">
      <div className="max-w-md w-full text-center">
        <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <HardDrive className="w-10 h-10 text-blue-600" />
        </div>
        <h2 className="text-2xl font-semibold text-gray-900 mb-3">
          Connect Google Drive
        </h2>

        <p className="text-gray-600 mb-8">
          Connect your Google Drive to browse, organize, and attach files directly
          from the CRM. Your files stay in your Drive &mdash; we just help you
          organize and attach them to your records.
        </p>

        <div className="grid grid-cols-1 gap-4 mb-8 text-left">
          <div className="flex items-start gap-3 p-4 bg-white rounded-lg border border-gray-200">
            <FolderSync className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-gray-900">Use Your Folder Structure</h3>
              <p className="text-sm text-gray-500 mt-0.5">
                Browse and use your existing Google Drive folders - no new structure required
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-4 bg-white rounded-lg border border-gray-200">
            <Link2 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-gray-900">Attach to Records</h3>
              <p className="text-sm text-gray-500 mt-0.5">
                Link files to contacts, opportunities, and other records for easy access
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-4 bg-white rounded-lg border border-gray-200">
            <Shield className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-gray-900">Secure & Private</h3>
              <p className="text-sm text-gray-500 mt-0.5">
                Files remain in your Google Drive. We only store references, not your actual files.
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3 text-left">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800">Unable to connect</p>
              <p className="text-sm text-amber-700 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        <button
          onClick={onConnect}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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

        <p className="text-xs text-gray-500 mt-4">
          By connecting, you agree to grant this application access to view and manage files
          in your Google Drive that you select.
        </p>
      </div>
    </div>
  );
}
