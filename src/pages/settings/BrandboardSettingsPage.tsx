import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Paintbrush, MoreVertical, CheckCircle2, Copy, Archive, Eye, Palette } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  getBrandKits,
  activateBrandKit,
  archiveBrandKit,
  duplicateBrandKit,
  getBrandLogoUrl,
  createBrandKit,
} from '../../services/brandboard';
import type { BrandKitWithVersion, BrandKitStatus } from '../../types';

function StatusBadge({ status }: { status: BrandKitStatus }) {
  const styles: Record<BrandKitStatus, string> = {
    draft: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    active: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    archived: 'bg-slate-600/50 text-slate-400 border-slate-500/30',
  };

  const labels: Record<BrandKitStatus, string> = {
    draft: 'Draft',
    active: 'Active',
    archived: 'Archived',
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full border ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function BrandboardSettingsPage() {
  const { user, hasPermission } = useAuth();
  const navigate = useNavigate();
  const [kits, setKits] = useState<BrandKitWithVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [logoUrls, setLogoUrls] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);

  const canManage = hasPermission('brandboard.manage');
  const canActivate = hasPermission('brandboard.activate') || hasPermission('brandboard.publish');

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

  const handleCreate = async () => {
    if (!user?.organization_id || !user?.id) return;
    setCreating(true);
    try {
      const newKit = await createBrandKit(
        user.organization_id,
        { name: 'Untitled Brand Kit' },
        user.id
      );
      navigate(`/settings/brandboard/${newKit.id}`);
    } catch (error) {
      console.error('Failed to create brand kit:', error);
    } finally {
      setCreating(false);
    }
  };

  const handleView = (kit: BrandKitWithVersion) => {
    navigate(`/settings/brandboard/${kit.id}`);
  };

  const handleActivate = async (kit: BrandKitWithVersion) => {
    try {
      await activateBrandKit(kit.id);
      await loadKits();
    } catch (error) {
      console.error('Failed to activate brand kit:', error);
    }
    setMenuOpenId(null);
  };

  const handleDuplicate = async (kit: BrandKitWithVersion) => {
    if (!user?.id) return;
    try {
      const newKit = await duplicateBrandKit(kit.id, `${kit.name} (Copy)`, user.id);
      navigate(`/settings/brandboard/${newKit.id}`);
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
    } catch (error) {
      console.error('Failed to archive brand kit:', error);
    }
    setMenuOpenId(null);
  };

  return (
    <div className="min-h-full bg-slate-900">
      <div className="bg-slate-800 border-b border-slate-700 px-6 py-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-cyan-500/20 to-teal-500/20 rounded-xl border border-cyan-500/30">
            <Palette className="w-7 h-7 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-white">Brandboard</h1>
            <p className="text-sm text-slate-400 mt-0.5">
              Define your brand's visual identity and voice
            </p>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search brand kits..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
            />
          </div>
          {canManage && (
            <button
              onClick={handleCreate}
              disabled={creating}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-teal-600 text-white text-sm font-medium rounded-lg hover:from-cyan-600 hover:to-teal-700 transition-all disabled:opacity-50 shadow-lg shadow-cyan-500/20"
            >
              <Plus className="w-4 h-4" />
              Create Brand Kit
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-600 border-t-cyan-500" />
          </div>
        ) : kits.length === 0 ? (
          <div className="text-center py-16 bg-slate-800 rounded-xl border border-slate-700">
            <Paintbrush className="w-14 h-14 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">No brand kits yet</h3>
            <p className="text-slate-400 mb-6 max-w-md mx-auto">
              Create your first brand kit to define your visual identity, voice, and messaging that powers AI and content across your organization.
            </p>
            {canManage && (
              <button
                onClick={handleCreate}
                disabled={creating}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-teal-600 text-white text-sm font-medium rounded-lg hover:from-cyan-600 hover:to-teal-700 transition-all disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                Create Brand Kit
              </button>
            )}
          </div>
        ) : (
          <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Brand</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Version</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Created By</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Last Updated</th>
                  <th className="w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {kits.map((kit) => (
                  <tr
                    key={kit.id}
                    className="hover:bg-slate-700/30 transition-colors cursor-pointer"
                    onClick={() => handleView(kit)}
                  >
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        {logoUrls[kit.id] ? (
                          <img
                            src={logoUrls[kit.id]}
                            alt={kit.name}
                            className="w-10 h-10 object-contain rounded-lg border border-slate-600 bg-slate-700"
                          />
                        ) : (
                          <div className="w-10 h-10 flex items-center justify-center rounded-lg border border-slate-600 bg-slate-700">
                            <Paintbrush className="w-5 h-5 text-slate-500" />
                          </div>
                        )}
                        <div>
                          <div className="font-medium text-white">{kit.name}</div>
                          {kit.description && (
                            <div className="text-sm text-slate-400 truncate max-w-xs">{kit.description}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge status={kit.status} />
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-slate-300">v{kit.latest_version?.version_number || 1}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-slate-300">{kit.created_by_user?.name || 'Unknown'}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-slate-400">{formatRelativeTime(kit.updated_at)}</span>
                    </td>
                    <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                      {canManage && (
                        <div className="relative">
                          <button
                            onClick={() => setMenuOpenId(menuOpenId === kit.id ? null : kit.id)}
                            className="p-1.5 text-slate-400 hover:text-slate-300 rounded-lg hover:bg-slate-700"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                          {menuOpenId === kit.id && (
                            <div className="absolute right-0 top-8 w-48 bg-slate-800 rounded-lg shadow-xl border border-slate-700 py-1 z-50">
                              <button
                                onClick={() => handleView(kit)}
                                className="w-full px-4 py-2 text-left text-sm text-slate-300 hover:bg-slate-700 flex items-center gap-2"
                              >
                                <Eye className="w-4 h-4" />
                                View / Edit
                              </button>
                              {canActivate && kit.status !== 'active' && kit.status !== 'archived' && (
                                <button
                                  onClick={() => handleActivate(kit)}
                                  className="w-full px-4 py-2 text-left text-sm text-slate-300 hover:bg-slate-700 flex items-center gap-2"
                                >
                                  <CheckCircle2 className="w-4 h-4" />
                                  Set as Active
                                </button>
                              )}
                              <button
                                onClick={() => handleDuplicate(kit)}
                                className="w-full px-4 py-2 text-left text-sm text-slate-300 hover:bg-slate-700 flex items-center gap-2"
                              >
                                <Copy className="w-4 h-4" />
                                Duplicate
                              </button>
                              {kit.status !== 'active' && kit.status !== 'archived' && (
                                <button
                                  onClick={() => handleArchive(kit)}
                                  className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-slate-700 flex items-center gap-2"
                                >
                                  <Archive className="w-4 h-4" />
                                  Archive
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
