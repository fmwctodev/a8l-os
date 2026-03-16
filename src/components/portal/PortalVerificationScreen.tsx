import { useState } from 'react';
import { Shield, Mail, AlertCircle, Loader2 } from 'lucide-react';
import { useClientPortal } from '../../contexts/ClientPortalContext';

export function PortalVerificationScreen() {
  const { authInfo, sendCode, state } = useClientPortal();
  const [error, setError] = useState<string | null>(null);

  const isSending = state === 'sending_code';

  async function handleSend() {
    setError(null);
    const result = await sendCode();
    if (!result.success) {
      setError(result.error || 'Failed to send verification code. Please try again.');
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-blue-600 px-8 py-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-blue-100 text-xs font-medium uppercase tracking-wide">
                  {authInfo?.orgName || 'Client Portal'}
                </p>
                <h1 className="text-white font-bold text-lg leading-tight">
                  {authInfo?.projectName || 'Your Project'}
                </h1>
              </div>
            </div>
          </div>

          <div className="px-8 py-8">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Verify Your Access</h2>
            <p className="text-gray-500 text-sm leading-relaxed mb-6">
              To protect your project information, we need to confirm your identity before granting access.
              We'll send a one-time verification code to your email address.
            </p>

            {authInfo?.maskedEmail && (
              <div className="bg-gray-50 rounded-xl px-4 py-3 flex items-center gap-3 mb-6 border border-gray-100">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Mail className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-medium">Code will be sent to</p>
                  <p className="text-sm font-semibold text-gray-900">{authInfo.maskedEmail}</p>
                </div>
              </div>
            )}

            {!authInfo?.hasEmail && (
              <div className="bg-amber-50 rounded-xl px-4 py-3 flex items-start gap-3 mb-6 border border-amber-200">
                <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-amber-700">
                  No email address is on file for this portal. Please contact your project team for assistance.
                </p>
              </div>
            )}

            {error && (
              <div className="bg-red-50 rounded-xl px-4 py-3 flex items-start gap-3 mb-6 border border-red-200">
                <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <button
              onClick={handleSend}
              disabled={isSending || !authInfo?.hasEmail}
              className="w-full bg-blue-600 text-white font-semibold py-3 px-6 rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {isSending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending Code...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4" />
                  Send Verification Code
                </>
              )}
            </button>
          </div>

          {authInfo?.supportEmail && (
            <div className="px-8 pb-6 border-t border-gray-100 pt-4">
              <p className="text-xs text-gray-400 text-center">
                Need help?{' '}
                <a href={`mailto:${authInfo.supportEmail}`} className="text-blue-600 hover:underline">
                  {authInfo.supportEmail}
                </a>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
