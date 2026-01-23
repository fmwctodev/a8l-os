import { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  Zap,
  Pencil,
  Trash2,
  Copy,
  ToggleLeft,
  ToggleRight,
  MessageSquare,
  Inbox,
  RefreshCw,
  Clock,
  Phone,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import {
  getConversationRules,
  deleteConversationRule,
  toggleRuleStatus,
  duplicateRule,
  getTriggerTypeLabel,
  getActionTypeLabel,
} from '../../../services/conversationRules';
import { ConversationRuleBuilder } from './ConversationRuleBuilder';
import type { ConversationRule, RuleTriggerType } from '../../../types';

export function RulesSettingsTab() {
  const { user } = useAuth();
  const [rules, setRules] = useState<ConversationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [triggerFilter, setTriggerFilter] = useState<RuleTriggerType | ''>('');
  const [editingRule, setEditingRule] = useState<ConversationRule | null>(null);
  const [showBuilder, setShowBuilder] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    loadRules();
  }, [user]);

  async function loadRules() {
    if (!user) return;
    try {
      setLoading(true);
      const data = await getConversationRules(user.organization_id);
      setRules(data);
    } catch (error) {
      console.error('Failed to load rules:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredRules = rules.filter((r) => {
    if (triggerFilter && r.trigger_type !== triggerFilter) return false;
    if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleToggleStatus = async (rule: ConversationRule) => {
    try {
      const updated = await toggleRuleStatus(rule.id, !rule.is_enabled);
      setRules(rules.map((r) => (r.id === updated.id ? updated : r)));
    } catch (error) {
      console.error('Failed to toggle status:', error);
    }
  };

  const handleDuplicate = async (rule: ConversationRule) => {
    try {
      const duplicated = await duplicateRule(rule.id);
      setRules([...rules, duplicated]);
    } catch (error) {
      console.error('Failed to duplicate rule:', error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteConversationRule(id);
      setRules(rules.filter((r) => r.id !== id));
      setDeleteConfirm(null);
    } catch (error) {
      console.error('Failed to delete rule:', error);
    }
  };

  const handleSave = (rule: ConversationRule) => {
    if (editingRule) {
      setRules(rules.map((r) => (r.id === rule.id ? rule : r)));
    } else {
      setRules([...rules, rule]);
    }
    setShowBuilder(false);
    setEditingRule(null);
  };

  const getTriggerIcon = (type: RuleTriggerType) => {
    switch (type) {
      case 'incoming_message':
        return MessageSquare;
      case 'new_conversation':
        return Inbox;
      case 'conversation_reopened':
        return RefreshCw;
      case 'no_reply_timeout':
        return Clock;
      case 'channel_message':
        return Phone;
      default:
        return Zap;
    }
  };

  const formatLastTriggered = (date: string | null) => {
    if (!date) return 'Never';
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-white">Conversation Rules</h2>
          <p className="text-sm text-slate-400 mt-1">
            Automate conversation handling with triggers and actions
          </p>
        </div>
        <button
          onClick={() => {
            setEditingRule(null);
            setShowBuilder(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-teal-600 text-white rounded-lg hover:from-cyan-600 hover:to-teal-700 transition-colors"
        >
          <Plus size={18} />
          Create Rule
        </button>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search rules..."
            className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
        </div>
        <select
          value={triggerFilter}
          onChange={(e) => setTriggerFilter(e.target.value as RuleTriggerType | '')}
          className="px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
        >
          <option value="">All Triggers</option>
          <option value="incoming_message">Incoming Message</option>
          <option value="new_conversation">New Conversation</option>
          <option value="conversation_reopened">Conversation Reopened</option>
          <option value="no_reply_timeout">No Reply Timeout</option>
          <option value="channel_message">Channel Message</option>
        </select>
      </div>

      {filteredRules.length === 0 ? (
        <div className="text-center py-12 bg-slate-900 rounded-lg border border-slate-700">
          <Zap size={48} className="mx-auto text-slate-600 mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">
            {search || triggerFilter ? 'No matching rules' : 'No rules yet'}
          </h3>
          <p className="text-slate-400 mb-4">
            {search || triggerFilter
              ? 'Try adjusting your filters'
              : 'Create your first rule to automate conversation handling'}
          </p>
          {!search && !triggerFilter && (
            <button
              onClick={() => {
                setEditingRule(null);
                setShowBuilder(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 transition-colors"
            >
              <Plus size={18} />
              Create Rule
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRules.map((rule) => {
            const TriggerIcon = getTriggerIcon(rule.trigger_type);
            return (
              <div
                key={rule.id}
                className="bg-slate-900 rounded-lg border border-slate-700 p-4 hover:border-slate-600 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div className={`p-2 rounded-lg ${rule.is_enabled ? 'bg-cyan-500/10' : 'bg-slate-800'}`}>
                      <TriggerIcon size={20} className={rule.is_enabled ? 'text-cyan-400' : 'text-slate-500'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className={`font-medium ${rule.is_enabled ? 'text-white' : 'text-slate-400'}`}>
                          {rule.name}
                        </h3>
                        <span className="px-2 py-0.5 text-xs bg-slate-700 text-slate-300 rounded">
                          Priority: {rule.priority}
                        </span>
                      </div>
                      <p className="text-sm text-slate-400 mt-1">{getTriggerTypeLabel(rule.trigger_type)}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                        <span>
                          {rule.conditions.length} condition{rule.conditions.length !== 1 ? 's' : ''}
                        </span>
                        <ChevronRight size={12} />
                        <span>
                          {rule.actions.length} action{rule.actions.length !== 1 ? 's' : ''}:{' '}
                          {rule.actions.map((a) => getActionTypeLabel(a.action_type)).join(', ')}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="text-right mr-4">
                      <div className="text-xs text-slate-500">Last triggered</div>
                      <div className="text-sm text-slate-400">{formatLastTriggered(rule.last_triggered_at)}</div>
                    </div>

                    <button
                      onClick={() => handleToggleStatus(rule)}
                      className="mr-2"
                      title={rule.is_enabled ? 'Disable rule' : 'Enable rule'}
                    >
                      {rule.is_enabled ? (
                        <ToggleRight size={28} className="text-green-500" />
                      ) : (
                        <ToggleLeft size={28} className="text-slate-500" />
                      )}
                    </button>

                    <button
                      onClick={() => {
                        setEditingRule(rule);
                        setShowBuilder(true);
                      }}
                      className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                      title="Edit rule"
                    >
                      <Pencil size={16} />
                    </button>

                    <button
                      onClick={() => handleDuplicate(rule)}
                      className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                      title="Duplicate rule"
                    >
                      <Copy size={16} />
                    </button>

                    <button
                      onClick={() => setDeleteConfirm(rule.id)}
                      className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-lg transition-colors"
                      title="Delete rule"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showBuilder && (
        <ConversationRuleBuilder
          rule={editingRule}
          onClose={() => {
            setShowBuilder(false);
            setEditingRule(null);
          }}
          onSave={handleSave}
        />
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDeleteConfirm(null)} />
          <div className="relative bg-slate-800 rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-semibold text-white mb-2">Delete Rule</h3>
            <p className="text-slate-400 mb-6">
              Are you sure you want to delete this rule? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-slate-300 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
