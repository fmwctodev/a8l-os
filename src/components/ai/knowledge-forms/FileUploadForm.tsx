import { useState, useRef } from 'react';
import { Upload, UploadCloud, FileText, Trash2 } from 'lucide-react';
import { FormFooter } from './FormFooter';
import type { FileUploadSourceConfig } from '../../../types';

interface FileUploadFormProps {
  existingConfig: Record<string, unknown>;
  onSave: (config: Record<string, unknown>) => void;
  onCancel: () => void;
  saving: boolean;
  isEditing: boolean;
}

export function FileUploadForm({
  existingConfig,
  onSave,
  onCancel,
  saving,
  isEditing,
}: FileUploadFormProps) {
  const config = existingConfig as Partial<FileUploadSourceConfig>;
  const [files, setFiles] = useState<Array<{ file: File; name: string; size: number }>>(
    []
  );
  const [existingFiles] = useState(config.files || []);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (selectedFiles: FileList | null) => {
    if (!selectedFiles) return;

    const validFiles = Array.from(selectedFiles).filter((file) =>
      ['.pdf', '.doc', '.docx'].some((ext) => file.name.toLowerCase().endsWith(ext))
    );

    const newFiles = validFiles.map((file) => ({
      file,
      name: file.name,
      size: file.size,
    }));

    setFiles((prev) => [...prev, ...newFiles]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleFileSelect(e.dataTransfer.files);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleSubmit = () => {
    const newConfig: FileUploadSourceConfig = {
      files: [
        ...existingFiles,
        ...files.map((f) => ({
          name: f.name,
          size: f.size,
        })),
      ],
    };
    onSave(newConfig);
  };

  const hasFiles = files.length > 0 || existingFiles.length > 0;

  return (
    <div>
      <div className="flex items-center gap-3 p-4 bg-slate-800/50 rounded-lg border border-slate-700 mb-6">
        <Upload className="w-6 h-6 text-rose-400" />
        <div>
          <h3 className="font-medium text-white">Upload Files</h3>
          <p className="text-sm text-slate-400">Upload files to your knowledge base to train your AI assistant.</p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Select Files</label>
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-cyan-500/50 rounded-lg p-8 text-center cursor-pointer hover:border-cyan-500 bg-cyan-500/5 transition-colors"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx"
              multiple
              onChange={(e) => handleFileSelect(e.target.files)}
              className="hidden"
            />
            <UploadCloud className="w-8 h-8 text-slate-400 mx-auto mb-3" />
            <p className="text-slate-300">
              Drop files here or <span className="text-cyan-400">browse</span>
            </p>
            <p className="text-sm text-slate-500 mt-1">Supports PDF, DOC, DOCX</p>
          </div>
        </div>

        {(files.length > 0 || existingFiles.length > 0) && (
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
            {files.map((file, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-slate-400" />
                  <div>
                    <p className="text-white text-sm">{file.name}</p>
                    <p className="text-xs text-slate-500">{formatFileSize(file.size)}</p>
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
        disabled={!hasFiles}
        submitLabel="Upload Files"
      />
    </div>
  );
}
