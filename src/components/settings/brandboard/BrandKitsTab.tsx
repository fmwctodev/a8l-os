import { useState, useEffect } from 'react';
import { Plus, Search, Paintbrush, MoreVertical, CheckCircle2, Copy, Archive, Star } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import {
  getBrandKits,
  activateBrandKit,
  archiveBrandKit,
  duplicateBrandKit,
  getBrandLogoUrl,
} from '../../../services/brandboard';
import type { BrandKitWithVersion } from '../../../types';
import { BrandKitDrawer } from './BrandKitDrawer';

interface BrandKitsTabProps {
  onSuccess?: () => void;
}

export function BrandKitsTab({ onSuccess }: BrandKitsTabProps) {
  const { user, hasPermission } = useAuth();
  const [kits, setKits] = useState<BrandKitWithVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedKit, setSelectedKit] = useState<BrandKitWithVersion | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [logoUrls, setLogoUrls] = useState<Record<string, string>>({});

  const canManage = hasPermission('brandboard.manage');
  const canActivate = hasPermission('brandboard.activate');

  useEffect(() => {
    if (user?.organization_id) {
      loadKits();
    }
  }, [user?.organization_id]);

  const loadKits = async () => {
    if (!user?.organization_id) return;
    setLoading(true);
    try {
      const data = await getBrandKits(user.organization_id, { search: search || undefined });
      setKits(data);

      const urls: Record<string, string> = {};
      for (const kit of data) {
        if (kit.latest_version?.logos?.[0]) {
          const url = await getBrandLogoUrl(kit.latest_version.logos[0]);
          if (url) urls[kit.id] = url;
        }
      }
      setLogoUrls(urls);
    } catch (error) {
      console.error('Failed to load brand kits:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (user?.organization_id) loadKits();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const handleCreate = () => {
    setSelectedKit(null);
    setDrawerOpen(true);
  };

  const handleEdit = (kit: BrandKitWithVersion) => {
    setSelectedKit(kit);
    setDrawerOpen(true);
    setMenuOpenId(null);
  };

  const handleActivate = async (kit: BrandKitWithVersion) => {
    try {
      await activateBrandKit(kit.id);
      await loadKits();
      onSuccess?.();
    } catch (error) {
      console.error('Failed to activate brand kit:', error);
    }
    setMenuOpenId(null);
  };

  const handleDuplicate = async (kit: BrandKitWithVersion) => {
    if (!user?.id) return;
    try {
      await duplicateBrandKit(kit.id, `${kit.name} (Copy)`, user.id);
      await loadKits();
      onSuccess?.();
    } catch (error) {
      console.error('Failed to duplicate brand kit:', error);
    }
    setMenuOpenId(null);
  };

  const handleArchive = async (kit: BrandKitWithVersion) => {
    if (!window.confirm(`Are you sure you want to archive "${kit.name}"?`)) return;
    try {
      await archiveBrandKit(kit.id);
      await loadKits();
      onSuccess?.();
    } catch (error) {
      console.error('Failed to archive brand kit:', error);
    }
    setMenuOpenId(null);
  };

  const handleDrawerClose = () => {
    setDrawerOpen(false);
    setSelectedKit(null);
  };

  const handleDrawerSave = () => {
    loadKits();
    onSuccess?.();
    handleDrawerClose();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search brand kits..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        {canManage && (
          <button
            onClick={handleCreate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Brand Kit
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : kits.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
          <Paintbrush className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No brand kits yet</h3>
          <p className="text-gray-500 mb-4">Create your first brand kit to define your visual identity.</p>
          {canManage && (
            <button
              onClick={handleCreate}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              Create Brand Kit
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {kits.map((kit) => (
            <div
              key={kit.id}
              className={`relative bg-white rounded-lg border ${
                kit.active ? 'border-blue-300 ring-1 ring-blue-100' : 'border-gray-200'
              } p-4 hover:shadow-md transition-shadow cursor-pointer`}
              onClick={() => canManage && handleEdit(kit)}
            >
              {kit.active && (
                <div className="absolute -top-2 -right-2">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-blue-700 bg-blue-100 rounded-full border border-blue-200">
                    <Star className="w-3 h-3 fill-current" />
                    Active
                  </span>
                </div>
              )}

              <div className="flex items-start gap-4">
                {logoUrls[kit.id] ? (
                  <img
                    src={logoUrls[kit.id]}
                    alt={kit.name}
                    className="w-14 h-14 object-contain rounded-lg border border-gray-200 bg-gray-50"
                  />
                ) : (
                  <div className="w-14 h-14 flex items-center justify-center rounded-lg border border-gray-200 bg-gray-50">
                    <Paintbrush className="w-6 h-6 text-gray-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-gray-900 truncate">{kit.name}</h4>
                  {kit.description && (
                    <p className="text-sm text-gray-500 line-clamp-1 mt-0.5">{kit.description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    {kit.latest_version?.colors && (
                      <div className="flex -space-x-1">
                        {Object.values(kit.latest_version.colors).slice(0, 5).map((color, i) => (
                          <div
                            key={i}
                            className="w-4 h-4 rounded-full border-2 border-white shadow-sm"
                            style={{ backgroundColor: color?.hex || '#ccc' }}
                          />
                        ))}
                      </div>
                    )}
                    <span className="text-xs text-gray-400">
                      v{kit.latest_version?.version_number || 1}
                    </span>
                  </div>
                </div>

                {canManage && (
                  <div className="relative" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setMenuOpenId(menuOpenId === kit.id ? null : kit.id)}
                      className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    {menuOpenId === kit.id && (
                      <div className="absolute right-0 top-8 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
                        {canActivate && !kit.active && (
                          <button
                            onClick={() => handleActivate(kit)}
                            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            Set as Active
                          </button>
                        )}
                        <button
                          onClick={() => handleDuplicate(kit)}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                        >
                          <Copy className="w-4 h-4" />
                          Duplicate
                        </button>
                        {!kit.active && (
                          <button
                            onClick={() => handleArchive(kit)}
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
        <BrandKitDrawer
          kit={selectedKit}
          onClose={handleDrawerClose}
          onSave={handleDrawerSave}
        />
      )}
    </div>
  );
}
