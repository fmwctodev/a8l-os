import { useState, useEffect, useRef } from 'react';
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  RefreshCw,
  Image,
  Video,
  Download,
  Plus,
} from 'lucide-react';
import type { MediaGenerationJob, MediaAsset } from '../../services/mediaGeneration';
import {
  getJobStatus,
  isJobActive,
  getStatusLabel,
  getStatusColor,
} from '../../services/mediaGeneration';

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
  const pollingRef = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  useEffect(() => {
    for (const job of jobs) {
      if (isJobActive(job.status) && !pollingRef.current[job.id]) {
        pollingRef.current[job.id] = setInterval(() => pollJob(job.id), 5000);
      }
    }

    return () => {
      Object.values(pollingRef.current).forEach(clearInterval);
    };
  }, [jobs]);

  async function pollJob(jobId: string) {
    try {
      const result = await getJobStatus(jobId);
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
                    <span
                      className={`text-xs font-medium ${getStatusColor(job.status)}`}
                    >
                      {getStatusLabel(job.status)}
                    </span>
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
                    {assets.map((asset) => (
                      <div key={asset.id} className="relative group flex-shrink-0">
                        {asset.media_type === 'image' ? (
                          <img
                            src={asset.public_url}
                            alt="Generated"
                            className="w-20 h-20 object-cover rounded-lg border border-gray-200 dark:border-gray-700"
                          />
                        ) : (
                          <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center justify-center">
                            <Video className="w-6 h-6 text-gray-400" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 rounded-lg transition-colors flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
