import { useState, useMemo } from 'react';
import type { Contact, MeetingTranscription } from '../../types';
import { MeetingTranscriptionCard } from '../meetings/MeetingTranscriptionCard';
import {
  Video,
  Search,
  Calendar,
  Filter,
  Clock,
  FileVideo,
  AlertCircle,
} from 'lucide-react';

interface ContactMeetingsTabProps {
  contact: Contact;
  meetings: MeetingTranscription[];
  onRefresh: () => void;
}

type DateFilter = 'all' | 'week' | 'month' | 'earlier';

export function ContactMeetingsTab({
  contact,
  meetings,
  onRefresh,
}: ContactMeetingsTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [showRecordingsOnly, setShowRecordingsOnly] = useState(false);

  const filteredMeetings = useMemo(() => {
    let filtered = meetings;

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (meeting) =>
          meeting.meeting_title.toLowerCase().includes(search) ||
          meeting.participants.some((p) =>
            p.name.toLowerCase().includes(search) ||
            p.email.toLowerCase().includes(search)
          ) ||
          meeting.summary?.toLowerCase().includes(search)
      );
    }

    if (showRecordingsOnly) {
      filtered = filtered.filter((meeting) => meeting.recording_url);
    }

    if (dateFilter !== 'all') {
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      filtered = filtered.filter((meeting) => {
        const meetingDate = new Date(meeting.meeting_date);
        if (dateFilter === 'week') {
          return meetingDate >= weekAgo;
        } else if (dateFilter === 'month') {
          return meetingDate >= monthAgo && meetingDate < weekAgo;
        } else {
          return meetingDate < monthAgo;
        }
      });
    }

    return filtered;
  }, [meetings, searchTerm, dateFilter, showRecordingsOnly]);

  const groupedMeetings = useMemo(() => {
    const groups: {
      week: MeetingTranscription[];
      month: MeetingTranscription[];
      earlier: MeetingTranscription[];
    } = {
      week: [],
      month: [],
      earlier: [],
    };

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    filteredMeetings.forEach((meeting) => {
      const meetingDate = new Date(meeting.meeting_date);
      if (meetingDate >= weekAgo) {
        groups.week.push(meeting);
      } else if (meetingDate >= monthAgo) {
        groups.month.push(meeting);
      } else {
        groups.earlier.push(meeting);
      }
    });

    return groups;
  }, [filteredMeetings]);

  const stats = useMemo(() => {
    const totalMeetings = meetings.length;
    const totalWithRecordings = meetings.filter((m) => m.recording_url).length;
    const totalDuration = meetings.reduce(
      (sum, m) => sum + (m.duration_minutes || 0),
      0
    );
    const avgDuration =
      totalMeetings > 0 ? Math.round(totalDuration / totalMeetings) : 0;
    const mostRecent = meetings[0]?.meeting_date;

    return {
      totalMeetings,
      totalWithRecordings,
      totalDuration,
      avgDuration,
      mostRecent,
    };
  }, [meetings]);

  const formatDuration = (minutes: number) => {
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (meetings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-4">
          <Video className="w-8 h-8 text-slate-500" />
        </div>
        <h3 className="text-lg font-medium text-white mb-2">No meetings recorded yet</h3>
        <p className="text-sm text-slate-400 text-center max-w-md mb-6">
          Meeting recordings from Google Meet will appear here automatically once you connect
          your Google account and import recordings.
        </p>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <AlertCircle className="w-4 h-4" />
          <span>Google Meet integration coming soon</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
              <Video className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.totalMeetings}</p>
              <p className="text-xs text-slate-400">Total Meetings</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-teal-500/20 flex items-center justify-center">
              <FileVideo className="w-5 h-5 text-teal-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.totalWithRecordings}</p>
              <p className="text-xs text-slate-400">With Recordings</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <Clock className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                {formatDuration(stats.totalDuration)}
              </p>
              <p className="text-xs text-slate-400">Total Duration</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">
                {stats.mostRecent ? formatDate(stats.mostRecent) : 'N/A'}
              </p>
              <p className="text-xs text-slate-400">Most Recent</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search meetings, participants, or topics..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div className="flex gap-2">
          <div className="relative">
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as DateFilter)}
              className="appearance-none pl-10 pr-8 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
            >
              <option value="all">All Time</option>
              <option value="week">This Week</option>
              <option value="month">Last 30 Days</option>
              <option value="earlier">Earlier</option>
            </select>
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          </div>

          <button
            onClick={() => setShowRecordingsOnly(!showRecordingsOnly)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
              showRecordingsOnly
                ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
            }`}
          >
            <Filter className="w-4 h-4" />
            Recordings Only
          </button>
        </div>
      </div>

      {filteredMeetings.length === 0 ? (
        <div className="text-center py-12">
          <Search className="w-12 h-12 text-slate-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No meetings found</h3>
          <p className="text-sm text-slate-400">
            Try adjusting your search or filter criteria
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {dateFilter === 'all' ? (
            <>
              {groupedMeetings.week.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    This Week
                    <span className="text-xs bg-slate-800 px-2 py-0.5 rounded-full">
                      {groupedMeetings.week.length}
                    </span>
                  </h3>
                  <div className="space-y-3">
                    {groupedMeetings.week.map((meeting) => (
                      <MeetingTranscriptionCard
                        key={meeting.id}
                        meeting={meeting}
                        showTranscript
                      />
                    ))}
                  </div>
                </div>
              )}

              {groupedMeetings.month.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Last 30 Days
                    <span className="text-xs bg-slate-800 px-2 py-0.5 rounded-full">
                      {groupedMeetings.month.length}
                    </span>
                  </h3>
                  <div className="space-y-3">
                    {groupedMeetings.month.map((meeting) => (
                      <MeetingTranscriptionCard
                        key={meeting.id}
                        meeting={meeting}
                        showTranscript
                      />
                    ))}
                  </div>
                </div>
              )}

              {groupedMeetings.earlier.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Earlier
                    <span className="text-xs bg-slate-800 px-2 py-0.5 rounded-full">
                      {groupedMeetings.earlier.length}
                    </span>
                  </h3>
                  <div className="space-y-3">
                    {groupedMeetings.earlier.map((meeting) => (
                      <MeetingTranscriptionCard
                        key={meeting.id}
                        meeting={meeting}
                        showTranscript
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-3">
              {filteredMeetings.map((meeting) => (
                <MeetingTranscriptionCard
                  key={meeting.id}
                  meeting={meeting}
                  showTranscript
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
