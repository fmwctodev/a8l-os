import { useState, useRef } from 'react';
import { Table, UploadCloud, Loader2, Check, ChevronRight, ArrowLeft } from 'lucide-react';
import type { TableSourceConfig } from '../../../types';

interface TableUploadFormProps {
  existingConfig: Record<string, unknown>;
  onSave: (config: Record<string, unknown>) => void;
  onCancel: () => void;
  saving: boolean;
  isEditing: boolean;
}

export function TableUploadForm({
  existingConfig,
  onSave,
  onCancel,
  saving,
  isEditing,
}: TableUploadFormProps) {
  const config = existingConfig as Partial<TableSourceConfig>;
  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState(config.fileName || '');
  const [columns, setColumns] = useState<string[]>([]);
  const [selectedColumns, setSelectedColumns] = useState<string[]>(
    config.selectedColumns || []
  );
  const [previewData, setPreviewData] = useState<string[][]>([]);
  const [rowCount, setRowCount] = useState(config.rowCount || 0);
  const [parsing, setParsing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile);
    setFileName(selectedFile.name.replace('.csv', ''));
    setParsing(true);

    try {
      const text = await selectedFile.text();
      const lines = text.split('\n').filter((line) => line.trim());
      if (lines.length > 0) {
        const headers = parseCSVLine(lines[0]);
        setColumns(headers);
        setSelectedColumns(headers);

        const preview: string[][] = [];
        for (let i = 1; i < Math.min(lines.length, 11); i++) {
          preview.push(parseCSVLine(lines[i]));
        }
        setPreviewData(preview);
        setRowCount(lines.length - 1);
      }
    } catch (err) {
      console.error('Failed to parse CSV:', err);
    } finally {
      setParsing(false);
    }
  };

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile?.name.endsWith('.csv')) {
      handleFileSelect(droppedFile);
    }
  };

  const toggleColumn = (column: string) => {
    setSelectedColumns((prev) =>
      prev.includes(column) ? prev.filter((c) => c !== column) : [...prev, column]
    );
  };

  const handleSubmit = () => {
    const newConfig: TableSourceConfig = {
      fileName,
      selectedColumns,
      rowCount,
      previewData,
    };
    onSave(newConfig);
  };

  return (
    <div>
      <div className="flex items-center gap-3 p-4 bg-slate-800/50 rounded-lg border border-slate-700 mb-6">
        <Table className="w-6 h-6 text-emerald-400" />
        <div>
          <h3 className="font-medium text-white">Table Upload</h3>
          <p className="text-sm text-slate-400">Upload a CSV file to train your bot with product details or other structured data.</p>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-6">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                step >= s
                  ? 'bg-cyan-600 text-white'
                  : 'bg-slate-700 text-slate-400'
              }`}
            >
              {step > s ? <Check className="w-4 h-4" /> : s}
            </div>
            <span className={`text-sm ${step >= s ? 'text-white' : 'text-slate-500'}`}>
              {s === 1 ? 'Upload File' : s === 2 ? 'Column Selection' : 'Summary'}
            </span>
            {s < 3 && <div className="w-8 h-px bg-slate-700" />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-600 rounded-lg p-8 text-center cursor-pointer hover:border-slate-500 transition-colors"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
              className="hidden"
            />
            {parsing ? (
              <Loader2 className="w-8 h-8 text-slate-400 mx-auto animate-spin" />
            ) : (
              <UploadCloud className="w-8 h-8 text-slate-400 mx-auto mb-3" />
            )}
            {file ? (
              <div>
                <p className="text-white font-medium">{file.name}</p>
                <p className="text-sm text-slate-400 mt-1">{rowCount} rows detected</p>
              </div>
            ) : (
              <div>
                <p className="text-cyan-400 font-medium">Click to upload</p>
                <p className="text-sm text-slate-400 mt-1">or drag and drop</p>
                <p className="text-xs text-slate-500 mt-2">CSV file only (max 50 MB)</p>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Name *</label>
            <input
              type="text"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              placeholder="Enter a name for your table source"
            />
          </div>

          <div className="flex justify-end gap-3">
            <button onClick={onCancel} className="px-4 py-2 text-slate-300 hover:text-white">
              Cancel
            </button>
            <button
              onClick={() => setStep(2)}
              disabled={!file || !fileName.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    {columns.map((col, idx) => (
                      <th key={idx} className="px-4 py-3 text-left">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedColumns.includes(col)}
                            onChange={() => toggleColumn(col)}
                            className="rounded border-slate-600 text-cyan-500 focus:ring-cyan-500"
                          />
                          <span className="text-slate-300 font-medium">{col}</span>
                        </label>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewData.slice(0, 5).map((row, rowIdx) => (
                    <tr key={rowIdx} className="border-b border-slate-700/50">
                      {row.map((cell, cellIdx) => (
                        <td key={cellIdx} className="px-4 py-2 text-slate-400 truncate max-w-xs">
                          {cell || '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {previewData.length > 5 && (
              <div className="px-4 py-2 text-xs text-slate-500 border-t border-slate-700">
                Showing 5 of {rowCount} rows
              </div>
            )}
          </div>

          <div className="flex justify-between">
            <button
              onClick={() => setStep(1)}
              className="flex items-center gap-2 px-4 py-2 text-slate-300 hover:text-white"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={selectedColumns.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 space-y-3">
            <div className="flex justify-between">
              <span className="text-slate-400">Source Name</span>
              <span className="text-white font-medium">{fileName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">File</span>
              <span className="text-white">{file?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Total Rows</span>
              <span className="text-white">{rowCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Selected Columns</span>
              <span className="text-white">{selectedColumns.length} of {columns.length}</span>
            </div>
            <div className="pt-2 border-t border-slate-700">
              <span className="text-sm text-slate-400">Columns:</span>
              <div className="flex flex-wrap gap-2 mt-2">
                {selectedColumns.map((col) => (
                  <span
                    key={col}
                    className="px-2 py-1 bg-slate-700 rounded text-sm text-white"
                  >
                    {col}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-between">
            <button
              onClick={() => setStep(2)}
              className="flex items-center gap-2 px-4 py-2 text-slate-300 hover:text-white"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {isEditing ? 'Save Changes' : 'Create'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
