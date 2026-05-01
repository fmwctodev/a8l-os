import { useEffect, useMemo, useState, useCallback } from 'react';
import { Loader2, Plus, Pencil, Trash2, Database } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  getCustomObjectDefinitions,
  getCustomObjectRecords,
  upsertCustomObjectRecord,
  deleteCustomObjectRecord,
} from '../../services/customObjects';
import type { CustomObjectDefinition, CustomObjectRecord } from '../../types';
import { CustomObjectRecordModal } from '../custom-objects/CustomObjectRecordModal';

export function ContactObjectsTab({ contactId }: { contactId: string }) {
  const { user } = useAuth();
  const [defs, setDefs] = useState<CustomObjectDefinition[]>([]);
  const [recordsByDef, setRecordsByDef] = useState<Record<string, CustomObjectRecord[]>>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<{ def: CustomObjectDefinition; record: CustomObjectRecord | null } | null>(null);

  const load = useCallback(async () => {
    if (!user?.organization_id) return;
    setLoading(true);
    try {
      const ds = await getCustomObjectDefinitions(user.organization_id);
      setDefs(ds);
      const entries = await Promise.all(
        ds.map(async (d) => {
          const recs = await getCustomObjectRecords(user.organization_id!, d.id, { contactId });
          return [d.id, recs] as const;
        })
      );
      const map: Record<string, CustomObjectRecord[]> = {};
      for (const [id, recs] of entries) map[id] = recs;
      setRecordsByDef(map);
    } finally {
      setLoading(false);
    }
  }, [user?.organization_id, contactId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave(values: Record<string, unknown>) {
    if (!editing || !user?.organization_id) return;
    const { def, record } = editing;
    const primaryValue = (values[def.primary_field_key] as string | undefined) ?? null;
    const next = await upsertCustomObjectRecord(user.organization_id, def.id, {
      contactId,
      primaryValue,
      values,
    });
    setRecordsByDef((prev) => {
      const list = prev[def.id] || [];
      const exists = list.some((r) => r.id === next.id);
      return {
        ...prev,
        [def.id]: exists ? list.map((r) => (r.id === next.id ? next : r)) : [next, ...list],
      };
    });
    setEditing(null);
  }

  async function handleDelete(def: CustomObjectDefinition, record: CustomObjectRecord) {
    if (!confirm(`Delete this ${def.name.toLowerCase()} record?`)) return;
    await deleteCustomObjectRecord(record.id);
    setRecordsByDef((prev) => ({
      ...prev,
      [def.id]: (prev[def.id] || []).filter((r) => r.id !== record.id),
    }));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    );
  }

  if (defs.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400">
        <Database className="w-10 h-10 mx-auto mb-3 text-slate-600" />
        <p className="text-sm">No custom objects configured yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {defs.map((def) => {
        const records = recordsByDef[def.id] || [];
        return (
          <div key={def.id} className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-slate-400" />
                <h3 className="text-sm font-medium text-white">{def.name}</h3>
                <span className="text-xs text-slate-500">{records.length}</span>
              </div>
              <button
                onClick={() => setEditing({ def, record: null })}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-cyan-400 hover:bg-cyan-500/10 rounded"
              >
                <Plus className="w-3 h-3" /> Add
              </button>
            </div>
            {records.length === 0 ? (
              <div className="p-4 text-center text-sm text-slate-500">No {def.name.toLowerCase()} records linked to this contact.</div>
            ) : (
              <div>
                {records.map((r) => (
                  <RecordRow key={r.id} def={def} record={r} onEdit={() => setEditing({ def, record: r })} onDelete={() => handleDelete(def, r)} />
                ))}
              </div>
            )}
          </div>
        );
      })}

      {editing && (
        <CustomObjectRecordModal
          def={editing.def}
          record={editing.record}
          onClose={() => setEditing(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

function RecordRow({
  def,
  record,
  onEdit,
  onDelete,
}: {
  def: CustomObjectDefinition;
  record: CustomObjectRecord;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const otherFields = useMemo(
    () => def.field_definitions.filter((f) => f.key !== def.primary_field_key).slice(0, 3),
    [def]
  );

  return (
    <div className="px-4 py-3 border-b border-slate-700/50 last:border-b-0 flex items-start gap-3">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-white">
          {record.primary_value || <span className="text-slate-500 italic">No name</span>}
        </div>
        <div className="mt-1 grid grid-cols-3 gap-3 text-xs text-slate-400">
          {otherFields.map((f) => {
            const v = record.values?.[f.key];
            if (v === undefined || v === null || v === '') return null;
            return (
              <div key={f.key}>
                <span className="text-slate-500">{f.label}:</span>{' '}
                <span className="text-slate-300">{String(v)}</span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button onClick={onEdit} className="p-1 text-slate-400 hover:text-cyan-400 rounded">
          <Pencil className="w-4 h-4" />
        </button>
        <button onClick={onDelete} className="p-1 text-slate-400 hover:text-red-400 rounded">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
