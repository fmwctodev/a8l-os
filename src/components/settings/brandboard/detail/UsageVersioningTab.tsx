import { useState, useEffect } from 'react';
import { History, RotateCcw, Bot, FileText, Mail, Receipt, Eye, X, Check } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import { getBrandKitVersions, rollbackBrandKitSection, getBrandUsageStats } from '../../../../services/brandboard';
import type { BrandKitWithVersion, BrandKitVersion, RollbackSection, BrandUsageStats } from '../../../../types';

interface UsageVersioningTabProps {
  kit: BrandKitWithVersion;
  onRollback: () => void;
  canManage: boolean;
}

interface RollbackModalProps {
  version: BrandKitVersion;
  onClose: () => void;
  onConfirm: (sections: RollbackSection[]) => void;
  loading: boolean;
}

function RollbackModal({ version, onClose, onConfirm, loading }: RollbackModalProps) {
  const [selectedSections, setSelectedSections] = useState<RollbackSection[]>([]);

  const toggleSection = (section: RollbackSection) => {
    setSelectedSections((prev) =>
      prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section]
    );
  };

  const sections: { id: RollbackSection; label: string; description: string }[] = [
    { id: 'visual_identity', label: 'Visual Identity', description: 'Logos, colors, fonts' },
    { id: 'brand_voice', label: 'Brand Voice', description: 'Tone, descriptors, examples' },
    { id: 'messaging', label: 'Messaging & Copy', description: 'Pitch, tagline, CTAs' },
    { id: 'ai_rules', label: 'AI Usage Rules', description: 'Enforcement, forbidden content' },
  ];

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h3 className="text-lg font-semibold text-white">Rollback to Version {version.version_number}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <p className="text-sm text-slate-400 mb-4">
            Select which sections to restore from version {version.version_number}. Other sections will remain unchanged.
          </p>

          <div className="space-y-2">
            {sections.map((section) => (
              <label
                key={section.id}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedSections.includes(section.id)
                    ? 'bg-cyan-500/10 border-cyan-500/30'
                    : 'bg-slate-900/50 border-slate-700 hover:border-slate-600'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded border flex items-center justify-center ${
                    selectedSections.includes(section.id)
                      ? 'bg-cyan-500 border-cyan-500'
                      : 'border-slate-600'
                  }`}
                >
                  {selectedSections.includes(section.id) && <Check className="w-3.5 h-3.5 text-white" />}
                </div>
                <div>
                  <span className="text-sm font-medium text-white">{section.label}</span>
                  <p className="text-xs text-slate-400">{section.description}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-400 text-sm font-medium hover:text-slate-300"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(selectedSections)}
            disabled={selectedSections.length === 0 || loading}
            className="px-4 py-2 bg-cyan-600 text-white text-sm font-medium rounded-lg hover:bg-cyan-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Rolling back...' : 'Rollback Selected'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function UsageVersioningTab({ kit, onRollback, canManage }: UsageVersioningTabProps) {
  const { user, hasPermission } = useAuth();
  const [versions, setVersions] = useState<BrandKitVersion[]>([]);
  const [usageStats, setUsageStats] = useState<BrandUsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [rollbackVersion, setRollbackVersion] = useState<BrandKitVersion | null>(null);
  const [rollingBack, setRollingBack] = useState(false);

  const canRollback = hasPermission('brandboard.publish') || hasPermission('brandboard.manage');

  useEffect(() => {
    loadData();
  }, [kit.id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [versionsData, statsData] = await Promise.all([
        getBrandKitVersions(kit.id),
        user?.organization_id ? getBrandUsageStats(user.organization_id) : null,
      ]);
      setVersions(versionsData);
      setUsageStats(statsData);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRollback = async (sections: RollbackSection[]) => {
    if (!rollbackVersion || !user?.id) return;
    setRollingBack(true);
    try {
      await rollbackBrandKitSection(kit.id, rollbackVersion.version_number, sections, user.id);
      setRollbackVersion(null);
      onRollback();
      await loadData();
    } catch (error) {
      console.error('Failed to rollback:', error);
    } finally {
      setRollingBack(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-cyan-500/20 rounded-lg">
            <History className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Version History</h2>
            <p className="text-sm text-slate-400">Track changes and rollback to previous versions</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-600 border-t-cyan-500" />
          </div>
        ) : versions.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <History className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No version history yet</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-700">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-900/50 border-b border-slate-700">
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase">Version</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase">Created By</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase">Date</th>
                  <th className="w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {versions.map((version, idx) => (
                  <tr key={version.id} className="hover:bg-slate-900/30">
                    <td className="px-4 py-3">
                      <span className="text-white font-medium">v{version.version_number}</span>
                      {idx === 0 && (
                        <span className="ml-2 px-2 py-0.5 text-xs bg-cyan-500/20 text-cyan-400 rounded">Current</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {version.published_at ? (
                        <span className="text-emerald-400 text-sm">Published</span>
                      ) : (
                        <span className="text-slate-400 text-sm">Draft</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-300 text-sm">
                      {version.created_by_user?.name || 'Unknown'}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-sm">
                      {formatDate(version.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      {canRollback && idx > 0 && kit.status === 'draft' && (
                        <button
                          onClick={() => setRollbackVersion(version)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-300 hover:text-white bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Rollback
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-white">Usage Map</h2>
          <p className="text-sm text-slate-400 mt-1">Where this brand is being used across the system</p>
        </div>

        {kit.status !== 'active' && (
          <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <p className="text-sm text-amber-300">
              This brand kit is not active. Set it as active to use it across the system.
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-700">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Bot className="w-4 h-4 text-blue-400" />
              </div>
              <span className="text-2xl font-bold text-white">{usageStats?.ai_agents || 0}</span>
            </div>
            <span className="text-sm text-slate-400">AI Agents</span>
          </div>

          <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-700">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-emerald-500/20 rounded-lg">
                <FileText className="w-4 h-4 text-emerald-400" />
              </div>
              <span className="text-2xl font-bold text-white">{usageStats?.proposals || 0}</span>
            </div>
            <span className="text-sm text-slate-400">Proposals</span>
          </div>

          <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-700">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-amber-500/20 rounded-lg">
                <Receipt className="w-4 h-4 text-amber-400" />
              </div>
              <span className="text-2xl font-bold text-white">{usageStats?.invoices || 0}</span>
            </div>
            <span className="text-sm text-slate-400">Invoices</span>
          </div>

          <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-700">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-cyan-500/20 rounded-lg">
                <Mail className="w-4 h-4 text-cyan-400" />
              </div>
              <span className="text-2xl font-bold text-white">{usageStats?.email_templates || 0}</span>
            </div>
            <span className="text-sm text-slate-400">Emails</span>
          </div>
        </div>

        <p className="text-xs text-slate-500 mt-4">
          Active brand is automatically applied to AI outputs, proposals, invoices, and emails.
        </p>
      </div>

      {rollbackVersion && (
        <RollbackModal
          version={rollbackVersion}
          onClose={() => setRollbackVersion(null)}
          onConfirm={handleRollback}
          loading={rollingBack}
        />
      )}
    </div>
  );
}
