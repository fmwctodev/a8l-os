import { Video, ExternalLink, Play, Clock, HardDrive } from 'lucide-react';
import { formatRecordingSize } from '../../services/googleMeet';

interface MeetingRecordingLinkProps {
  recordingUrl: string | null;
  recordingDuration?: string | null;
  recordingSizeBytes?: number | null;
  variant?: 'button' | 'badge' | 'inline' | 'card';
  showDuration?: boolean;
  showSize?: boolean;
}

export function MeetingRecordingLink({
  recordingUrl,
  recordingDuration,
  recordingSizeBytes,
  variant = 'badge',
  showDuration = false,
  showSize = false,
}: MeetingRecordingLinkProps) {
  if (!recordingUrl) {
    return null;
  }

  if (variant === 'button') {
    return (
      <a
        href={recordingUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors"
      >
        <Play className="w-4 h-4" />
        View Recording
        <ExternalLink className="w-3 h-3" />
      </a>
    );
  }

  if (variant === 'badge') {
    return (
      <a
        href={recordingUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 rounded-full text-xs font-medium transition-colors"
      >
        <Video className="w-3 h-3" />
        Recording
        <ExternalLink className="w-3 h-3" />
      </a>
    );
  }

  if (variant === 'inline') {
    return (
      <a
        href={recordingUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300 text-sm transition-colors"
      >
        <Video className="w-4 h-4" />
        <span>View Recording</span>
        <ExternalLink className="w-3 h-3" />
      </a>
    );
  }

  if (variant === 'card') {
    return (
      <a
        href={recordingUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block p-4 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 rounded-lg transition-colors group"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center group-hover:bg-cyan-500/30 transition-colors">
            <Video className="w-5 h-5 text-cyan-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-medium flex items-center gap-2">
              Meeting Recording
              <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-cyan-400 transition-colors" />
            </p>
            <div className="flex items-center gap-3 text-sm text-slate-400 mt-0.5">
              {showDuration && recordingDuration && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {recordingDuration}
                </span>
              )}
              {showSize && recordingSizeBytes && (
                <span className="flex items-center gap-1">
                  <HardDrive className="w-3 h-3" />
                  {formatRecordingSize(recordingSizeBytes)}
                </span>
              )}
              {!showDuration && !showSize && (
                <span>Click to open in Google Drive</span>
              )}
            </div>
          </div>
        </div>
      </a>
    );
  }

  return null;
}
