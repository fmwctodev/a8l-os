import { supabase } from '../lib/supabase';
import type { DriveConnection, DriveConnectionStatus } from '../types';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_DRIVE_API = 'https://www.googleapis.com/drive/v3';
const GOOGLE_OAUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
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
}

export interface GoogleDriveFolderInfo {
  id: string;
  name: string;
  parents?: string[];
}

export function getDriveOAuthUrl(
  clientId: string,
  redirectUri: string,
  state: string
): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    state,
  });

  return `${GOOGLE_OAUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForTokens(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to exchange code: ${error}`);
  }

  return response.json();
}

export async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<{ access_token: string; expires_in: number }> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to refresh token: ${error}`);
  }

  return response.json();
}

export async function getUserEmail(accessToken: string): Promise<string> {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch user info');
  }

  const data = await response.json();
  return data.email;
}

export async function getDriveConnection(
  organizationId: string
): Promise<DriveConnection | null> {
  const { data, error } = await supabase
    .from('drive_connections')
    .select('*')
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function saveDriveConnection(
  organizationId: string,
  tokens: { access_token: string; refresh_token: string; expires_in: number },
  email: string
): Promise<DriveConnection> {
  const tokenExpiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  const { data, error } = await supabase
    .from('drive_connections')
    .upsert({
      organization_id: organizationId,
      access_token_encrypted: tokens.access_token,
      refresh_token_encrypted: tokens.refresh_token,
      token_expiry: tokenExpiry,
      email,
      scopes: SCOPES.split(' '),
      is_active: true,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateDriveConnection(
  connectionId: string,
  updates: Partial<Pick<DriveConnection, 'is_active' | 'root_folder_id'>>
): Promise<void> {
  const { error } = await supabase
    .from('drive_connections')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', connectionId);

  if (error) throw error;
}

export async function disconnectDrive(organizationId: string): Promise<void> {
  const { error } = await supabase
    .from('drive_connections')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('organization_id', organizationId);

  if (error) throw error;
}

export async function getConnectionStatus(
  organizationId: string
): Promise<DriveConnectionStatus> {
  const connection = await getDriveConnection(organizationId);

  if (!connection || !connection.is_active) {
    return {
      connected: false,
      email: null,
      tokenExpired: false,
      lastSyncAt: null,
    };
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

export async function getValidAccessToken(
  connection: DriveConnection,
  clientId: string,
  clientSecret: string
): Promise<string> {
  const expiry = new Date(connection.token_expiry);
  const now = new Date();

  if (expiry.getTime() - now.getTime() > 5 * 60 * 1000) {
    return connection.access_token_encrypted;
  }

  const { access_token, expires_in } = await refreshAccessToken(
    connection.refresh_token_encrypted,
    clientId,
    clientSecret
  );

  const newExpiry = new Date(Date.now() + expires_in * 1000).toISOString();

  await supabase
    .from('drive_connections')
    .update({
      access_token_encrypted: access_token,
      token_expiry: newExpiry,
      updated_at: new Date().toISOString(),
    })
    .eq('id', connection.id);

  return access_token;
}

export async function listDriveFiles(
  accessToken: string,
  folderId: string = 'root',
  pageToken?: string
): Promise<{ files: GoogleDriveFileInfo[]; nextPageToken?: string }> {
  const params = new URLSearchParams({
    q: `'${folderId}' in parents and trashed = false`,
    fields: 'nextPageToken,files(id,name,mimeType,size,owners,parents,thumbnailLink,webViewLink,iconLink,trashed,createdTime,modifiedTime)',
    pageSize: '100',
    orderBy: 'folder,name',
  });

  if (pageToken) {
    params.set('pageToken', pageToken);
  }

  const response = await fetch(`${GOOGLE_DRIVE_API}/files?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error('Failed to list files');
  }

  const data = await response.json();
  return {
    files: data.files || [],
    nextPageToken: data.nextPageToken,
  };
}

export async function searchDriveFiles(
  accessToken: string,
  query: string,
  mimeTypes?: string[]
): Promise<GoogleDriveFileInfo[]> {
  let q = `name contains '${query.replace(/'/g, "\\'")}' and trashed = false`;

  if (mimeTypes && mimeTypes.length > 0) {
    const mimeQuery = mimeTypes.map((m) => `mimeType = '${m}'`).join(' or ');
    q = `${q} and (${mimeQuery})`;
  }

  const params = new URLSearchParams({
    q,
    fields: 'files(id,name,mimeType,size,owners,parents,thumbnailLink,webViewLink,iconLink,trashed,createdTime,modifiedTime)',
    pageSize: '50',
    orderBy: 'modifiedTime desc',
  });

  const response = await fetch(`${GOOGLE_DRIVE_API}/files?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error('Failed to search files');
  }

  const data = await response.json();
  return data.files || [];
}

export async function getDriveFileMetadata(
  accessToken: string,
  fileId: string
): Promise<GoogleDriveFileInfo> {
  const params = new URLSearchParams({
    fields: 'id,name,mimeType,size,owners,parents,thumbnailLink,webViewLink,iconLink,trashed,createdTime,modifiedTime',
  });

  const response = await fetch(`${GOOGLE_DRIVE_API}/files/${fileId}?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('File not found');
    }
    throw new Error('Failed to get file metadata');
  }

  return response.json();
}

export async function createDriveFolder(
  accessToken: string,
  name: string,
  parentId: string = 'root'
): Promise<GoogleDriveFolderInfo> {
  const response = await fetch(`${GOOGLE_DRIVE_API}/files`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to create folder');
  }

  return response.json();
}

export async function deleteDriveFile(
  accessToken: string,
  fileId: string
): Promise<void> {
  const response = await fetch(`${GOOGLE_DRIVE_API}/files/${fileId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok && response.status !== 404) {
    throw new Error('Failed to delete file');
  }
}

export async function getFileDownloadUrl(
  accessToken: string,
  fileId: string
): Promise<string> {
  return `${GOOGLE_DRIVE_API}/files/${fileId}?alt=media&access_token=${encodeURIComponent(accessToken)}`;
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
