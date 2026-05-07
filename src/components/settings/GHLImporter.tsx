import { useState, useRef } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Eye,
  EyeOff,
  Loader2,
  Play,
  Square,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { callEdgeFunction } from '../../lib/edgeFunction';

interface ImportProgress {
  contacts_processed: number;
  notes_processed: number;
  custom_field_values_processed: number;
  opportunities_processed: number;
  appointments_processed: number;
  errors: string[];
  contact_id_map?: Record<string, string>;
  custom_field_map?: Record<string, string>;
  pipeline_map?: Record<string, { pipeline_id: string; stages: Record<string, string> }>;
}

type Phase = 'contacts' | 'opportunities' | 'appointments' | 'done';

const newProgress = (): ImportProgress => ({
  contacts_processed: 0,
  notes_processed: 0,
  custom_field_values_processed: 0,
  opportunities_processed: 0,
  appointments_processed: 0,
  errors: [],
  contact_id_map: {},
  custom_field_map: {},
  pipeline_map: {},
});

export function GHLImporter() {
  const { user } = useAuth();
  const [token, setToken] = useState('');
  const [locationId, setLocationId] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [running, setRunning] = useState(false);
  const [stopRequested, setStopRequested] = useState(false);
  const [phase, setPhase] = useState<Phase>('contacts');
  const [chunkCount, setChunkCount] = useState(0);
  const [progress, setProgress] = useState<ImportProgress>(newProgress());
  const [error, setError] = useState<string | null>(null);
  const [completedAt, setCompletedAt] = useState<string | null>(null);
  const stopRef = useRef(false);

  const activeOrgId = user?.organization?.id ?? user?.organization_id ?? null;
  const importerUserId = user?.id;

  const runImport = async () => {
    if (!token || !locationId || !activeOrgId || !importerUserId) {
      setError('Missing token, location ID, or user context.');
      return;
    }
    if (!confirm(
      `Import contacts/opportunities/notes from GHL location ${locationId}\ninto the org currently active in your session?\n\nThis writes to ${user?.organization?.display_name || 'this org'}'s contacts table.`
    )) return;

    setError(null);
    setProgress(newProgress());
    setPhase('contacts');
    setChunkCount(0);
    setCompletedAt(null);
    setStopRequested(false);
    stopRef.current = false;
    setRunning(true);

    let cursor: string | null = null;
    let currentPhase: Phase = 'contacts';
    let runningProgress: ImportProgress = newProgress();

    try {
      while (currentPhase !== 'done') {
        if (stopRef.current) {
          setError('Stopped by user. Re-run to continue (idempotent — no duplicates).');
          break;
        }

        const response = await callEdgeFunction('ghl-import', {
          action: 'import',
          ghl_token: token,
          ghl_location_id: locationId,
          importer_user_id: importerUserId,
          target_org_id: activeOrgId,
          cursor,
          phase: currentPhase,
          progress: runningProgress,
        });

        const data = await response.json();
        if (!response.ok) {
          setError(data.error || `Import error (${response.status})`);
          break;
        }

        runningProgress = data.progress as ImportProgress;
        cursor = data.cursor as string | null;
        currentPhase = data.phase as Phase;

        setProgress({ ...runningProgress });
        setPhase(currentPhase);
        setChunkCount((c) => c + 1);

        if (data.done) {
          setCompletedAt(new Date().toISOString());
          break;
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  };

  const handleStop = () => {
    stopRef.current = true;
    setStopRequested(true);
  };

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-5">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30">
          <Database className="w-5 h-5 text-amber-400" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-white">
            GoHighLevel Import
          </h3>
          <p className="text-sm text-slate-400 mt-1">
            One-time migration of contacts, notes, custom field values, and opportunities
            from a GHL sub-account into <span className="text-cyan-400 font-medium">
            {user?.organization?.display_name || 'the active org'}</span>. Idempotent — re-runs skip already-imported records.
          </p>
        </div>
      </div>

      {!completedAt && !running && (
        <div className="space-y-3">
          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-500 mb-1.5">
              GHL Private Integration Token
            </label>
            <div className="relative">
              <input
                type={showToken ? 'text' : 'password'}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="pit-..."
                className="w-full px-3 py-2 pr-10 rounded-lg bg-slate-900 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
              <button
                type="button"
                onClick={() => setShowToken((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Create at GHL → Settings → Private Integrations. Required scopes:
              contacts.readonly, contacts.write, opportunities.readonly,
              opportunities.write, locations.readonly.
            </p>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-500 mb-1.5">
              GHL Location ID
            </label>
            <input
              type="text"
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              placeholder="kQDg8MpJNq5fdGy5CSnf"
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {(running || progress.contacts_processed > 0 || completedAt) && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              {running ? (
                <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
              ) : completedAt ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : null}
              <span className="text-white font-medium">
                {completedAt ? 'Import complete' : `Phase: ${phase} (chunk #${chunkCount})`}
              </span>
            </div>
            {stopRequested && <span className="text-amber-400 text-xs">stopping...</span>}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
            <Stat label="Contacts" value={progress.contacts_processed} />
            <Stat label="Notes" value={progress.notes_processed} />
            <Stat label="Custom fields" value={progress.custom_field_values_processed} />
            <Stat label="Opportunities" value={progress.opportunities_processed} />
            <Stat label="Appointments" value={progress.appointments_processed} />
          </div>

          {progress.errors.length > 0 && (
            <details className="text-xs text-amber-300 bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">
              <summary className="cursor-pointer font-medium">
                {progress.errors.length} warning{progress.errors.length === 1 ? '' : 's'} (click to expand)
              </summary>
              <ul className="mt-2 list-disc list-inside space-y-0.5 max-h-48 overflow-y-auto opacity-90">
                {progress.errors.slice(0, 50).map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
                {progress.errors.length > 50 && (
                  <li className="opacity-60">... +{progress.errors.length - 50} more (truncated)</li>
                )}
              </ul>
            </details>
          )}
        </div>
      )}

      <div className="flex gap-2">
        {!running ? (
          <button
            onClick={runImport}
            disabled={!token || !locationId}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-600 text-white font-medium text-sm disabled:opacity-50"
          >
            <Play className="w-4 h-4" />
            {completedAt ? 'Run again' : 'Start import'}
          </button>
        ) : (
          <button
            onClick={handleStop}
            disabled={stopRequested}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 text-sm font-medium disabled:opacity-50"
          >
            <Square className="w-4 h-4" />
            Stop
          </button>
        )}

        {!running && completedAt && (
          <button
            onClick={() => {
              setCompletedAt(null);
              setProgress(newProgress());
              setPhase('contacts');
              setChunkCount(0);
            }}
            className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm"
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-3">
      <p className="text-xs text-slate-500 uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-bold text-white mt-0.5">{value.toLocaleString()}</p>
    </div>
  );
}
