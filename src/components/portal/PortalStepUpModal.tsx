import { useEffect, useRef, useState, useCallback } from 'react';
import { Shield, AlertCircle, Loader2, CheckCircle, RefreshCw } from 'lucide-react';
import { useClientPortalV2 } from '../../contexts/ClientPortalContextV2';
import { sendLoginCode, verifyLoginCode } from '../../services/clientPortal';

interface PortalStepUpModalProps {
  onSuccess: () => void;
  onCancel: () => void;
  actionLabel?: string;
}

export function PortalStepUpModal({ onSuccess, onCancel, actionLabel = 'this action' }: PortalStepUpModalProps) {
  const { contact, completeStepUp } = useClientPortalV2();
  const authInfo = contact ? { maskedEmail: contact.contactEmail } : null;
  const [phase, setPhase] = useState<'send' | 'enter'>('send');
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setInterval(() => setResendCooldown(p => Math.max(0, p - 1)), 1000);
    return () => clearInterval(id);
  }, [resendCooldown]);

  async function handleSendCode() {
    if (!contact?.contactEmail) return;
    setError(null);
    setIsSending(true);
    try {
      const result = await sendLoginCode(contact.contactEmail);
      if (result.success) {
        setPhase('enter');
        setResendCooldown(60);
        setTimeout(() => inputRefs.current[0]?.focus(), 50);
      } else {
        setError(result.rateLimited ? 'Please wait before requesting another code.' : 'Failed to send code.');
      }
    } catch {
      setError('Failed to send code. Please try again.');
    } finally {
      setIsSending(false);
    }
  }

  const handleDigitChange = useCallback((index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newDigits = [...digits];
    if (value.length > 1) {
      const pasted = value.replace(/\D/g, '').slice(0, 6);
      const filled = [...pasted.split(''), ...Array(6).fill('')].slice(0, 6);
      setDigits(filled);
      const nextEmpty = filled.findIndex(d => d === '');
      inputRefs.current[nextEmpty === -1 ? 5 : nextEmpty]?.focus();
      return;
    }
    newDigits[index] = value;
    setDigits(newDigits);
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
  }, [digits]);

  const handleKeyDown = useCallback((index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }, [digits]);

  async function handleVerify() {
    const code = digits.join('');
    if (code.length !== 6 || !contact?.contactEmail) return;
    setError(null);
    setIsVerifying(true);
    try {
      const result = await verifyLoginCode(contact.contactEmail, code, false);
      if (result.success) {
        await completeStepUp();
        onSuccess();
      } else {
        setError(
          result.maxAttemptsExceeded
            ? 'Too many attempts. Please request a new code.'
            : `Incorrect code.${result.attemptsRemaining != null ? ` ${result.attemptsRemaining} attempt${result.attemptsRemaining === 1 ? '' : 's'} remaining.` : ''}`
        );
        setDigits(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
        if (result.maxAttemptsExceeded) setPhase('send');
      }
    } catch {
      setError('Verification failed. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  }

  async function handleResend() {
    if (resendCooldown > 0 || !contact?.contactEmail) return;
    setError(null);
    setDigits(['', '', '', '', '', '']);
    setIsSending(true);
    try {
      const result = await sendLoginCode(contact.contactEmail);
      if (result.success) {
        setResendCooldown(60);
        inputRefs.current[0]?.focus();
      } else {
        setError('Failed to resend.');
      }
    } catch {
      setError('Failed to resend.');
    } finally {
      setIsSending(false);
    }
  }

  const codeComplete = digits.every(d => d !== '');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
        <div className="bg-blue-600 px-6 py-5 flex items-center gap-3">
          <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-white font-semibold text-sm">Security Verification</p>
            <p className="text-blue-200 text-xs">Required to complete {actionLabel}</p>
          </div>
        </div>

        <div className="p-6">
          {phase === 'send' ? (
            <>
              <p className="text-gray-600 text-sm leading-relaxed mb-4">
                For your security, this action requires a fresh identity verification.
                We'll send a code to{' '}
                <span className="font-semibold text-gray-800">{authInfo?.maskedEmail || 'your email'}</span>.
              </p>

              {error && (
                <div className="bg-red-50 rounded-xl px-3 py-2.5 flex items-start gap-2 mb-4 border border-red-200">
                  <AlertCircle className="w-3.5 h-3.5 text-red-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-red-700">{error}</p>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={onCancel}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendCode}
                  disabled={isSending}
                  className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  {isSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  {isSending ? 'Sending...' : 'Send Code'}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-gray-500 text-xs mb-4">
                Enter the 6-digit code sent to{' '}
                <span className="font-semibold text-gray-700">{authInfo?.maskedEmail}</span>
              </p>

              <div className="flex gap-1.5 justify-center mb-4">
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
                    className={`w-9 h-11 text-center text-lg font-bold border-2 rounded-lg transition-colors focus:outline-none focus:border-blue-500 ${
                      error
                        ? 'border-red-300 bg-red-50 text-red-600'
                        : digit
                        ? 'border-blue-400 bg-blue-50 text-blue-700'
                        : 'border-gray-200 bg-gray-50 text-gray-900'
                    }`}
                    disabled={isVerifying}
                  />
                ))}
              </div>

              {error && (
                <div className="bg-red-50 rounded-xl px-3 py-2.5 flex items-start gap-2 mb-3 border border-red-200">
                  <AlertCircle className="w-3.5 h-3.5 text-red-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-red-700">{error}</p>
                </div>
              )}

              <button
                onClick={handleVerify}
                disabled={!codeComplete || isVerifying}
                className="w-full bg-blue-600 text-white font-semibold py-2.5 px-4 rounded-xl hover:bg-blue-700 disabled:opacity-40 transition-colors flex items-center justify-center gap-2 mb-2 text-sm"
              >
                {isVerifying ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Verifying...</>
                ) : (
                  <><CheckCircle className="w-3.5 h-3.5" /> Confirm</>
                )}
              </button>

              <button
                onClick={handleResend}
                disabled={resendCooldown > 0 || isSending}
                className="w-full text-xs text-gray-400 hover:text-blue-600 disabled:text-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5 py-1.5"
              >
                <RefreshCw className="w-3 h-3" />
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
