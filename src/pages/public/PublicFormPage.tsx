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
import { getTheme, themeStyleVars } from '../../constants/formThemes';
import { evaluateRule } from '../../components/SubmitRulesEditor';
import { evalFormula } from '../../utils/formulaEvaluator';

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
  const [disqualifyMessage, setDisqualifyMessage] = useState<string | null>(null);
  const [customSuccessMessage, setCustomSuccessMessage] = useState<string | null>(null);
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

      const defaults: Record<string, FormFieldValue> = {};
      const fields: FormField[] = data.definition?.fields || [];
      for (const f of fields) {
        if (f.defaultValue === undefined || f.defaultValue === null || f.defaultValue === '') continue;
        if (f.type === 'checkbox' || f.type === 'consent') {
          defaults[f.id] = f.defaultValue === 'true' || f.defaultValue === true;
        } else if (f.type === 'number' || f.type === 'monetary') {
          const n = parseFloat(String(f.defaultValue));
          defaults[f.id] = isNaN(n) ? f.defaultValue : n;
        } else if (f.type === 'multi_select' || f.type === 'checkbox_group' || f.type === 'multi_dropdown') {
          defaults[f.id] = String(f.defaultValue).split(',').map((s) => s.trim()).filter(Boolean);
        } else {
          defaults[f.id] = f.defaultValue;
        }
      }
      if (Object.keys(defaults).length > 0) {
        setFormData((prev) => ({ ...defaults, ...prev }));
      }
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

      if (field.validationRules && formData[field.id] !== undefined && formData[field.id] !== '') {
        const rawValue = formData[field.id];
        const value = String(rawValue ?? '');
        const numValue = typeof rawValue === 'number' ? rawValue : parseFloat(value);
        for (const rule of field.validationRules) {
          if (errors[field.id]) break;
          if (rule.type === 'min_length' && value.length < Number(rule.value)) {
            errors[field.id] = rule.message || `Minimum ${rule.value} characters required`;
          } else if (rule.type === 'max_length' && value.length > Number(rule.value)) {
            errors[field.id] = rule.message || `Maximum ${rule.value} characters allowed`;
          } else if (rule.type === 'pattern') {
            try {
              if (!new RegExp(String(rule.value)).test(value)) {
                errors[field.id] = rule.message || 'Invalid format';
              }
            } catch {
              // bad pattern in builder — ignore at runtime
            }
          } else if (rule.type === 'min' && !isNaN(numValue) && numValue < Number(rule.value)) {
            errors[field.id] = rule.message || `Must be at least ${rule.value}`;
          } else if (rule.type === 'max' && !isNaN(numValue) && numValue > Number(rule.value)) {
            errors[field.id] = rule.message || `Must be at most ${rule.value}`;
          } else if (rule.type === 'min_date' && value && value < String(rule.value)) {
            errors[field.id] = rule.message || `Must be on or after ${rule.value}`;
          } else if (rule.type === 'max_date' && value && value > String(rule.value)) {
            errors[field.id] = rule.message || `Must be on or before ${rule.value}`;
          } else if (rule.type === 'format') {
            if (field.type === 'email') {
              if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                errors[field.id] = rule.message || 'Please enter a valid email address';
              }
            } else if (field.type === 'phone') {
              const digits = value.replace(/\D+/g, '');
              if (digits.length < 7 || digits.length > 15) {
                errors[field.id] = rule.message || 'Please enter a valid phone number';
              }
            } else if (field.type === 'website') {
              try {
                const u = new URL(value.includes('://') ? value : `https://${value}`);
                if (!u.hostname.includes('.')) throw new Error();
              } catch {
                errors[field.id] = rule.message || 'Please enter a valid URL';
              }
            }
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

    const submitRules = form.settings.submitRules || [];

    const disqualifyHit = submitRules.find(
      (r) => r.action === 'disqualify' && evaluateRule(r, formData as Record<string, unknown>)
    );
    if (disqualifyHit) {
      setDisqualifyMessage(disqualifyHit.payload || "Sorry, you don't qualify based on your answers.");
      return;
    }

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
        } else if (field.type === 'math_calculation') {
          submissionData[field.id] = evalFormula(field.formula, formData as Record<string, unknown>);
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

      const matchedRule = submitRules.find(
        (r) => (r.action === 'redirect' || r.action === 'message') && evaluateRule(r, formData as Record<string, unknown>)
      );

      if (matchedRule?.action === 'redirect' && matchedRule.payload) {
        window.location.href = matchedRule.payload;
        return;
      }

      if (matchedRule?.action === 'message' && matchedRule.payload) {
        setCustomSuccessMessage(matchedRule.payload);
      }

      setSubmitted(true);

      if (!matchedRule && form.settings.redirectUrl) {
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

  function optionsLayoutClass(field: FormField): string {
    switch (field.optionsLayout) {
      case 'horizontal':
        return 'flex flex-wrap gap-3';
      case 'columns_2':
        return 'grid grid-cols-1 sm:grid-cols-2 gap-2';
      case 'columns_3':
        return 'grid grid-cols-1 sm:grid-cols-3 gap-2';
      default:
        return 'space-y-2';
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
            <hr className="border-[var(--form-input-border)]" />
            {field.label && (
              <p className="text-sm text-[var(--form-text-muted)] mt-2">{field.label}</p>
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
              className={`w-full px-4 py-3 bg-[var(--form-input-bg)] text-[var(--form-input-text)] placeholder:text-[var(--form-input-placeholder)] border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                hasError
                  ? 'border-red-500/40 focus:ring-red-500'
                  : 'border-[var(--form-input-border)] focus:ring-[var(--form-accent-solid)]'
              }`}
            />
            {field.characterLimit && (
              <div className="absolute bottom-2 right-2 text-xs text-[var(--form-text-muted)]">
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
            className={`w-full px-4 py-3 bg-[var(--form-input-bg)] text-[var(--form-input-text)] placeholder:text-[var(--form-input-placeholder)] border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
              hasError
                ? 'border-red-500/40 focus:ring-red-500'
                : 'border-[var(--form-input-border)] focus:ring-[var(--form-accent-solid)]'
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
          <div className={optionsLayoutClass(field)}>
            {(field.options || []).map((opt) => (
              <label
                key={opt.value}
                className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                  formData[field.id] === opt.value
                    ? 'border-[var(--form-selected-border)] bg-[var(--form-selected-bg)]'
                    : 'border-[var(--form-input-border)] hover:border-[var(--form-input-border)]'
                }`}
              >
                <input
                  type="radio"
                  name={field.id}
                  checked={formData[field.id] === opt.value}
                  onChange={() => updateField(field.id, opt.value)}
                  className="text-[var(--form-accent-solid)] focus:ring-[var(--form-accent-solid)]"
                />
                <span className="text-[var(--form-text-secondary)]">{opt.label}</span>
              </label>
            ))}
          </div>
        );

      case 'multi_select':
      case 'checkbox_group':
        return (
          <div className={optionsLayoutClass(field)}>
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
                  className="rounded border-[var(--form-input-border)] text-[var(--form-accent-solid)] focus:ring-[var(--form-accent-solid)]"
                />
                <span className="text-[var(--form-text-secondary)]">{opt.label}</span>
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
            className={`w-full px-4 py-3 bg-[var(--form-input-bg)] text-[var(--form-input-text)] placeholder:text-[var(--form-input-placeholder)] border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
              hasError ? 'border-red-500/40 focus:ring-red-500' : 'border-[var(--form-input-border)] focus:ring-[var(--form-accent-solid)]'
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
            className={`w-full px-4 py-3 bg-[var(--form-input-bg)] text-[var(--form-input-text)] placeholder:text-[var(--form-input-placeholder)] border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
              hasError ? 'border-red-500/40 focus:ring-red-500' : 'border-[var(--form-input-border)] focus:ring-[var(--form-accent-solid)]'
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
                  className="flex-1 px-4 py-3 bg-[var(--form-input-bg)] text-[var(--form-input-text)] placeholder:text-[var(--form-input-placeholder)] border border-[var(--form-input-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--form-accent-solid)]"
                />
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => updateField(field.id, items.filter((_, j) => j !== i))}
                    className="p-2 text-[var(--form-text-muted)] hover:text-[var(--form-error-text)]"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => updateField(field.id, [...items, ''])}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-[var(--form-accent-solid)] hover:bg-[var(--form-selected-bg)] rounded-lg"
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
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--form-text-muted)] text-sm pointer-events-none">
              {currencySymbol(field.currency)}
            </span>
            <input
              type="number"
              step="0.01"
              value={String(formData[field.id] || '')}
              onChange={(e) => updateField(field.id, e.target.value)}
              placeholder={field.placeholder || '0.00'}
              className={`w-full pl-8 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                hasError ? 'border-red-500/40 focus:ring-red-500' : 'border-[var(--form-input-border)] focus:ring-[var(--form-accent-solid)]'
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
          <div className="border border-[var(--form-input-border)] rounded-lg p-4 bg-[var(--form-input-bg)]/60 text-sm text-[var(--form-text-secondary)] flex items-center gap-2">
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
              className={`w-full px-4 py-3 bg-[var(--form-input-bg)] text-[var(--form-input-text)] placeholder:text-[var(--form-input-placeholder)] border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                hasError ? 'border-red-500/40 focus:ring-red-500' : 'border-[var(--form-input-border)] focus:ring-[var(--form-accent-solid)]'
              }`}
            />
            <div className="flex gap-2">
              <input
                type="text"
                value={value.code || ''}
                onChange={(e) => updateField(field.id, { ...value, code: e.target.value })}
                placeholder="Verification code"
                className="flex-1 px-4 py-3 bg-[var(--form-input-bg)] text-[var(--form-input-text)] placeholder:text-[var(--form-input-placeholder)] border border-[var(--form-input-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--form-accent-solid)]"
              />
              <button
                type="button"
                className="px-3 py-2 text-sm bg-[var(--form-input-bg)] text-[var(--form-text-secondary)] rounded-lg hover:opacity-80"
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
                hasError ? 'border-red-500/40 focus:ring-red-500' : 'border-[var(--form-input-border)] focus:ring-[var(--form-accent-solid)]'
              }`}
            />
            <button
              type="button"
              className="px-3 py-2 text-sm bg-[var(--form-input-bg)] text-[var(--form-text-secondary)] rounded-lg hover:opacity-80"
              disabled
              title="Email validation not yet configured"
            >
              Verify
            </button>
          </div>
        );

      case 'math_calculation': {
        const computed = evalFormula(field.formula, formData as Record<string, unknown>);
        const display =
          computed !== null
            ? field.currency
              ? `${currencySymbol(field.currency)}${computed.toFixed(2)}`
              : String(computed)
            : '';
        return (
          <input
            type="text"
            readOnly
            value={display}
            placeholder={field.formula ? `= ${field.formula}` : 'Configure formula in field settings'}
            className="w-full px-4 py-3 bg-[var(--form-input-bg)]/60 border border-[var(--form-input-border)] rounded-lg text-[var(--form-text-muted)] placeholder:text-[var(--form-input-placeholder)]"
          />
        );
      }

      case 'checkbox':
      case 'consent':
        return (
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={Boolean(formData[field.id])}
              onChange={(e) => updateField(field.id, e.target.checked)}
              className="mt-1 rounded border-[var(--form-input-border)] text-[var(--form-accent-solid)] focus:ring-[var(--form-accent-solid)]"
            />
            <span className="text-[var(--form-text-secondary)]">{field.label}</span>
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
                  : 'border-[var(--form-input-border)] hover:border-[var(--form-accent-solid)] hover:bg-[var(--form-selected-bg)]'
              }`}
            >
              <Upload className="w-8 h-8 text-[var(--form-text-muted)] mx-auto mb-2" />
              <p className="text-sm text-[var(--form-text-secondary)]">
                Click to upload or drag and drop
              </p>
              <p className="text-xs text-[var(--form-text-muted)] mt-1">
                Max {Math.round(config.maxSizeBytes / 1024 / 1024)}MB
                {config.maxFiles > 1 && ` - Up to ${config.maxFiles} files`}
              </p>
            </button>
            {files.length > 0 && (
              <div className="mt-3 space-y-2">
                {files.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center gap-3 p-3 bg-[var(--form-input-bg)]/60 rounded-lg"
                  >
                    <FileText className="w-5 h-5 text-[var(--form-text-muted)]" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[var(--form-text-secondary)] truncate">{file.name}</p>
                      {file.status === 'uploading' && (
                        <div className="mt-1 h-1 bg-[var(--form-input-bg)] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[var(--form-accent-solid)] transition-all"
                            style={{ width: `${file.progress}%` }}
                          />
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(field.id, file.id)}
                      className="p-1 text-[var(--form-text-muted)] hover:text-[var(--form-error-text)]"
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
            className={`w-full px-4 py-3 bg-[var(--form-input-bg)] text-[var(--form-input-text)] placeholder:text-[var(--form-input-placeholder)] border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
              hasError
                ? 'border-red-500/40 focus:ring-red-500'
                : 'border-[var(--form-input-border)] focus:ring-[var(--form-accent-solid)]'
            }`}
          />
        );
    }
  }

  const theme = getTheme(form?.settings?.theme);
  const themeStyle = themeStyleVars(theme);
  const rootClass = embed
    ? 'bg-[var(--form-page-bg)] p-4'
    : 'min-h-screen bg-[var(--form-page-bg)] py-12 px-4';
  const centeredRootClass = embed
    ? 'bg-[var(--form-page-bg)] flex items-center justify-center p-4'
    : 'min-h-screen bg-[var(--form-page-bg)] flex items-center justify-center p-4';

  if (loading) {
    return (
      <div className={centeredRootClass} style={themeStyle}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--form-accent-solid)]" />
      </div>
    );
  }

  if (error && !form) {
    return (
      <div className={centeredRootClass} style={themeStyle}>
        <div className="max-w-md w-full bg-[var(--form-card-bg)] rounded-2xl border border-[var(--form-card-border)] p-8 text-center">
          <AlertCircle className="w-12 h-12 text-[var(--form-error-text)] mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-[var(--form-text-primary)] mb-2">Form Not Available</h1>
          <p className="text-[var(--form-text-muted)]">{error}</p>
        </div>
      </div>
    );
  }

  if (disqualifyMessage) {
    return (
      <div className={centeredRootClass} style={themeStyle}>
        <div className="max-w-md w-full bg-[var(--form-card-bg)] rounded-2xl border border-[var(--form-card-border)] p-8 text-center">
          <AlertCircle className="w-12 h-12 text-[var(--form-text-muted)] mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-[var(--form-text-primary)] mb-2">Thanks for your interest</h1>
          <p className="text-[var(--form-text-muted)] whitespace-pre-line">{disqualifyMessage}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    const message = customSuccessMessage || form?.settings.thankYouMessage || 'Your response has been submitted successfully.';
    return (
      <div className={centeredRootClass} style={themeStyle}>
        <div className="max-w-md w-full bg-[var(--form-card-bg)] rounded-2xl border border-[var(--form-card-border)] p-8 text-center">
          <CheckCircle className="w-12 h-12 text-[var(--form-success-text)] mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-[var(--form-text-primary)] mb-2">Thank You!</h1>
          <p className="text-[var(--form-text-muted)] whitespace-pre-line">{message}</p>
          {!customSuccessMessage && form?.settings.redirectUrl && (
            <p className="text-sm text-[var(--form-text-muted)] mt-4">Redirecting...</p>
          )}
        </div>
      </div>
    );
  }

  if (!form) return null;

  return (
    <div className={rootClass} style={themeStyle}>
      <div className="max-w-xl mx-auto">
        <div className="bg-[var(--form-card-bg)] rounded-2xl border border-[var(--form-card-border)] p-8">
          <h1 className="text-2xl font-semibold text-[var(--form-text-primary)] mb-1">{form.name}</h1>
          {form.description && (
            <p className="text-[var(--form-text-muted)] mb-6">{form.description}</p>
          )}

          {error && (
            <div className="mb-6 p-4 bg-[var(--form-error-bg)] border border-[var(--form-error-border)] rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-[var(--form-error-text)] mt-0.5" />
              <div className="text-sm text-[var(--form-error-text)]">{error}</div>
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

              const widthCls = field.width === 'half' ? 'inline-block w-1/2 pr-2 align-top' : '';
              const showLabel =
                field.type !== 'hidden' &&
                field.type !== 'checkbox' &&
                field.type !== 'consent' &&
                field.type !== 'divider' &&
                field.labelAlignment !== 'inline';
              const isLeftAligned = field.labelAlignment === 'left' && showLabel;

              const labelEl = showLabel ? (
                <label
                  className={`block text-sm font-medium text-[var(--form-text-secondary)] ${
                    isLeftAligned ? 'sm:mb-0 sm:pt-3 sm:w-1/3 sm:pr-3' : 'mb-2'
                  }`}
                >
                  {field.label}
                  {field.required && <span className="text-[var(--form-error-text)] ml-1">*</span>}
                </label>
              ) : null;

              const inputBlock = (
                <div className={isLeftAligned ? 'sm:flex-1' : ''}>
                  {field.helpText && field.type !== 'divider' && (
                    <p className="text-sm text-[var(--form-text-muted)] mb-2">{field.helpText}</p>
                  )}
                  {renderField(field)}
                  {validationErrors[field.id] && (
                    <p className="mt-1 text-sm text-[var(--form-error-text)]">{validationErrors[field.id]}</p>
                  )}
                </div>
              );

              return (
                <div key={field.id} className={widthCls}>
                  {isLeftAligned ? (
                    <div className="sm:flex sm:items-start">
                      {labelEl}
                      {inputBlock}
                    </div>
                  ) : (
                    <>
                      {labelEl}
                      {inputBlock}
                    </>
                  )}
                </div>
              );
            })}

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-[var(--form-accent-from)] to-[var(--form-accent-to)] text-[var(--form-accent-text)] font-medium rounded-lg hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--form-accent-solid)] focus:ring-offset-2 focus:ring-offset-[var(--form-page-bg)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
          <p className="text-center text-[var(--form-text-muted)] text-sm mt-6 opacity-70">
            Powered by Your CRM
          </p>
        )}
      </div>
    </div>
  );
}
