import { supabase } from '../lib/supabase';
import type { GoogleMeetRecording, MeetingParticipant } from '../types';

const GOOGLE_DRIVE_API = 'https://www.googleapis.com/drive/v3';
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

async function getDriveAccessToken(orgId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('drive_connections')
    .select('access_token_encrypted, token_expiry')
    .eq('organization_id', orgId)
    .eq('is_active', true)
    .maybeSingle();

  if (error || !data) return null;

  const tokenExpiry = new Date(data.token_expiry);
  if (tokenExpiry < new Date()) {
    return null;
  }

  return data.access_token_encrypted;
}

export async function listGoogleMeetRecordings(
  orgId: string,
  startDate?: string,
  endDate?: string
): Promise<GoogleMeetRecording[]> {
  const accessToken = await getDriveAccessToken(orgId);
  if (!accessToken) {
    throw new Error('Google Drive not connected or token expired');
  }

  const folderId = await findMeetRecordingsFolder(accessToken);
  if (!folderId) {
    return [];
  }

  let query = `'${folderId}' in parents and mimeType contains 'video'`;

  if (startDate) {
    query += ` and createdTime >= '${startDate}'`;
  }
  if (endDate) {
    query += ` and createdTime <= '${endDate}'`;
  }

  const params = new URLSearchParams({
    q: query,
    fields: 'files(id,name,mimeType,webViewLink,size,createdTime,modifiedTime,videoMediaMetadata)',
    orderBy: 'createdTime desc',
    pageSize: '100',
  });

  const response = await fetch(`${GOOGLE_DRIVE_API}/files?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error('Failed to list Meet recordings');
  }

  const data = await response.json();
  const files: DriveRecordingFile[] = data.files || [];

  return files.map(file => parseRecordingToMeetInfo(file));
}

async function findMeetRecordingsFolder(accessToken: string): Promise<string | null> {
  const query = `name = '${GOOGLE_MEET_RECORDINGS_FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder'`;
  const params = new URLSearchParams({
    q: query,
    fields: 'files(id,name)',
    pageSize: '1',
  });

  const response = await fetch(`${GOOGLE_DRIVE_API}/files?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) return null;

  const data = await response.json();
  return data.files?.[0]?.id || null;
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
  orgId: string,
  fileId: string
): Promise<MeetRecordingDetails | null> {
  const accessToken = await getDriveAccessToken(orgId);
  if (!accessToken) {
    throw new Error('Google Drive not connected or token expired');
  }

  const params = new URLSearchParams({
    fields: 'id,name,mimeType,webViewLink,webContentLink,size,createdTime,modifiedTime,videoMediaMetadata',
  });

  const response = await fetch(`${GOOGLE_DRIVE_API}/files/${fileId}?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error('Failed to get recording details');
  }

  const file: DriveRecordingFile = await response.json();
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

export async function checkDriveConnectionStatus(orgId: string): Promise<{
  connected: boolean;
  hasRecordingsAccess: boolean;
  email?: string;
}> {
  const { data, error } = await supabase
    .from('drive_connections')
    .select('email, is_active, token_expiry, scopes')
    .eq('organization_id', orgId)
    .maybeSingle();

  if (error || !data) {
    return { connected: false, hasRecordingsAccess: false };
  }

  const tokenExpiry = new Date(data.token_expiry);
  const isTokenValid = tokenExpiry > new Date();

  const hasRecordingsAccess = data.scopes?.includes('https://www.googleapis.com/auth/drive.readonly') ||
    data.scopes?.includes('https://www.googleapis.com/auth/drive');

  return {
    connected: data.is_active && isTokenValid,
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

export function formatRecordingSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
