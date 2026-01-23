import { useState, useEffect } from 'react';
import { Paintbrush, MessageSquareText, Bot, Mail, FileText, Share2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import {
  getActiveBrandKit,
  getActiveBrandVoice,
  getBrandUsageStats,
  getBrandLogoUrl,
} from '../../../services/brandboard';
import type { BrandKitWithVersion, BrandVoiceWithVersion, BrandUsageStats } from '../../../types';

interface OverviewTabProps {
  onNavigate: (tab: 'kits' | 'voice' | 'usage' | 'versions') => void;
  onRefresh?: () => void;
}

export function OverviewTab({ onNavigate }: OverviewTabProps) {
  const { user } = useAuth();
  const [activeKit, setActiveKit] = useState<BrandKitWithVersion | null>(null);
  const [activeVoice, setActiveVoice] = useState<BrandVoiceWithVersion | null>(null);
  const [usageStats, setUsageStats] = useState<BrandUsageStats | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.organization_id) {
      loadData();
    }
  }, [user?.organization_id]);

  const loadData = async () => {
    if (!user?.organization_id) return;
    setLoading(true);
    try {
      const [kit, voice, stats] = await Promise.all([
        getActiveBrandKit(user.organization_id),
        getActiveBrandVoice(user.organization_id),
        getBrandUsageStats(user.organization_id),
      ]);
      setActiveKit(kit);
      setActiveVoice(voice);
      setUsageStats(stats);

      if (kit?.latest_version?.logos?.[0]) {
        const url = await getBrandLogoUrl(kit.latest_version.logos[0]);
        setLogoUrl(url);
      }
    } catch (error) {
      console.error('Failed to load brandboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getToneLabel = (value: number): string => {
    if (value < 35) return 'Low';
    if (value < 70) return 'Medium';
    return 'High';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <Paintbrush className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900">Active Brand Kit</h3>
                <p className="text-sm text-gray-500">Visual identity settings</p>
              </div>
            </div>
            {activeKit ? (
              <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-700 bg-green-50 rounded-full">
                <CheckCircle2 className="w-3 h-3" />
                Active
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-amber-700 bg-amber-50 rounded-full">
                <AlertCircle className="w-3 h-3" />
                Not Set
              </span>
            )}
          </div>

          {activeKit ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt="Brand logo"
                    className="w-16 h-16 object-contain rounded-lg border border-gray-200 bg-gray-50"
                  />
                ) : (
                  <div className="w-16 h-16 flex items-center justify-center rounded-lg border border-gray-200 bg-gray-50">
                    <Paintbrush className="w-6 h-6 text-gray-400" />
                  </div>
                )}
                <div>
                  <p className="font-medium text-gray-900">{activeKit.name}</p>
                  {activeKit.description && (
                    <p className="text-sm text-gray-500 line-clamp-2">{activeKit.description}</p>
                  )}
                </div>
              </div>

              {activeKit.latest_version?.colors && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2">Colors</p>
                  <div className="flex gap-2">
                    {Object.entries(activeKit.latest_version.colors).map(([key, color]) => (
                      <div key={key} className="text-center">
                        <div
                          className="w-8 h-8 rounded-lg border border-gray-200 shadow-sm"
                          style={{ backgroundColor: color?.hex || '#ccc' }}
                          title={color?.name || key}
                        />
                        <span className="text-xs text-gray-500 capitalize">{key}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-xs text-gray-400">
                Version {activeKit.latest_version?.version_number || 1} · Updated{' '}
                {new Date(activeKit.updated_at).toLocaleDateString()}
              </p>
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              No brand kit is currently active. Create and activate one to use across your organization.
            </p>
          )}

          <button
            onClick={() => onNavigate('kits')}
            className="mt-4 w-full px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
          >
            {activeKit ? 'Manage Brand Kits' : 'Create Brand Kit'}
          </button>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-50 rounded-lg">
                <MessageSquareText className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900">Active Brand Voice</h3>
                <p className="text-sm text-gray-500">Communication style settings</p>
              </div>
            </div>
            {activeVoice ? (
              <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-700 bg-green-50 rounded-full">
                <CheckCircle2 className="w-3 h-3" />
                Active
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-amber-700 bg-amber-50 rounded-full">
                <AlertCircle className="w-3 h-3" />
                Not Set
              </span>
            )}
          </div>

          {activeVoice ? (
            <div className="space-y-4">
              <div>
                <p className="font-medium text-gray-900">{activeVoice.name}</p>
                {activeVoice.summary && (
                  <p className="text-sm text-gray-500 line-clamp-2 mt-1">{activeVoice.summary}</p>
                )}
              </div>

              {activeVoice.latest_version?.tone_settings && (
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(activeVoice.latest_version.tone_settings).map(([key, value]) => (
                    <div key={key} className="bg-gray-50 rounded-lg px-3 py-2">
                      <p className="text-xs text-gray-500 capitalize">{key}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full"
                            style={{ width: `${value}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-gray-700">{getToneLabel(value)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-xs text-gray-400">
                Version {activeVoice.latest_version?.version_number || 1} · Updated{' '}
                {new Date(activeVoice.updated_at).toLocaleDateString()}
              </p>
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              No brand voice is currently active. Create and activate one to guide AI communications.
            </p>
          )}

          <button
            onClick={() => onNavigate('voice')}
            className="mt-4 w-full px-4 py-2 text-sm font-medium text-emerald-600 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors"
          >
            {activeVoice ? 'Manage Brand Voices' : 'Create Brand Voice'}
          </button>
        </div>
      </div>

      {usageStats && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-gray-900">Brand Asset Usage</h3>
            <button
              onClick={() => onNavigate('usage')}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              View Details
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <Bot className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-lg font-semibold text-gray-900">{usageStats.ai_agents}</p>
                <p className="text-xs text-gray-500">AI Agents</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <Mail className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-lg font-semibold text-gray-900">{usageStats.email_templates}</p>
                <p className="text-xs text-gray-500">Email Templates</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <FileText className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-lg font-semibold text-gray-900">
                  {usageStats.proposals + usageStats.invoices + usageStats.documents}
                </p>
                <p className="text-xs text-gray-500">Documents</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <Share2 className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-lg font-semibold text-gray-900">{usageStats.social_posts}</p>
                <p className="text-xs text-gray-500">Social Posts</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
