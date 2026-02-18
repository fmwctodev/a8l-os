import { useState, useRef } from 'react';
import { Upload, UploadCloud, FileText, Trash2, Loader2, AlertCircle } from 'lucide-react';
import { FormFooter } from './FormFooter';
import { parseFile, formatFileSize, ACCEPTED_TYPES, MAX_FILE_SIZE } from '../../../utils/fileParser';
import type { FileUploadSourceConfig } from '../../../types';

interface FileUploadFormProps {
  existingConfig: Record<string, unknown>;
  onSave: (config: Record<string, unknown>) => void;
  onCancel: () => void;
  saving: boolean;
  isEditing: boolean;
}

interface ParsedFileEntry {
  name: string;
  size: number;
  contentPreview: string;
}

export function FileUploadForm({
  existingConfig,
  onSave,
  onCancel,
  saving,
  isEditing,
}: FileUploadFormProps) {
  const config = existingConfig as Partial<FileUploadSourceConfig>;
  const [parsedFiles, setParsedFiles] = useState<ParsedFileEntry[]>(
    (config.files || []).filter((f) => f.contentPreview) as ParsedFileEntry[]
  );
  const [existingFiles] = useState(
    (config.files || []).filter((f) => !f.contentPreview)
  );
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (selectedFiles: FileList | null) => {
    if (!selectedFiles) return;

    const validFiles = Array.from(selectedFiles).filter((file) => {
      const ext = file.name.split('.').pop()?.toLowerCase();
      return ['pdf', 'doc', 'docx', 'txt'].includes(ext || '');
    });

    if (validFiles.length === 0) return;

    setParsing(true);
    setError(null);

    try {
      const newParsed: ParsedFileEntry[] = [];
      for (const file of validFiles) {
        if (file.size > MAX_FILE_SIZE) {
          setError(`${file.name} exceeds 10 MB limit`);
          continue;
        }
        const result = await parseFile(file);
        if (result.text) {
          newParsed.push({
            name: result.name,
            size: result.size,
            contentPreview: result.text,
          });
        } else {
          setError(`Could not extract text from ${file.name}`);
        }
      }
      setParsedFiles((prev) => [...prev, ...newParsed]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse file');
    } finally {
      setParsing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleFileSelect(e.dataTransfer.files);
  };

  const removeFile = (index: number) => {
    setParsedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    const newConfig: FileUploadSourceConfig = {
      files: [
        ...existingFiles,
        ...parsedFiles.map((f) => ({
          name: f.name,
          size: f.size,
          contentPreview: f.contentPreview,
        })),
      ],
    };
    onSave(newConfig);
  };

  const hasFiles = parsedFiles.length > 0 || existingFiles.length > 0;

  return (
    <div>
      <div className="flex items-center gap-3 p-4 bg-slate-800/50 rounded-lg border border-slate-700 mb-6">
        <Upload className="w-6 h-6 text-rose-400" />
        <div>
          <h3 className="font-medium text-white">Upload Files</h3>
          <p className="text-sm text-slate-400">Upload files to your knowledge base to train your AI assistant.</p>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Select Files</label>
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => !parsing && fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              parsing
                ? 'border-slate-600 cursor-wait'
                : 'border-cyan-500/50 cursor-pointer hover:border-cyan-500 bg-cyan-500/5'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_TYPES}
              multiple
              onChange={(e) => handleFileSelect(e.target.files)}
              className="hidden"
            />
            {parsing ? (
              <div>
                <Loader2 className="w-8 h-8 text-cyan-400 mx-auto mb-3 animate-spin" />
                <p className="text-slate-300">Extracting text from files...</p>
              </div>
            ) : (
              <>
                <UploadCloud className="w-8 h-8 text-slate-400 mx-auto mb-3" />
                <p className="text-slate-300">
                  Drop files here or <span className="text-cyan-400">browse</span>
                </p>
                <p className="text-sm text-slate-500 mt-1">Supports PDF, DOC, DOCX, TXT (max 10 MB)</p>
              </>
            )}
          </div>
        </div>

        {(parsedFiles.length > 0 || existingFiles.length > 0) && (
          <div className="space-y-2">
            {existingFiles.map((file, idx) => (
              <div
                key={`existing-${idx}`}
                className="flex items-center justify-between px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-slate-400" />
                  <div>
                    <p className="text-white text-sm">{file.name}</p>
                    <p className="text-xs text-slate-500">{formatFileSize(file.size)}</p>
                  </div>
                </div>
                <span className="text-xs text-slate-500">Existing</span>
              </div>
            ))}
            {parsedFiles.map((file, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-emerald-400" />
                  <div>
                    <p className="text-white text-sm">{file.name}</p>
                    <p className="text-xs text-slate-500">
                      {formatFileSize(file.size)} — {file.contentPreview.length.toLocaleString()} chars extracted
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => removeFile(idx)}
                  className="p-1 text-slate-400 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <FormFooter
        onCancel={onCancel}
        onSubmit={handleSubmit}
        saving={saving}
        isEditing={isEditing}
        disabled={!hasFiles || parsing}
        submitLabel="Upload Files"
      />
    </div>
  );
}
