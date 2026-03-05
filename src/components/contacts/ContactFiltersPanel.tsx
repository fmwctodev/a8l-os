import type { ContactFilters } from '../../services/contacts';
import type { Tag, Department, User } from '../../types';

interface ContactFiltersPanelProps {
  filters: ContactFilters;
  onFiltersChange: (filters: ContactFilters) => void;
  tags: Tag[];
  departments: Department[];
  users: User[];
  isAdmin: boolean;
}

export function ContactFiltersPanel({
  filters,
  onFiltersChange,
  tags,
  departments,
  users,
  isAdmin,
}: ContactFiltersPanelProps) {
  const updateFilter = <K extends keyof ContactFilters>(key: K, value: ContactFilters[K]) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const toggleTag = (tagId: string) => {
    const currentTags = filters.tagIds || [];
    const newTags = currentTags.includes(tagId)
      ? currentTags.filter((id) => id !== tagId)
      : [...currentTags, tagId];
    updateFilter('tagIds', newTags.length > 0 ? newTags : undefined);
  };

  return (
    <div className="mt-4 pt-4 border-t border-slate-800 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {isAdmin && (
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Department</label>
          <select
            value={filters.departmentId || ''}
            onChange={(e) => updateFilter('departmentId', e.target.value || undefined)}
            className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-sm"
          >
            <option value="">All Departments</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1.5">Owner</label>
        <select
          value={filters.ownerId || ''}
          onChange={(e) => updateFilter('ownerId', e.target.value || undefined)}
          className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-sm"
        >
          <option value="">All Owners</option>
          <option value="unassigned">Unassigned</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1.5">Source</label>
        <select
          value={filters.source || ''}
          onChange={(e) => updateFilter('source', e.target.value || undefined)}
          className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-sm"
        >
          <option value="">All Sources</option>
          <option value="cold_call">Cold Call</option>
          <option value="cold_email">Cold Email</option>
          <option value="google">Google</option>
          <option value="google_ads">Google Ads</option>
          <option value="import">Import</option>
          <option value="linkedin">Linkedin</option>
          <option value="manual">Manual Entry</option>
          <option value="meta">Meta</option>
          <option value="meta_ads">Meta Ads</option>
          <option value="website">Website</option>
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1.5">Status</label>
        <select
          value={filters.status || ''}
          onChange={(e) =>
            updateFilter('status', (e.target.value as 'active' | 'archived') || undefined)
          }
          className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-sm"
        >
          <option value="">Active Only</option>
          <option value="active">Active</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      <div className="col-span-full">
        <label className="block text-xs font-medium text-slate-400 mb-1.5">Tags</label>
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => {
            const isSelected = filters.tagIds?.includes(tag.id);
            return (
              <button
                key={tag.id}
                onClick={() => toggleTag(tag.id)}
                className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  isSelected
                    ? 'ring-2 ring-offset-1 ring-offset-slate-900'
                    : 'opacity-60 hover:opacity-100'
                }`}
                style={{
                  backgroundColor: `${tag.color}20`,
                  color: tag.color,
                  ...(isSelected && { ringColor: tag.color }),
                }}
              >
                {tag.name}
              </button>
            );
          })}
          {tags.length === 0 && (
            <span className="text-sm text-slate-500">No tags available</span>
          )}
        </div>
      </div>
    </div>
  );
}
