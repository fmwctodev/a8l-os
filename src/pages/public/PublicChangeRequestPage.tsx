import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, AlertCircle, FileText, Send } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { createChangeRequest } from '../../services/projectChangeRequests';
import type { ProjectChangeRequestType, ProjectChangeRequestPriority } from '../../types';

type PageState = 'loading' | 'ready' | 'invalid' | 'submitted' | 'error';

const TYPE_OPTIONS: { value: ProjectChangeRequestType; label: string }[] = [
  { value: 'scope', label: 'Scope Change' },
  { value: 'timeline', label: 'Timeline Adjustment' },
  { value: 'design', label: 'Design Change' },
  { value: 'feature', label: 'New Feature' },
  { value: 'bugfix', label: 'Bug Fix' },
  { value: 'support', label: 'Support Request' },
  { value: 'other', label: 'Other' },
];

const PRIORITY_OPTIONS: { value: ProjectChangeRequestPriority; label: string; desc: string }[] = [
  { value: 'low', label: 'Low', desc: 'No immediate impact' },
  { value: 'medium', label: 'Medium', desc: 'Affects timeline slightly' },
  { value: 'high', label: 'High', desc: 'Significant impact' },
  { value: 'critical', label: 'Critical', desc: 'Blocking progress' },
];

export function PublicChangeRequestPage() {
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('projectId');
  const orgId = searchParams.get('org');

  const [pageState, setPageState] = useState<PageState>('loading');
  const [projectName, setProjectName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [referenceId, setReferenceId] = useState('');
  const [clientPortalUrl, setClientPortalUrl] = useState('');
  const [copied, setCopied] = useState(false);

  const [form, setForm] = useState({
    client_name: '',
    client_email: '',
    client_phone: '',
    title: '',
    request_type: 'scope' as ProjectChangeRequestType,
    priority: 'medium' as ProjectChangeRequestPriority,
    description: '',
    requested_due_date: '',
    honeypot: '',
  });

  useEffect(() => {
    async function validateProject() {
      if (!projectId) {
        setPageState('invalid');
        return;
      }
      const { data } = await supabase
        .from('projects')
        .select('id, name')
        .eq('id', projectId)
        .maybeSingle();

      if (!data) {
        setPageState('invalid');
        return;
      }
      setProjectName(data.name);
      setPageState('ready');
    }
    validateProject();
  }, [projectId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.honeypot) return;
    if (!form.client_name.trim() || !form.title.trim() || !form.description.trim()) return;
    if (!projectId || !orgId) return;

    setSubmitting(true);
    try {
      const { request, clientPortalUrl: url } = await createChangeRequest({
        project_id: projectId,
        org_id: orgId,
        client_name: form.client_name,
        client_email: form.client_email || undefined,
        client_phone: form.client_phone || undefined,
        title: form.title,
        request_type: form.request_type,
        priority: form.priority,
        description: form.description,
        requested_due_date: form.requested_due_date || undefined,
        source: 'public_form',
      });

      try {
        const notifyUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/change-request-notify`;
        const notifyRes = await fetch(notifyUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ request_id: request.id, org_id: orgId }),
        });
        const notifyBody = await notifyRes.json().catch(() => null);
        console.log('change-request-notify response:', notifyRes.status, notifyBody);
      } catch (notifyErr) {
        console.error('change-request-notify error:', notifyErr);
      }

      setReferenceId(request.id.slice(0, 8).toUpperCase());
      setClientPortalUrl(url);
      setPageState('submitted');
    } catch (err) {
      console.error(err);
      setPageState('error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCopyPortal() {
    await navigator.clipboard.writeText(clientPortalUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  if (pageState === 'loading') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500" />
      </div>
    );
  }

  if (pageState === 'invalid') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 bg-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-7 h-7 text-red-400" />
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Invalid Link</h1>
          <p className="text-slate-400 text-sm">This change request link is invalid or has expired. Please contact the project team for a new link.</p>
        </div>
      </div>
    );
  }

  if (pageState === 'error') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 bg-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-7 h-7 text-red-400" />
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Submission Failed</h1>
          <p className="text-slate-400 text-sm">Something went wrong submitting your request. Please try again or contact the project team.</p>
          <button onClick={() => setPageState('ready')} className="mt-4 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (pageState === 'submitted') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center shadow-2xl">
            <div className="w-16 h-16 bg-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Request Submitted</h1>
            <p className="text-slate-400 text-sm mb-6">
              Your change request has been submitted and the project team has been notified. You can track the status using your secure portal link below.
            </p>
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 mb-5">
              <p className="text-xs text-slate-400 mb-1">Reference ID</p>
              <p className="text-lg font-mono font-bold text-white">{referenceId}</p>
            </div>
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 mb-5 text-left">
              <p className="text-xs text-slate-400 mb-2">Your Secure Status Link</p>
              <p className="text-xs text-slate-300 break-all font-mono leading-relaxed mb-2">{clientPortalUrl}</p>
              <button
                onClick={handleCopyPortal}
                className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300"
              >
                {copied ? <CheckCircle2 className="w-3.5 h-3.5" /> : null}
                {copied ? 'Copied!' : 'Copy link'}
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Save this link — it is your only way to track progress and approve any change orders.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 py-12 px-4">
      <div className="max-w-xl mx-auto">
        <div className="mb-8 text-center">
          <div className="w-12 h-12 bg-cyan-500/20 rounded-xl flex items-center justify-center mx-auto mb-4">
            <FileText className="w-6 h-6 text-cyan-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Submit a Change Request</h1>
          <p className="text-slate-400 text-sm mt-1">
            Project: <span className="text-white font-medium">{projectName}</span>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
          <input name="website" type="text" className="hidden" tabIndex={-1} value={form.honeypot} onChange={(e) => setForm((f) => ({ ...f, honeypot: e.target.value }))} autoComplete="off" />

          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold text-white mb-3">Your Information</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Full Name *</label>
                <input
                  required
                  value={form.client_name}
                  onChange={(e) => setForm((f) => ({ ...f, client_name: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
                  placeholder="Jane Smith"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Email</label>
                <input
                  type="email"
                  value={form.client_email}
                  onChange={(e) => setForm((f) => ({ ...f, client_email: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
                  placeholder="jane@example.com"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Phone (optional)</label>
              <input
                type="tel"
                value={form.client_phone}
                onChange={(e) => setForm((f) => ({ ...f, client_phone: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
                placeholder="+1 (555) 000-0000"
              />
            </div>
          </fieldset>

          <hr className="border-slate-700" />

          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold text-white mb-3">Change Details</legend>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Request Title *</label>
              <input
                required
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
                placeholder="Brief title for this change"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Change Type</label>
                <select
                  value={form.request_type}
                  onChange={(e) => setForm((f) => ({ ...f, request_type: e.target.value as ProjectChangeRequestType }))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
                >
                  {TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Priority</label>
                <select
                  value={form.priority}
                  onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as ProjectChangeRequestPriority }))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
                >
                  {PRIORITY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label} — {o.desc}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Requested Completion Date (optional)</label>
              <input
                type="date"
                value={form.requested_due_date}
                onChange={(e) => setForm((f) => ({ ...f, requested_due_date: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Description *</label>
              <textarea
                required
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={5}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500 resize-none"
                placeholder="Please describe the change you are requesting in as much detail as possible..."
              />
            </div>
          </fieldset>

          <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3">
            <p className="text-xs text-slate-400 leading-relaxed">
              By submitting this request, you understand that it will be reviewed by the project team. Any approved changes requiring additional cost or timeline will be presented in a formal change order for your signature.
            </p>
          </div>

          <button
            type="submit"
            disabled={submitting || !form.client_name || !form.title || !form.description}
            className="w-full flex items-center justify-center gap-2 py-3 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors"
          >
            <Send className="w-4 h-4" />
            {submitting ? 'Submitting...' : 'Submit Change Request'}
          </button>
        </form>
      </div>
    </div>
  );
}
