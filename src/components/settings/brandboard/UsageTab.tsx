import { useState, useEffect } from 'react';
import { Bot, Mail, FileText, Share2, Filter, ExternalLink } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { getBrandUsage, getBrandKits, getBrandVoices } from '../../../services/brandboard';
import type { BrandUsage, BrandKitWithVersion, BrandVoiceWithVersion, BrandUsageEntityType, BRAND_USAGE_ENTITY_LABELS } from '../../../types';

const ENTITY_ICONS: Record<BrandUsageEntityType, React.ElementType> = {
  ai_agent: Bot,
  email_template: Mail,
  proposal: FileText,
  invoice: FileText,
  document: FileText,
  social_post: Share2,
};

const ENTITY_LABELS: Record<BrandUsageEntityType, string> = {
  ai_agent: 'AI Agent',
  email_template: 'Email Template',
  proposal: 'Proposal',
  invoice: 'Invoice',
  document: 'Document',
  social_post: 'Social Post',
};

export function UsageTab() {
  const { user } = useAuth();
  const [usage, setUsage] = useState<BrandUsage[]>([]);
  const [kits, setKits] = useState<BrandKitWithVersion[]>([]);
  const [voices, setVoices] = useState<BrandVoiceWithVersion[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterBrandType, setFilterBrandType] = useState<'all' | 'kit' | 'voice'>('all');
  const [filterBrandId, setFilterBrandId] = useState<string>('all');
  const [filterEntityType, setFilterEntityType] = useState<string>('all');

  useEffect(() => {
    if (user?.organization_id) {
      loadData();
    }
  }, [user?.organization_id]);

  const loadData = async () => {
    if (!user?.organization_id) return;
    setLoading(true);
    try {
      const [usageData, kitsData, voicesData] = await Promise.all([
        getBrandUsage(user.organization_id),
        getBrandKits(user.organization_id),
        getBrandVoices(user.organization_id),
      ]);
      setUsage(usageData);
      setKits(kitsData);
      setVoices(voicesData);
    } catch (error) {
      console.error('Failed to load usage data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getBrandName = (brandType: 'kit' | 'voice', brandId: string): string => {
    if (brandType === 'kit') {
      return kits.find(k => k.id === brandId)?.name || 'Unknown Kit';
    }
    return voices.find(v => v.id === brandId)?.name || 'Unknown Voice';
  };

  const filteredUsage = usage.filter(item => {
    if (filterBrandType !== 'all' && item.brand_type !== filterBrandType) return false;
    if (filterBrandId !== 'all' && item.brand_id !== filterBrandId) return false;
    if (filterEntityType !== 'all' && item.entity_type !== filterEntityType) return false;
    return true;
  });

  const allBrands = [
    ...kits.map(k => ({ id: k.id, name: k.name, type: 'kit' as const })),
    ...voices.map(v => ({ id: v.id, name: v.name, type: 'voice' as const })),
  ];

  const entityTypes = [...new Set(usage.map(u => u.entity_type))];

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
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-500">Filters:</span>
        </div>
        <select
          value={filterBrandType}
          onChange={(e) => {
            setFilterBrandType(e.target.value as 'all' | 'kit' | 'voice');
            setFilterBrandId('all');
          }}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
        >
          <option value="all">All Types</option>
          <option value="kit">Brand Kits</option>
          <option value="voice">Brand Voices</option>
        </select>
        <select
          value={filterBrandId}
          onChange={(e) => setFilterBrandId(e.target.value)}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
        >
          <option value="all">All Brands</option>
          {allBrands
            .filter(b => filterBrandType === 'all' || b.type === filterBrandType)
            .map(brand => (
              <option key={brand.id} value={brand.id}>
                {brand.name} ({brand.type})
              </option>
            ))}
        </select>
        <select
          value={filterEntityType}
          onChange={(e) => setFilterEntityType(e.target.value)}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
        >
          <option value="all">All Entity Types</option>
          {entityTypes.map(type => (
            <option key={type} value={type}>
              {ENTITY_LABELS[type as BrandUsageEntityType] || type}
            </option>
          ))}
        </select>
      </div>

      {filteredUsage.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No usage data</h3>
          <p className="text-gray-500">
            {usage.length === 0
              ? 'Brand assets have not been used in any entities yet.'
              : 'No results match your current filters.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Entity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Brand Asset
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Used
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredUsage.map((item) => {
                const Icon = ENTITY_ICONS[item.entity_type as BrandUsageEntityType] || FileText;
                return (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-gray-100 rounded-lg">
                          <Icon className="w-4 h-4 text-gray-600" />
                        </div>
                        <span className="text-sm font-medium text-gray-900">
                          {item.entity_name || 'Unnamed Entity'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-500">
                        {ENTITY_LABELS[item.entity_type as BrandUsageEntityType] || item.entity_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        item.brand_type === 'kit'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {getBrandName(item.brand_type, item.brand_id)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(item.last_used_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button className="text-gray-400 hover:text-blue-600 transition-colors">
                        <ExternalLink className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>
          Showing {filteredUsage.length} of {usage.length} usage records
        </span>
      </div>
    </div>
  );
}
