import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { createContact, updateContact, type CreateContactData } from '../../services/contacts';
import { addTagToContact, removeTagFromContact, createTag, getRandomTagColor } from '../../services/tags';
import type { Contact, Tag, Department, User } from '../../types';
import { X, Loader2, Plus } from 'lucide-react';

interface ContactModalProps {
  contact?: Contact;
  departments: Department[];
  users: User[];
  tags: Tag[];
  onClose: () => void;
  onSuccess: () => void;
}

export function ContactModal({
  contact,
  departments,
  users,
  tags,
  onClose,
  onSuccess,
}: ContactModalProps) {
  const { user: currentUser, isSuperAdmin } = useAuth();
  const isEditing = !!contact;

  const [formData, setFormData] = useState<CreateContactData>({
    department_id: contact?.department_id || currentUser?.department_id || departments[0]?.id || '',
    owner_id: contact?.owner_id || null,
    first_name: contact?.first_name || '',
    last_name: contact?.last_name || '',
    email: contact?.email || null,
    phone: contact?.phone || null,
    company: contact?.company || null,
    job_title: contact?.job_title || null,
    address_line1: contact?.address_line1 || null,
    address_line2: contact?.address_line2 || null,
    city: contact?.city || null,
    state: contact?.state || null,
    postal_code: contact?.postal_code || null,
    country: contact?.country || null,
    source: contact?.source || 'manual',
  });

  const [selectedTags, setSelectedTags] = useState<string[]>(
    contact?.tags?.map((t) => t.id) || []
  );
  const [newTagName, setNewTagName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = isSuperAdmin || currentUser?.role?.hierarchy_level === 2;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    if (!formData.first_name.trim()) {
      setError('First name is required');
      return;
    }

    if (!formData.department_id) {
      setError('Department is required');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      let savedContact: Contact;

      if (isEditing && contact) {
        savedContact = await updateContact(contact.id, formData, currentUser);

        const currentTagIds = contact.tags?.map((t) => t.id) || [];
        const tagsToAdd = selectedTags.filter((id) => !currentTagIds.includes(id));
        const tagsToRemove = currentTagIds.filter((id) => !selectedTags.includes(id));

        for (const tagId of tagsToAdd) {
          await addTagToContact(contact.id, tagId, currentUser);
        }
        for (const tagId of tagsToRemove) {
          await removeTagFromContact(contact.id, tagId, currentUser);
        }
      } else {
        savedContact = await createContact(currentUser.organization_id, formData, currentUser);

        for (const tagId of selectedTags) {
          await addTagToContact(savedContact.id, tagId, currentUser);
        }
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save contact');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateTag = async () => {
    if (!currentUser || !newTagName.trim()) return;

    try {
      const tag = await createTag(
        currentUser.organization_id,
        newTagName.trim(),
        getRandomTagColor(),
        currentUser
      );
      setSelectedTags([...selectedTags, tag.id]);
      setNewTagName('');
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create tag');
    }
  };

  const toggleTag = (tagId: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const updateField = (field: keyof CreateContactData, value: string | null) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-900 rounded-xl border border-slate-800 shadow-xl">
        <div className="sticky top-0 flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900">
          <h2 className="text-lg font-semibold text-white">
            {isEditing ? 'Edit Contact' : 'Add Contact'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-6">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                First Name *
              </label>
              <input
                type="text"
                value={formData.first_name}
                onChange={(e) => updateField('first_name', e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Last Name
              </label>
              <input
                type="text"
                value={formData.last_name || ''}
                onChange={(e) => updateField('last_name', e.target.value || null)}
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
              <input
                type="email"
                value={formData.email || ''}
                onChange={(e) => updateField('email', e.target.value || null)}
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Phone</label>
              <input
                type="tel"
                value={formData.phone || ''}
                onChange={(e) => updateField('phone', e.target.value || null)}
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Company</label>
              <input
                type="text"
                value={formData.company || ''}
                onChange={(e) => updateField('company', e.target.value || null)}
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Job Title</label>
              <input
                type="text"
                value={formData.job_title || ''}
                onChange={(e) => updateField('job_title', e.target.value || null)}
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Address Line 1
            </label>
            <input
              type="text"
              value={formData.address_line1 || ''}
              onChange={(e) => updateField('address_line1', e.target.value || null)}
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Address Line 2
            </label>
            <input
              type="text"
              value={formData.address_line2 || ''}
              onChange={(e) => updateField('address_line2', e.target.value || null)}
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">City</label>
              <input
                type="text"
                value={formData.city || ''}
                onChange={(e) => updateField('city', e.target.value || null)}
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">State</label>
              <input
                type="text"
                value={formData.state || ''}
                onChange={(e) => updateField('state', e.target.value || null)}
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Postal Code
              </label>
              <input
                type="text"
                value={formData.postal_code || ''}
                onChange={(e) => updateField('postal_code', e.target.value || null)}
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Country</label>
              <input
                type="text"
                value={formData.country || ''}
                onChange={(e) => updateField('country', e.target.value || null)}
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {isAdmin && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Department *
                </label>
                <select
                  value={formData.department_id}
                  onChange={(e) => updateField('department_id', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  required
                >
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Owner</label>
              <select
                value={formData.owner_id || ''}
                onChange={(e) => updateField('owner_id', e.target.value || null)}
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              >
                <option value="">Unassigned</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Source</label>
              <select
                value={formData.source || 'manual'}
                onChange={(e) => updateField('source', e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              >
                <option value="manual">Manual Entry</option>
                <option value="import">Import</option>
                <option value="website">Website</option>
                <option value="referral">Referral</option>
                <option value="social">Social Media</option>
                <option value="advertisement">Advertisement</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Tags</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {tags.map((tag) => {
                const isSelected = selectedTags.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.id)}
                    className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                      isSelected ? 'ring-2 ring-offset-1 ring-offset-slate-900' : 'opacity-60 hover:opacity-100'
                    }`}
                    style={{
                      backgroundColor: `${tag.color}20`,
                      color: tag.color,
                    }}
                  >
                    {tag.name}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="New tag name..."
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                className="flex-1 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-sm"
              />
              <button
                type="button"
                onClick={handleCreateTag}
                disabled={!newTagName.trim()}
                className="px-3 py-1.5 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-600 text-white font-medium hover:from-cyan-600 hover:to-teal-700 transition-colors disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {isEditing ? 'Save Changes' : 'Create Contact'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
