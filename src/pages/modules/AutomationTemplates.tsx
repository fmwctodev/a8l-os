import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getAutomationTemplates, getAutomationTemplateById } from '../../services/automationTemplates';
import type { AutomationTemplate, TemplateCategory, TemplateComplexity, TemplateFilters } from '../../types';
import {
  Search,
  Plus,
  Loader2,
  AlertCircle,
  Zap,
  ArrowLeft,
  Mail,
  MessageSquare,
  Users,
  BarChart3,
  FileText,
  Clock,
  Star,
  ChevronRight,
  Sparkles,
  Target,
  Calendar,
  Send,
  Settings,
  TrendingUp,
  Play,
} from 'lucide-react';
import { UseTemplateModal } from '../../components/automation/UseTemplateModal';

const CATEGORY_CONFIG: Record<TemplateCategory, { label: string; icon: typeof Zap; color: string; bg: string }> = {
  sales: { label: 'Sales', icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  lead_management: { label: 'Lead Management', icon: Target, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
  scheduling: { label: 'Scheduling', icon: Calendar, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  proposal: { label: 'Proposal', icon: FileText, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  follow_up: { label: 'Follow-Up', icon: Send, color: 'text-teal-400', bg: 'bg-teal-500/10' },
  internal_ops: { label: 'Internal Ops', icon: Settings, color: 'text-slate-400', bg: 'bg-slate-500/10' },
};

const COMPLEXITY_CONFIG: Record<TemplateComplexity, { label: string; color: string; dots: number }> = {
  simple: { label: 'Simple', color: 'text-emerald-400', dots: 1 },
  moderate: { label: 'Moderate', color: 'text-amber-400', dots: 2 },
  advanced: { label: 'Advanced', color: 'text-red-400', dots: 3 },
};

const CHANNEL_TAGS: { value: string; label: string; icon: typeof Mail }[] = [
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'sms', label: 'SMS', icon: MessageSquare },
  { value: 'ai', label: 'AI', icon: Sparkles },
  { value: 'notification', label: 'Notification', icon: Zap },
];

export default function AutomationTemplates() {
  const { user: currentUser, hasPermission } = useAuth();
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<AutomationTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory | 'all'>('all');
  const [selectedComplexity, setSelectedComplexity] = useState<TemplateComplexity | 'all'>('all');
  const [useTemplate, setUseTemplate] = useState<AutomationTemplate | null>(null);
  const [hydratingUse, setHydratingUse] = useState(false);

  const canManage = hasPermission('automation.manage');

  async function handleUse(template: AutomationTemplate) {
    // The list query doesn't load latest_version. Fetch the full template
    // before opening the modal so the review step shows real steps.
    try {
      setHydratingUse(true);
      const full = await getAutomationTemplateById(template.id);
      if (full) setUseTemplate(full);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load template');
    } finally {
      setHydratingUse(false);
    }
  }

  const loadTemplates = useCallback(async () => {
    if (!currentUser?.organization_id) return;

    try {
      setIsLoading(true);
      setError(null);

      const filters: TemplateFilters = {
        search: searchQuery || undefined,
        category: selectedCategory !== 'all' ? selectedCategory : undefined,
        complexity: selectedComplexity !== 'all' ? selectedComplexity : undefined,
        status: 'published',
      };

      const data = await getAutomationTemplates(currentUser.organization_id, filters);
      setTemplates(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load templates');
    } finally {
      setIsLoading(false);
    }
  }, [currentUser?.organization_id, searchQuery, selectedCategory, selectedComplexity]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const systemTemplates = templates.filter(t => t.is_system);
  const orgTemplates = templates.filter(t => !t.is_system);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/automation')}
            className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-400" />
          </button>
          <div>
            <h1 className="text-2xl font-semibold text-white">Automation Templates</h1>
            <p className="text-slate-400 mt-1">
              Pre-built workflows to get you started quickly
            </p>
          </div>
        </div>
        {canManage && (
          <button
            onClick={() => navigate('/automation/templates/new')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-600 text-white font-medium hover:from-cyan-600 hover:to-teal-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Template
          </button>
        )}
      </div>

      <div className="flex items-center gap-3 overflow-x-auto pb-1">
        <button
          onClick={() => setSelectedCategory('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
            selectedCategory === 'all'
              ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
              : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700'
          }`}
        >
          All Categories
        </button>
        {(Object.keys(CATEGORY_CONFIG) as TemplateCategory[]).map(cat => {
          const config = CATEGORY_CONFIG[cat];
          const Icon = config.icon;
          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                selectedCategory === cat
                  ? `${config.bg} ${config.color} border border-current/30`
                  : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {config.label}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
          />
        </div>
        <select
          value={selectedComplexity}
          onChange={(e) => setSelectedComplexity(e.target.value as TemplateComplexity | 'all')}
          className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500"
        >
          <option value="all">All Complexity</option>
          <option value="simple">Simple</option>
          <option value="moderate">Moderate</option>
          <option value="advanced">Advanced</option>
        </select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh]">
          <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
          <p className="text-white font-medium">Error loading templates</p>
          <p className="text-slate-400 text-sm">{error}</p>
        </div>
      ) : (
        <div className="space-y-8">
          {systemTemplates.length > 0 && (
            <TemplateSection
              title="System Templates"
              subtitle="Pre-built by the platform"
              templates={systemTemplates}
              navigate={navigate}
              onUse={handleUse}
              hydratingUse={hydratingUse}
            />
          )}

          {orgTemplates.length > 0 && (
            <TemplateSection
              title="Your Templates"
              subtitle="Custom templates created by your team"
              templates={orgTemplates}
              navigate={navigate}
              onUse={handleUse}
              hydratingUse={hydratingUse}
            />
          )}

          {templates.length === 0 && (
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-12 text-center">
              <Zap className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-white font-medium mb-1">No templates found</p>
              <p className="text-slate-400 text-sm">
                {searchQuery || selectedCategory !== 'all' || selectedComplexity !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Templates will appear here once they are created'}
              </p>
            </div>
          )}
        </div>
      )}

      {useTemplate && (
        <UseTemplateModal
          template={useTemplate}
          onClose={() => setUseTemplate(null)}
          onSuccess={(workflowId) => {
            setUseTemplate(null);
            navigate(`/automation/${workflowId}`);
          }}
        />
      )}
    </div>
  );
}

function TemplateSection({
  title,
  subtitle,
  templates,
  navigate,
  onUse,
  hydratingUse,
}: {
  title: string;
  subtitle: string;
  templates: AutomationTemplate[];
  navigate: ReturnType<typeof useNavigate>;
  onUse: (t: AutomationTemplate) => void;
  hydratingUse: boolean;
}) {
  return (
    <div>
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <p className="text-sm text-slate-400">{subtitle}</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map(template => (
          <TemplateCard
            key={template.id}
            template={template}
            navigate={navigate}
            onUse={onUse}
            hydratingUse={hydratingUse}
          />
        ))}
      </div>
    </div>
  );
}

function TemplateCard({
  template,
  navigate,
  onUse,
  hydratingUse,
}: {
  template: AutomationTemplate;
  navigate: ReturnType<typeof useNavigate>;
  onUse: (t: AutomationTemplate) => void;
  hydratingUse: boolean;
}) {
  const catConfig = CATEGORY_CONFIG[template.category];
  const complexityConfig = COMPLEXITY_CONFIG[template.complexity];
  const CatIcon = catConfig.icon;

  return (
    <div
      className="group bg-slate-900 rounded-xl border border-slate-800 hover:border-slate-700 transition-all cursor-pointer overflow-hidden"
      onClick={() => navigate(`/automation/templates/${template.id}`)}
    >
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className={`w-10 h-10 rounded-lg ${catConfig.bg} flex items-center justify-center`}>
            <CatIcon className={`w-5 h-5 ${catConfig.color}`} />
          </div>
          {template.is_system && (
            <span className="px-2 py-0.5 rounded text-xs font-medium bg-cyan-500/10 text-cyan-400">
              System
            </span>
          )}
        </div>

        <h3 className="text-sm font-medium text-white mb-1 group-hover:text-cyan-400 transition-colors">
          {template.name}
        </h3>
        <p className="text-xs text-slate-400 line-clamp-2 mb-4 min-h-[2rem]">
          {template.description || 'No description'}
        </p>

        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${catConfig.bg} ${catConfig.color}`}>
            {catConfig.label}
          </span>
          <span className="flex items-center gap-1 text-xs">
            {Array.from({ length: 3 }).map((_, i) => (
              <span
                key={i}
                className={`w-1.5 h-1.5 rounded-full ${
                  i < complexityConfig.dots ? complexityConfig.color.replace('text-', 'bg-') : 'bg-slate-700'
                }`}
              />
            ))}
            <span className={`ml-0.5 ${complexityConfig.color}`}>{complexityConfig.label}</span>
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {template.channel_tags.map(tag => {
            const channelConfig = CHANNEL_TAGS.find(c => c.value === tag);
            return (
              <span
                key={tag}
                className="px-2 py-0.5 rounded bg-slate-800 text-xs text-slate-400"
              >
                {channelConfig?.label || tag}
              </span>
            );
          })}
        </div>
      </div>

      <div className="px-5 py-3 border-t border-slate-800 flex items-center justify-between bg-slate-800/30">
        <div className="flex items-center gap-4 text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5" />
            {template.use_count} uses
          </span>
          {template.estimated_time && (
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {template.estimated_time}
            </span>
          )}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onUse(template);
          }}
          disabled={hydratingUse}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-cyan-400 hover:bg-cyan-500/10 transition-colors disabled:opacity-50"
        >
          <Play className="w-3 h-3" />
          Use
        </button>
      </div>
    </div>
  );
}
