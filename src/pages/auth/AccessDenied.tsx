import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export function AccessDenied() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const reason = params.get('reason') ?? 'unauthorized';
  const detail = params.get('detail') ?? '';

  useEffect(() => {
    // Make sure no auth session lingers — the trigger rolled back the
    // public.users row but the auth session may still be open.
    supabase.auth.signOut().catch(() => undefined);
  }, []);

  const headline =
    reason === 'domain_not_authorized'
      ? 'Your email domain is not authorized'
      : reason === 'provider_not_allowed'
        ? 'This sign-in method is not allowed for your domain'
        : 'Access denied';

  const body =
    reason === 'domain_not_authorized'
      ? 'The email address you signed in with is not registered with any organization on this platform. Contact your administrator to register your domain.'
      : reason === 'provider_not_allowed'
        ? 'Your organization restricts which sign-in providers can be used with your email domain. Try a different sign-in method.'
        : 'You do not have permission to access this platform.';

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
            <ShieldAlert className="w-8 h-8 text-red-400" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-white mb-3">{headline}</h1>
        <p className="text-slate-400 mb-2">{body}</p>
        {detail && (
          <p className="text-slate-500 text-sm mb-6 font-mono break-all">{detail}</p>
        )}
        <button
          type="button"
          onClick={() => navigate('/login', { replace: true })}
          className="mt-4 py-2.5 px-6 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-600 text-white font-medium hover:from-cyan-600 hover:to-teal-700 transition-all"
        >
          Return to sign-in
        </button>
      </div>
    </div>
  );
}
