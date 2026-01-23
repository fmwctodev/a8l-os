import { supabase } from '../lib/supabase';
import type { FileAttachment, FileAttachmentEntityType, DriveFile } from '../types';

export interface FileAttachmentWithFile extends FileAttachment {
  drive_file: DriveFile;
}

export async function getAttachments(
  entityType: FileAttachmentEntityType,
  entityId: string
): Promise<FileAttachmentWithFile[]> {
  const { data, error } = await supabase
    .from('file_attachments')
    .select(`
      *,
      drive_file:drive_files(*),
      attached_by_user:users!file_attachments_attached_by_fkey(id, name, email, avatar_url)
    `)
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('attached_at', { ascending: false });

  if (error) throw error;
  return (data || []) as FileAttachmentWithFile[];
}

export async function getAttachmentById(
  attachmentId: string
): Promise<FileAttachmentWithFile | null> {
  const { data, error } = await supabase
    .from('file_attachments')
    .select(`
      *,
      drive_file:drive_files(*),
      attached_by_user:users!file_attachments_attached_by_fkey(id, name, email, avatar_url)
    `)
    .eq('id', attachmentId)
    .maybeSingle();

  if (error) throw error;
  return data as FileAttachmentWithFile | null;
}

export async function attachFile(
  organizationId: string,
  driveFileId: string,
  entityType: FileAttachmentEntityType,
  entityId: string,
  attachedBy: string,
  note?: string
): Promise<FileAttachment> {
  const { data, error } = await supabase
    .from('file_attachments')
    .insert({
      organization_id: organizationId,
      drive_file_id: driveFileId,
      entity_type: entityType,
      entity_id: entityId,
      attached_by: attachedBy,
      note: note || null,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error('File is already attached to this entity');
    }
    throw error;
  }

  return data;
}

export async function detachFile(attachmentId: string): Promise<void> {
  const { error } = await supabase
    .from('file_attachments')
    .delete()
    .eq('id', attachmentId);

  if (error) throw error;
}

export async function updateAttachmentNote(
  attachmentId: string,
  note: string | null
): Promise<void> {
  const { error } = await supabase
    .from('file_attachments')
    .update({ note })
    .eq('id', attachmentId);

  if (error) throw error;
}

export async function getAttachmentCount(
  entityType: FileAttachmentEntityType,
  entityId: string
): Promise<number> {
  const { count, error } = await supabase
    .from('file_attachments')
    .select('id', { count: 'exact', head: true })
    .eq('entity_type', entityType)
    .eq('entity_id', entityId);

  if (error) throw error;
  return count || 0;
}

export async function getAttachmentCounts(
  entityType: FileAttachmentEntityType,
  entityIds: string[]
): Promise<Record<string, number>> {
  if (entityIds.length === 0) return {};

  const { data, error } = await supabase
    .from('file_attachments')
    .select('entity_id')
    .eq('entity_type', entityType)
    .in('entity_id', entityIds);

  if (error) throw error;

  const counts: Record<string, number> = {};
  entityIds.forEach((id) => {
    counts[id] = 0;
  });

  (data || []).forEach((row) => {
    counts[row.entity_id] = (counts[row.entity_id] || 0) + 1;
  });

  return counts;
}

export async function getEntitiesByFile(
  driveFileId: string
): Promise<FileAttachment[]> {
  const { data, error } = await supabase
    .from('file_attachments')
    .select('*')
    .eq('drive_file_id', driveFileId)
    .order('attached_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getRecentAttachments(
  organizationId: string,
  limit: number = 10
): Promise<FileAttachmentWithFile[]> {
  const { data, error } = await supabase
    .from('file_attachments')
    .select(`
      *,
      drive_file:drive_files(*),
      attached_by_user:users!file_attachments_attached_by_fkey(id, name, email, avatar_url)
    `)
    .eq('organization_id', organizationId)
    .order('attached_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []) as FileAttachmentWithFile[];
}

export async function getFilesAttachedToEntity(
  entityType: FileAttachmentEntityType,
  entityId: string
): Promise<DriveFile[]> {
  const { data, error } = await supabase
    .from('file_attachments')
    .select('drive_file:drive_files(*)')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId);

  if (error) throw error;
  return (data || []).map((row) => row.drive_file).filter(Boolean) as DriveFile[];
}

export async function isFileAttached(
  driveFileId: string,
  entityType: FileAttachmentEntityType,
  entityId: string
): Promise<boolean> {
  const { count, error } = await supabase
    .from('file_attachments')
    .select('id', { count: 'exact', head: true })
    .eq('drive_file_id', driveFileId)
    .eq('entity_type', entityType)
    .eq('entity_id', entityId);

  if (error) throw error;
  return (count || 0) > 0;
}
