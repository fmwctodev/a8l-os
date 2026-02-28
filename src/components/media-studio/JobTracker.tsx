import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Image,
  Video,
  Download,
  Plus,
  ArrowUpCircle,
  Sparkles,
  Monitor,
  Eye,
  Play,
} from 'lucide-react';
import type {
  MediaGenerationJob,
  MediaAsset,
  JobStatusResult,
  UpgradeTaskInfo,
} from '../../services/mediaGeneration';
import {
  getJobStatus,
  isJobActive,
  getStatusLabel,
  getStatusColor,
  requestUpgrade,
} from '../../services/mediaGeneration';
import { MediaLightbox, type LightboxItem } from '../ui/MediaLightbox';

interface JobTrackerProps {
  jobs: MediaGenerationJob[];
  onJobComplete: (jobId: string, assets: MediaAsset[]) => void;
  onAttachAsset?: (asset: MediaAsset) => void;
}

const STATUS_ICONS: Record<string, typeof Clock> = {
  waiting: Clock,
  queuing: Loader2,
  generating: Loader2,
  success: CheckCircle2,
  fail: XCircle,
  cancelled: AlertTriangle,
};

export default function JobTracker({ jobs, onJobComplete, onAttachAsset }: JobTrackerProps) {
  const [jobAssets, setJobAssets] = useState<Record<string, MediaAsset[]>>({});
  const [jobStatusResults, setJobStatusResults] = useState<Record<string, JobStatusResult>>({});
  const [upgradeLoading, setUpgradeLoading] = useState<Record<string, string>>({});
  const [lightbox, setLightbox] = useState<{ items: LightboxItem[]; index: number } | null>(null);
  const pollingRef = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  const pollJob = useCallback(async (jobId: string) => {
    try {
      const result = await getJobStatus(jobId);
      setJobStatusResults((prev) => ({ ...prev, [jobId]: result }));

      if (result.job.status === 'success' && result.assets.length > 0) {
        clearInterval(pollingRef.current[jobId]);
        delete pollingRef.current[jobId];
        setJobAssets((prev) => ({ ...prev, [jobId]: result.assets }));
        onJobComplete(jobId, result.assets);
      } else if (result.job.status === 'fail' || result.job.status === 'cancelled') {
        clearInterval(pollingRef.current[jobId]);
        delete pollingRef.current[jobId];
      }
    } catch (err) {
      console.error('Poll error:', err);
    }
  }, [onJobComplete]);

  useEffect(() => {
    for (const job of jobs) {
      if (isJobActive(job.status) && !pollingRef.current[job.id]) {
        pollingRef.current[job.id] = setInterval(() => pollJob(job.id), 5000);
      }
    }

    return () => {
      Object.values(pollingRef.current).forEach(clearInterval);
    };
  }, [jobs, pollJob]);

  async function handleUpgrade(jobId: string, upgradeType: '1080p' | '4k') {
    const key = `${jobId}-${upgradeType}`;
    setUpgradeLoading((prev) => ({ ...prev, [key]: 'loading' }));
    try {
      await requestUpgrade(jobId, upgradeType);
      setUpgradeLoading((prev) => ({ ...prev, [key]: 'requested' }));
      if (!pollingRef.current[jobId]) {
        pollingRef.current[jobId] = setInterval(() => pollJob(jobId), 5000);
      }
    } catch (err) {
      console.error('Upgrade error:', err);
      setUpgradeLoading((prev) => ({ ...prev, [key]: 'error' }));
      setTimeout(() => {
        setUpgradeLoading((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      }, 3000);
    }
  }

  if (jobs.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
        Generation Jobs
      </h4>
      <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
        {jobs.map((job) => {
          const StatusIcon = STATUS_ICONS[job.status] || Clock;
          const isActive = isJobActive(job.status);
          const assets = jobAssets[job.id] || [];
          const modelName = job.kie_models?.display_name || 'Unknown model';
          const modelType = job.kie_models?.type || 'image';
          const statusResult = jobStatusResults[job.id];
          const canUpgrade1080p = statusResult?.can_upgrade_1080p ?? false;
          const canUpgrade4k = statusResult?.can_upgrade_4k ?? false;
          const upgradeTasks = job.upgrade_task_ids;

          return (
            <div
              key={job.id}
              className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
            >
              <div className="flex items-center gap-3 px-3 py-2.5">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    job.status === 'success'
                      ? 'bg-emerald-50 dark:bg-emerald-900/20'
                      : job.status === 'fail'
                        ? 'bg-red-50 dark:bg-red-900/20'
                        : 'bg-blue-50 dark:bg-blue-900/20'
                  }`}
                >
                  <StatusIcon
                    className={`w-4 h-4 ${getStatusColor(job.status)} ${
                      isActive ? 'animate-spin' : ''
                    }`}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {modelName}
                    </span>
                    <span className={`text-xs font-medium ${getStatusColor(job.status)}`}>
                      {getStatusLabel(job.status)}
                    </span>
                    {job.job_type && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                        {job.job_type.replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 truncate">{job.prompt}</p>
                </div>
                {modelType === 'image' ? (
                  <Image className="w-4 h-4 text-gray-400 flex-shrink-0" />
                ) : (
                  <Video className="w-4 h-4 text-gray-400 flex-shrink-0" />
                )}
              </div>

              {isActive && (
                <div className="px-3 pb-2.5">
                  <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-1000 ${
                        job.status === 'generating'
                          ? 'bg-blue-500 w-2/3 animate-pulse'
                          : job.status === 'queuing'
                            ? 'bg-blue-400 w-1/3'
                            : 'bg-gray-300 w-[10%]'
                      }`}
                    />
                  </div>
                </div>
              )}

              {job.status === 'fail' && job.error_message && (
                <div className="px-3 pb-2.5">
                  <p className="text-xs text-red-600 dark:text-red-400">
                    {job.error_message}
                  </p>
                </div>
              )}

              {job.status === 'success' && assets.length > 0 && (
                <div className="px-3 pb-2.5">
                  <div className="flex gap-2 overflow-x-auto">
                    {assets.map((asset, assetIdx) => (
                      <div key={asset.id} className="relative group flex-shrink-0">
                        {asset.media_type === 'image' ? (
                          <img
                            src={asset.public_url}
                            alt="Generated"
                            className="w-20 h-20 object-cover rounded-lg border border-gray-200 dark:border-gray-700"
                          />
                        ) : (
                          <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center justify-center relative overflow-hidden">
                            {asset.thumbnail_url ? (
                              <img src={asset.thumbnail_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <Video className="w-6 h-6 text-gray-400" />
                            )}
                            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                              <Play className="w-5 h-5 text-white" />
                            </div>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 rounded-lg transition-colors flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
                          <button
                            onClick={() => setLightbox({
                              items: assets.map((a): LightboxItem => ({
                                url: a.public_url,
                                thumbnailUrl: a.thumbnail_url,
                                mediaType: a.media_type,
                              })),
                              index: assetIdx,
                            })}
                            className="p-1.5 bg-white rounded-full shadow-sm hover:bg-gray-100"
                            title="Preview"
                          >
                            <Eye className="w-3 h-3 text-gray-900" />
                          </button>
                          {onAttachAsset && (
                            <button
                              onClick={() => onAttachAsset(asset)}
                              className="p-1.5 bg-white rounded-full shadow-sm hover:bg-gray-100"
                              title="Attach to post"
                            >
                              <Plus className="w-3 h-3 text-gray-900" />
                            </button>
                          )}
                          <a
                            href={asset.public_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 bg-white rounded-full shadow-sm hover:bg-gray-100"
                            title="Download"
                          >
                            <Download className="w-3 h-3 text-gray-900" />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {job.status === 'success' && modelType === 'video' && (canUpgrade1080p || canUpgrade4k) && (
                <UpgradeBar
                  jobId={job.id}
                  canUpgrade1080p={canUpgrade1080p}
                  canUpgrade4k={canUpgrade4k}
                  upgradeTasks={upgradeTasks}
                  upgradeLoading={upgradeLoading}
                  onUpgrade={handleUpgrade}
                />
              )}

              {upgradeTasks && Object.keys(upgradeTasks).length > 0 && (
                <UpgradeStatusRow upgradeTasks={upgradeTasks} />
              )}
            </div>
          );
        })}
      </div>

      {lightbox && (
        <MediaLightbox
          items={lightbox.items}
          startIndex={lightbox.index}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}

function UpgradeBar({
  jobId,
  canUpgrade1080p,
  canUpgrade4k,
  upgradeTasks,
  upgradeLoading,
  onUpgrade,
}: {
  jobId: string;
  canUpgrade1080p: boolean;
  canUpgrade4k: boolean;
  upgradeTasks: Record<string, UpgradeTaskInfo> | null;
  upgradeLoading: Record<string, string>;
  onUpgrade: (jobId: string, type: '1080p' | '4k') => void;
}) {
  const has1080p = upgradeTasks?.['1080p'];
  const has4k = upgradeTasks?.['4k'];
  const loading1080p = upgradeLoading[`${jobId}-1080p`];
  const loading4k = upgradeLoading[`${jobId}-4k`];

  const show1080p = canUpgrade1080p && !has1080p && !loading1080p;
  const show4k = canUpgrade4k && !has4k && !loading4k;

  if (!show1080p && !show4k && !loading1080p && !loading4k) return null;

  return (
    <div className="px-3 pb-2.5 flex items-center gap-2 border-t border-gray-100 dark:border-gray-800 pt-2">
      <ArrowUpCircle className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
      <span className="text-[11px] text-gray-500 dark:text-gray-400">Upscale:</span>
      {show1080p && (
        <button
          onClick={() => onUpgrade(jobId, '1080p')}
          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
        >
          <Monitor className="w-3 h-3" />
          1080p
        </button>
      )}
      {loading1080p === 'loading' && (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-[11px] text-blue-600">
          <Loader2 className="w-3 h-3 animate-spin" /> Requesting 1080p...
        </span>
      )}
      {loading1080p === 'requested' && (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-[11px] text-emerald-600">
          <CheckCircle2 className="w-3 h-3" /> 1080p requested
        </span>
      )}
      {loading1080p === 'error' && (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-[11px] text-red-600">
          <XCircle className="w-3 h-3" /> 1080p failed
        </span>
      )}
      {show4k && (
        <button
          onClick={() => onUpgrade(jobId, '4k')}
          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
        >
          <Sparkles className="w-3 h-3" />
          4K
        </button>
      )}
      {loading4k === 'loading' && (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-[11px] text-amber-600">
          <Loader2 className="w-3 h-3 animate-spin" /> Requesting 4K...
        </span>
      )}
      {loading4k === 'requested' && (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-[11px] text-emerald-600">
          <CheckCircle2 className="w-3 h-3" /> 4K requested
        </span>
      )}
      {loading4k === 'error' && (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-[11px] text-red-600">
          <XCircle className="w-3 h-3" /> 4K failed
        </span>
      )}
    </div>
  );
}

function UpgradeStatusRow({
  upgradeTasks,
}: {
  upgradeTasks: Record<string, UpgradeTaskInfo>;
}) {
  const entries = Object.entries(upgradeTasks);
  if (entries.length === 0) return null;

  return (
    <div className="px-3 pb-2.5 space-y-1">
      {entries.map(([resolution, task]) => (
        <div
          key={resolution}
          className="flex items-center gap-2 text-[11px]"
        >
          {task.status === 'pending' && (
            <>
              <Loader2 className="w-3 h-3 text-blue-500 animate-spin" />
              <span className="text-blue-600 dark:text-blue-400">
                {resolution} upscale processing...
              </span>
            </>
          )}
          {task.status === 'complete' && (
            <>
              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
              <span className="text-emerald-600 dark:text-emerald-400">
                {resolution} ready
              </span>
              {task.url && (
                <a
                  href={task.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 text-blue-600 hover:text-blue-700 dark:text-blue-400"
                >
                  <Download className="w-3 h-3" />
                  Download
                </a>
              )}
            </>
          )}
          {task.status === 'failed' && (
            <>
              <XCircle className="w-3 h-3 text-red-500" />
              <span className="text-red-600 dark:text-red-400">
                {resolution} upscale failed
              </span>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
