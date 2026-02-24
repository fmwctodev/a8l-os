import { useState, useCallback } from 'react';
import {
  Sparkles,
  X,
  Wand2,
  FolderOpen,
  ChevronRight,
  AlertCircle,
  Shield,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import ModelSelector from './ModelSelector';
import GenerationForm from './GenerationForm';
import JobTracker from './JobTracker';
import MediaLibrary from './MediaLibrary';
import type {
  KieModel,
  MediaGenerationJob,
  MediaAsset,
  CreateJobParams,
} from '../../services/mediaGeneration';
import { createGenerationJob, uploadSourceImage } from '../../services/mediaGeneration';

type Tab = 'generate' | 'library';

interface MediaStudioPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onAttachAsset: (asset: MediaAsset) => void;
  postId?: string;
  platform?: string;
  brandKitId?: string | null;
  promptSuffix?: string;
}

export default function MediaStudioPanel({
  isOpen,
  onClose,
  onAttachAsset,
  postId,
  platform,
  brandKitId,
  promptSuffix,
}: MediaStudioPanelProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('generate');
  const [selectedModel, setSelectedModel] = useState<KieModel | null>(null);
  const [jobs, setJobs] = useState<MediaGenerationJob[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = user?.role === 'Admin' || user?.role === 'SuperAdmin';

  const handleSubmit = useCallback(
    async (params: CreateJobParams) => {
      if (!user?.organization_id || !user?.id) return;

      setIsSubmitting(true);
      setError(null);

      try {
        const job = await createGenerationJob(params);
        setJobs((prev) => [job, ...prev]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Generation failed');
      } finally {
        setIsSubmitting(false);
      }
    },
    [user]
  );

  const handleJobComplete = useCallback(
    (jobId: string, assets: MediaAsset[]) => {
      setJobs((prev) =>
        prev.map((j) => (j.id === jobId ? { ...j, status: 'success' as const } : j))
      );
    },
    []
  );

  if (!isOpen) return null;

  if (!isAdmin) {
    return (
      <div className="fixed inset-y-0 right-0 w-[420px] bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 shadow-2xl z-50 flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-gray-900 dark:text-white" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Media Studio
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <Shield className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-4" />
          <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-2">
            Admin Access Required
          </h4>
          <p className="text-sm text-gray-500 max-w-[280px]">
            AI media generation is only available to Admin and SuperAdmin users.
            Contact your administrator for access.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-y-0 right-0 w-[420px] bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 shadow-2xl z-50 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-gray-900 dark:text-white" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            Media Studio
          </h3>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('generate')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 'generate'
                ? 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-white'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <Wand2 className="w-3 h-3" />
            Generate
          </button>
          <button
            onClick={() => setActiveTab('library')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 'library'
                ? 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-white'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <FolderOpen className="w-3 h-3" />
            Library
          </button>
          <button
            onClick={onClose}
            className="ml-2 p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'generate' ? (
          <div className="p-4 space-y-5">
            {error && (
              <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-red-700 dark:text-red-300">{error}</p>
              </div>
            )}

            <div>
              <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                1. Choose Model
              </h4>
              <ModelSelector
                selectedModelId={selectedModel?.id || null}
                onSelect={setSelectedModel}
                platformHint={platform}
              />
            </div>

            <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
              <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                2. Configure
                <ChevronRight className="w-3 h-3" />
                Generate
              </h4>
              <GenerationForm
                model={selectedModel}
                onSubmit={handleSubmit}
                isSubmitting={isSubmitting}
                brandKitId={brandKitId}
                postId={postId}
                defaultPromptSuffix={promptSuffix}
              />
            </div>

            {jobs.length > 0 && (
              <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
                <JobTracker
                  jobs={jobs}
                  onJobComplete={handleJobComplete}
                  onAttachAsset={onAttachAsset}
                />
              </div>
            )}
          </div>
        ) : (
          <div className="p-4">
            <MediaLibrary onAttach={onAttachAsset} compact />
          </div>
        )}
      </div>
    </div>
  );
}
