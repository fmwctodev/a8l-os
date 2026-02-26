import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { Loader2, Film } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import type { MediaStylePreset } from '../../services/mediaStylePresets';
import { getStylePresets } from '../../services/mediaStylePresets';
import { StylePresetsManager } from '../../components/settings/media-presets/StylePresetsManager';

const BLOCKED_ROLES = ['Team Lead', 'Agent'];

export function MediaStylePresetsPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [presets, setPresets] = useState<MediaStylePreset[]>([]);
  const [loading, setLoading] = useState(true);

  const roleName = user?.role?.name;
  const isBlocked = roleName && BLOCKED_ROLES.includes(roleName);

  useEffect(() => {
    loadPresets();
  }, []);

  async function loadPresets() {
    try {
      setLoading(true);
      const data = await getStylePresets(false);
      setPresets(data);
    } catch (err) {
      console.error('Failed to load style presets:', err);
      showToast('Failed to load style presets', 'error');
    } finally {
      setLoading(false);
    }
  }

  if (isBlocked) {
    return <Navigate to="/unauthorized" replace />;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500/20 to-cyan-500/20 flex items-center justify-center">
          <Film className="w-5 h-5 text-teal-400" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-white">Media Style Presets</h1>
          <p className="text-sm text-slate-400">
            Configure video generation style presets used by the AI Social Chat and Media Studio.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
        </div>
      ) : (
        <StylePresetsManager
          presets={presets}
          onRefresh={loadPresets}
        />
      )}
    </div>
  );
}
