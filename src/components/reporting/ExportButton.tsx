import { useState } from 'react';
import { Download, Loader2, Check, AlertCircle } from 'lucide-react';
import { createReportRun, updateReportRun } from '../../services/reports';
import { createExportJob, pollExportStatus, getDownloadUrl } from '../../services/reportExports';
import type { Report, ReportExport } from '../../types';

interface ExportButtonProps {
  report: Report;
  onExportComplete?: (exportRecord: ReportExport) => void;
  disabled?: boolean;
}

type ExportState = 'idle' | 'queued' | 'running' | 'complete' | 'failed';

export function ExportButton({ report, onExportComplete, disabled }: ExportButtonProps) {
  const [state, setState] = useState<ExportState>('idle');
  const [progress, setProgress] = useState<string>('');
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    try {
      setState('queued');
      setProgress('Creating export...');
      setError(null);

      const run = await createReportRun(report.organization_id, report.id, 'user');

      setProgress('Queuing export job...');
      const exportJob = await createExportJob(report.organization_id, run.id);

      setState('running');
      setProgress('Generating CSV...');

      const finalExport = await pollExportStatus(
        exportJob.id,
        (status) => {
          if (status.status === 'running') {
            setProgress('Processing data...');
          }
        },
        120,
        2000
      );

      if (finalExport.status === 'complete') {
        setState('complete');
        setProgress('Export ready!');

        const url = await getDownloadUrl(finalExport.id);
        setDownloadUrl(url);

        await updateReportRun(run.id, {
          status: 'success',
          finished_at: new Date().toISOString(),
        });

        if (onExportComplete) {
          onExportComplete(finalExport);
        }

        if (url) {
          window.open(url, '_blank');
        }
      } else {
        throw new Error(finalExport.error || 'Export failed');
      }
    } catch (err) {
      setState('failed');
      setError(err instanceof Error ? err.message : 'Export failed');
      setProgress('');
    }
  };

  const handleReset = () => {
    setState('idle');
    setProgress('');
    setDownloadUrl(null);
    setError(null);
  };

  if (state === 'complete') {
    return (
      <div className="flex items-center gap-2">
        {downloadUrl && (
          <a
            href={downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors text-sm font-medium"
          >
            <Download className="w-4 h-4" />
            Download CSV
          </a>
        )}
        <button
          onClick={handleReset}
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          Export again
        </button>
      </div>
    );
  }

  if (state === 'failed') {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 text-red-600 text-sm">
          <AlertCircle className="w-4 h-4" />
          {error || 'Export failed'}
        </div>
        <button
          onClick={handleReset}
          className="text-sm text-sky-600 hover:text-sky-700"
        >
          Try again
        </button>
      </div>
    );
  }

  const isExporting = state === 'queued' || state === 'running';

  return (
    <button
      onClick={handleExport}
      disabled={disabled || isExporting}
      className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isExporting ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          {progress || 'Exporting...'}
        </>
      ) : (
        <>
          <Download className="w-4 h-4" />
          Export CSV
        </>
      )}
    </button>
  );
}

interface QuickExportButtonProps {
  organizationId: string;
  reportId: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

export function QuickExportButton({
  organizationId,
  reportId,
  disabled,
  size = 'md',
}: QuickExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    try {
      setIsExporting(true);

      const run = await createReportRun(organizationId, reportId, 'user');
      const exportJob = await createExportJob(organizationId, run.id);

      const finalExport = await pollExportStatus(exportJob.id, () => {}, 120, 2000);

      if (finalExport.status === 'complete') {
        const url = await getDownloadUrl(finalExport.id);
        if (url) {
          window.open(url, '_blank');
        }
      }
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const sizeClasses = size === 'sm' ? 'p-1.5' : 'p-2';

  return (
    <button
      onClick={handleExport}
      disabled={disabled || isExporting}
      title="Export to CSV"
      className={`${sizeClasses} text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      {isExporting ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Download className="w-4 h-4" />
      )}
    </button>
  );
}
