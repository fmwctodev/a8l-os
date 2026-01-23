import { supabase } from '../lib/supabase';
import type { ReportExport } from '../types';

export async function createExportJob(
  organizationId: string,
  reportRunId: string
): Promise<ReportExport> {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 14);

  const { data, error } = await supabase
    .from('report_exports')
    .insert({
      organization_id: organizationId,
      report_run_id: reportRunId,
      status: 'queued',
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating export job:', error);
    throw new Error('Failed to create export job');
  }

  return data;
}

export async function getExportById(exportId: string): Promise<ReportExport | null> {
  const { data, error } = await supabase
    .from('report_exports')
    .select(`
      *,
      report_run:report_runs(
        *,
        report:reports(*)
      )
    `)
    .eq('id', exportId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching export:', error);
    throw new Error('Failed to fetch export');
  }

  return data;
}

export async function getExportsByRunId(reportRunId: string): Promise<ReportExport[]> {
  const { data, error } = await supabase
    .from('report_exports')
    .select('*')
    .eq('report_run_id', reportRunId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching exports:', error);
    throw new Error('Failed to fetch exports');
  }

  return data || [];
}

export async function updateExportStatus(
  exportId: string,
  data: {
    status?: 'queued' | 'running' | 'complete' | 'failed';
    file_path?: string;
    file_size?: number;
    error?: string;
    completed_at?: string;
  }
): Promise<void> {
  const { error } = await supabase
    .from('report_exports')
    .update(data)
    .eq('id', exportId);

  if (error) {
    console.error('Error updating export:', error);
    throw new Error('Failed to update export');
  }
}

export async function getDownloadUrl(exportId: string): Promise<string | null> {
  const exportRecord = await getExportById(exportId);

  if (!exportRecord || exportRecord.status !== 'complete' || !exportRecord.file_path) {
    return null;
  }

  if (new Date(exportRecord.expires_at) < new Date()) {
    return null;
  }

  const { data, error } = await supabase.storage
    .from('report-exports')
    .createSignedUrl(exportRecord.file_path, 3600);

  if (error) {
    console.error('Error creating signed URL:', error);
    throw new Error('Failed to generate download URL');
  }

  return data.signedUrl;
}

export async function getRecentExports(
  organizationId: string,
  limit: number = 20
): Promise<ReportExport[]> {
  const { data, error } = await supabase
    .from('report_exports')
    .select(`
      *,
      report_run:report_runs(
        id,
        report:reports(id, name)
      )
    `)
    .eq('organization_id', organizationId)
    .eq('status', 'complete')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching recent exports:', error);
    throw new Error('Failed to fetch recent exports');
  }

  return data || [];
}

export async function pollExportStatus(
  exportId: string,
  onUpdate: (status: ReportExport) => void,
  maxAttempts: number = 60,
  intervalMs: number = 2000
): Promise<ReportExport> {
  let attempts = 0;

  return new Promise((resolve, reject) => {
    const poll = async () => {
      try {
        const exportRecord = await getExportById(exportId);

        if (!exportRecord) {
          reject(new Error('Export not found'));
          return;
        }

        onUpdate(exportRecord);

        if (exportRecord.status === 'complete' || exportRecord.status === 'failed') {
          resolve(exportRecord);
          return;
        }

        attempts++;
        if (attempts >= maxAttempts) {
          reject(new Error('Export polling timeout'));
          return;
        }

        setTimeout(poll, intervalMs);
      } catch (err) {
        reject(err);
      }
    };

    poll();
  });
}
