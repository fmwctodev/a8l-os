import { useState, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { parseCSVToContacts, importContacts } from '../../services/contacts';
import type { Department } from '../../types';
import { X, Loader2, Upload, FileText, AlertCircle, CheckCircle } from 'lucide-react';

interface ImportContactsModalProps {
  departments: Department[];
  onClose: () => void;
  onSuccess: () => void;
}

export function ImportContactsModal({
  departments,
  onClose,
  onSuccess,
}: ImportContactsModalProps) {
  const { user: currentUser, isSuperAdmin } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [departmentId, setDepartmentId] = useState(
    currentUser?.department_id || departments[0]?.id || ''
  );
  const [csvContent, setCsvContent] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [previewCount, setPreviewCount] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; errors: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = isSuperAdmin || currentUser?.role?.hierarchy_level === 2;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      setError('Please select a CSV file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setCsvContent(content);
      setFileName(file.name);
      setError(null);

      const contacts = parseCSVToContacts(content, departmentId);
      setPreviewCount(contacts.length);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!csvContent || !currentUser || !departmentId) return;

    try {
      setIsImporting(true);
      setError(null);

      const contacts = parseCSVToContacts(csvContent, departmentId);
      const importResult = await importContacts(currentUser.organization_id, contacts, currentUser);

      setResult(importResult);

      if (importResult.errors.length === 0) {
        setTimeout(() => {
          onSuccess();
        }, 1500);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import contacts');
    } finally {
      setIsImporting(false);
    }
  };

  const downloadTemplate = () => {
    const template =
      'First Name,Last Name,Email,Phone,Company,Job Title,Address Line 1,Address Line 2,City,State,Postal Code,Country,Source\nJohn,Doe,john@example.com,555-1234,Acme Inc,CEO,123 Main St,,New York,NY,10001,USA,referral';
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'contacts-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-slate-900 rounded-xl border border-slate-800 shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <h2 className="text-lg font-semibold text-white">Import Contacts</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              {error}
            </div>
          )}

          {result ? (
            <div className="text-center py-6">
              {result.errors.length === 0 ? (
                <>
                  <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
                  <p className="text-white font-medium mb-1">Import Complete</p>
                  <p className="text-slate-400">
                    Successfully imported {result.imported} contacts
                  </p>
                </>
              ) : (
                <>
                  <AlertCircle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
                  <p className="text-white font-medium mb-1">Import Completed with Errors</p>
                  <p className="text-slate-400 mb-4">
                    Imported {result.imported} contacts, {result.errors.length} failed
                  </p>
                  <div className="text-left max-h-40 overflow-y-auto bg-slate-800 rounded-lg p-3">
                    {result.errors.map((err, i) => (
                      <p key={i} className="text-sm text-red-400">
                        {err}
                      </p>
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : (
            <>
              {isAdmin && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Import to Department
                  </label>
                  <select
                    value={departmentId}
                    onChange={(e) => setDepartmentId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  >
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  CSV File
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-700 rounded-lg p-6 text-center cursor-pointer hover:border-slate-600 transition-colors"
                >
                  {csvContent ? (
                    <div className="flex items-center justify-center gap-3">
                      <FileText className="w-8 h-8 text-cyan-400" />
                      <div className="text-left">
                        <p className="text-white font-medium">{fileName}</p>
                        <p className="text-sm text-slate-400">{previewCount} contacts found</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                      <p className="text-slate-400 mb-1">
                        Click to upload or drag and drop
                      </p>
                      <p className="text-sm text-slate-500">CSV files only</p>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <button
                  onClick={downloadTemplate}
                  className="text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  Download CSV template
                </button>
              </div>

              <div className="bg-slate-800/50 rounded-lg p-3 text-sm text-slate-400">
                <p className="font-medium text-slate-300 mb-1">Expected columns:</p>
                <p>
                  First Name, Last Name, Email, Phone, Company, Job Title, Address Line 1,
                  Address Line 2, City, State, Postal Code, Country, Source
                </p>
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-3 p-4 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
          >
            {result ? 'Close' : 'Cancel'}
          </button>
          {!result && (
            <button
              onClick={handleImport}
              disabled={!csvContent || isImporting || !departmentId}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-600 text-white font-medium hover:from-cyan-600 hover:to-teal-700 transition-colors disabled:opacity-50"
            >
              {isImporting && <Loader2 className="w-4 h-4 animate-spin" />}
              Import {previewCount > 0 && `(${previewCount})`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
