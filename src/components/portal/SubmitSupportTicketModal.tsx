import { useState, useRef } from 'react';
import {
  X,
  Plus,
  AlertCircle,
  CheckCircle2,
  Upload,
  Trash2,
  Paperclip,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { createSupportTicket, uploadTicketAttachment } from '../../services/projectSupportTickets';
import type {
  SupportTicketServiceCategory,
  SupportTicketRequestType,
  SupportTicketPriority,
  SupportTicketBusinessImpact,
  SupportTicketEnvironment,
  SupportTicketAttachment,
} from '../../types';

interface Props {
  projectId: string;
  orgId: string;
  contactName: string;
  contactEmail?: string;
  contactPhone?: string;
  onSuccess: () => void;
  onClose: () => void;
}

const CATEGORY_LABELS: Record<SupportTicketServiceCategory, string> = {
  ai_automation: 'AI Automation System',
  crm_pipeline: 'CRM / Pipeline System',
  content_automation: 'Content Automation Engine',
  integration_api: 'Integration / API System',
  workflow_automation: 'Workflow Automation',
  custom_software: 'Custom Software Development',
  data_analytics: 'Data / Analytics System',
  other: 'Other',
};

const REQUEST_TYPE_LABELS: Record<SupportTicketRequestType, string> = {
  bug_report: 'Bug Report',
  feature_request: 'Feature Request',
  performance_issue: 'Performance Issue',
  configuration_change: 'Configuration Change',
  access_permissions: 'Access / Permissions',
  training_docs: 'Training / Documentation',
  general_inquiry: 'General Inquiry',
};

const PRIORITY_OPTIONS: { value: SupportTicketPriority; label: string; desc: string }[] = [
  { value: 'low', label: 'Low', desc: 'Minor inconvenience' },
  { value: 'medium', label: 'Medium', desc: 'Impacts workflow' },
  { value: 'high', label: 'High', desc: 'Significant disruption' },
  { value: 'critical', label: 'Critical', desc: 'System down / revenue loss' },
];

const IMPACT_LABELS: Record<SupportTicketBusinessImpact, string> = {
  minimal: 'Minimal',
  internal_only: 'Internal Only',
  team_productivity: 'Team Productivity',
  client_facing: 'Client-Facing',
  operations_blocked: 'Operations Blocked',
  revenue_affecting: 'Revenue Affecting',
};

const ENV_LABELS: Record<SupportTicketEnvironment, string> = {
  production: 'Production',
  staging: 'Staging',
  development: 'Development',
  unknown: 'Unknown',
};

interface FormState {
  title: string;
  service_category: SupportTicketServiceCategory;
  request_type: SupportTicketRequestType;
  priority: SupportTicketPriority;
  description: string;
  steps_to_reproduce: string;
  expected_behavior: string;
  actual_behavior: string;
  affected_area: string;
  affected_feature: string;
  affected_integration: string;
  environment: SupportTicketEnvironment;
  error_messages: string;
  business_impact: SupportTicketBusinessImpact;
  impact_description: string;
  users_affected_count: number;
  workaround_available: boolean;
  preferred_contact_method: string;
  availability_window: string;
  expected_resolution_date: string;
}

const DEFAULT_FORM: FormState = {
  title: '',
  service_category: 'ai_automation',
  request_type: 'bug_report',
  priority: 'medium',
  description: '',
  steps_to_reproduce: '',
  expected_behavior: '',
  actual_behavior: '',
  affected_area: '',
  affected_feature: '',
  affected_integration: '',
  environment: 'production',
  error_messages: '',
  business_impact: 'minimal',
  impact_description: '',
  users_affected_count: 1,
  workaround_available: false,
  preferred_contact_method: 'email',
  availability_window: '',
  expected_resolution_date: '',
};

const MAX_FILES = 5;

export function SubmitSupportTicketModal({
  projectId,
  orgId,
  contactName,
  contactEmail,
  contactPhone,
  onSuccess,
  onClose,
}: Props) {
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function updateForm(updates: Partial<FormState>) {
    setForm((f) => ({ ...f, ...updates }));
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files) return;
    const newFiles = Array.from(e.target.files);
    setFiles((prev) => {
      const combined = [...prev, ...newFiles];
      return combined.slice(0, MAX_FILES);
    });
    e.target.value = '';
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    if (!form.title.trim() || !form.description.trim()) return;
    setSaving(true);
    setError('');

    try {
      const uploadedAttachments: SupportTicketAttachment[] = [];
      for (const file of files) {
        const att = await uploadTicketAttachment(orgId, 'pending', file);
        uploadedAttachments.push(att);
      }

      const { ticket } = await createSupportTicket({
        project_id: projectId,
        org_id: orgId,
        client_name: contactName,
        client_email: contactEmail,
        client_phone: contactPhone,
        title: form.title,
        service_category: form.service_category,
        request_type: form.request_type,
        priority: form.priority,
        description: form.description,
        steps_to_reproduce: form.steps_to_reproduce || undefined,
        expected_behavior: form.expected_behavior || undefined,
        actual_behavior: form.actual_behavior || undefined,
        affected_area: form.affected_area || undefined,
        affected_feature: form.affected_feature || undefined,
        affected_integration: form.affected_integration || undefined,
        environment: form.environment,
        error_messages: form.error_messages || undefined,
        attachments: uploadedAttachments,
        business_impact: form.business_impact,
        impact_description: form.impact_description || undefined,
        users_affected_count: form.users_affected_count,
        workaround_available: form.workaround_available,
        preferred_contact_method: form.preferred_contact_method,
        availability_window: form.availability_window || undefined,
        expected_resolution_date: form.expected_resolution_date || undefined,
        source: 'portal',
      });

      try {
        const notifyUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/support-ticket-notify`;
        const notifyRes = await fetch(notifyUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ ticket_id: ticket.id, org_id: orgId }),
        });
        if (!notifyRes.ok) {
          const body = await notifyRes.text().catch(() => '');
          console.error('support-ticket-notify failed:', notifyRes.status, body);
        }
      } catch (notifyErr) {
        console.error('support-ticket-notify error:', notifyErr);
      }

      setSubmitted(true);
      setTimeout(() => onSuccess(), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (submitted) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40" />
        <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-8 text-center animate-in fade-in zoom-in-95 duration-200">
          <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-7 h-7 text-emerald-600" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">Ticket Submitted</h2>
          <p className="text-sm text-gray-500">
            Your support ticket has been submitted and our team has been notified. We'll get back to you shortly.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
        <div className="sticky top-0 z-10 bg-white flex items-center justify-between p-6 border-b border-gray-100 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-teal-100 rounded-xl flex items-center justify-center">
              <AlertCircle className="w-4 h-4 text-teal-600" />
            </div>
            <h2 className="text-base font-bold text-gray-900">Submit Support Ticket</h2>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="bg-teal-50 border border-teal-100 rounded-xl p-3 text-sm text-teal-700">
            Submitting as: <strong>{contactName}</strong>
            {contactEmail && <span className="text-teal-500"> &middot; {contactEmail}</span>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Issue Title <span className="text-red-500">*</span>
            </label>
            <input
              value={form.title}
              onChange={(e) => updateForm({ title: e.target.value })}
              placeholder="Brief summary of the issue"
              className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 text-gray-900 placeholder-gray-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Support Category</label>
              <select
                value={form.service_category}
                onChange={(e) => updateForm({ service_category: e.target.value as SupportTicketServiceCategory })}
                className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 text-gray-900 bg-white"
              >
                {Object.entries(CATEGORY_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Request Type</label>
              <select
                value={form.request_type}
                onChange={(e) => updateForm({ request_type: e.target.value as SupportTicketRequestType })}
                className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 text-gray-900 bg-white"
              >
                {Object.entries(REQUEST_TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
            <div className="grid grid-cols-4 gap-2">
              {PRIORITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => updateForm({ priority: opt.value })}
                  className={`p-2.5 rounded-xl border text-center transition-all ${
                    form.priority === opt.value
                      ? opt.value === 'critical'
                        ? 'border-red-400 bg-red-50 ring-2 ring-red-200'
                        : opt.value === 'high'
                        ? 'border-orange-400 bg-orange-50 ring-2 ring-orange-200'
                        : opt.value === 'medium'
                        ? 'border-amber-400 bg-amber-50 ring-2 ring-amber-200'
                        : 'border-gray-400 bg-gray-50 ring-2 ring-gray-200'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className="text-sm font-semibold text-gray-900">{opt.label}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              value={form.description}
              onChange={(e) => updateForm({ description: e.target.value })}
              rows={4}
              placeholder="Describe the issue in detail. What is happening? When did it start?"
              className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 resize-none text-gray-900 placeholder-gray-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Steps to Reproduce <span className="text-gray-400 font-normal">(if applicable)</span>
            </label>
            <textarea
              value={form.steps_to_reproduce}
              onChange={(e) => updateForm({ steps_to_reproduce: e.target.value })}
              rows={3}
              placeholder="1. Go to...&#10;2. Click on...&#10;3. Observe that..."
              className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 resize-none text-gray-900 placeholder-gray-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Affected Area</label>
              <input
                value={form.affected_area}
                onChange={(e) => updateForm({ affected_area: e.target.value })}
                placeholder="e.g., Dashboard, CRM, Workflows"
                className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 text-gray-900 placeholder-gray-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Affected Feature</label>
              <input
                value={form.affected_feature}
                onChange={(e) => updateForm({ affected_feature: e.target.value })}
                placeholder="e.g., Email automation, Lead scoring"
                className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 text-gray-900 placeholder-gray-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Error Messages <span className="text-gray-400 font-normal">(if any)</span>
            </label>
            <textarea
              value={form.error_messages}
              onChange={(e) => updateForm({ error_messages: e.target.value })}
              rows={2}
              placeholder="Paste any error messages you're seeing..."
              className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 resize-none text-gray-900 placeholder-gray-400 font-mono text-xs"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Screenshots & Attachments <span className="text-gray-400 font-normal">(max {MAX_FILES})</span>
            </label>
            <div
              onClick={() => files.length < MAX_FILES && fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-4 text-center transition-colors ${
                files.length >= MAX_FILES
                  ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
                  : 'border-gray-300 hover:border-teal-400 hover:bg-teal-50/30 cursor-pointer'
              }`}
            >
              <Upload className="w-5 h-5 text-gray-400 mx-auto mb-1.5" />
              <p className="text-sm text-gray-500">
                {files.length >= MAX_FILES ? 'Maximum files reached' : 'Click to upload screenshots or files'}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">PNG, JPG, PDF, or any file type</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.pdf,.doc,.docx,.txt,.log,.csv"
              onChange={handleFileSelect}
              className="hidden"
            />
            {files.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {files.map((file, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg">
                    <Paperclip className="w-3.5 h-3.5 text-gray-400 flex-none" />
                    <span className="text-sm text-gray-700 truncate flex-1">{file.name}</span>
                    <span className="text-xs text-gray-400 flex-none">{(file.size / 1024).toFixed(0)} KB</span>
                    <button
                      onClick={() => removeFile(i)}
                      className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors flex-none"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Business Impact</label>
              <select
                value={form.business_impact}
                onChange={(e) => updateForm({ business_impact: e.target.value as SupportTicketBusinessImpact })}
                className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 text-gray-900 bg-white"
              >
                {Object.entries(IMPACT_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Environment</label>
              <select
                value={form.environment}
                onChange={(e) => updateForm({ environment: e.target.value as SupportTicketEnvironment })}
                className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 text-gray-900 bg-white"
              >
                {Object.entries(ENV_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 font-medium transition-colors"
          >
            {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {showAdvanced ? 'Hide' : 'Show'} additional details
          </button>

          {showAdvanced && (
            <div className="space-y-4 border-t border-gray-100 pt-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Expected Behavior</label>
                  <textarea
                    value={form.expected_behavior}
                    onChange={(e) => updateForm({ expected_behavior: e.target.value })}
                    rows={2}
                    placeholder="What should happen?"
                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 resize-none text-gray-900 placeholder-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Actual Behavior</label>
                  <textarea
                    value={form.actual_behavior}
                    onChange={(e) => updateForm({ actual_behavior: e.target.value })}
                    rows={2}
                    placeholder="What is actually happening?"
                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 resize-none text-gray-900 placeholder-gray-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Impact Description</label>
                <textarea
                  value={form.impact_description}
                  onChange={(e) => updateForm({ impact_description: e.target.value })}
                  rows={2}
                  placeholder="Describe how this issue impacts your business..."
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 resize-none text-gray-900 placeholder-gray-400"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Users Affected</label>
                  <input
                    type="number"
                    min={1}
                    value={form.users_affected_count}
                    onChange={(e) => updateForm({ users_affected_count: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Contact Preference</label>
                  <select
                    value={form.preferred_contact_method}
                    onChange={(e) => updateForm({ preferred_contact_method: e.target.value })}
                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 text-gray-900 bg-white"
                  >
                    <option value="email">Email</option>
                    <option value="phone">Phone</option>
                    <option value="portal">Portal</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Need By Date</label>
                  <input
                    type="date"
                    value={form.expected_resolution_date}
                    onChange={(e) => updateForm({ expected_resolution_date: e.target.value })}
                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 text-gray-900"
                  />
                </div>
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.workaround_available}
                  onChange={(e) => updateForm({ workaround_available: e.target.checked })}
                  className="w-4 h-4 accent-teal-600 rounded"
                />
                <span className="text-sm text-gray-700">I have a workaround for this issue</span>
              </label>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 flex-none" />
              {error}
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-white flex gap-3 p-6 border-t border-gray-100 rounded-b-2xl">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !form.title.trim() || !form.description.trim()}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 rounded-xl transition-colors"
          >
            <Plus className="w-4 h-4" />
            {saving ? 'Submitting...' : 'Submit Ticket'}
          </button>
        </div>
      </div>
    </div>
  );
}
