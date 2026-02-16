import { supabase } from '../lib/supabase';
import { fetchEdge } from '../lib/edgeFunction';
import type { DriveConnection, DriveConnectionStatus } from '../types';

const SCOPES = [
  'https://www.googleapis.com/auth/drive',
].join(' ');

export interface GoogleDriveFileInfo {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  owners?: { emailAddress: string }[];
  parents?: string[];
  thumbnailLink?: string;
  webViewLink?: string;
  iconLink?: string;
  trashed?: boolean;
  createdTime?: string;
  modifiedTime?: string;
  shared?: boolean;
  driveId?: string;
}

export interface GoogleDriveFolderInfo {
  id: string;
  name: string;
  parents?: string[];
}

export interface SharedDriveInfo {
  id: string;
  name: string;
  backgroundImageLink?: string;
  createdTime?: string;
}

async function callDriveApi(action: string, body?: Record<string, unknown>) {
  const response = await fetchEdge('drive-api', {
    body: { action, ...body },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Drive API ${action} failed`);
  }

  return response.json();
}

export async function initiateDriveOAuth(redirectUri?: string): Promise<string> {
  const response = await fetchEdge('drive-oauth-start', {
    body: { redirect_uri: redirectUri || `${window.location.origin}/media` },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to start Google Drive OAuth');
  }

  const data = await response.json();
  return data.authUrl;
}

export async function autoConnectDrive(
  providerToken: string,
  providerRefreshToken: string
): Promise<{ connected: boolean; email?: string }> {
  const response = await fetchEdge('drive-auto-connect', {
    body: { provider_token: providerToken, provider_refresh_token: providerRefreshToken },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to auto-connect Drive');
  }

  return response.json();
}

export async function getDriveConnection(
  userId: string
): Promise<DriveConnection | null> {
  const { data, error } = await supabase
    .from('drive_connections')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function disconnectDrive(userId: string): Promise<void> {
  const { error: connError } = await supabase
    .from('drive_connections')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('user_id', userId);

  if (connError) throw connError;

  const { error: flagError } = await supabase
    .from('users')
    .update({ google_drive_connected: false, updated_at: new Date().toISOString() })
    .eq('id', userId);

  if (flagError) throw flagError;
}

export async function getConnectionStatus(
  userId: string
): Promise<DriveConnectionStatus> {
  const connection = await getDriveConnection(userId);

  if (!connection || !connection.is_active) {
    return { connected: false, email: null, tokenExpired: false, lastSyncAt: null };
  }

  const expiry = new Date(connection.token_expiry);
  const tokenExpired = expiry.getTime() < Date.now();

  return {
    connected: true,
    email: connection.email,
    tokenExpired,
    lastSyncAt: connection.updated_at,
  };
}

export async function listDriveFilesViaApi(
  folderId: string = 'root',
  pageToken?: string,
  driveId?: string
): Promise<{ files: GoogleDriveFileInfo[]; nextPageToken?: string }> {
  return callDriveApi('list', { folderId, pageToken, driveId });
}

export async function listSharedDrives(): Promise<SharedDriveInfo[]> {
  const data = await callDriveApi('list-shared-drives');
  return data.drives || [];
}

export async function listSharedWithMeViaApi(
  pageToken?: string
): Promise<{ files: GoogleDriveFileInfo[]; nextPageToken?: string }> {
  return callDriveApi('list-shared-with-me', { pageToken });
}

export async function searchDriveFilesViaApi(
  query: string,
  mimeTypes?: string[],
  driveId?: string
): Promise<GoogleDriveFileInfo[]> {
  const data = await callDriveApi('search', { query, mimeTypes, driveId });
  return data.files || [];
}

export async function createDriveFolderViaApi(
  name: string,
  parentId: string = 'root',
  driveId?: string
): Promise<GoogleDriveFolderInfo> {
  const data = await callDriveApi('create-folder', { name, parentId, driveId });
  return data.folder;
}

export async function deleteDriveFileViaApi(fileId: string): Promise<void> {
  await callDriveApi('delete', { fileId });
}

export async function getDownloadUrl(fileId: string): Promise<{ url: string; accessToken: string }> {
  return callDriveApi('get-download-url', { fileId });
}

export async function uploadFileToDrive(
  file: File,
  parentId: string = 'root',
  driveId?: string
): Promise<GoogleDriveFileInfo> {
  const formData = new FormData();
  formData.append('file', file);

  const params: Record<string, string> = { action: 'upload', parentId };
  if (driveId) params.driveId = driveId;

  const response = await fetchEdge('drive-api', { body: formData, params });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to upload file');
  }

  const data = await response.json();
  return data.file;
}

export async function shareDriveFile(
  fileId: string,
  email: string,
  role: string = 'reader'
): Promise<void> {
  await callDriveApi('share', { fileId, email, role, type: 'user' });
}

export async function getShareLink(fileId: string): Promise<string> {
  const data = await callDriveApi('get-share-link', { fileId });
  return data.link;
}

export async function downloadDriveFile(fileId: string, fileName: string): Promise<void> {
  const { url, accessToken } = await getDownloadUrl(fileId);
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) throw new Error('Failed to download file');

  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(blobUrl);
}

export function isFolder(mimeType: string): boolean {
  return mimeType === 'application/vnd.google-apps.folder';
}

export function getFileTypeCategory(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'spreadsheet';
  if (mimeType.includes('document') || mimeType.includes('word')) return 'document';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'presentation';
  if (mimeType.startsWith('text/')) return 'text';
  return 'other';
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
