import { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Plus, Loader2, Trash2, Pencil, Search, ArrowLeft, Database, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  getCustomObjectDefinitionBySlug,
  getCustomObjectRecords,
  upsertCustomObjectRecord,
  deleteCustomObjectRecord,
  getCustomObjectDefinitions,
} from '../../services/customObjects';
import type { CustomObjectDefinition, CustomObjectRecord } from '../../types';
import { CustomObjectRecordModal } from '../../components/custom-objects/CustomObjectRecordModal';

export function CustomObjectRecords() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [def, setDef] = useState<CustomObjectDefinition | null>(null);
  const [allDefs, setAllDefs] = useState<CustomObjectDefinition[]>([]);
  const [records, setRecords] = useState<CustomObjectRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<CustomObjectRecord | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!user?.organization_id || !slug) return;
    setLoading(true);
    try {
      const [d, defs] = await Promise.all([
        getCustomObjectDefinitionBySlug(user.organization_id, slug),
        getCustomObjectDefinitions(user.organization_id),
      ]);
      setAllDefs(defs);
      if (!d) {
        setError(`No "${slug}" custom object found`);
        setDef(null);
        setRecords([]);
        return;
      }
      setDef(d);
      const recs = await getCustomObjectRecords(user.organization_id, d.id, {
        search: search || undefined,
      });
      setRecords(recs);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [user?.organization_id, slug, search]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredRecords = useMemo(() => {
    if (!search.trim()) return records;
    const s = search.trim().toLowerCase();
    return records.filter((r) => {
      if (r.primary_value && r.primary_value.toLowerCase().includes(s)) return true;
      return Object.values(r.values || {}).some((v) =>
        v !== null && v !== undefined && String(v).toLowerCase().includes(s)
      );
    });
  }, [records, search]);

  async function handleSave(values: Record<string, unknown>) {
    if (!def || !user?.organization_id) return;
    const primaryValue = (values[def.primary_field_key] as string | undefined) ?? null;

    if (editing) {
      // Update path: keep contact_id, replace values
      const next = await upsertCustomObjectRecord(user.organization_id, def.id, {
        contactId: editing.contact_id || null,
        primaryValue,
        values,
      });
      setRecords((prev) => prev.map((r) => (r.id === next.id ? next : r)));
    } else {
      const next = await upsertCustomObjectRecord(user.organization_id, def.id, {
        contactId: null,
        primaryValue,
        values,
      });
      setRecords((prev) => [next, ...prev]);
    }
    setEditing(null);
    setShowCreate(false);
  }

  async function handleDelete(record: CustomObjectRecord) {
    if (!confirm(`Delete this ${def?.name || 'record'}?`)) return;
    try {
      await deleteCustomObjectRecord(record.id);
      setRecords((prev) => prev.filter((r) => r.id !== record.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete record');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!def) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800">Custom object not found</p>
            <p className="text-sm text-red-700 mt-1">
              Configure a custom object at <Link to="/settings/custom-objects" className="underline">Settings → Custom Objects</Link>.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <button
            onClick={() => navigate('/contacts')}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-2"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-gray-700" />
            <h1 className="text-2xl font-semibold text-gray-900">{def.name}</h1>
            <span className="text-sm text-gray-400">{filteredRecords.length} record{filteredRecords.length === 1 ? '' : 's'}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {allDefs.length > 1 && (
            <select
              value={def.slug}
              onChange={(e) => navigate(`/custom-objects/${e.target.value}`)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {allDefs.map((d) => (
                <option key={d.id} value={d.slug}>{d.name}</option>
              ))}
            </select>
          )}
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
          >
            <Plus className="w-4 h-4" /> New {def.name}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mb-4 relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Search ${def.name.toLowerCase()} records...`}
          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {filteredRecords.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Database className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p className="text-sm">No {def.name.toLowerCase()} records yet.</p>
            <button
              onClick={() => setShowCreate(true)}
              className="mt-3 inline-flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded"
            >
              <Plus className="w-4 h-4" /> Create the first one
            </button>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {def.field_definitions.find((f) => f.key === def.primary_field_key)?.label || 'Name'}
                </th>
                {def.field_definitions
                  .filter((f) => f.key !== def.primary_field_key)
                  .slice(0, 4)
                  .map((f) => (
                    <th key={f.key} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {f.label}
                    </th>
                  ))}
                <th className="px-4 py-2 w-24" />
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((r) => (
                <tr key={r.id} className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {r.primary_value || <span className="text-gray-400 italic">(no value)</span>}
                  </td>
                  {def.field_definitions
                    .filter((f) => f.key !== def.primary_field_key)
                    .slice(0, 4)
                    .map((f) => (
                      <td key={f.key} className="px-4 py-3 text-sm text-gray-700">
                        {formatCell(r.values?.[f.key], f.type)}
                      </td>
                    ))}
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        onClick={() => setEditing(r)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(r)}
                        className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {(showCreate || editing) && (
        <CustomObjectRecordModal
          def={def}
          record={editing}
          onClose={() => {
            setShowCreate(false);
            setEditing(null);
          }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

function formatCell(value: unknown, type: string): string {
  if (value === null || value === undefined || value === '') return '—';
  if (type === 'boolean') return value ? 'Yes' : 'No';
  if (type === 'currency') {
    const n = Number(value);
    if (!isNaN(n)) return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(n);
  }
  return String(value);
}
