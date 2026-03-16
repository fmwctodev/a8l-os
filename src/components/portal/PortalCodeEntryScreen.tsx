import { useEffect, useRef, useState, useCallback } from 'react';
import { Shield, RefreshCw, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { useClientPortal } from '../../contexts/ClientPortalContext';

function useCountdown(expiresAt: string | null) {
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (!expiresAt) { setSecondsLeft(0); return; }
    function update() {
      const diff = Math.max(0, Math.floor((new Date(expiresAt!).getTime() - Date.now()) / 1000));
      setSecondsLeft(diff);
    }
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const label = `${minutes}:${String(seconds).padStart(2, '0')}`;
  return { secondsLeft, label };
}

export function PortalCodeEntryScreen() {
  const { authInfo, submitCode, sendCode, state } = useClientPortal();
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [rememberDevice, setRememberDevice] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);
  const [resendCooldown, setResendCooldown] = useState(60);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const { secondsLeft, label: countdownLabel } = useCountdown(authInfo?.codeExpiresAt || null);
  const isVerifying = state === 'verifying';
  const isSending = state === 'sending_code';

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setInterval(() => {
      setResendCooldown(prev => {
        if (prev <= 1) { clearInterval(id); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const handleDigitChange = useCallback((index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newDigits = [...digits];
    if (value.length > 1) {
      const pasted = value.replace(/\D/g, '').slice(0, 6);
      const filled = [...pasted.split(''), ...Array(6).fill('')].slice(0, 6);
      setDigits(filled);
      const nextEmpty = filled.findIndex(d => d === '');
      const focusIndex = nextEmpty === -1 ? 5 : nextEmpty;
      inputRefs.current[focusIndex]?.focus();
      return;
    }
    newDigits[index] = value;
    setDigits(newDigits);
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }, [digits]);

  const handleKeyDown = useCallback((index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }, [digits]);

  async function handleVerify() {
    const code = digits.join('');
    if (code.length !== 6) return;
    setError(null);
    const result = await submitCode(code, rememberDevice);
    if (!result.success) {
      if (result.expired) {
        setError('This code has expired. Please request a new one.');
      } else if (result.maxAttemptsExceeded) {
        setError('Too many incorrect attempts. Please request a new code.');
      } else {
        const remaining = result.attemptsRemaining;
        setAttemptsRemaining(remaining ?? null);
        setError(
          remaining !== undefined && remaining > 0
            ? `Incorrect code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
            : 'Incorrect code. Please try again.'
        );
      }
      setDigits(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    }
  }

  async function handleResend() {
    if (resendCooldown > 0) return;
    setError(null);
    setDigits(['', '', '', '', '', '']);
    setAttemptsRemaining(null);
    const result = await sendCode();
    if (result.success) {
      setResendCooldown(60);
      inputRefs.current[0]?.focus();
    } else {
      setError(result.error || 'Failed to resend. Please try again.');
    }
  }

  const codeComplete = digits.every(d => d !== '');
  const expired = secondsLeft === 0;

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
            <h2 className="text-xl font-bold text-gray-900 mb-2">Enter Verification Code</h2>
            <p className="text-gray-500 text-sm leading-relaxed mb-2">
              We sent a 6-digit code to{' '}
              <span className="font-semibold text-gray-700">{authInfo?.maskedEmail || 'your email'}</span>.
              Enter it below.
            </p>

            <div className="flex items-center gap-1.5 mb-6">
              <div className={`w-2 h-2 rounded-full ${expired ? 'bg-red-400' : 'bg-emerald-400'}`} />
              {expired ? (
                <span className="text-xs text-red-500 font-medium">Code expired</span>
              ) : (
                <span className="text-xs text-gray-400">
                  Expires in <span className="font-semibold text-gray-600">{countdownLabel}</span>
                </span>
              )}
            </div>

            <div className="flex gap-2 justify-center mb-6">
              {digits.map((digit, i) => (
                <input
                  key={i}
                  ref={el => { inputRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={digit}
                  onChange={e => handleDigitChange(i, e.target.value)}
                  onKeyDown={e => handleKeyDown(i, e)}
                  className={`w-11 h-14 text-center text-xl font-bold border-2 rounded-xl transition-colors focus:outline-none focus:border-blue-500 ${
                    error
                      ? 'border-red-300 bg-red-50 text-red-600'
                      : digit
                      ? 'border-blue-400 bg-blue-50 text-blue-700'
                      : 'border-gray-200 bg-gray-50 text-gray-900'
                  }`}
                  disabled={isVerifying || expired}
                />
              ))}
            </div>

            {error && (
              <div className="bg-red-50 rounded-xl px-4 py-3 flex items-start gap-3 mb-4 border border-red-200">
                <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <label className="flex items-center gap-3 cursor-pointer mb-6 select-none">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={rememberDevice}
                  onChange={e => setRememberDevice(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-gray-200 peer-checked:bg-blue-600 rounded-full transition-colors" />
                <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5 shadow-sm" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Remember this device for 30 days</p>
                <p className="text-xs text-gray-400">Skip verification on this browser</p>
              </div>
            </label>

            <button
              onClick={handleVerify}
              disabled={!codeComplete || isVerifying || expired}
              className="w-full bg-blue-600 text-white font-semibold py-3 px-6 rounded-xl hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 mb-4"
            >
              {isVerifying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Verify Access
                </>
              )}
            </button>

            <button
              onClick={handleResend}
              disabled={resendCooldown > 0 || isSending}
              className="w-full text-sm text-gray-500 hover:text-blue-600 disabled:text-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 py-2"
            >
              {isSending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Sending new code...
                </>
              ) : resendCooldown > 0 ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5" />
                  Resend code in {resendCooldown}s
                </>
              ) : (
                <>
                  <RefreshCw className="w-3.5 h-3.5" />
                  Resend code
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
