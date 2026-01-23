import { useState, useEffect } from 'react';
import { History, ChevronRight, RotateCcw, Paintbrush, MessageSquareText } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import {
  getBrandKits,
  getBrandVoices,
  getBrandKitVersions,
  getBrandVoiceVersions,
  rollbackBrandKitVersion,
  rollbackBrandVoiceVersion,
} from '../../../services/brandboard';
import type {
  BrandKitWithVersion,
  BrandVoiceWithVersion,
  BrandKitVersion,
  BrandVoiceVersion,
} from '../../../types';

interface VersionsTabProps {
  onRollback?: () => void;
}

export function VersionsTab({ onRollback }: VersionsTabProps) {
  const { user, hasPermission } = useAuth();
  const [kits, setKits] = useState<BrandKitWithVersion[]>([]);
  const [voices, setVoices] = useState<BrandVoiceWithVersion[]>([]);
  const [loading, setLoading] = useState(true);

  const [brandType, setBrandType] = useState<'kit' | 'voice'>('kit');
  const [selectedBrandId, setSelectedBrandId] = useState<string>('');
  const [versions, setVersions] = useState<(BrandKitVersion | BrandVoiceVersion)[]>([]);
  const [selectedVersionNumber, setSelectedVersionNumber] = useState<number | null>(null);
  const [comparing, setComparing] = useState(false);
  const [rolling, setRolling] = useState(false);

  const canActivate = hasPermission('brandboard.activate');

  useEffect(() => {
    if (user?.organization_id) {
      loadBrands();
    }
  }, [user?.organization_id]);

  const loadBrands = async () => {
    if (!user?.organization_id) return;
    setLoading(true);
    try {
      const [kitsData, voicesData] = await Promise.all([
        getBrandKits(user.organization_id),
        getBrandVoices(user.organization_id),
      ]);
      setKits(kitsData);
      setVoices(voicesData);
      if (kitsData.length > 0) {
        setSelectedBrandId(kitsData[0].id);
      } else if (voicesData.length > 0) {
        setBrandType('voice');
        setSelectedBrandId(voicesData[0].id);
      }
    } catch (error) {
      console.error('Failed to load brands:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedBrandId) {
      loadVersions();
    }
  }, [selectedBrandId, brandType]);

  const loadVersions = async () => {
    if (!selectedBrandId) return;
    setComparing(true);
    try {
      const versionData = brandType === 'kit'
        ? await getBrandKitVersions(selectedBrandId)
        : await getBrandVoiceVersions(selectedBrandId);
      setVersions(versionData);
      setSelectedVersionNumber(versionData[1]?.version_number || null);
    } catch (error) {
      console.error('Failed to load versions:', error);
    } finally {
      setComparing(false);
    }
  };

  const handleRollback = async () => {
    if (!selectedVersionNumber || !user?.id || !selectedBrandId) return;
    if (!window.confirm(`Roll back to version ${selectedVersionNumber}? This will create a new version with the selected settings.`)) return;

    setRolling(true);
    try {
      if (brandType === 'kit') {
        await rollbackBrandKitVersion(selectedBrandId, selectedVersionNumber, user.id);
      } else {
        await rollbackBrandVoiceVersion(selectedBrandId, selectedVersionNumber, user.id);
      }
      await loadVersions();
      onRollback?.();
    } catch (error) {
      console.error('Failed to rollback:', error);
    } finally {
      setRolling(false);
    }
  };

  const currentVersion = versions[0];
  const selectedVersion = versions.find(v => v.version_number === selectedVersionNumber);

  const brands = brandType === 'kit' ? kits : voices;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex rounded-lg border border-gray-300 overflow-hidden">
          <button
            onClick={() => {
              setBrandType('kit');
              setSelectedBrandId(kits[0]?.id || '');
            }}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
              brandType === 'kit' ? 'bg-blue-50 text-blue-700' : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Paintbrush className="w-4 h-4" />
            Brand Kits
          </button>
          <button
            onClick={() => {
              setBrandType('voice');
              setSelectedBrandId(voices[0]?.id || '');
            }}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-l border-gray-300 transition-colors ${
              brandType === 'voice' ? 'bg-emerald-50 text-emerald-700' : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            <MessageSquareText className="w-4 h-4" />
            Brand Voices
          </button>
        </div>

        <select
          value={selectedBrandId}
          onChange={(e) => setSelectedBrandId(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          {brands.map((brand) => (
            <option key={brand.id} value={brand.id}>
              {brand.name} {brand.active ? '(Active)' : ''}
            </option>
          ))}
        </select>
      </div>

      {versions.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
          <History className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No version history</h3>
          <p className="text-gray-500">Select a brand to view its version history.</p>
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-3">
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                <h3 className="text-sm font-medium text-gray-900">Version History</h3>
              </div>
              <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
                {versions.map((version, index) => (
                  <button
                    key={version.id}
                    onClick={() => setSelectedVersionNumber(version.version_number)}
                    className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors ${
                      selectedVersionNumber === version.version_number ? 'bg-blue-50 border-l-2 border-blue-500' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-900">
                        Version {version.version_number}
                        {index === 0 && (
                          <span className="ml-2 text-xs text-blue-600">(Current)</span>
                        )}
                      </span>
                      {selectedVersionNumber === version.version_number && (
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(version.created_at).toLocaleDateString()} at{' '}
                      {new Date(version.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="col-span-9">
            {selectedVersion && currentVersion && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-gray-900">
                    Comparing Version {selectedVersion.version_number} with Current (v{currentVersion.version_number})
                  </h3>
                  {canActivate && selectedVersionNumber !== currentVersion.version_number && (
                    <button
                      onClick={handleRollback}
                      disabled={rolling}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-amber-100 text-amber-700 text-sm font-medium rounded-lg hover:bg-amber-200 disabled:opacity-50"
                    >
                      <RotateCcw className="w-4 h-4" />
                      {rolling ? 'Rolling Back...' : `Rollback to v${selectedVersionNumber}`}
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white rounded-lg border border-gray-200">
                    <div className="px-4 py-3 bg-amber-50 border-b border-gray-200">
                      <h4 className="text-sm font-medium text-amber-900">
                        Version {selectedVersion.version_number} (Selected)
                      </h4>
                    </div>
                    <div className="p-4 max-h-[500px] overflow-y-auto">
                      {brandType === 'kit' ? (
                        <KitVersionDetails version={selectedVersion as BrandKitVersion} />
                      ) : (
                        <VoiceVersionDetails version={selectedVersion as BrandVoiceVersion} />
                      )}
                    </div>
                  </div>

                  <div className="bg-white rounded-lg border border-gray-200">
                    <div className="px-4 py-3 bg-blue-50 border-b border-gray-200">
                      <h4 className="text-sm font-medium text-blue-900">
                        Version {currentVersion.version_number} (Current)
                      </h4>
                    </div>
                    <div className="p-4 max-h-[500px] overflow-y-auto">
                      {brandType === 'kit' ? (
                        <KitVersionDetails
                          version={currentVersion as BrandKitVersion}
                          compareWith={selectedVersion as BrandKitVersion}
                        />
                      ) : (
                        <VoiceVersionDetails
                          version={currentVersion as BrandVoiceVersion}
                          compareWith={selectedVersion as BrandVoiceVersion}
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function KitVersionDetails({
  version,
  compareWith,
}: {
  version: BrandKitVersion;
  compareWith?: BrandKitVersion;
}) {
  const colorsDiff = (key: string) => {
    if (!compareWith) return false;
    const v1 = version.colors?.[key as keyof typeof version.colors]?.hex;
    const v2 = compareWith.colors?.[key as keyof typeof compareWith.colors]?.hex;
    return v1 !== v2;
  };

  return (
    <div className="space-y-4 text-sm">
      <div>
        <h5 className="font-medium text-gray-700 mb-2">Logos</h5>
        {version.logos?.length > 0 ? (
          <div className="space-y-1">
            {version.logos.map((logo, i) => (
              <div key={i} className="text-gray-600 bg-gray-50 px-2 py-1 rounded">
                {logo.label} ({logo.source_type})
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400 italic">No logos</p>
        )}
      </div>

      <div>
        <h5 className="font-medium text-gray-700 mb-2">Colors</h5>
        <div className="space-y-2">
          {Object.entries(version.colors || {}).map(([key, color]) => (
            <div
              key={key}
              className={`flex items-center gap-2 px-2 py-1 rounded ${
                colorsDiff(key) ? 'bg-yellow-50 border border-yellow-200' : 'bg-gray-50'
              }`}
            >
              <div
                className="w-4 h-4 rounded border border-gray-300"
                style={{ backgroundColor: color?.hex || '#ccc' }}
              />
              <span className="capitalize">{key}:</span>
              <span className="font-mono text-gray-600">{color?.hex}</span>
              {color?.name && <span className="text-gray-400">({color.name})</span>}
            </div>
          ))}
        </div>
      </div>

      <div>
        <h5 className="font-medium text-gray-700 mb-2">Fonts</h5>
        <div className="space-y-1">
          {version.fonts?.primary && (
            <div className="text-gray-600 bg-gray-50 px-2 py-1 rounded">
              Primary: {version.fonts.primary.name} ({version.fonts.primary.source})
            </div>
          )}
          {version.fonts?.secondary && (
            <div className="text-gray-600 bg-gray-50 px-2 py-1 rounded">
              Secondary: {version.fonts.secondary.name} ({version.fonts.secondary.source})
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function VoiceVersionDetails({
  version,
  compareWith,
}: {
  version: BrandVoiceVersion;
  compareWith?: BrandVoiceVersion;
}) {
  const toneDiff = (key: string) => {
    if (!compareWith) return false;
    const v1 = version.tone_settings?.[key as keyof typeof version.tone_settings];
    const v2 = compareWith.tone_settings?.[key as keyof typeof compareWith.tone_settings];
    return v1 !== v2;
  };

  const listDiff = (list1: string[], list2: string[]) => {
    const added = list1.filter(item => !list2.includes(item));
    const removed = list2.filter(item => !list1.includes(item));
    return { added, removed };
  };

  const dosDiff = compareWith ? listDiff(version.dos || [], compareWith.dos || []) : { added: [], removed: [] };
  const dontsDiff = compareWith ? listDiff(version.donts || [], compareWith.donts || []) : { added: [], removed: [] };

  return (
    <div className="space-y-4 text-sm">
      <div>
        <h5 className="font-medium text-gray-700 mb-2">Tone Settings</h5>
        <div className="space-y-2">
          {Object.entries(version.tone_settings || {}).map(([key, value]) => (
            <div
              key={key}
              className={`flex items-center justify-between px-2 py-1 rounded ${
                toneDiff(key) ? 'bg-yellow-50 border border-yellow-200' : 'bg-gray-50'
              }`}
            >
              <span className="capitalize">{key}</span>
              <div className="flex items-center gap-2">
                <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full"
                    style={{ width: `${value}%` }}
                  />
                </div>
                <span className="text-gray-600 w-8 text-right">{value}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h5 className="font-medium text-gray-700 mb-2">Do's</h5>
        <div className="space-y-1">
          {(version.dos || []).map((item, i) => {
            const isNew = dosDiff.added.includes(item);
            return (
              <div
                key={i}
                className={`px-2 py-1 rounded ${
                  isNew ? 'bg-green-50 border border-green-200' : 'bg-gray-50'
                }`}
              >
                {item}
              </div>
            );
          })}
          {dosDiff.removed.map((item, i) => (
            <div key={`removed-${i}`} className="px-2 py-1 rounded bg-red-50 border border-red-200 line-through text-gray-400">
              {item}
            </div>
          ))}
        </div>
      </div>

      <div>
        <h5 className="font-medium text-gray-700 mb-2">Don'ts</h5>
        <div className="space-y-1">
          {(version.donts || []).map((item, i) => {
            const isNew = dontsDiff.added.includes(item);
            return (
              <div
                key={i}
                className={`px-2 py-1 rounded ${
                  isNew ? 'bg-green-50 border border-green-200' : 'bg-gray-50'
                }`}
              >
                {item}
              </div>
            );
          })}
          {dontsDiff.removed.map((item, i) => (
            <div key={`removed-${i}`} className="px-2 py-1 rounded bg-red-50 border border-red-200 line-through text-gray-400">
              {item}
            </div>
          ))}
        </div>
      </div>

      <div>
        <h5 className="font-medium text-gray-700 mb-2">Vocabulary</h5>
        <div className="flex flex-wrap gap-1">
          {(version.vocabulary_preferred || []).map((item, i) => (
            <span key={i} className="px-2 py-0.5 text-xs bg-blue-50 text-blue-700 rounded">
              {item}
            </span>
          ))}
          {(version.vocabulary_prohibited || []).map((item, i) => (
            <span key={i} className="px-2 py-0.5 text-xs bg-amber-50 text-amber-700 rounded line-through">
              {item}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
