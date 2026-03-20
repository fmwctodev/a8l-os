import { supabase } from '../lib/supabase';
import { fetchEdge } from '../lib/edgeFunction';
import type { GoogleMeetRecording, MeetingParticipant } from '../types';

const GOOGLE_MEET_RECORDINGS_FOLDER_NAME = 'Meet Recordings';

export interface DriveRecordingFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  webContentLink?: string;
  size: string;
  createdTime: string;
  modifiedTime: string;
  videoMediaMetadata?: {
    durationMillis: string;
    width: number;
    height: number;
  };
}

export interface MeetRecordingDetails {
  fileId: string;
  fileName: string;
  driveUrl: string;
  downloadUrl?: string;
  duration: string | null;
  sizeBytes: number;
  createdAt: string;
  meetingTitle: string;
  participants: string[];
}

async function driveSearch(query: string): Promise<DriveRecordingFile[]> {
  const response = await fetchEdge('drive-api', {
    body: { action: 'search', query },
  });

  if (!response.ok) {
    throw new Error('Failed to search Drive files');
  }

  const data = await response.json();
  return data.files || [];
}

async function driveGetMetadata(fileId: string): Promise<DriveRecordingFile | null> {
  const response = await fetchEdge('drive-api', {
    body: { action: 'get-metadata', fileId },
  });

  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error('Failed to get file metadata');
  }

  return await response.json();
}

export async function listGoogleMeetRecordings(
  _orgId: string,
  startDate?: string,
  endDate?: string
): Promise<GoogleMeetRecording[]> {
  const folderFiles = await driveSearch(
    `name = '${GOOGLE_MEET_RECORDINGS_FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder'`
  );

  const folderId = folderFiles[0]?.id;
  if (!folderId) return [];

  let query = `'${folderId}' in parents and mimeType contains 'video'`;
  if (startDate) query += ` and createdTime >= '${startDate}'`;
  if (endDate) query += ` and createdTime <= '${endDate}'`;

  const files = await driveSearch(query);
  return files.map(file => parseRecordingToMeetInfo(file));
}

function parseRecordingToMeetInfo(file: DriveRecordingFile): GoogleMeetRecording {
  const meetingInfo = parseMeetingInfoFromFileName(file.name);
  const durationMs = file.videoMediaMetadata?.durationMillis;
  const duration = durationMs ? formatDuration(parseInt(durationMs)) : undefined;

  return {
    meetingId: file.id,
    title: meetingInfo.title,
    startTime: file.createdTime,
    endTime: file.modifiedTime,
    participants: meetingInfo.participants,
    hasTranscript: false,
    recordingUrl: file.webViewLink,
    recordingFileId: file.id,
    recordingDuration: duration,
    recordingSizeBytes: parseInt(file.size),
    driveFileUrl: file.webViewLink,
  };
}

function parseMeetingInfoFromFileName(fileName: string): { title: string; participants: string[] } {
  const cleanName = fileName.replace(/\.(mp4|webm|mkv)$/i, '');

  const datePattern = /\s*-?\s*\d{4}-\d{2}-\d{2}/;
  const timePattern = /\s+at\s+\d{1,2}[.:]\d{2}/i;

  let title = cleanName
    .replace(datePattern, '')
    .replace(timePattern, '')
    .trim();

  if (!title) {
    title = 'Google Meet Recording';
  }

  return {
    title,
    participants: [],
  };
}

function formatDuration(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

export async function getRecordingDetails(
  _orgId: string,
  fileId: string
): Promise<MeetRecordingDetails | null> {
  const file = await driveGetMetadata(fileId);
  if (!file) return null;

  const meetingInfo = parseMeetingInfoFromFileName(file.name);
  const durationMs = file.videoMediaMetadata?.durationMillis;

  return {
    fileId: file.id,
    fileName: file.name,
    driveUrl: file.webViewLink,
    downloadUrl: file.webContentLink,
    duration: durationMs ? formatDuration(parseInt(durationMs)) : null,
    sizeBytes: parseInt(file.size),
    createdAt: file.createdTime,
    meetingTitle: meetingInfo.title,
    participants: meetingInfo.participants,
  };
}

export async function getRecordingDriveLink(
  orgId: string,
  fileId: string
): Promise<string | null> {
  const details = await getRecordingDetails(orgId, fileId);
  return details?.driveUrl || null;
}

export async function checkDriveConnectionStatus(orgId: string, userId?: string): Promise<{
  connected: boolean;
  tokenExpired: boolean;
  hasRecordingsAccess: boolean;
  email?: string;
}> {
  let query = supabase
    .from('drive_connections')
    .select('email, is_active, token_expiry, scopes')
    .eq('organization_id', orgId);

  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query.maybeSingle();

  if (error || !data) {
    return { connected: false, tokenExpired: false, hasRecordingsAccess: false };
  }

  const tokenExpiry = new Date(data.token_expiry);
  const isTokenValid = tokenExpiry > new Date();

  const hasRecordingsAccess = data.scopes?.includes('https://www.googleapis.com/auth/drive.readonly') ||
    data.scopes?.includes('https://www.googleapis.com/auth/drive');

  return {
    connected: data.is_active && isTokenValid,
    tokenExpired: data.is_active && !isTokenValid,
    hasRecordingsAccess,
    email: data.email,
  };
}

export async function importMeetRecording(
  orgId: string,
  recording: GoogleMeetRecording,
  importedBy: string
): Promise<{ transcriptionId: string }> {
  const { data, error } = await supabase
    .from('meeting_transcriptions')
    .insert({
      org_id: orgId,
      meeting_source: 'google_meet',
      external_meeting_id: recording.meetingId,
      meeting_title: recording.title,
      meeting_date: recording.startTime,
      participants: recording.participants.map(email => ({ name: '', email })),
      transcript_text: '',
      recording_url: recording.recordingUrl,
      recording_file_id: recording.recordingFileId,
      recording_duration: recording.recordingDuration,
      recording_size_bytes: recording.recordingSizeBytes,
      imported_by: importedBy,
    })
    .select('id')
    .single();

  if (error) throw error;

  return { transcriptionId: data.id };
}

export async function extractParticipantsFromMeeting(
  recording: GoogleMeetRecording
): Promise<MeetingParticipant[]> {
  return recording.participants.map(email => ({
    name: email.split('@')[0],
    email,
  }));
}

export async function syncMeetRecordings(
  orgId: string,
  importedBy: string,
  sinceDate?: string
): Promise<{ imported: number; skipped: number }> {
  const recordings = await listGoogleMeetRecordings(orgId, sinceDate);

  let imported = 0;
  let skipped = 0;

  for (const recording of recordings) {
    const { data: existing } = await supabase
      .from('meeting_transcriptions')
      .select('id')
      .eq('org_id', orgId)
      .eq('meeting_source', 'google_meet')
      .eq('external_meeting_id', recording.meetingId)
      .maybeSingle();

    if (existing) {
      skipped++;
      continue;
    }

    try {
      await importMeetRecording(orgId, recording, importedBy);
      imported++;
    } catch {
      skipped++;
    }
  }

  return { imported, skipped };
}

export async function enrichMeetingRecording(
  meetingTranscriptionId: string
): Promise<{ has_transcript: boolean; has_notes: boolean; key_points_count: number; action_items_count: number }> {
  const response = await fetchEdge('drive-api', {
    body: { action: 'enrich-meeting', meetingTranscriptionId },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || 'Failed to enrich meeting');
  }

  return await response.json();
}

export async function enrichAllUnprocessedRecordings(
  orgId: string
): Promise<{ enriched: number; failed: number }> {
  const { data: unprocessed } = await supabase
    .from('meeting_transcriptions')
    .select('id')
    .eq('org_id', orgId)
    .eq('meeting_source', 'google_meet')
    .is('processed_at', null)
    .limit(10);

  if (!unprocessed || unprocessed.length === 0) {
    return { enriched: 0, failed: 0 };
  }

  const ids = unprocessed.map(r => r.id);

  const response = await fetchEdge('drive-api', {
    body: { action: 'enrich-meetings-batch', meetingTranscriptionIds: ids },
  });

  if (!response.ok) {
    throw new Error('Failed to enrich meetings batch');
  }

  const data = await response.json();
  const results = data.results || [];

  let enriched = 0;
  let failed = 0;
  for (const r of results) {
    if (r.error) {
      failed++;
    } else {
      enriched++;
    }
  }

  return { enriched, failed };
}

export function formatRecordingSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
