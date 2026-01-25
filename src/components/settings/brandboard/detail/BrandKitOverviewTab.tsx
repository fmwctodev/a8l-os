import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Rocket, Save } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import { updateBrandKit, activateBrandKit, publishBrandKit, setActiveBrandKit } from '../../../../services/brandboard';
import type { BrandKitWithVersion, BrandKitStatus } from '../../../../types';

interface BrandKitOverviewTabProps {
  kit: BrandKitWithVersion;
  onUpdate: () => void;
  canManage: boolean;
  canPublish: boolean;
}

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
    <span className={`inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-lg border ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

export function BrandKitOverviewTab({ kit, onUpdate, canManage, canPublish }: BrandKitOverviewTabProps) {
  const { user } = useAuth();
  const [name, setName] = useState(kit.name);
  const [description, setDescription] = useState(kit.description || '');
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [activating, setActivating] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const handleNameChange = (value: string) => {
    setName(value);
    setHasChanges(value !== kit.name || description !== (kit.description || ''));
  };

  const handleDescriptionChange = (value: string) => {
    setDescription(value);
    setHasChanges(name !== kit.name || value !== (kit.description || ''));
  };

  const handleSave = async () => {
    if (!user?.id) return;
    setSaving(true);
    try {
      await updateBrandKit(kit.id, { name, description: description || undefined }, user.id);
      setHasChanges(false);
      onUpdate();
    } catch (error) {
      console.error('Failed to save:', error);
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!user?.id) return;
    if (!window.confirm('Publishing this brand will affect AI outputs, proposals, emails, and invoices across your organization. Continue?')) return;
    setPublishing(true);
    try {
      await publishBrandKit(kit.id, user.id);
      onUpdate();
    } catch (error) {
      console.error('Failed to publish:', error);
    } finally {
      setPublishing(false);
    }
  };

  const handleSetActive = async () => {
    if (!window.confirm('Setting this brand as active will deactivate any currently active brand. Continue?')) return;
    setActivating(true);
    try {
      await setActiveBrandKit(kit.id);
      onUpdate();
    } catch (error) {
      console.error('Failed to activate:', error);
    } finally {
      setActivating(false);
    }
  };

  const isEditable = kit.status === 'draft' && canManage;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
        <h2 className="text-lg font-semibold text-white mb-6">Brand Kit Details</h2>

        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Brand Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              disabled={!isEditable}
              className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 disabled:opacity-60 disabled:cursor-not-allowed"
              placeholder="Enter brand name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => handleDescriptionChange(e.target.value)}
              disabled={!isEditable}
              rows={3}
              className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 disabled:opacity-60 disabled:cursor-not-allowed resize-none"
              placeholder="Describe this brand kit"
            />
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Current Status</label>
              <StatusBadge status={kit.status} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Version Number</label>
              <span className="text-lg font-semibold text-white">v{kit.latest_version?.version_number || 1}</span>
            </div>
          </div>
        </div>

        {hasChanges && isEditable && (
          <div className="mt-6 pt-6 border-t border-slate-700 flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white text-sm font-medium rounded-lg hover:bg-cyan-700 transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        )}
      </div>

      {kit.status !== 'archived' && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Actions</h2>

          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-amber-200 font-medium">Publishing affects system-wide content</p>
                <p className="text-sm text-amber-200/80 mt-1">
                  Setting this brand as active will affect AI outputs, proposals, emails, and invoices across your organization.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {canPublish && kit.status === 'draft' && (
              <button
                onClick={handlePublish}
                disabled={publishing}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-teal-600 text-white text-sm font-medium rounded-lg hover:from-cyan-600 hover:to-teal-700 transition-all disabled:opacity-50 shadow-lg shadow-cyan-500/20"
              >
                <Rocket className="w-4 h-4" />
                {publishing ? 'Publishing...' : 'Publish Version'}
              </button>
            )}

            {canPublish && kit.status !== 'active' && (
              <button
                onClick={handleSetActive}
                disabled={activating}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                {activating ? 'Activating...' : 'Set as Active'}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Metadata</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-slate-400">Created by</span>
            <p className="text-white mt-1">{kit.created_by_user?.name || 'Unknown'}</p>
          </div>
          <div>
            <span className="text-slate-400">Created at</span>
            <p className="text-white mt-1">{new Date(kit.created_at).toLocaleDateString()}</p>
          </div>
          <div>
            <span className="text-slate-400">Last updated</span>
            <p className="text-white mt-1">{new Date(kit.updated_at).toLocaleDateString()}</p>
          </div>
          {kit.latest_version?.published_at && (
            <div>
              <span className="text-slate-400">Last published</span>
              <p className="text-white mt-1">{new Date(kit.latest_version.published_at).toLocaleDateString()}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
