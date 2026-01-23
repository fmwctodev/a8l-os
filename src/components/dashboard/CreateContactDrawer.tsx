import { useState, useEffect } from 'react';
import { Drawer } from '../layouts/Drawer';
import { useAuth } from '../../contexts/AuthContext';
import { createContact, type CreateContactData } from '../../services/contacts';
import { supabase } from '../../lib/supabase';
import { logActivity } from '../../services/activityLog';

interface CreateContactDrawerProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface Department {
  id: string;
  name: string;
}

export function CreateContactDrawer({ open, onClose, onSuccess }: CreateContactDrawerProps) {
  const { user } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<CreateContactData>({
    department_id: '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    company: '',
    source: 'manual',
  });

  useEffect(() => {
    if (open && user?.organization_id) {
      fetchDepartments();
    }
  }, [open, user?.organization_id]);

  async function fetchDepartments() {
    const { data } = await supabase
      .from('departments')
      .select('id, name')
      .eq('organization_id', user?.organization_id)
      .eq('status', 'active')
      .order('name');
    if (data) {
      setDepartments(data);
      if (data.length > 0 && !formData.department_id) {
        setFormData((prev) => ({ ...prev, department_id: data[0].id }));
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !user.organization_id) return;

    setLoading(true);
    setError(null);

    try {
      const contact = await createContact(user.organization_id, formData, user);

      await logActivity({
        organizationId: user.organization_id,
        userId: user.id,
        eventType: 'contact_created',
        entityType: 'contact',
        entityId: contact.id,
        contactId: contact.id,
        summary: `Created contact ${formData.first_name} ${formData.last_name}`.trim(),
        payload: { source: formData.source },
      });

      setFormData({
        department_id: departments[0]?.id || '',
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        company: '',
        source: 'manual',
      });
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create contact');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Add Contact"
      subtitle="Create a new contact record"
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
            disabled={loading || !formData.first_name || !formData.department_id}
            className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Creating...' : 'Create Contact'}
          </button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              First Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={formData.first_name}
              onChange={(e) => setFormData((prev) => ({ ...prev, first_name: e.target.value }))}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
              placeholder="John"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Last Name</label>
            <input
              type="text"
              value={formData.last_name || ''}
              onChange={(e) => setFormData((prev) => ({ ...prev, last_name: e.target.value }))}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
              placeholder="Doe"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
          <input
            type="email"
            value={formData.email || ''}
            onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
            placeholder="john@example.com"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Phone</label>
          <input
            type="tel"
            value={formData.phone || ''}
            onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
            placeholder="+1 (555) 123-4567"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Company</label>
          <input
            type="text"
            value={formData.company || ''}
            onChange={(e) => setFormData((prev) => ({ ...prev, company: e.target.value }))}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
            placeholder="Acme Inc."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Department <span className="text-red-400">*</span>
          </label>
          <select
            value={formData.department_id}
            onChange={(e) => setFormData((prev) => ({ ...prev, department_id: e.target.value }))}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
          >
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name}
              </option>
            ))}
          </select>
        </div>
      </form>
    </Drawer>
  );
}
