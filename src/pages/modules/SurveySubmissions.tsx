import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Loader2, Search, Inbox, Eye, ExternalLink, X } from 'lucide-react';
import { getSurveyById, getSurveySubmissions } from '../../services/surveys';
import type { Survey, SurveySubmission, SurveyQuestion } from '../../types';

export function SurveySubmissions() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [submissions, setSubmissions] = useState<SurveySubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<SurveySubmission | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const s = await getSurveyById(id);
        if (cancelled) return;
        setSurvey(s);
        const { submissions: subs } = await getSurveySubmissions(id, { limit: 200 });
        if (cancelled) return;
        setSubmissions(subs);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Failed to load submissions');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const questionMap = useMemo(() => {
    const map: Record<string, SurveyQuestion> = {};
    for (const step of survey?.definition?.steps || []) {
      for (const q of step.questions || []) map[q.id] = q;
    }
    return map;
  }, [survey]);

  const filtered = useMemo(() => {
    if (!search.trim()) return submissions;
    const s = search.trim().toLowerCase();
    return submissions.filter((sub) => {
      const c = sub.contact;
      if (c) {
        const name = `${c.first_name || ''} ${c.last_name || ''}`.toLowerCase();
        if (name.includes(s)) return true;
        if (c.email?.toLowerCase().includes(s)) return true;
      }
      if (sub.score_band?.toLowerCase().includes(s)) return true;
      return Object.values(sub.answers || {}).some((v) =>
        v !== null && v !== undefined && String(v).toLowerCase().includes(s)
      );
    });
  }, [submissions, search]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !survey) {
    return (
      <div className="p-6">
        <p className="text-sm text-red-600">{error || 'Survey not found'}</p>
      </div>
    );
  }

  const scoringEnabled = !!survey.settings?.scoringEnabled;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <button onClick={() => navigate('/marketing/surveys')} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-2">
            <ArrowLeft className="w-4 h-4" /> Back to Surveys
          </button>
          <div className="flex items-center gap-2">
            <Inbox className="w-5 h-5 text-gray-700" />
            <h1 className="text-2xl font-semibold text-gray-900">{survey.name}</h1>
            <span className="text-sm text-gray-400">
              {filtered.length} response{filtered.length === 1 ? '' : 's'}
            </span>
          </div>
        </div>
        <Link
          to={`/marketing/surveys/${survey.id}/edit`}
          className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
        >
          <ExternalLink className="w-4 h-4" /> Open builder
        </Link>
      </div>

      <div className="mb-4 relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by contact name, email, score band, or any answer..."
          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Inbox className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p className="text-sm">No responses yet.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Submitted</th>
                {scoringEnabled && (
                  <>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Band</th>
                  </>
                )}
                <th className="px-4 py-2 w-24" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((sub) => (
                <tr key={sub.id} className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">
                    {sub.contact ? (
                      <Link to={`/contacts/${sub.contact.id}`} className="text-blue-600 hover:underline">
                        {sub.contact.first_name || sub.contact.last_name
                          ? `${sub.contact.first_name || ''} ${sub.contact.last_name || ''}`.trim()
                          : sub.contact.email || sub.contact.phone}
                      </Link>
                    ) : (
                      <span className="text-gray-400 italic">No contact</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {new Date(sub.submitted_at).toLocaleString()}
                  </td>
                  {scoringEnabled && (
                    <>
                      <td className="px-4 py-3 text-sm text-gray-700">{sub.score_total}</td>
                      <td className="px-4 py-3 text-sm">
                        {sub.score_band ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">
                            {sub.score_band}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                    </>
                  )}
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setSelected(sub)}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded"
                    >
                      <Eye className="w-3 h-3" /> View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selected && (
        <SubmissionDrawer
          submission={selected}
          questionMap={questionMap}
          scoringEnabled={scoringEnabled}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function SubmissionDrawer({
  submission,
  questionMap,
  scoringEnabled,
  onClose,
}: {
  submission: SurveySubmission;
  questionMap: Record<string, SurveyQuestion>;
  scoringEnabled: boolean;
  onClose: () => void;
}) {
  const entries = Object.entries(submission.answers || {});

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-end z-50">
      <div className="bg-white h-full w-full max-w-md overflow-y-auto shadow-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 sticky top-0 bg-white">
          <h3 className="text-sm font-semibold text-gray-900">Response detail</h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Submitted</span>
              <span className="text-gray-900">{new Date(submission.submitted_at).toLocaleString()}</span>
            </div>
            {submission.contact && (
              <div className="flex justify-between">
                <span className="text-gray-500">Contact</span>
                <Link to={`/contacts/${submission.contact.id}`} className="text-blue-600 hover:underline">
                  {submission.contact.first_name || submission.contact.last_name
                    ? `${submission.contact.first_name || ''} ${submission.contact.last_name || ''}`.trim()
                    : submission.contact.email || submission.contact.phone}
                </Link>
              </div>
            )}
            {scoringEnabled && (
              <>
                <div className="flex justify-between">
                  <span className="text-gray-500">Score</span>
                  <span className="text-gray-900">{submission.score_total}</span>
                </div>
                {submission.score_band && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Band</span>
                    <span className="text-gray-900">{submission.score_band}</span>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="border-t border-gray-200 pt-4">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Answers</h4>
            <div className="space-y-3">
              {entries.length === 0 ? (
                <p className="text-sm text-gray-400 italic">No answers recorded.</p>
              ) : (
                entries.map(([key, value]) => {
                  const q = questionMap[key];
                  return (
                    <div key={key}>
                      <div className="text-xs font-medium text-gray-500">{q?.label || key}</div>
                      <div className="text-sm text-gray-900 break-words">
                        {formatValue(value)}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (Array.isArray(v)) return v.map((x) => String(x)).join(', ');
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}
