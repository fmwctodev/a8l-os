import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle, AlertCircle, Loader2, Upload, X, FileText } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Form, FormField } from '../../types';

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  url?: string;
  status: 'uploading' | 'uploaded' | 'error';
  progress: number;
}

export function PublicFormPage() {
  const { slug } = useParams<{ slug: string }>();
  const [form, setForm] = useState<Form | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, string | string[] | boolean>>({});
  const [fileData, setFileData] = useState<Record<string, UploadedFile[]>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    if (slug) loadForm();
  }, [slug]);

  async function loadForm() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('forms')
        .select('*')
        .eq('public_slug', slug)
        .eq('status', 'published')
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        setError('Form not found or no longer available');
        return;
      }

      setForm(data);
    } catch (err) {
      console.error('Failed to load form:', err);
      setError('Failed to load form');
    } finally {
      setLoading(false);
    }
  }

  function shouldShowField(field: FormField): boolean {
    if (!field.conditionalRules || field.conditionalRules.length === 0) {
      return true;
    }

    return field.conditionalRules.every(rule => {
      const fieldValue = formData[rule.fieldId];
      switch (rule.operator) {
        case 'equals':
          return String(fieldValue) === rule.value;
        case 'not_equals':
          return String(fieldValue) !== rule.value;
        case 'contains':
          return String(fieldValue || '').includes(rule.value);
        case 'is_empty':
          return fieldValue === undefined || fieldValue === '' || (Array.isArray(fieldValue) && fieldValue.length === 0);
        case 'is_not_empty':
          return fieldValue !== undefined && fieldValue !== '' && !(Array.isArray(fieldValue) && fieldValue.length === 0);
        default:
          return true;
      }
    });
  }

  function validateForm(): boolean {
    const errors: Record<string, string> = {};

    if (!form) return false;

    for (const field of form.definition.fields) {
      if (!shouldShowField(field)) continue;

      if (field.required && field.type !== 'hidden' && field.type !== 'divider') {
        if (field.type === 'file_upload') {
          const files = fileData[field.id] || [];
          if (files.length === 0) {
            errors[field.id] = `${field.label} is required`;
          }
        } else {
          const value = formData[field.id];
          if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) {
            errors[field.id] = `${field.label} is required`;
          }
        }
      }

      if (field.type === 'email' && formData[field.id]) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(String(formData[field.id]))) {
          errors[field.id] = 'Please enter a valid email address';
        }
      }

      if (field.validationRules) {
        const value = String(formData[field.id] || '');
        for (const rule of field.validationRules) {
          if (rule.type === 'minLength' && value.length < (rule.value as number)) {
            errors[field.id] = rule.message || `Minimum ${rule.value} characters required`;
          }
          if (rule.type === 'maxLength' && value.length > (rule.value as number)) {
            errors[field.id] = rule.message || `Maximum ${rule.value} characters allowed`;
          }
          if (rule.type === 'pattern' && !new RegExp(rule.value as string).test(value)) {
            errors[field.id] = rule.message || 'Invalid format';
          }
        }
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleFileUpload(fieldId: string, files: FileList) {
    const field = form?.definition.fields.find(f => f.id === fieldId);
    if (!field?.fileUploadConfig) return;

    const maxFiles = field.fileUploadConfig.maxFiles || 1;
    const maxSize = field.fileUploadConfig.maxSizeBytes || 10 * 1024 * 1024;
    const allowedTypes = field.fileUploadConfig.allowedTypes || [];

    const currentFiles = fileData[fieldId] || [];
    const newFiles: UploadedFile[] = [];

    for (const file of Array.from(files)) {
      if (currentFiles.length + newFiles.length >= maxFiles) {
        alert(`Maximum ${maxFiles} file(s) allowed`);
        break;
      }

      if (file.size > maxSize) {
        alert(`File "${file.name}" exceeds the ${Math.round(maxSize / 1024 / 1024)}MB limit`);
        continue;
      }

      if (allowedTypes.length > 0 && !allowedTypes.some(t => file.type.includes(t) || file.name.endsWith(t))) {
        alert(`File type not allowed: ${file.name}`);
        continue;
      }

      const uploadFile: UploadedFile = {
        id: crypto.randomUUID(),
        name: file.name,
        size: file.size,
        type: file.type,
        status: 'uploading',
        progress: 0,
      };

      newFiles.push(uploadFile);

      simulateFileUpload(fieldId, uploadFile.id);
    }

    setFileData(prev => ({
      ...prev,
      [fieldId]: [...currentFiles, ...newFiles],
    }));
  }

  function simulateFileUpload(fieldId: string, fileId: string) {
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 30;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        setFileData(prev => ({
          ...prev,
          [fieldId]: prev[fieldId].map(f =>
            f.id === fileId ? { ...f, status: 'uploaded' as const, progress: 100 } : f
          ),
        }));
      } else {
        setFileData(prev => ({
          ...prev,
          [fieldId]: prev[fieldId].map(f =>
            f.id === fileId ? { ...f, progress: Math.min(progress, 100) } : f
          ),
        }));
      }
    }, 200);
  }

  function removeFile(fieldId: string, fileId: string) {
    setFileData(prev => ({
      ...prev,
      [fieldId]: prev[fieldId].filter(f => f.id !== fileId),
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!form || !validateForm()) return;

    try {
      setSubmitting(true);

      const submissionData: Record<string, unknown> = {};
      for (const field of form.definition.fields) {
        if (!shouldShowField(field)) continue;

        if (field.type === 'file_upload') {
          const files = fileData[field.id] || [];
          submissionData[field.id] = files.map(f => ({
            name: f.name,
            size: f.size,
            type: f.type,
            url: f.url,
          }));
        } else {
          submissionData[field.id] = formData[field.id] ?? null;
        }
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/form-submit`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            formId: form.id,
            data: submissionData,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Submission failed');
      }

      setSubmitted(true);

      if (form.settings.redirectUrl) {
        setTimeout(() => {
          window.location.href = form.settings.redirectUrl!;
        }, 2000);
      }
    } catch (err) {
      console.error('Submission error:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit form');
    } finally {
      setSubmitting(false);
    }
  }

  function updateField(fieldId: string, value: string | string[] | boolean) {
    setFormData((prev) => ({ ...prev, [fieldId]: value }));
    if (validationErrors[fieldId]) {
      setValidationErrors((prev) => {
        const next = { ...prev };
        delete next[fieldId];
        return next;
      });
    }
  }

  function renderField(field: FormField) {
    const hasError = !!validationErrors[field.id];

    switch (field.type) {
      case 'hidden':
        return (
          <input
            type="hidden"
            value={String(formData[field.id] || field.defaultValue || '')}
          />
        );

      case 'divider':
        return (
          <div className="py-4">
            <hr className="border-gray-200" />
            {field.label && (
              <p className="text-sm text-gray-500 mt-2">{field.label}</p>
            )}
          </div>
        );

      case 'textarea':
        return (
          <div className="relative">
            <textarea
              value={String(formData[field.id] || '')}
              onChange={(e) => updateField(field.id, e.target.value)}
              placeholder={field.placeholder}
              rows={4}
              maxLength={field.characterLimit}
              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                hasError
                  ? 'border-red-300 focus:ring-red-500'
                  : 'border-gray-300 focus:ring-blue-500'
              }`}
            />
            {field.characterLimit && (
              <div className="absolute bottom-2 right-2 text-xs text-gray-400">
                {String(formData[field.id] || '').length}/{field.characterLimit}
              </div>
            )}
          </div>
        );

      case 'dropdown':
        return (
          <select
            value={String(formData[field.id] || '')}
            onChange={(e) => updateField(field.id, e.target.value)}
            className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
              hasError
                ? 'border-red-300 focus:ring-red-500'
                : 'border-gray-300 focus:ring-blue-500'
            }`}
          >
            <option value="">{field.placeholder || 'Select an option'}</option>
            {(field.options || []).map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        );

      case 'radio':
        return (
          <div className="space-y-2">
            {(field.options || []).map((opt) => (
              <label
                key={opt.value}
                className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                  formData[field.id] === opt.value
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name={field.id}
                  checked={formData[field.id] === opt.value}
                  onChange={() => updateField(field.id, opt.value)}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span className="text-gray-700">{opt.label}</span>
              </label>
            ))}
          </div>
        );

      case 'multi_select':
        return (
          <div className="space-y-2">
            {(field.options || []).map((opt) => (
              <label key={opt.value} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={((formData[field.id] as string[]) || []).includes(opt.value)}
                  onChange={(e) => {
                    const current = (formData[field.id] as string[]) || [];
                    const newValue = e.target.checked
                      ? [...current, opt.value]
                      : current.filter((v) => v !== opt.value);
                    updateField(field.id, newValue);
                  }}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-gray-700">{opt.label}</span>
              </label>
            ))}
          </div>
        );

      case 'checkbox':
      case 'consent':
        return (
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={Boolean(formData[field.id])}
              onChange={(e) => updateField(field.id, e.target.checked)}
              className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-gray-700">{field.label}</span>
          </label>
        );

      case 'file_upload':
        const files = fileData[field.id] || [];
        const config = field.fileUploadConfig || { maxSizeBytes: 10 * 1024 * 1024, allowedTypes: [], maxFiles: 1 };
        return (
          <div>
            <input
              ref={(el) => { fileInputRefs.current[field.id] = el; }}
              type="file"
              multiple={config.maxFiles > 1}
              accept={config.allowedTypes.join(',')}
              onChange={(e) => e.target.files && handleFileUpload(field.id, e.target.files)}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRefs.current[field.id]?.click()}
              className={`w-full p-6 border-2 border-dashed rounded-lg text-center transition-colors ${
                hasError
                  ? 'border-red-300 bg-red-50'
                  : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
              }`}
            >
              <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-600">
                Click to upload or drag and drop
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Max {Math.round(config.maxSizeBytes / 1024 / 1024)}MB
                {config.maxFiles > 1 && ` - Up to ${config.maxFiles} files`}
              </p>
            </button>
            {files.length > 0 && (
              <div className="mt-3 space-y-2">
                {files.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                  >
                    <FileText className="w-5 h-5 text-gray-400" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700 truncate">{file.name}</p>
                      {file.status === 'uploading' && (
                        <div className="mt-1 h-1 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 transition-all"
                            style={{ width: `${file.progress}%` }}
                          />
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(field.id, file.id)}
                      className="p-1 text-gray-400 hover:text-red-500"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      default:
        return (
          <input
            type={
              field.type === 'email'
                ? 'email'
                : field.type === 'phone'
                ? 'tel'
                : field.type === 'number'
                ? 'number'
                : field.type === 'date'
                ? 'date'
                : 'text'
            }
            value={String(formData[field.id] || '')}
            onChange={(e) => updateField(field.id, e.target.value)}
            placeholder={field.placeholder}
            className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
              hasError
                ? 'border-red-300 focus:ring-red-500'
                : 'border-gray-300 focus:ring-blue-500'
            }`}
          />
        );
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error && !form) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Form Not Available</h1>
          <p className="text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Thank You!</h1>
          <p className="text-gray-500">
            {form?.settings.thankYouMessage || 'Your response has been submitted successfully.'}
          </p>
          {form?.settings.redirectUrl && (
            <p className="text-sm text-gray-400 mt-4">Redirecting...</p>
          )}
        </div>
      </div>
    );
  }

  if (!form) return null;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">{form.name}</h1>
          {form.description && (
            <p className="text-gray-500 mb-6">{form.description}</p>
          )}

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
              <div className="text-sm text-red-600">{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {form.settings.honeypotEnabled && (
              <input
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                style={{ position: 'absolute', left: '-9999px' }}
              />
            )}

            {form.definition.fields.map((field) => {
              if (!shouldShowField(field)) return null;

              return (
                <div
                  key={field.id}
                  className={field.width === 'half' ? 'inline-block w-1/2 pr-2 align-top' : ''}
                >
                  {field.type !== 'hidden' && field.type !== 'checkbox' && field.type !== 'consent' && field.type !== 'divider' && (
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {field.label}
                      {field.required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                  )}
                  {field.helpText && field.type !== 'divider' && (
                    <p className="text-sm text-gray-500 mb-2">{field.helpText}</p>
                  )}
                  {renderField(field)}
                  {validationErrors[field.id] && (
                    <p className="mt-1 text-sm text-red-500">{validationErrors[field.id]}</p>
                  )}
                </div>
              );
            })}

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
