import { useState } from 'react';
import {
  X,
  Globe,
  HelpCircle,
  Table,
  FileText,
  Upload,
  ArrowLeft,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import {
  GlobalFormHeader,
  WebCrawlerForm,
  FAQForm,
  TableUploadForm,
  RichTextForm,
  FileUploadForm,
} from '../../ai/knowledge-forms';
import * as knowledgeCollectionsService from '../../../services/knowledgeCollections';
import type {
  KnowledgeCollection,
  AgentKnowledgeSourceType,
} from '../../../types';

interface GlobalKnowledgeSourceModalProps {
  collection?: KnowledgeCollection | null;
  onClose: () => void;
  onSave: () => void;
}

const SOURCE_TYPES: Array<{
  type: AgentKnowledgeSourceType;
  icon: typeof Globe;
  title: string;
  description: string;
  color: string;
}> = [
  {
    type: 'website',
    icon: Globe,
    title: 'Web Crawler',
    description: 'Crawl and extract content from a website to train your bot.',
    color: 'blue',
  },
  {
    type: 'faq',
    icon: HelpCircle,
    title: 'FAQ',
    description: 'Write question and answer pairs to help your bot answer common questions.',
    color: 'cyan',
  },
  {
    type: 'table',
    icon: Table,
    title: 'Tables',
    description: 'Upload a CSV file to train your bot with product details or other structured data.',
    color: 'emerald',
  },
  {
    type: 'rich_text',
    icon: FileText,
    title: 'Rich Text',
    description: 'Create formatted content with a rich text editor.',
    color: 'amber',
  },
  {
    type: 'file_upload',
    icon: Upload,
    title: 'File Upload',
    description: 'Upload files to your knowledge base to train your AI assistant.',
    color: 'rose',
  },
];

export function GlobalKnowledgeSourceModal({
  collection,
  onClose,
  onSave,
}: GlobalKnowledgeSourceModalProps) {
  const { user } = useAuth();
  const orgId = user?.organization_id;
  const isEditing = !!collection;

  const [selectedType, setSelectedType] = useState<AgentKnowledgeSourceType | null>(
    collection?.source_type || null
  );
  const [sourceName, setSourceName] = useState(collection?.name || '');
  const [description, setDescription] = useState(collection?.description || '');
  const [applyToAllAgents, setApplyToAllAgents] = useState(
    collection?.apply_to_all_agents ?? false
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSelectType = (type: AgentKnowledgeSourceType) => {
    setSelectedType(type);
    const sourceConfig = SOURCE_TYPES.find((s) => s.type === type);
    if (sourceConfig && !sourceName) {
      setSourceName(`New ${sourceConfig.title}`);
    }
  };

  const handleBack = () => {
    if (!isEditing) {
      setSelectedType(null);
    }
  };

  const handleSave = async (config: Record<string, unknown>) => {
    if (!orgId || !user || !selectedType || !sourceName.trim()) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      if (isEditing && collection) {
        await knowledgeCollectionsService.updateCollection(collection.id, {
          name: sourceName.trim(),
          description: description.trim() || undefined,
          apply_to_all_agents: applyToAllAgents,
          source_type: selectedType,
          source_config: config,
        });

        await knowledgeCollectionsService.createVersion(
          collection.id,
          { source_config: config },
          user.id
        );
      } else {
        await knowledgeCollectionsService.createCollection(
          orgId,
          {
            name: sourceName.trim(),
            description: description.trim() || undefined,
            apply_to_all_agents: applyToAllAgents,
            source_type: selectedType,
            source_config: config,
          },
          user.id
        );
      }

      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save knowledge collection');
    } finally {
      setSaving(false);
    }
  };

  const renderSourceForm = () => {
    if (!selectedType) return null;

    const existingConfig = collection?.source_config ||
      (collection?.latest_version?.source_config) ||
      {};

    const commonProps = {
      existingConfig: existingConfig as Record<string, unknown>,
      onSave: handleSave,
      onCancel: onClose,
      saving,
      isEditing,
    };

    return (
      <div>
        <GlobalFormHeader
          sourceName={sourceName}
          setSourceName={setSourceName}
          description={description}
          setDescription={setDescription}
          applyToAllAgents={applyToAllAgents}
          setApplyToAllAgents={setApplyToAllAgents}
        />

        {selectedType === 'website' && <WebCrawlerForm {...commonProps} />}
        {selectedType === 'faq' && <FAQForm {...commonProps} />}
        {selectedType === 'table' && <TableUploadForm {...commonProps} />}
        {selectedType === 'rich_text' && <RichTextForm {...commonProps} />}
        {selectedType === 'file_upload' && <FileUploadForm {...commonProps} />}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            {selectedType && !isEditing && (
              <button
                onClick={handleBack}
                className="p-1 text-slate-400 hover:text-white rounded transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div>
              <h2 className="text-lg font-semibold text-white">
                {isEditing ? 'Edit Collection' : 'Create Collection'}
              </h2>
              {!selectedType && (
                <p className="text-sm text-slate-400 mt-0.5">
                  Choose a source type to add knowledge to your agents
                </p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm">
            {error}
            <button onClick={() => setError(null)} className="ml-2 underline">
              Dismiss
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6">
          {!selectedType ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {SOURCE_TYPES.map((source) => {
                const Icon = source.icon;
                return (
                  <button
                    key={source.type}
                    onClick={() => handleSelectType(source.type)}
                    className="flex items-start gap-4 p-4 bg-slate-800 border border-slate-700 rounded-lg hover:border-slate-600 hover:bg-slate-800/80 transition-all text-left group"
                  >
                    <div className={`p-3 rounded-lg transition-colors ${
                      source.color === 'blue' ? 'bg-blue-500/10 group-hover:bg-blue-500/20' :
                      source.color === 'cyan' ? 'bg-cyan-500/10 group-hover:bg-cyan-500/20' :
                      source.color === 'emerald' ? 'bg-emerald-500/10 group-hover:bg-emerald-500/20' :
                      source.color === 'amber' ? 'bg-amber-500/10 group-hover:bg-amber-500/20' :
                      'bg-rose-500/10 group-hover:bg-rose-500/20'
                    }`}>
                      <Icon className={`w-6 h-6 ${
                        source.color === 'blue' ? 'text-blue-400' :
                        source.color === 'cyan' ? 'text-cyan-400' :
                        source.color === 'emerald' ? 'text-emerald-400' :
                        source.color === 'amber' ? 'text-amber-400' :
                        'text-rose-400'
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-white mb-1">{source.title}</h3>
                      <p className="text-sm text-slate-400 line-clamp-2">{source.description}</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-slate-400 transition-colors mt-1" />
                  </button>
                );
              })}
            </div>
          ) : (
            renderSourceForm()
          )}
        </div>
      </div>
    </div>
  );
}
