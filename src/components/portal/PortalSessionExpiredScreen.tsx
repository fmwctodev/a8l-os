import { Clock, RefreshCw, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useClientPortal } from '../../contexts/ClientPortalContext';

export function PortalSessionExpiredScreen() {
  const { authInfo, sendCode } = useClientPortal();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRequestNew() {
    setLoading(true);
    setError(null);
    const result = await sendCode();
    setLoading(false);
    if (!result.success) {
      setError(result.error || 'Failed to send code. Please try again.');
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
          <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Clock className="w-7 h-7 text-amber-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Session Expired</h2>
          <p className="text-gray-500 text-sm leading-relaxed mb-6">
            Your portal session has expired. For your security, please verify your identity again to continue.
          </p>

          {error && (
            <div className="bg-red-50 rounded-xl px-4 py-3 text-left mb-4 border border-red-200">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <button
            onClick={handleRequestNew}
            disabled={loading}
            className="w-full bg-blue-600 text-white font-semibold py-3 px-6 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Sending Code...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                Request New Code
              </>
            )}
          </button>

          {authInfo?.supportEmail && (
            <p className="text-xs text-gray-400 mt-4">
              Need help?{' '}
              <a href={`mailto:${authInfo.supportEmail}`} className="text-blue-600 hover:underline">
                Contact support
              </a>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
