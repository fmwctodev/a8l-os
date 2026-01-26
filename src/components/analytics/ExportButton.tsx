import { useState } from 'react';
import { FileDown, Loader2 } from 'lucide-react';

interface ExportButtonProps {
  onExport: () => Promise<void>;
  label?: string;
  disabled?: boolean;
}

export function ExportButton({ onExport, label = 'Export PDF', disabled = false }: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleClick = async () => {
    if (isExporting || disabled) return;

    setIsExporting(true);
    try {
      await onExport();
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isExporting || disabled}
      className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:border-gray-400 dark:hover:border-gray-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isExporting ? (
        <Loader2 className="w-4 h-4 text-gray-500 animate-spin" />
      ) : (
        <FileDown className="w-4 h-4 text-gray-500" />
      )}
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {isExporting ? 'Exporting...' : label}
      </span>
    </button>
  );
}
