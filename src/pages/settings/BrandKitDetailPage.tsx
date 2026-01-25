import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, LayoutDashboard, Palette, MessageSquareText, FileText, Bot, History, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getBrandKitById } from '../../services/brandboard';
import type { BrandKitWithVersion, BrandKitStatus } from '../../types';
import { BrandKitOverviewTab } from '../../components/settings/brandboard/detail/BrandKitOverviewTab';
import { VisualIdentityTab } from '../../components/settings/brandboard/detail/VisualIdentityTab';
import { BrandVoiceTabNew } from '../../components/settings/brandboard/detail/BrandVoiceTabNew';
import { MessagingCopyTab } from '../../components/settings/brandboard/detail/MessagingCopyTab';
import { AIUsageRulesTab } from '../../components/settings/brandboard/detail/AIUsageRulesTab';
import { UsageVersioningTab } from '../../components/settings/brandboard/detail/UsageVersioningTab';

type TabId = 'overview' | 'visual' | 'voice' | 'messaging' | 'ai-rules' | 'versioning';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ElementType;
}

const tabs: Tab[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'visual', label: 'Visual Identity', icon: Palette },
  { id: 'voice', label: 'Brand Voice', icon: MessageSquareText },
  { id: 'messaging', label: 'Messaging & Copy', icon: FileText },
  { id: 'ai-rules', label: 'AI Usage Rules', icon: Bot },
  { id: 'versioning', label: 'Usage & Versioning', icon: History },
];

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
    <span className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full border ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

export function BrandKitDetailPage() {
  const { brandId } = useParams<{ brandId: string }>();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const [kit, setKit] = useState<BrandKitWithVersion | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  const canManage = hasPermission('brandboard.manage');
  const canPublish = hasPermission('brandboard.publish');

  useEffect(() => {
    if (brandId) {
      loadKit();
    }
  }, [brandId]);

  const loadKit = async () => {
    if (!brandId) return;
    setLoading(true);
    try {
      const data = await getBrandKitById(brandId);
      if (!data) {
        navigate('/settings/brandboard');
        return;
      }
      setKit(data);
    } catch (error) {
      console.error('Failed to load brand kit:', error);
      navigate('/settings/brandboard');
    } finally {
      setLoading(false);
    }
  };

  const handleKitUpdate = () => {
    loadKit();
  };

  if (loading) {
    return (
      <div className="min-h-full bg-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
      </div>
    );
  }

  if (!kit) {
    return null;
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <BrandKitOverviewTab
            kit={kit}
            onUpdate={handleKitUpdate}
            canManage={canManage}
            canPublish={canPublish}
          />
        );
      case 'visual':
        return (
          <VisualIdentityTab
            kit={kit}
            onUpdate={handleKitUpdate}
            canManage={canManage}
          />
        );
      case 'voice':
        return (
          <BrandVoiceTabNew
            kit={kit}
            onUpdate={handleKitUpdate}
            canManage={canManage}
          />
        );
      case 'messaging':
        return (
          <MessagingCopyTab
            kit={kit}
            onUpdate={handleKitUpdate}
            canManage={canManage}
          />
        );
      case 'ai-rules':
        return (
          <AIUsageRulesTab
            kit={kit}
            onUpdate={handleKitUpdate}
            canManage={canManage}
          />
        );
      case 'versioning':
        return (
          <UsageVersioningTab
            kit={kit}
            onRollback={handleKitUpdate}
            canManage={canManage}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-full bg-slate-900">
      <div className="bg-slate-800 border-b border-slate-700">
        <div className="px-6 py-4">
          <div className="flex items-center gap-2 text-sm text-slate-400 mb-3">
            <Link to="/settings/brandboard" className="hover:text-slate-300 transition-colors flex items-center gap-1">
              <ArrowLeft className="w-4 h-4" />
              Brandboard
            </Link>
            <span>/</span>
            <span className="text-slate-300">{kit.name}</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-semibold text-white">{kit.name}</h1>
              <StatusBadge status={kit.status} />
              <span className="text-sm text-slate-400">v{kit.latest_version?.version_number || 1}</span>
            </div>
          </div>
        </div>

        <div className="px-6">
          <nav className="flex gap-1 -mb-px" aria-label="Tabs">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors
                    ${isActive
                      ? 'border-cyan-500 text-white'
                      : 'border-transparent text-slate-400 hover:text-slate-300 hover:border-slate-600'
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      <div className="p-6">
        {renderTabContent()}
      </div>
    </div>
  );
}
