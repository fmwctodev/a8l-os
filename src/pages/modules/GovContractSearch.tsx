import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Filter,
  ExternalLink,
  Building2,
  Calendar,
  DollarSign,
  Loader2,
  ChevronDown,
  ChevronUp,
  Bell,
  Plus,
  MapPin,
  Phone,
  Mail,
  FileText,
  Download,
  FileSignature,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  searchOpportunities,
  importToOpportunity,
  getOpportunityDescription,
  type SamGovOpportunity,
  type SamSearchFilters,
} from '../../services/samGov';
import { SavedSearchPanel } from '../../components/opportunities/SavedSearchPanel';

const SET_ASIDE_OPTIONS = [
  { value: '', label: 'Any' },
  { value: 'SBA', label: 'Small Business (SBA)' },
  { value: '8A', label: '8(a)' },
  { value: 'HZC', label: 'HUBZone' },
  { value: 'SDVOSBC', label: 'Service-Disabled Veteran-Owned' },
  { value: 'WOSB', label: 'Women-Owned Small Business' },
  { value: 'EDWOSB', label: 'Economically Disadvantaged WOSB' },
];

// SAM.gov notice type codes (ptype query param). Comma-separated values
// can be passed to combine types — e.g. "o,k" for Solicitation + Combined.
const NOTICE_TYPE_OPTIONS = [
  { value: '', label: 'Any Type' },
  { value: 'p', label: 'Pre-Solicitation' },
  { value: 'o', label: 'Solicitation' },
  { value: 'k', label: 'Combined Synopsis / Solicitation' },
  { value: 'r', label: 'Sources Sought / RFI' },
  { value: 's', label: 'Special Notice' },
  { value: 'a', label: 'Award Notice' },
  { value: 'u', label: 'Justification (J&A)' },
  { value: 'g', label: 'Sale of Surplus Property' },
  { value: 'i', label: 'Intent to Bundle (DoD)' },
];

const US_STATES = [
  '', 'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
];

const PAGE_SIZE = 25;

function formatDate(dateStr: string | undefined | null): string {
  if (!dateStr) return '--';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function defaultDateRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return {
    from: from.toISOString().split('T')[0],
    to: to.toISOString().split('T')[0],
  };
}

export default function GovContractSearch() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const dates = defaultDateRange();

  // Search state
  const [keywords, setKeywords] = useState('');
  const [naicsCode, setNaicsCode] = useState('');
  const [setAsideType, setSetAsideType] = useState('');
  const [noticeType, setNoticeType] = useState('');
  const [state, setState] = useState('');
  const [postedFrom, setPostedFrom] = useState(dates.from);
  const [postedTo, setPostedTo] = useState(dates.to);

  // Results state
  const [results, setResults] = useState<SamGovOpportunity[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Detail expansion
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Description cache — lazy-loaded when row expanded
  const [descCache, setDescCache] = useState<Record<string, string>>({});
  const [descLoading, setDescLoading] = useState<Record<string, boolean>>({});

  // Fetch real description when a row is expanded
  useEffect(() => {
    if (!expandedId) return;
    // Already cached or already loading
    if (descCache[expandedId] || descLoading[expandedId]) return;
    // Find the opportunity
    const opp = results.find((o) => o.noticeId === expandedId);
    if (!opp) return;
    const desc = opp.description || '';
    // Only fetch if the description looks like a URL (SAM.gov returns URL, not text)
    if (!desc.startsWith('http')) return;

    setDescLoading((prev) => ({ ...prev, [expandedId]: true }));
    getOpportunityDescription(expandedId)
      .then((result) => {
        setDescCache((prev) => ({ ...prev, [expandedId]: result.plainText || 'No description available.' }));
      })
      .catch(() => {
        setDescCache((prev) => ({ ...prev, [expandedId]: 'Failed to load description.' }));
      })
      .finally(() => {
        setDescLoading((prev) => ({ ...prev, [expandedId]: false }));
      });
  }, [expandedId, results, descCache, descLoading]);

  // Import state
  const [importingId, setImportingId] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);

  // Saved searches panel
  const [showSaved, setShowSaved] = useState(false);

  // Filters panel toggle (mobile)
  const [showFilters, setShowFilters] = useState(false);

  function buildFilters(): SamSearchFilters {
    return {
      keywords: keywords.trim() || undefined,
      naicsCode: naicsCode.trim() || undefined,
      setAsideType: setAsideType || undefined,
      procurementType: noticeType || undefined,
      state: state || undefined,
      postedFrom: postedFrom || undefined,
      postedTo: postedTo || undefined,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    };
  }

  async function handleSearch(newPage = 0) {
    setLoading(true);
    setError(null);
    setPage(newPage);
    try {
      const filters: SamSearchFilters = {
        ...buildFilters(),
        offset: newPage * PAGE_SIZE,
      };
      const res = await searchOpportunities(filters);
      setResults(res.opportunities || []);
      setTotalRecords(res.totalRecords || 0);
      setHasSearched(true);
      setExpandedId(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Search failed');
      setResults([]);
      setTotalRecords(0);
    } finally {
      setLoading(false);
    }
  }

  async function handleImport(opp: SamGovOpportunity) {
    setImportingId(opp.noticeId);
    setImportSuccess(null);
    try {
      await importToOpportunity(opp);
      setImportSuccess(opp.noticeId);
      setTimeout(() => setImportSuccess(null), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImportingId(null);
    }
  }

  async function handleGenerateResponse(opp: SamGovOpportunity) {
    // First import the opportunity if not already imported
    setImportingId(opp.noticeId);
    try {
      const result = await importToOpportunity(opp);
      // Navigate to proposals page with the opportunity pre-selected
      navigate(`/proposals?new=true&opportunity_id=${result.opportunityId}&contact_id=${result.contactId || ''}&source=sam_gov`);
    } catch (err: unknown) {
      // If import fails (e.g., already imported), still try to navigate
      setError(err instanceof Error ? err.message : 'Failed to prepare response');
    } finally {
      setImportingId(null);
    }
  }

  const totalPages = Math.ceil(totalRecords / PAGE_SIZE);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-cyan-500/10 rounded-lg flex items-center justify-center">
                <Building2 className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Government Contracting</h1>
                <p className="text-sm text-slate-400">Search SAM.gov opportunities</p>
              </div>
            </div>
            <button
              onClick={() => setShowSaved(true)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm text-slate-300 transition-colors"
            >
              <Bell className="w-4 h-4" />
              Saved Searches
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Search Bar & Filters */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4">
          {/* Main search row */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search keywords (e.g., cybersecurity, IT consulting)..."
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch(0)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="sm:hidden flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300"
            >
              <Filter className="w-4 h-4" />
              Filters
              {showFilters ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            <button
              onClick={() => handleSearch(0)}
              disabled={loading}
              className="flex items-center justify-center gap-2 px-6 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Search
            </button>
          </div>

          {/* Filter row */}
          <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 ${showFilters ? '' : 'hidden sm:grid'}`}>
            <div>
              <label className="block text-xs text-slate-400 mb-1">NAICS Code</label>
              <input
                type="text"
                placeholder="e.g., 541512"
                value={naicsCode}
                onChange={(e) => setNaicsCode(e.target.value)}
                maxLength={6}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Notice Type</label>
              <select
                value={noticeType}
                onChange={(e) => setNoticeType(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
              >
                {NOTICE_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Set-Aside Type</label>
              <select
                value={setAsideType}
                onChange={(e) => setSetAsideType(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
              >
                {SET_ASIDE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">State</label>
              <select
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
              >
                <option value="">Any State</option>
                {US_STATES.filter(Boolean).map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Posted From</label>
              <input
                type="date"
                value={postedFrom}
                onChange={(e) => setPostedFrom(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Posted To</label>
              <input
                type="date"
                value={postedTo}
                onChange={(e) => setPostedTo(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Import success toast */}
        {importSuccess && (
          <div className="px-4 py-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 text-sm">
            Opportunity imported to pipeline successfully.
          </div>
        )}

        {/* Results */}
        {loading && !hasSearched ? (
          <ResultsSkeleton />
        ) : !hasSearched ? (
          <EmptyState />
        ) : results.length === 0 ? (
          <div className="text-center py-16">
            <Search className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-slate-300">No opportunities found</h3>
            <p className="text-sm text-slate-500 mt-1">Try adjusting your search criteria.</p>
          </div>
        ) : (
          <>
            {/* Results header */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-400">
                Showing {page * PAGE_SIZE + 1}&ndash;{Math.min((page + 1) * PAGE_SIZE, totalRecords)} of{' '}
                <span className="text-white font-medium">{totalRecords.toLocaleString()}</span> results
              </p>
            </div>

            {/* Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-left">
                      <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Title</th>
                      <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider hidden lg:table-cell">Sol #</th>
                      <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider hidden md:table-cell">Agency</th>
                      <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider hidden xl:table-cell">Type</th>
                      <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider hidden xl:table-cell">Set-Aside</th>
                      <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Deadline</th>
                      <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider hidden md:table-cell">Posted</th>
                      <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {results.map((opp) => (
                      <ResultRow
                        key={opp.noticeId}
                        opp={opp}
                        expanded={expandedId === opp.noticeId}
                        onToggle={() => setExpandedId(expandedId === opp.noticeId ? null : opp.noticeId)}
                        onImport={() => handleImport(opp)}
                        onGenerateResponse={() => handleGenerateResponse(opp)}
                        importing={importingId === opp.noticeId}
                        importedSuccess={importSuccess === opp.noticeId}
                        resolvedDescription={descCache[opp.noticeId]}
                        descriptionLoading={descLoading[opp.noticeId] || false}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={() => handleSearch(page - 1)}
                  disabled={page === 0 || loading}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-700 rounded-lg text-sm text-slate-300 transition-colors"
                >
                  Previous
                </button>
                <span className="text-sm text-slate-400">
                  Page {page + 1} of {totalPages}
                </span>
                <button
                  onClick={() => handleSearch(page + 1)}
                  disabled={page >= totalPages - 1 || loading}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-700 rounded-lg text-sm text-slate-300 transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Saved Search Panel */}
      <SavedSearchPanel
        isOpen={showSaved}
        onClose={() => setShowSaved(false)}
        currentFilters={buildFilters()}
      />
    </div>
  );
}

// --- Sub-components ---

interface ResultRowProps {
  opp: SamGovOpportunity;
  expanded: boolean;
  onToggle: () => void;
  onImport: () => void;
  onGenerateResponse: () => void;
  importing: boolean;
  importedSuccess: boolean;
  resolvedDescription?: string;
  descriptionLoading: boolean;
}

function ResultRow({ opp, expanded, onToggle, onImport, onGenerateResponse, importing, importedSuccess, resolvedDescription, descriptionLoading }: ResultRowProps) {
  const deadlineDate = opp.responseDeadLine ? new Date(opp.responseDeadLine) : null;
  const isPastDeadline = deadlineDate ? deadlineDate < new Date() : false;

  return (
    <>
      <tr
        className="hover:bg-slate-800/50 cursor-pointer transition-colors"
        onClick={onToggle}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            {expanded ? <ChevronUp className="w-4 h-4 text-slate-500 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />}
            <span className="text-white font-medium line-clamp-2">{opp.title}</span>
          </div>
        </td>
        <td className="px-4 py-3 text-slate-400 hidden lg:table-cell whitespace-nowrap">
          {opp.solicitationNumber || '--'}
        </td>
        <td className="px-4 py-3 text-slate-400 hidden md:table-cell">
          <span className="line-clamp-1">{opp.department || opp.subTier || '--'}</span>
        </td>
        <td className="px-4 py-3 hidden xl:table-cell">
          <span className="inline-block px-2 py-0.5 bg-slate-800 text-slate-300 text-xs rounded-full">
            {opp.type || opp.baseType || '--'}
          </span>
        </td>
        <td className="px-4 py-3 hidden xl:table-cell">
          {opp.typeOfSetAsideDescription ? (
            <span className="inline-block px-2 py-0.5 bg-cyan-500/10 text-cyan-400 text-xs rounded-full whitespace-nowrap">
              {opp.typeOfSetAsideDescription}
            </span>
          ) : (
            <span className="text-slate-600 text-xs">--</span>
          )}
        </td>
        <td className="px-4 py-3 whitespace-nowrap">
          <span className={isPastDeadline ? 'text-red-400' : 'text-slate-300'}>
            {formatDate(opp.responseDeadLine)}
          </span>
        </td>
        <td className="px-4 py-3 text-slate-400 hidden md:table-cell whitespace-nowrap">
          {formatDate(opp.postedDate)}
        </td>
        <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-end gap-2">
            {opp.uiLink && (
              <a
                href={opp.uiLink}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 text-slate-400 hover:text-cyan-400 transition-colors"
                title="View on SAM.gov"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
            <button
              onClick={onImport}
              disabled={importing || importedSuccess}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                importedSuccess
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-cyan-600 hover:bg-cyan-500 text-white disabled:opacity-50'
              }`}
            >
              {importing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : importedSuccess ? (
                'Imported'
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  Import
                </>
              )}
            </button>
          </div>
        </td>
      </tr>

      {/* Expanded detail row */}
      {expanded && (
        <tr>
          <td colSpan={8} className="px-4 py-4 bg-slate-800/30 border-t border-slate-800">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Description */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Description
                </h4>
                {descriptionLoading ? (
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading description...
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 whitespace-pre-wrap max-h-64 overflow-y-auto">
                    {resolvedDescription || (opp.description?.startsWith('http') ? 'Loading...' : opp.description) || 'No description available.'}
                  </p>
                )}

                {/* Resource Links */}
                {opp.resourceLinks && opp.resourceLinks.length > 0 && (
                  <div>
                    <h5 className="text-xs font-medium text-slate-400 mb-1">Attachments</h5>
                    <div className="flex flex-wrap gap-2">
                      {opp.resourceLinks.map((link, i) => (
                        <a
                          key={i}
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-xs text-cyan-400 transition-colors"
                        >
                          <Download className="w-3 h-3" />
                          Resource {i + 1}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Details sidebar */}
              <div className="space-y-4">
                {/* Classification */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-xs text-slate-500">NAICS Code</span>
                    <p className="text-slate-300">{opp.naicsCode || '--'}</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500">PSC Code</span>
                    <p className="text-slate-300">{opp.classificationCode || '--'}</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500">Notice ID</span>
                    <p className="text-slate-300 text-xs break-all">{opp.noticeId}</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500">Archive Date</span>
                    <p className="text-slate-300">{formatDate(opp.archiveDate)}</p>
                  </div>
                </div>

                {/* Point of Contact */}
                {opp.pointOfContact && opp.pointOfContact.length > 0 && (
                  <div>
                    <h5 className="text-xs font-medium text-slate-400 mb-2">Point of Contact</h5>
                    <div className="space-y-2">
                      {opp.pointOfContact.map((poc, i) => (
                        <div key={i} className="bg-slate-800 rounded-lg p-3 text-sm space-y-1">
                          <p className="text-white font-medium">{poc.fullName}</p>
                          {poc.title && <p className="text-xs text-slate-400">{poc.title}</p>}
                          {poc.email && (
                            <p className="text-slate-400 flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              <a href={`mailto:${poc.email}`} className="text-cyan-400 hover:underline">{poc.email}</a>
                            </p>
                          )}
                          {poc.phone && (
                            <p className="text-slate-400 flex items-center gap-1">
                              <Phone className="w-3 h-3" />{poc.phone}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Place of Performance */}
                {opp.placeOfPerformance && (
                  <div>
                    <h5 className="text-xs font-medium text-slate-400 mb-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      Place of Performance
                    </h5>
                    <p className="text-sm text-slate-300">
                      {[
                        opp.placeOfPerformance.city?.name,
                        opp.placeOfPerformance.state?.code,
                        opp.placeOfPerformance.zip,
                        opp.placeOfPerformance.country?.code !== 'USA' ? opp.placeOfPerformance.country?.code : null,
                      ].filter(Boolean).join(', ') || '--'}
                    </p>
                  </div>
                )}

                {/* Award Info */}
                {opp.award && (
                  <div>
                    <h5 className="text-xs font-medium text-slate-400 mb-1 flex items-center gap-1">
                      <DollarSign className="w-3 h-3" />
                      Award Information
                    </h5>
                    <div className="bg-slate-800 rounded-lg p-3 text-sm space-y-1">
                      {opp.award.amount && <p className="text-emerald-400 font-medium">${Number(opp.award.amount).toLocaleString()}</p>}
                      {opp.award.date && <p className="text-slate-400">Awarded: {formatDate(opp.award.date)}</p>}
                      {opp.award.number && <p className="text-slate-400">Contract #: {opp.award.number}</p>}
                      {opp.award.awardee && (
                        <p className="text-slate-300">
                          {opp.award.awardee.name}
                          {opp.award.awardee.location && (
                            <span className="text-slate-500 ml-1">
                              ({opp.award.awardee.location.city}, {opp.award.awardee.location.state})
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Generate Response Button */}
                <div className="pt-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); onGenerateResponse(); }}
                    disabled={importing}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                  >
                    {importing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <FileSignature className="w-4 h-4" />
                    )}
                    Generate Response
                  </button>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-20">
      <div className="w-20 h-20 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-5">
        <Building2 className="w-10 h-10 text-cyan-400/60" />
      </div>
      <h3 className="text-xl font-semibold text-white mb-2">Search SAM.gov Opportunities</h3>
      <p className="text-sm text-slate-400 max-w-md mx-auto mb-1">
        Find federal government contracts, grants, and solicitations from SAM.gov.
      </p>
      <p className="text-sm text-slate-500 max-w-md mx-auto">
        Enter keywords or use filters above to start searching.
      </p>
    </div>
  );
}

function ResultsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-4 border-b border-slate-800 last:border-b-0">
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-slate-800 rounded w-3/4 animate-pulse" />
              <div className="h-3 bg-slate-800 rounded w-1/2 animate-pulse" />
            </div>
            <div className="hidden md:block h-3 bg-slate-800 rounded w-24 animate-pulse" />
            <div className="h-3 bg-slate-800 rounded w-20 animate-pulse" />
            <div className="h-8 bg-slate-800 rounded w-16 animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
