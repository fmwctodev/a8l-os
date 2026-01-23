import { useNavigate } from 'react-router-dom';
import { Lock, ArrowLeft } from 'lucide-react';

export function FeatureDisabled() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="text-center">
        <div className="w-20 h-20 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-6">
          <Lock className="w-10 h-10 text-amber-400" />
        </div>
        <h1 className="text-2xl font-semibold text-white mb-2">Feature Unavailable</h1>
        <p className="text-slate-400 max-w-md mb-8">
          This feature is currently disabled. Check back later or contact your administrator for more information.
        </p>
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </button>
      </div>
    </div>
  );
}
