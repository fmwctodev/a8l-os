import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Shield, ArrowLeft, Loader2 } from 'lucide-react';

export function ForgotPassword() {
  const { session, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && session) {
      navigate('/', { replace: true });
    }
  }, [session, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
      </div>
    );
  }

  if (session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-8">
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-cyan-500/10 flex items-center justify-center mb-6">
              <Shield className="w-8 h-8 text-cyan-400" />
            </div>

            <h1 className="text-xl font-semibold text-white mb-4">
              Password Reset Required
            </h1>

            <p className="text-slate-400 leading-relaxed mb-4">
              For security reasons, password resets are handled manually.
              Please contact your system administrator to regain access to your account.
            </p>

            <p className="text-slate-500 text-sm mb-8">
              If you are unsure who your administrator is, contact your organization's internal support team.
            </p>

            <div className="w-full space-y-3">
              <Link
                to="/login"
                className="w-full py-2.5 px-4 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-600 text-white font-medium hover:from-cyan-600 hover:to-teal-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-slate-800 transition-all duration-200 flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Sign In
              </Link>

              <a
                href="mailto:support@autom8ionlab.com?subject=Password%20Reset%20Request"
                className="w-full py-2.5 px-4 rounded-lg bg-slate-800 border border-slate-700 text-white font-medium hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-slate-800 transition-all duration-200 flex items-center justify-center"
              >
                Contact Administrator
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
