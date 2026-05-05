import { useEffect, useState } from 'react';
import { Shield, Clock, Mail, Users } from 'lucide-react';
import type { ActionNodeData } from '../../../../types';
import { useAuth } from '../../../../contexts/AuthContext';
import { supabase } from '../../../../lib/supabase';

interface Props {
  data: ActionNodeData;
  onUpdate: (u: Partial<ActionNodeData>) => void;
}

interface UserOption {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
}

/**
 * ManualActionConfig — configures a `manual_action` node which pauses the
 * workflow and creates a row in workflow_approval_queue. P7 expands this
 * into a full approval gate:
 *
 *   - Approver routing (contact owner | specific user(s) | role | round robin)
 *   - Multi-approver mode (any one | all of N | majority)
 *   - Auto-expire TTL with branch fallback (approve | reject | escalate)
 *   - Magic-link approve-from-email toggle
 *   - In-app + email notification preferences
 */
export default function ManualActionConfig({ data, onUpdate }: Props) {
  const cfg = (data.config as Record<string, any>) ?? {};
  const set = (key: string, val: unknown) => onUpdate({ config: { ...cfg, [key]: val } });
  const { user } = useAuth();
  const orgId = user?.organization_id ?? null;

  const [orgUsers, setOrgUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!orgId) return;
    setLoading(true);
    supabase
      .from('users')
      .select('id, full_name, email, role')
      .eq('organization_id', orgId)
      .order('full_name')
      .then(({ data: rows, error }) => {
        if (!error && rows) setOrgUsers(rows as UserOption[]);
        setLoading(false);
      });
  }, [orgId]);

  const approverType = cfg.approverType ?? cfg.assigneeType ?? 'contact_owner';
  const approvalMode = cfg.approvalMode ?? 'any_one';
  const approverUserIds: string[] = Array.isArray(cfg.approverUserIds) ? cfg.approverUserIds : [];
  const expiresInHours = cfg.expiresInHours ?? 72; // 3 days default
  const expirationBranch = cfg.expirationBranch ?? 'reject';
  const enableMagicLink = cfg.enableMagicLink ?? true;
  const enableEmailNotify = cfg.enableEmailNotify ?? true;

  function toggleUserId(id: string) {
    const next = approverUserIds.includes(id)
      ? approverUserIds.filter((u) => u !== id)
      : [...approverUserIds, id];
    set('approverUserIds', next);
  }

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
        <Shield className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-800">
          Pauses the workflow and creates an approval queue item. Configure who decides,
          how many approvals are required, and what happens if no one responds in time.
        </p>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Approval title</label>
        <input
          type="text"
          value={cfg.title ?? ''}
          onChange={e => set('title', e.target.value)}
          placeholder="e.g. Approve $50K proposal for {{contact.company_name}}"
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Description / instructions</label>
        <textarea
          value={cfg.description ?? cfg.instructionText ?? ''}
          onChange={e => set('description', e.target.value)}
          rows={3}
          placeholder="Describe what the approver should review and decide..."
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1">
          <Users className="w-3.5 h-3.5" />
          Who approves?
        </label>
        <select
          value={approverType}
          onChange={e => set('approverType', e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        >
          <option value="contact_owner">Contact owner</option>
          <option value="specific_users">Specific user(s)</option>
          <option value="role">By role</option>
          <option value="round_robin">Round robin</option>
        </select>
      </div>

      {approverType === 'specific_users' && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-2">Pick approvers</label>
          <div className="border border-gray-200 rounded-lg max-h-48 overflow-y-auto divide-y divide-gray-100">
            {loading && <div className="p-3 text-xs text-gray-500">Loading users…</div>}
            {!loading && orgUsers.length === 0 && (
              <div className="p-3 text-xs text-gray-500">No users found in organization.</div>
            )}
            {orgUsers.map((u) => (
              <label key={u.id} className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={approverUserIds.includes(u.id)}
                  onChange={() => toggleUserId(u.id)}
                  className="rounded border-gray-300"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-gray-900 truncate">{u.full_name ?? u.email ?? u.id}</div>
                  <div className="text-xs text-gray-500 truncate">{u.email ?? ''}</div>
                </div>
                {u.role && <span className="text-xs text-gray-400">{u.role}</span>}
              </label>
            ))}
          </div>
        </div>
      )}

      {approverType === 'role' && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Required role</label>
          <select
            value={cfg.approverRole ?? 'admin'}
            onChange={e => set('approverRole', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="owner">Owner</option>
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
            <option value="member">Member</option>
          </select>
        </div>
      )}

      {approverType === 'specific_users' && approverUserIds.length > 1 && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Approval mode</label>
          <select
            value={approvalMode}
            onChange={e => set('approvalMode', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="any_one">Any 1 of {approverUserIds.length} approves</option>
            <option value="all_of">All {approverUserIds.length} must approve</option>
            <option value="majority">Majority approves</option>
          </select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            Auto-expire (hours)
          </label>
          <input
            type="number"
            min={1}
            max={720}
            value={expiresInHours}
            onChange={e => set('expiresInHours', parseInt(e.target.value, 10) || 72)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">If expired, default to</label>
          <select
            value={expirationBranch}
            onChange={e => set('expirationBranch', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="reject">Reject (safe default)</option>
            <option value="approve">Auto-approve</option>
            <option value="escalate">Escalate</option>
          </select>
        </div>
      </div>

      <div className="border-t border-gray-200 pt-3 space-y-2">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={enableMagicLink}
            onChange={e => set('enableMagicLink', e.target.checked)}
            className="rounded border-gray-300"
          />
          <Mail className="w-3.5 h-3.5 text-gray-500" />
          <span className="text-gray-700 text-xs">Allow approve-from-email (one-click magic link)</span>
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={enableEmailNotify}
            onChange={e => set('enableEmailNotify', e.target.checked)}
            className="rounded border-gray-300"
          />
          <Mail className="w-3.5 h-3.5 text-gray-500" />
          <span className="text-gray-700 text-xs">Email approver(s) on creation + 24h reminders</span>
        </label>
      </div>
    </div>
  );
}
