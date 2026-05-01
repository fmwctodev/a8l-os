import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { CheckCircle, AlertCircle, Loader2, Upload, X, FileText, Plus, CreditCard } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Form, FormField } from '../../types';
import {
  US_STATES,
  COUNTRIES,
  COMMON_TIMEZONES,
  currencySymbol,
} from '../../constants/formFieldOptions';

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  url?: string;
  status: 'uploading' | 'uploaded' | 'error';
  progress: number;
}

type FormFieldValue =
  | string
  | string[]
  | boolean
  | number
  | Record<string, string>
  | undefined;

export function PublicFormPage() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState<Form | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, FormFieldValue>>({});
  const [fileData, setFileData] = useState<Record<string, UploadedFile[]>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const embed = useMemo(() => {
    const v = searchParams.get('embed');
    return v === '1' || v === 'true';
  }, [searchParams]);

  useEffect(() => {
    if (slug) loadForm();
  }, [slug]);

  useEffect(() => {
    if (!embed) return;
    if (typeof window === 'undefined' || window.parent === window) return;
    const post = () => {
      const height = Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight
      );
      window.parent.postMessage({ type: 'forms-widget:height', height }, '*');
      window.parent.postMessage({ type: 'autom8ion:resize', height }, '*');
    };
    post();
    const observer = new ResizeObserver(post);
    observer.observe(document.body);
    window.addEventListener('load', post);
    return () => {
      observer.disconnect();
      window.removeEventListener('load', post);
    };
  }, [embed, loading, submitted, error]);

  useEffect(() => {
    if (!embed || !submitted) return;
    if (typeof window === 'undefined' || window.parent === window) return;
    const payload = { formId: form?.id, slug: form?.public_slug };
    window.parent.postMessage({ type: 'forms-widget:submitted', payload }, '*');
    window.parent.postMessage({ type: 'autom8ion:form:submit', payload }, '*');
  }, [embed, submitted, form?.id, form?.public_slug]);

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

  function updateField(fieldId: string, value: FormFieldValue) {
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
            <hr className="border-slate-700" />
            {field.label && (
              <p className="text-sm text-slate-400 mt-2">{field.label}</p>
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
              className={`w-full px-4 py-3 bg-slate-800 text-white placeholder-slate-500 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                hasError
                  ? 'border-red-500/40 focus:ring-red-500'
                  : 'border-slate-700 focus:ring-cyan-500'
              }`}
            />
            {field.characterLimit && (
              <div className="absolute bottom-2 right-2 text-xs text-slate-500">
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
            className={`w-full px-4 py-3 bg-slate-800 text-white placeholder-slate-500 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
              hasError
                ? 'border-red-500/40 focus:ring-red-500'
                : 'border-slate-700 focus:ring-cyan-500'
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
                    ? 'border-cyan-500 bg-cyan-500/20'
                    : 'border-slate-700 hover:border-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name={field.id}
                  checked={formData[field.id] === opt.value}
                  onChange={() => updateField(field.id, opt.value)}
                  className="text-cyan-400 focus:ring-cyan-500"
                />
                <span className="text-slate-300">{opt.label}</span>
              </label>
            ))}
          </div>
        );

      case 'multi_select':
      case 'checkbox_group':
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
                  className="rounded border-slate-700 text-cyan-400 focus:ring-cyan-500"
                />
                <span className="text-slate-300">{opt.label}</span>
              </label>
            ))}
          </div>
        );

      case 'multi_dropdown':
        return (
          <select
            multiple
            size={Math.min(6, (field.options || []).length || 3)}
            value={(formData[field.id] as string[]) || []}
            onChange={(e) => {
              const selected = Array.from(e.target.selectedOptions).map((o) => o.value);
              updateField(field.id, selected);
            }}
            className={`w-full px-4 py-3 bg-slate-800 text-white placeholder-slate-500 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
              hasError ? 'border-red-500/40 focus:ring-red-500' : 'border-slate-700 focus:ring-cyan-500'
            }`}
          >
            {(field.options || []).map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        );

      case 'state':
      case 'country':
      case 'timezone':
      case 'product_selection': {
        const opts =
          field.type === 'state' ? US_STATES :
          field.type === 'country' ? COUNTRIES :
          field.type === 'timezone' ? COMMON_TIMEZONES :
          (field.options || []);
        const placeholder =
          field.placeholder ||
          (field.type === 'state' ? 'Select state...' :
           field.type === 'country' ? 'Select country...' :
           field.type === 'timezone' ? 'Select timezone...' :
           'Select an option');
        return (
          <select
            value={String(formData[field.id] || '')}
            onChange={(e) => updateField(field.id, e.target.value)}
            className={`w-full px-4 py-3 bg-slate-800 text-white placeholder-slate-500 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
              hasError ? 'border-red-500/40 focus:ring-red-500' : 'border-slate-700 focus:ring-cyan-500'
            }`}
          >
            <option value="">{placeholder}</option>
            {opts.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        );
      }

      case 'textbox_list': {
        const items = (formData[field.id] as string[]) || [''];
        return (
          <div className="space-y-2">
            {items.map((item, i) => (
              <div key={i} className="flex gap-2">
                <input
                  type="text"
                  value={item}
                  onChange={(e) => {
                    const next = [...items];
                    next[i] = e.target.value;
                    updateField(field.id, next);
                  }}
                  placeholder={field.placeholder || `Item ${i + 1}`}
                  className="flex-1 px-4 py-3 bg-slate-800 text-white placeholder-slate-500 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => updateField(field.id, items.filter((_, j) => j !== i))}
                    className="p-2 text-slate-500 hover:text-red-300"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => updateField(field.id, [...items, ''])}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-cyan-400 hover:bg-cyan-500/10 rounded-lg"
            >
              <Plus className="w-4 h-4" />
              Add item
            </button>
          </div>
        );
      }

      case 'monetary':
        return (
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">
              {currencySymbol(field.currency)}
            </span>
            <input
              type="number"
              step="0.01"
              value={String(formData[field.id] || '')}
              onChange={(e) => updateField(field.id, e.target.value)}
              placeholder={field.placeholder || '0.00'}
              className={`w-full pl-8 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                hasError ? 'border-red-500/40 focus:ring-red-500' : 'border-slate-700 focus:ring-cyan-500'
              }`}
            />
          </div>
        );

      case 'custom_html':
        return (
          <div
            className="prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: field.htmlContent || '' }}
          />
        );

      case 'column':
        return (
          <div
            className="grid gap-3"
            style={{ gridTemplateColumns: `repeat(${field.columnCount || 2}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: field.columnCount || 2 }).map((_, i) => (
              <div key={i} />
            ))}
          </div>
        );

      case 'payment':
        return (
          <div className="border border-slate-700 rounded-lg p-4 bg-slate-800/60 text-sm text-slate-300 flex items-center gap-2">
            <CreditCard className="w-4 h-4" />
            <span>Payment processing not yet configured for this form.</span>
          </div>
        );

      case 'sms_verification': {
        const value = (formData[field.id] as Record<string, string>) || {};
        return (
          <div className="space-y-2">
            <input
              type="tel"
              value={value.phone || ''}
              onChange={(e) => updateField(field.id, { ...value, phone: e.target.value })}
              placeholder="Phone number"
              className={`w-full px-4 py-3 bg-slate-800 text-white placeholder-slate-500 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                hasError ? 'border-red-500/40 focus:ring-red-500' : 'border-slate-700 focus:ring-cyan-500'
              }`}
            />
            <div className="flex gap-2">
              <input
                type="text"
                value={value.code || ''}
                onChange={(e) => updateField(field.id, { ...value, code: e.target.value })}
                placeholder="Verification code"
                className="flex-1 px-4 py-3 bg-slate-800 text-white placeholder-slate-500 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
              <button
                type="button"
                className="px-3 py-2 text-sm bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600"
                disabled
                title="SMS sending not yet configured"
              >
                Send code
              </button>
            </div>
          </div>
        );
      }

      case 'email_validation':
        return (
          <div className="flex gap-2">
            <input
              type="email"
              value={String(formData[field.id] || '')}
              onChange={(e) => updateField(field.id, e.target.value)}
              placeholder={field.placeholder || 'you@example.com'}
              className={`flex-1 px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                hasError ? 'border-red-500/40 focus:ring-red-500' : 'border-slate-700 focus:ring-cyan-500'
              }`}
            />
            <button
              type="button"
              className="px-3 py-2 text-sm bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600"
              disabled
              title="Email validation not yet configured"
            >
              Verify
            </button>
          </div>
        );

      case 'math_calculation':
        return (
          <input
            type="text"
            readOnly
            value={String(formData[field.id] || '')}
            placeholder={field.formula ? `= ${field.formula}` : 'Computed value'}
            className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-lg text-slate-400 placeholder-slate-500"
          />
        );

      case 'checkbox':
      case 'consent':
        return (
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={Boolean(formData[field.id])}
              onChange={(e) => updateField(field.id, e.target.checked)}
              className="mt-1 rounded border-slate-700 text-cyan-400 focus:ring-cyan-500"
            />
            <span className="text-slate-300">{field.label}</span>
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
                  ? 'border-red-500/40 bg-red-500/10'
                  : 'border-slate-700 hover:border-cyan-500 hover:bg-cyan-500/10'
              }`}
            >
              <Upload className="w-8 h-8 text-slate-500 mx-auto mb-2" />
              <p className="text-sm text-slate-300">
                Click to upload or drag and drop
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Max {Math.round(config.maxSizeBytes / 1024 / 1024)}MB
                {config.maxFiles > 1 && ` - Up to ${config.maxFiles} files`}
              </p>
            </button>
            {files.length > 0 && (
              <div className="mt-3 space-y-2">
                {files.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center gap-3 p-3 bg-slate-800/60 rounded-lg"
                  >
                    <FileText className="w-5 h-5 text-slate-500" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-300 truncate">{file.name}</p>
                      {file.status === 'uploading' && (
                        <div className="mt-1 h-1 bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-cyan-500 transition-all"
                            style={{ width: `${file.progress}%` }}
                          />
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(field.id, file.id)}
                      className="p-1 text-slate-500 hover:text-red-300"
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
                : field.type === 'website'
                ? 'url'
                : 'text'
            }
            value={String(formData[field.id] || '')}
            onChange={(e) => updateField(field.id, e.target.value)}
            placeholder={field.placeholder}
            className={`w-full px-4 py-3 bg-slate-800 text-white placeholder-slate-500 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
              hasError
                ? 'border-red-500/40 focus:ring-red-500'
                : 'border-slate-700 focus:ring-cyan-500'
            }`}
          />
        );
    }
  }

  const rootClass = embed
    ? 'bg-slate-950 p-4'
    : 'min-h-screen bg-slate-950 py-12 px-4';
  const centeredRootClass = embed
    ? 'bg-slate-950 flex items-center justify-center p-4'
    : 'min-h-screen bg-slate-950 flex items-center justify-center p-4';

  if (loading) {
    return (
      <div className={centeredRootClass}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500" />
      </div>
    );
  }

  if (error && !form) {
    return (
      <div className={centeredRootClass}>
        <div className="max-w-md w-full bg-slate-900 rounded-2xl border border-slate-800 p-8 text-center">
          <AlertCircle className="w-12 h-12 text-red-300 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-white mb-2">Form Not Available</h1>
          <p className="text-slate-400">{error}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className={centeredRootClass}>
        <div className="max-w-md w-full bg-slate-900 rounded-2xl border border-slate-800 p-8 text-center">
          <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-white mb-2">Thank You!</h1>
          <p className="text-slate-400">
            {form?.settings.thankYouMessage || 'Your response has been submitted successfully.'}
          </p>
          {form?.settings.redirectUrl && (
            <p className="text-sm text-slate-500 mt-4">Redirecting...</p>
          )}
        </div>
      </div>
    );
  }

  if (!form) return null;

  return (
    <div className={rootClass}>
      <div className="max-w-xl mx-auto">
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-8">
          <h1 className="text-2xl font-semibold text-white mb-1">{form.name}</h1>
          {form.description && (
            <p className="text-slate-400 mb-6">{form.description}</p>
          )}

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-300 mt-0.5" />
              <div className="text-sm text-red-300">{error}</div>
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
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      {field.label}
                      {field.required && <span className="text-red-300 ml-1">*</span>}
                    </label>
                  )}
                  {field.helpText && field.type !== 'divider' && (
                    <p className="text-sm text-slate-400 mb-2">{field.helpText}</p>
                  )}
                  {renderField(field)}
                  {validationErrors[field.id] && (
                    <p className="mt-1 text-sm text-red-300">{validationErrors[field.id]}</p>
                  )}
                </div>
              );
            })}

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-500 to-teal-600 text-white font-medium rounded-lg hover:from-cyan-600 hover:to-teal-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
        {!embed && (
          <p className="text-center text-slate-500 text-sm mt-6">
            Powered by Your CRM
          </p>
        )}
      </div>
    </div>
  );
}
