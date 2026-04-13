import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Loader2, ArrowRight, ShieldCheck } from 'lucide-react';
import { useClientPortalV2 } from '../../../contexts/ClientPortalContextV2';
import { sendLoginCode } from '../../../services/clientPortal';

export function ClientPortalLoginPage() {
  const { state, inviteToken, pendingEmail, setPendingEmail, setState } = useClientPortalV2();
  const navigate = useNavigate();

  const [email, setEmail] = useState(pendingEmail ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If already authenticated, redirect to dashboard
  if (state === 'authenticated') {
    navigate('/client-portal/dashboard', { replace: true });
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const result = await sendLoginCode(email.trim(), inviteToken ?? undefined);
      if (result.rateLimited) {
        setError('Please wait 60 seconds before requesting another code.');
      } else {
        setPendingEmail(email.trim());
        setState('needs_code');
        navigate('/client-portal/verify');
      }
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const showNoInviteWarning = !inviteToken && state === 'unauthenticated';

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 sm:p-10 shadow-xl">
          <div className="flex items-center justify-center w-14 h-14 bg-cyan-500/10 rounded-xl mb-6 mx-auto">
            <ShieldCheck size={28} className="text-cyan-400" />
          </div>

          <h1 className="text-2xl font-bold text-white text-center mb-2">
            Client Portal
          </h1>
          <p className="text-sm text-slate-400 text-center mb-8">
            Enter your email to receive a verification code
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                autoFocus
                required
                className="w-full pl-11 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all text-sm"
              />
            </div>

            {error && (
              <p className="text-sm text-red-400 text-center">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full flex items-center justify-center gap-2 py-3 bg-cyan-500 hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors text-sm"
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <>
                  Send Verification Code
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {showNoInviteWarning && (
            <p className="text-xs text-slate-500 text-center mt-6 leading-relaxed">
              If you have not received an invite email, please contact your service provider for access.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
