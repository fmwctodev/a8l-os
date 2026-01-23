import { supabase } from '../lib/supabase';
import type { DriveFile, DriveFolder, DriveFilters, DriveStats } from '../types';
import type { GoogleDriveFileInfo } from './googleDrive';

export async function getDriveFolders(
  organizationId: string,
  parentId?: string | null
): Promise<DriveFolder[]> {
  let query = supabase
    .from('drive_folders')
    .select('*')
    .eq('organization_id', organizationId)
    .order('name');

  if (parentId === null || parentId === undefined) {
    query = query.is('parent_drive_folder_id', null);
  } else if (parentId === 'root') {
    query = query.eq('drive_folder_id', 'root');
  } else {
    query = query.eq('parent_drive_folder_id', parentId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getDriveFolderById(
  organizationId: string,
  driveFolderId: string
): Promise<DriveFolder | null> {
  const { data, error } = await supabase
    .from('drive_folders')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('drive_folder_id', driveFolderId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getDriveFiles(
  organizationId: string,
  filters: DriveFilters = {}
): Promise<DriveFile[]> {
  let query = supabase
    .from('drive_files')
    .select('*')
    .eq('organization_id', organizationId)
    .order('name');

  if (filters.folderId) {
    query = query.eq('parent_drive_folder_id', filters.folderId);
  } else if (filters.folderId === null) {
    query = query.is('parent_drive_folder_id', null);
  }

  if (!filters.showDeleted) {
    query = query.eq('is_deleted', false);
  }

  if (filters.mimeType && filters.mimeType.length > 0) {
    query = query.in('mime_type', filters.mimeType);
  }

  if (filters.search) {
    query = query.ilike('name', `%${filters.search}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getDriveFileById(
  fileId: string
): Promise<DriveFile | null> {
  const { data, error } = await supabase
    .from('drive_files')
    .select('*')
    .eq('id', fileId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getDriveFileByDriveId(
  organizationId: string,
  driveFileId: string
): Promise<DriveFile | null> {
  const { data, error } = await supabase
    .from('drive_files')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('drive_file_id', driveFileId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function upsertDriveFolder(
  organizationId: string,
  folder: {
    drive_folder_id: string;
    name: string;
    parent_drive_folder_id?: string | null;
    path: string;
  }
): Promise<DriveFolder> {
  const { data, error } = await supabase
    .from('drive_folders')
    .upsert({
      organization_id: organizationId,
      drive_folder_id: folder.drive_folder_id,
      name: folder.name,
      parent_drive_folder_id: folder.parent_drive_folder_id || null,
      path: folder.path,
      last_synced_at: new Date().toISOString(),
    }, {
      onConflict: 'organization_id,drive_folder_id',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function upsertDriveFile(
  organizationId: string,
  file: GoogleDriveFileInfo,
  parentFolderId?: string | null
): Promise<DriveFile> {
  const { data, error } = await supabase
    .from('drive_files')
    .upsert({
      organization_id: organizationId,
      drive_file_id: file.id,
      name: file.name,
      mime_type: file.mimeType,
      size_bytes: file.size ? parseInt(file.size, 10) : 0,
      drive_owner_email: file.owners?.[0]?.emailAddress || null,
      parent_drive_folder_id: parentFolderId || file.parents?.[0] || null,
      thumbnail_url: file.thumbnailLink || null,
      web_view_link: file.webViewLink || null,
      icon_link: file.iconLink || null,
      is_deleted: file.trashed || false,
      access_revoked: false,
      last_synced_at: new Date().toISOString(),
    }, {
      onConflict: 'organization_id,drive_file_id',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function markFileAsDeleted(fileId: string): Promise<void> {
  const { error } = await supabase
    .from('drive_files')
    .update({
      is_deleted: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', fileId);

  if (error) throw error;
}

export async function markFileAccessRevoked(fileId: string): Promise<void> {
  const { error } = await supabase
    .from('drive_files')
    .update({
      access_revoked: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', fileId);

  if (error) throw error;
}

export async function restoreFileAccess(fileId: string): Promise<void> {
  const { error } = await supabase
    .from('drive_files')
    .update({
      access_revoked: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', fileId);

  if (error) throw error;
}

export async function deleteDriveFileRecord(fileId: string): Promise<void> {
  const { error } = await supabase
    .from('drive_files')
    .delete()
    .eq('id', fileId);

  if (error) throw error;
}

export async function deleteDriveFolderRecord(folderId: string): Promise<void> {
  const { error } = await supabase
    .from('drive_folders')
    .delete()
    .eq('id', folderId);

  if (error) throw error;
}

export async function getDriveStats(organizationId: string): Promise<DriveStats> {
  const [filesResult, foldersResult, attachmentsResult] = await Promise.all([
    supabase
      .from('drive_files')
      .select('is_deleted,access_revoked', { count: 'exact' })
      .eq('organization_id', organizationId),
    supabase
      .from('drive_folders')
      .select('id', { count: 'exact' })
      .eq('organization_id', organizationId),
    supabase
      .from('file_attachments')
      .select('id', { count: 'exact' })
      .eq('organization_id', organizationId),
  ]);

  const files = filesResult.data || [];
  const totalFiles = files.length;
  const unavailableFiles = files.filter(
    (f) => f.is_deleted || f.access_revoked
  ).length;

  return {
    totalFiles,
    totalFolders: foldersResult.count || 0,
    availableFiles: totalFiles - unavailableFiles,
    unavailableFiles,
    totalAttachments: attachmentsResult.count || 0,
  };
}

export async function getFolderPath(
  organizationId: string,
  driveFolderId: string
): Promise<DriveFolder[]> {
  const path: DriveFolder[] = [];
  let currentId: string | null = driveFolderId;

  while (currentId && currentId !== 'root') {
    const folder = await getDriveFolderById(organizationId, currentId);
    if (!folder) break;
    path.unshift(folder);
    currentId = folder.parent_drive_folder_id;
  }

  return path;
}

export function getFileStatus(file: DriveFile): 'available' | 'unavailable' | 'deleted' | 'access_revoked' {
  if (file.is_deleted) return 'deleted';
  if (file.access_revoked) return 'access_revoked';
  return 'available';
}

export function isFileAvailable(file: DriveFile): boolean {
  return !file.is_deleted && !file.access_revoked;
}
