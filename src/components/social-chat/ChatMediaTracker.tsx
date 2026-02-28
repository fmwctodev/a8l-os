import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Image,
  Film,
  Loader2,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Maximize2,
  Play,
  Clock,
} from 'lucide-react';
import { getJobStatus, isJobActive } from '../../services/mediaGeneration';
import type { MediaJobInfo } from '../../services/socialChat';
import type { MediaAsset } from '../../services/mediaGeneration';
import { MediaLightbox, type LightboxItem } from '../ui/MediaLightbox';

interface TrackedJob extends MediaJobInfo {
  currentStatus: string;
  assets: MediaAsset[];
  error?: string;
}

interface ChatMediaTrackerProps {
  jobs: MediaJobInfo[];
  onAssetReady: (draftIndex: number, assets: MediaAsset[]) => void;
  onJobStatusChange?: (jobId: string, newStatus: string) => void;
  onRetry?: (job: MediaJobInfo) => void;
}

export function ChatMediaTracker({ jobs, onAssetReady, onJobStatusChange, onRetry }: ChatMediaTrackerProps) {
  const [trackedJobs, setTrackedJobs] = useState<TrackedJob[]>(() =>
    jobs.map(j => ({
      ...j,
      currentStatus: j.status,
      assets: j.preloadedAssets && j.preloadedAssets.length > 0 ? j.preloadedAssets : [],
    }))
  );
  const [lightbox, setLightbox] = useState<{ items: LightboxItem[]; index: number } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onAssetReadyRef = useRef(onAssetReady);
  onAssetReadyRef.current = onAssetReady;
  const onJobStatusChangeRef = useRef(onJobStatusChange);
  onJobStatusChangeRef.current = onJobStatusChange;

  const pollJobs = useCallback(async () => {
    const activeJobs = trackedJobs.filter(j => isJobActive(j.currentStatus));
    if (activeJobs.length === 0) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }

    const updates: TrackedJob[] = [...trackedJobs];
    let changed = false;

    for (const job of activeJobs) {
      try {
        const result = await getJobStatus(job.job_id);
        const idx = updates.findIndex(j => j.job_id === job.job_id);
        if (idx === -1) continue;

        if (result.job.status !== updates[idx].currentStatus) {
          changed = true;
          updates[idx] = {
            ...updates[idx],
            currentStatus: result.job.status,
            assets: result.assets || [],
            error: result.job.error_message || undefined,
          };

          onJobStatusChangeRef.current?.(job.job_id, result.job.status);

          if (result.job.status === 'success' && result.assets?.length > 0) {
            onAssetReadyRef.current(updates[idx].draft_index, result.assets);
          }
        }
      } catch {
        // continue polling
      }
    }

    if (changed) {
      setTrackedJobs(updates);
    }
  }, [trackedJobs]);

  useEffect(() => {
    const hasActive = trackedJobs.some(j => isJobActive(j.currentStatus));
    if (hasActive && !pollRef.current) {
      pollRef.current = setInterval(pollJobs, 5000);
      pollJobs();
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [pollJobs]);

  useEffect(() => {
    setTrackedJobs(prev => {
      const existing = new Set(prev.map(j => j.job_id));
      const newJobs = jobs.filter(j => !existing.has(j.job_id));
      if (newJobs.length === 0) return prev;
      return [
        ...prev,
        ...newJobs.map(j => ({
          ...j,
          currentStatus: j.status,
          assets: j.preloadedAssets && j.preloadedAssets.length > 0 ? j.preloadedAssets : [],
        })),
      ];
    });
  }, [jobs]);

  if (trackedJobs.length === 0) return null;

  return (
    <div className="space-y-2 mt-2">
      {trackedJobs.map((job) => (
        <div
          key={job.job_id}
          className="flex items-start gap-2.5 bg-slate-800/80 border border-slate-700 rounded-lg p-2.5"
        >
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${getStatusBg(job.currentStatus)}`}>
            {job.media_type === 'video' ? (
              <Film className={`w-4 h-4 ${getStatusIconColor(job.currentStatus)}`} />
            ) : (
              <Image className={`w-4 h-4 ${getStatusIconColor(job.currentStatus)}`} />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-medium text-slate-300">
                {job.model_name}
              </span>
              <StatusIndicator status={job.currentStatus} />
            </div>
            <p className="text-[10px] text-slate-500 mt-0.5 truncate">
              {job.prompt}
            </p>

            {job.currentStatus === 'success' && job.assets.length > 0 && (
              <div className="flex gap-1.5 mt-2">
                {job.assets.map((asset, assetIdx) => (
                  <button
                    key={asset.id}
                    onClick={() => setLightbox({
                      items: job.assets.map((a): LightboxItem => ({
                        url: a.public_url,
                        thumbnailUrl: a.thumbnail_url,
                        mediaType: a.media_type,
                      })),
                      index: assetIdx,
                    })}
                    className="block relative group"
                  >
                    {asset.media_type === 'video' ? (
                      <div className="w-16 h-16 rounded-md bg-slate-700 flex items-center justify-center border border-slate-600 group-hover:border-cyan-500/50 transition-colors relative overflow-hidden">
                        {asset.thumbnail_url ? (
                          <img src={asset.thumbnail_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Film className="w-6 h-6 text-slate-400" />
                        )}
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                          <Play className="w-4 h-4 text-white" />
                        </div>
                      </div>
                    ) : (
                      <img
                        src={asset.thumbnail_url || asset.public_url}
                        alt=""
                        className="w-16 h-16 rounded-md object-cover border border-slate-600 group-hover:border-cyan-500/50 transition-colors"
                      />
                    )}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-md opacity-0 group-hover:opacity-100 transition-opacity">
                      <Maximize2 className="w-4 h-4 text-white" />
                    </div>
                  </button>
                ))}
              </div>
            )}

            {job.currentStatus === 'fail' && (
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-[10px] text-red-400">{job.error || 'Generation failed'}</span>
                {onRetry && (
                  <button
                    onClick={() => onRetry(job)}
                    className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-slate-400 hover:text-white bg-slate-700 rounded transition-colors"
                  >
                    <RotateCcw className="w-2.5 h-2.5" />
                    Retry
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
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

function StatusIndicator({ status }: { status: string }) {
  switch (status) {
    case 'waiting':
      return (
        <span className="flex items-center gap-1 text-[10px] text-amber-400">
          <Clock className="w-2.5 h-2.5" />
          Waiting
        </span>
      );
    case 'queuing':
      return (
        <span className="flex items-center gap-1 text-[10px] text-blue-400">
          <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
          In Queue
        </span>
      );
    case 'generating':
      return (
        <span className="flex items-center gap-1 text-[10px] text-blue-400">
          <Loader2 className="w-2.5 h-2.5 animate-spin" />
          Generating
        </span>
      );
    case 'success':
      return (
        <span className="flex items-center gap-1 text-[10px] text-emerald-400">
          <CheckCircle2 className="w-2.5 h-2.5" />
          Complete
        </span>
      );
    case 'fail':
      return (
        <span className="flex items-center gap-1 text-[10px] text-red-400">
          <AlertCircle className="w-2.5 h-2.5" />
          Failed
        </span>
      );
    default:
      return null;
  }
}

function getStatusBg(status: string): string {
  const map: Record<string, string> = {
    waiting: 'bg-amber-500/10',
    queuing: 'bg-blue-500/10',
    generating: 'bg-blue-500/10',
    success: 'bg-emerald-500/10',
    fail: 'bg-red-500/10',
  };
  return map[status] || 'bg-slate-700';
}

function getStatusIconColor(status: string): string {
  const map: Record<string, string> = {
    waiting: 'text-amber-400',
    queuing: 'text-blue-400',
    generating: 'text-blue-400',
    success: 'text-emerald-400',
    fail: 'text-red-400',
  };
  return map[status] || 'text-slate-400';
}
