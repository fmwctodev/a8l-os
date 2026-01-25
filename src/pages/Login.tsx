import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Loader2, AlertCircle, Eye, EyeOff } from 'lucide-react';

function getErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'Invalid email or password';
  }

  const message = error.message.toLowerCase();

  if (message.includes('invalid login credentials') || message.includes('invalid credentials')) {
    return 'Invalid email or password';
  }
  if (message.includes('email not confirmed')) {
    return 'Please verify your email address';
  }
  if (message.includes('user not found')) {
    return 'Invalid email or password';
  }
  if (message.includes('disabled') || message.includes('banned')) {
    return 'Account disabled. Contact your administrator.';
  }
  if (message.includes('rate') || message.includes('too many')) {
    return 'Too many attempts. Please try again later.';
  }
  if (message.includes('network') || message.includes('fetch')) {
    return 'Unable to connect. Please check your connection.';
  }

  return 'Invalid email or password';
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { signIn, user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/';

  useEffect(() => {
    if (!authLoading && user) {
      navigate(from, { replace: true });
    }
  }, [user, authLoading, navigate, from]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setEmailError('');

    if (!isValidEmail(email)) {
      setEmailError('Please enter a valid email address');
      return;
    }

    setIsLoading(true);

    try {
      await signIn(email, password);
    } catch (err) {
      setError(getErrorMessage(err));
      setPassword('');
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
      </div>
    );
  }

  if (user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img
            src="/assets/logo/logo.png"
            alt="Autom8ion Lab OS"
            className="h-16 mx-auto mb-4"
          />
          <h1 className="text-2xl font-bold text-white mb-1">Autom8ion Lab OS</h1>
          <p className="text-slate-400">Sign in to your workspace</p>
        </div>

        <div className="bg-slate-800 rounded-xl border border-slate-700 p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div
                className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm"
                role="alert"
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (emailError) setEmailError('');
                }}
                required
                autoComplete="email"
                aria-describedby={emailError ? 'email-error' : undefined}
                aria-invalid={!!emailError}
                className={`w-full px-4 py-2.5 rounded-lg bg-slate-900 border text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-colors ${
                  emailError ? 'border-red-500' : 'border-slate-600'
                }`}
                placeholder="you@example.com"
              />
              {emailError && (
                <p id="email-error" className="mt-1.5 text-sm text-red-400">
                  {emailError}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full px-4 py-2.5 pr-11 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-colors"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-cyan-400 focus:outline-none focus:text-cyan-400 transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <Link
                to="/forgot-password"
                className="text-sm text-cyan-400 hover:text-cyan-300 focus:outline-none focus:underline transition-colors"
              >
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-600 text-white font-medium hover:from-cyan-600 hover:to-teal-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Signing in...
                </span>
              ) : (
                'Sign in'
              )}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-slate-500">
          Contact your administrator if you need access
        </p>
      </div>
    </div>
  );
}
