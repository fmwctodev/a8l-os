import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { Drawer } from '../layouts/Drawer';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { createOpportunity } from '../../services/opportunities';
import { logActivity } from '../../services/activityLog';

interface CreateOpportunityDrawerProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
}

interface Pipeline {
  id: string;
  name: string;
  stages: { id: string; name: string; sort_order: number }[];
}

interface User {
  id: string;
  name: string;
}

export function CreateOpportunityDrawer({ open, onClose, onSuccess }: CreateOpportunityDrawerProps) {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedPipeline, setSelectedPipeline] = useState<string>('');
  const [selectedStage, setSelectedStage] = useState<string>('');
  const [assignedTo, setAssignedTo] = useState<string>('');
  const [value, setValue] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && user?.organization_id) {
      fetchPipelines();
      fetchUsers();
    }
  }, [open, user?.organization_id]);

  useEffect(() => {
    if (!open) {
      setSearchQuery('');
      setContacts([]);
      setSelectedContact(null);
      setSelectedPipeline('');
      setSelectedStage('');
      setAssignedTo('');
      setValue('');
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.length >= 2 && user?.organization_id) {
        searchContacts();
      } else {
        setContacts([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, user?.organization_id]);

  useEffect(() => {
    if (selectedPipeline) {
      const pipeline = pipelines.find((p) => p.id === selectedPipeline);
      if (pipeline && pipeline.stages.length > 0) {
        const sortedStages = [...pipeline.stages].sort((a, b) => a.sort_order - b.sort_order);
        setSelectedStage(sortedStages[0].id);
      }
    }
  }, [selectedPipeline, pipelines]);

  async function fetchPipelines() {
    const { data } = await supabase
      .from('pipelines')
      .select('id, name, stages:pipeline_stages(id, name, sort_order)')
      .eq('organization_id', user?.organization_id)
      .eq('is_active', true)
      .order('name');

    if (data) {
      setPipelines(data);
      if (data.length > 0) {
        setSelectedPipeline(data[0].id);
      }
    }
  }

  async function fetchUsers() {
    const { data } = await supabase
      .from('users')
      .select('id, name')
      .eq('organization_id', user?.organization_id)
      .eq('status', 'active')
      .order('name');

    if (data) {
      setUsers(data);
      if (user) {
        setAssignedTo(user.id);
      }
    }
  }

  async function searchContacts() {
    setSearching(true);
    const { data } = await supabase
      .from('contacts')
      .select('id, first_name, last_name, email')
      .eq('organization_id', user?.organization_id)
      .eq('status', 'active')
      .or(
        `first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`
      )
      .limit(10);

    setContacts(data || []);
    setSearching(false);
  }

  async function handleSubmit() {
    if (!user || !user.organization_id || !selectedContact || !selectedPipeline || !selectedStage)
      return;

    setLoading(true);
    setError(null);

    try {
      const opportunity = await createOpportunity({
        org_id: user.organization_id,
        contact_id: selectedContact.id,
        pipeline_id: selectedPipeline,
        stage_id: selectedStage,
        assigned_user_id: assignedTo || null,
        value_amount: value ? parseFloat(value) : 0,
        created_by: user.id,
      });

      await logActivity({
        organizationId: user.organization_id,
        userId: user.id,
        eventType: 'opportunity_created',
        entityType: 'opportunity',
        entityId: opportunity.id,
        contactId: selectedContact.id,
        summary: `Created opportunity for ${selectedContact.first_name} ${selectedContact.last_name}`.trim(),
        payload: { value: value ? parseFloat(value) : 0, pipeline_id: selectedPipeline },
      });

      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create opportunity');
    } finally {
      setLoading(false);
    }
  }

  const currentPipeline = pipelines.find((p) => p.id === selectedPipeline);
  const stages = currentPipeline?.stages?.sort((a, b) => a.sort_order - b.sort_order) || [];

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Create Opportunity"
      subtitle="Add a new sales opportunity"
      footer={
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !selectedContact || !selectedPipeline || !selectedStage}
            className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Creating...' : 'Create Opportunity'}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Contact <span className="text-red-400">*</span>
          </label>
          {selectedContact ? (
            <div className="flex items-center justify-between p-3 bg-slate-800 border border-slate-700 rounded-lg">
              <div>
                <p className="text-sm font-medium text-white">
                  {selectedContact.first_name} {selectedContact.last_name}
                </p>
                <p className="text-xs text-slate-400">{selectedContact.email || 'No email'}</p>
              </div>
              <button
                onClick={() => setSelectedContact(null)}
                className="text-xs text-cyan-400 hover:text-cyan-300"
              >
                Change
              </button>
            </div>
          ) : (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search contacts..."
                className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
              />
              {(contacts.length > 0 || searching) && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-10 max-h-48 overflow-y-auto">
                  {searching ? (
                    <div className="p-3 text-sm text-slate-400">Searching...</div>
                  ) : (
                    contacts.map((contact) => (
                      <button
                        key={contact.id}
                        onClick={() => {
                          setSelectedContact(contact);
                          setSearchQuery('');
                          setContacts([]);
                        }}
                        className="w-full p-3 text-left hover:bg-slate-700 transition-colors"
                      >
                        <p className="text-sm font-medium text-white">
                          {contact.first_name} {contact.last_name}
                        </p>
                        <p className="text-xs text-slate-400">{contact.email || 'No email'}</p>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Pipeline <span className="text-red-400">*</span>
          </label>
          <select
            value={selectedPipeline}
            onChange={(e) => setSelectedPipeline(e.target.value)}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
          >
            {pipelines.map((pipeline) => (
              <option key={pipeline.id} value={pipeline.id}>
                {pipeline.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Stage <span className="text-red-400">*</span>
          </label>
          <select
            value={selectedStage}
            onChange={(e) => setSelectedStage(e.target.value)}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
          >
            {stages.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {stage.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Value ($)</label>
          <input
            type="number"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="0.00"
            min="0"
            step="0.01"
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Assigned To</label>
          <select
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
          >
            <option value="">Unassigned</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </Drawer>
  );
}
