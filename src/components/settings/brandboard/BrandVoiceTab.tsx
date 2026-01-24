import { useState, useEffect } from 'react';
import { Plus, Search, MessageSquareText, MoreVertical, CheckCircle2, Copy, Archive, Star } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import {
  getBrandVoices,
  activateBrandVoice,
  archiveBrandVoice,
  duplicateBrandVoice,
} from '../../../services/brandboard';
import type { BrandVoiceWithVersion } from '../../../types';
import { BrandVoiceDrawer } from './BrandVoiceDrawer';

interface BrandVoiceTabProps {
  onSuccess?: () => void;
}

export function BrandVoiceTab({ onSuccess }: BrandVoiceTabProps) {
  const { user, hasPermission } = useAuth();
  const [voices, setVoices] = useState<BrandVoiceWithVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState<BrandVoiceWithVersion | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const canManage = hasPermission('brandboard.manage');
  const canActivate = hasPermission('brandboard.activate');

  useEffect(() => {
    if (user?.organization_id) {
      loadVoices();
    }
  }, [user?.organization_id]);

  const loadVoices = async () => {
    if (!user?.organization_id) return;
    setLoading(true);
    try {
      const data = await getBrandVoices(user.organization_id, { search: search || undefined });
      setVoices(data);
    } catch (error) {
      console.error('Failed to load brand voices:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (user?.organization_id) loadVoices();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const handleCreate = () => {
    setSelectedVoice(null);
    setDrawerOpen(true);
  };

  const handleEdit = (voice: BrandVoiceWithVersion) => {
    setSelectedVoice(voice);
    setDrawerOpen(true);
    setMenuOpenId(null);
  };

  const handleActivate = async (voice: BrandVoiceWithVersion) => {
    try {
      await activateBrandVoice(voice.id);
      await loadVoices();
      onSuccess?.();
    } catch (error) {
      console.error('Failed to activate brand voice:', error);
    }
    setMenuOpenId(null);
  };

  const handleDuplicate = async (voice: BrandVoiceWithVersion) => {
    if (!user?.id) return;
    try {
      await duplicateBrandVoice(voice.id, `${voice.name} (Copy)`, user.id);
      await loadVoices();
      onSuccess?.();
    } catch (error) {
      console.error('Failed to duplicate brand voice:', error);
    }
    setMenuOpenId(null);
  };

  const handleArchive = async (voice: BrandVoiceWithVersion) => {
    if (!window.confirm(`Are you sure you want to archive "${voice.name}"?`)) return;
    try {
      await archiveBrandVoice(voice.id);
      await loadVoices();
      onSuccess?.();
    } catch (error) {
      console.error('Failed to archive brand voice:', error);
    }
    setMenuOpenId(null);
  };

  const handleDrawerClose = () => {
    setDrawerOpen(false);
    setSelectedVoice(null);
  };

  const handleDrawerSave = () => {
    loadVoices();
    onSuccess?.();
    handleDrawerClose();
  };

  const getToneLabel = (value: number): string => {
    if (value < 35) return 'Low';
    if (value < 70) return 'Med';
    return 'High';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search brand voices..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        {canManage && (
          <button
            onClick={handleCreate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Brand Voice
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
        </div>
      ) : voices.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
          <MessageSquareText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No brand voices yet</h3>
          <p className="text-gray-500 mb-4">Create your first brand voice to guide AI communications.</p>
          {canManage && (
            <button
              onClick={handleCreate}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700"
            >
              <Plus className="w-4 h-4" />
              Create Brand Voice
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {voices.map((voice) => (
            <div
              key={voice.id}
              className={`relative bg-white rounded-lg border ${
                voice.active ? 'border-emerald-300 ring-1 ring-emerald-100' : 'border-gray-200'
              } p-4 hover:shadow-md transition-shadow cursor-pointer`}
              onClick={() => canManage && handleEdit(voice)}
            >
              {voice.active && (
                <div className="absolute -top-2 -right-2">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-emerald-700 bg-emerald-100 rounded-full border border-emerald-200">
                    <Star className="w-3 h-3 fill-current" />
                    Active
                  </span>
                </div>
              )}

              <div className="flex items-start gap-4">
                <div className="p-2.5 bg-emerald-50 rounded-lg">
                  <MessageSquareText className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-gray-900 truncate">{voice.name}</h4>
                  {voice.summary && (
                    <p className="text-sm text-gray-500 line-clamp-2 mt-0.5">{voice.summary}</p>
                  )}

                  {voice.latest_version?.tone_settings && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {Object.entries(voice.latest_version.tone_settings).map(([key, value]) => (
                        <span
                          key={key}
                          className="inline-flex items-center px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded capitalize"
                        >
                          {key}: {getToneLabel(value)}
                        </span>
                      ))}
                    </div>
                  )}

                  <span className="text-xs text-gray-400 mt-2 block">
                    v{voice.latest_version?.version_number || 1}
                  </span>
                </div>

                {canManage && (
                  <div className="relative" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setMenuOpenId(menuOpenId === voice.id ? null : voice.id)}
                      className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    {menuOpenId === voice.id && (
                      <div className="absolute right-0 top-8 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                        {canActivate && !voice.active && (
                          <button
                            onClick={() => handleActivate(voice)}
                            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            Set as Active
                          </button>
                        )}
                        <button
                          onClick={() => handleDuplicate(voice)}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                        >
                          <Copy className="w-4 h-4" />
                          Duplicate
                        </button>
                        {!voice.active && (
                          <button
                            onClick={() => handleArchive(voice)}
                            className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                          >
                            <Archive className="w-4 h-4" />
                            Archive
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {drawerOpen && (
        <BrandVoiceDrawer
          voice={selectedVoice}
          onClose={handleDrawerClose}
          onSave={handleDrawerSave}
        />
      )}
    </div>
  );
}
