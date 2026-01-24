import { useState } from 'react';
import type { MeetingTranscription } from '../../types';
import {
  Video,
  Calendar,
  Clock,
  Users,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  ListChecks,
  FileText,
  ExternalLink,
} from 'lucide-react';
import { MeetingRecordingLink } from './MeetingRecordingLink';

interface MeetingTranscriptionCardProps {
  meeting: MeetingTranscription;
  onSelect?: () => void;
  isSelected?: boolean;
  showTranscript?: boolean;
}

export function MeetingTranscriptionCard({
  meeting,
  onSelect,
  isSelected,
  showTranscript = false,
}: MeetingTranscriptionCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return '-';
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
  };

  const CardWrapper = onSelect ? 'button' : 'div';

  return (
    <div
      className={`rounded-lg border transition-colors ${
        isSelected
          ? 'border-cyan-500 bg-cyan-500/10'
          : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
      }`}
    >
      <CardWrapper
        onClick={onSelect}
        className={`w-full p-4 text-left ${onSelect ? 'cursor-pointer' : ''}`}
      >
        <div className="flex items-start gap-4">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
            meeting.recording_url ? 'bg-cyan-500/20' : 'bg-slate-700'
          }`}>
            <Video className={`w-5 h-5 ${meeting.recording_url ? 'text-cyan-400' : 'text-slate-400'}`} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-3 mb-2">
              <h3 className="font-medium text-white truncate">{meeting.meeting_title}</h3>
              {meeting.recording_url && (
                <MeetingRecordingLink
                  recordingUrl={meeting.recording_url}
                  variant="badge"
                />
              )}
            </div>

            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-400 mb-3">
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {formatDate(meeting.meeting_date)}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {formatDuration(meeting.duration_minutes)}
              </span>
              <span className="flex items-center gap-1">
                <Users className="w-4 h-4" />
                {meeting.participants.length} participants
              </span>
            </div>

            {meeting.summary && (
              <p className="text-sm text-slate-300 line-clamp-2 mb-3">{meeting.summary}</p>
            )}

            <div className="flex flex-wrap gap-4">
              {meeting.key_points && meeting.key_points.length > 0 && (
                <span className="flex items-center gap-1 text-xs text-slate-400">
                  <MessageSquare className="w-3 h-3" />
                  {meeting.key_points.length} key points
                </span>
              )}
              {meeting.action_items && meeting.action_items.length > 0 && (
                <span className="flex items-center gap-1 text-xs text-slate-400">
                  <ListChecks className="w-3 h-3" />
                  {meeting.action_items.length} action items
                </span>
              )}
              {meeting.transcript_text && (
                <span className="flex items-center gap-1 text-xs text-slate-400">
                  <FileText className="w-3 h-3" />
                  Transcript available
                </span>
              )}
            </div>
          </div>
        </div>
      </CardWrapper>

      {(showTranscript || meeting.key_points.length > 0 || meeting.action_items.length > 0) && (
        <div className="border-t border-slate-700">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full px-4 py-2 flex items-center justify-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-4 h-4" />
                Hide Details
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4" />
                Show Details
              </>
            )}
          </button>

          {isExpanded && (
            <div className="px-4 pb-4 space-y-4">
              {meeting.key_points && meeting.key_points.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-cyan-400" />
                    Key Points
                  </h4>
                  <ul className="space-y-1">
                    {meeting.key_points.map((point, i) => (
                      <li key={i} className="text-sm text-slate-400 flex items-start gap-2">
                        <span className="text-cyan-400 mt-1">-</span>
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {meeting.action_items && meeting.action_items.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
                    <ListChecks className="w-4 h-4 text-amber-400" />
                    Action Items
                  </h4>
                  <ul className="space-y-2">
                    {meeting.action_items.map((item, i) => (
                      <li key={i} className="text-sm text-slate-400 flex items-start gap-2">
                        <input
                          type="checkbox"
                          checked={item.completed}
                          readOnly
                          className="mt-1 w-4 h-4 rounded border-slate-600 bg-slate-700 text-cyan-500"
                        />
                        <div>
                          <p>{item.description}</p>
                          {item.assignee && (
                            <p className="text-xs text-slate-500">Assigned to: {item.assignee}</p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {showTranscript && meeting.transcript_text && (
                <div>
                  <h4 className="text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-slate-400" />
                    Transcript
                  </h4>
                  <div className="max-h-64 overflow-auto bg-slate-900/50 rounded-lg p-3">
                    <pre className="text-xs text-slate-400 whitespace-pre-wrap font-mono">
                      {meeting.transcript_text}
                    </pre>
                  </div>
                </div>
              )}

              {meeting.recording_url && (
                <div className="pt-2">
                  <MeetingRecordingLink
                    recordingUrl={meeting.recording_url}
                    recordingDuration={meeting.recording_duration}
                    recordingSizeBytes={meeting.recording_size_bytes}
                    variant="card"
                    showDuration
                    showSize
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
