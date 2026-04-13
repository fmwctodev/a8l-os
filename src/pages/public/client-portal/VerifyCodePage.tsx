import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import { useClientPortalV2 } from '../../../contexts/ClientPortalContextV2';
import { verifyLoginCode, sendLoginCode, validateSession } from '../../../services/clientPortal';

const CODE_LENGTH = 6;

export function ClientPortalVerifyCodePage() {
  const { state, pendingEmail, inviteToken, authenticate } = useClientPortalV2();
  const navigate = useNavigate();

  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rememberDevice, setRememberDevice] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(60);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  // Redirect if no pending email
  useEffect(() => {
    if (state !== 'needs_code' && state !== 'unauthenticated') return;
    if (!pendingEmail) {
      navigate('/client-portal', { replace: true });
    }
  }, [state, pendingEmail, navigate]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => setResendCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleDigitChange = useCallback(
    (index: number, value: string) => {
      if (!/^\d?$/.test(value)) return;
      const next = [...digits];
      next[index] = value;
      setDigits(next);
      setError(null);

      if (value && index < CODE_LENGTH - 1) {
        inputsRef.current[index + 1]?.focus();
      }
    },
    [digits]
  );

  const handleKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent) => {
      if (e.key === 'Backspace' && !digits[index] && index > 0) {
        inputsRef.current[index - 1]?.focus();
      }
    },
    [digits]
  );

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, CODE_LENGTH);
    if (pasted.length > 0) {
      setDigits(pasted.split('').concat(Array(CODE_LENGTH).fill('')).slice(0, CODE_LENGTH));
      inputsRef.current[Math.min(pasted.length, CODE_LENGTH - 1)]?.focus();
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = digits.join('');
    if (code.length !== CODE_LENGTH || !pendingEmail) return;

    setLoading(true);
    setError(null);

    try {
      const result = await verifyLoginCode(
        pendingEmail,
        code,
        rememberDevice,
        inviteToken ?? undefined
      );

      if (result.success && result.sessionToken) {
        // Validate the new session to get contact info for the context
        const info = await validateSession(result.sessionToken);
        if (info.valid) {
          authenticate(result.sessionToken, info);
        } else {
          setError('Session could not be validated. Please try again.');
        }
      } else if (result.maxAttemptsExceeded) {
        setError('Too many incorrect attempts. Please request a new code.');
      } else {
        setError(
          result.attemptsRemaining !== undefined
            ? `Incorrect code. ${result.attemptsRemaining} attempt${result.attemptsRemaining !== 1 ? 's' : ''} remaining.`
            : 'Incorrect code. Please try again.'
        );
        setDigits(Array(CODE_LENGTH).fill(''));
        inputsRef.current[0]?.focus();
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || !pendingEmail) return;
    try {
      await sendLoginCode(pendingEmail, inviteToken ?? undefined);
      setResendCooldown(60);
      setError(null);
    } catch {
      setError('Failed to resend code.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 sm:p-10 shadow-xl">
          <div className="flex items-center justify-center w-14 h-14 bg-cyan-500/10 rounded-xl mb-6 mx-auto">
            <ShieldCheck size={28} className="text-cyan-400" />
          </div>

          <h1 className="text-2xl font-bold text-white text-center mb-2">
            Enter Verification Code
          </h1>
          <p className="text-sm text-slate-400 text-center mb-8">
            We sent a 6-digit code to{' '}
            <strong className="text-white">{pendingEmail}</strong>
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* OTP digit inputs */}
            <div className="flex justify-center gap-2" onPaste={handlePaste}>
              {digits.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => { inputsRef.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={d}
                  onChange={(e) => handleDigitChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  autoFocus={i === 0}
                  className="w-12 h-14 text-center text-xl font-bold bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                />
              ))}
            </div>

            {error && (
              <p className="text-sm text-red-400 text-center">{error}</p>
            )}

            {/* Remember device */}
            <label className="flex items-center gap-2 cursor-pointer justify-center">
              <input
                type="checkbox"
                checked={rememberDevice}
                onChange={(e) => setRememberDevice(e.target.checked)}
                className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-cyan-500"
              />
              <span className="text-sm text-slate-400">
                Remember this device for 30 days
              </span>
            </label>

            <button
              type="submit"
              disabled={loading || digits.join('').length !== CODE_LENGTH}
              className="w-full flex items-center justify-center gap-2 py-3 bg-cyan-500 hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors text-sm"
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                'Verify & Sign In'
              )}
            </button>
          </form>

          {/* Resend button */}
          <div className="mt-6 text-center">
            <button
              onClick={handleResend}
              disabled={resendCooldown > 0}
              className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <RefreshCw size={14} />
              {resendCooldown > 0
                ? `Resend code in ${resendCooldown}s`
                : 'Resend code'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
