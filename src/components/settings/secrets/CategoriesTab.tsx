import { useState, useEffect } from 'react';
import { FolderKey, Plus, Pencil, Trash2, GripVertical, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import * as secretsService from '../../../services/secrets';
import type { SecretCategory } from '../../../services/secrets';
import * as LucideIcons from 'lucide-react';

interface Props {
  onSuccess?: () => void;
}

const AVAILABLE_ICONS = [
  'key', 'lock', 'shield', 'credit-card', 'mail', 'cloud', 'database',
  'server', 'globe', 'link', 'code', 'terminal', 'cpu', 'hard-drive',
  'wifi', 'smartphone', 'monitor', 'settings', 'tool', 'zap', 'brain',
  'bar-chart-2', 'share-2', 'send', 'message-square', 'file', 'folder'
];

export function CategoriesTab({ onSuccess }: Props) {
  const { user, hasPermission } = useAuth();
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<SecretCategory[]>([]);
  const [editingCategory, setEditingCategory] = useState<SecretCategory | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('key');
  const [sortOrder, setSortOrder] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canManage = hasPermission('secrets.categories');

  useEffect(() => {
    if (user?.organization_id) {
      loadCategories();
    }
  }, [user?.organization_id]);

  const loadCategories = async () => {
    if (!user?.organization_id) return;

    try {
      setLoading(true);
      const data = await secretsService.getCategories(user.organization_id);
      setCategories(data);
    } catch (err) {
      console.error('Failed to load categories:', err);
    } finally {
      setLoading(false);
    }
  };

  const openModal = (category?: SecretCategory) => {
    if (category) {
      setEditingCategory(category);
      setName(category.name);
      setDescription(category.description || '');
      setIcon(category.icon);
      setSortOrder(category.sort_order);
    } else {
      setEditingCategory(null);
      setName('');
      setDescription('');
      setIcon('key');
      setSortOrder(categories.length);
    }
    setError(null);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!user?.organization_id || !canManage) return;

    setError(null);
    setSaving(true);

    try {
      if (editingCategory) {
        await secretsService.updateCategory(user.organization_id, editingCategory.id, {
          name,
          description: description || null,
          icon,
          sort_order: sortOrder,
        });
      } else {
        await secretsService.createCategory(user.organization_id, {
          name,
          description: description || undefined,
          icon,
          sort_order: sortOrder,
        });
      }
      setIsModalOpen(false);
      loadCategories();
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save category');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (categoryId: string) => {
    if (!user?.organization_id || !canManage) return;

    try {
      await secretsService.deleteCategory(user.organization_id, categoryId);
      setDeleteConfirm(null);
      loadCategories();
      onSuccess?.();
    } catch (err) {
      console.error('Failed to delete category:', err);
    }
  };

  const getIcon = (iconName: string) => {
    const pascalCase = iconName
      .split('-')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join('');
    const IconComponent = (LucideIcons as Record<string, React.ComponentType<{ className?: string }>>)[pascalCase];
    return IconComponent ? <IconComponent className="h-5 w-5" /> : <FolderKey className="h-5 w-5" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Secret Categories</h3>
          <p className="text-sm text-gray-500">Organize your secrets into logical groups</p>
        </div>
        {canManage && (
          <button
            onClick={() => openModal()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Category
          </button>
        )}
      </div>

      {categories.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl border border-gray-200">
          <FolderKey className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-4 text-sm font-medium text-gray-900">No categories</h3>
          <p className="mt-1 text-sm text-gray-500">Create categories to organize your secrets</p>
          {canManage && (
            <button
              onClick={() => openModal()}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Add Category
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-200">
          {categories.map((category) => (
            <div
              key={category.id}
              className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors"
            >
              <div className="text-gray-400 cursor-move">
                <GripVertical className="h-5 w-5" />
              </div>
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
                {getIcon(category.icon)}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-gray-900">{category.name}</h4>
                {category.description && (
                  <p className="text-sm text-gray-500 truncate">{category.description}</p>
                )}
              </div>
              <div className="text-sm text-gray-400">
                Order: {category.sort_order}
              </div>
              {canManage && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openModal(category)}
                    className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                    title="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(category.id)}
                    className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl max-w-md w-full mx-4 shadow-xl">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingCategory ? 'Edit Category' : 'Add Category'}
              </h2>
            </div>

            <div className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Payment Gateways"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional description"
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Icon</label>
                <div className="grid grid-cols-7 gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200 max-h-32 overflow-y-auto">
                  {AVAILABLE_ICONS.map((iconName) => (
                    <button
                      key={iconName}
                      type="button"
                      onClick={() => setIcon(iconName)}
                      className={`p-2 rounded-lg transition-colors ${
                        icon === iconName
                          ? 'bg-blue-100 text-blue-600 ring-2 ring-blue-500'
                          : 'text-gray-500 hover:bg-gray-100'
                      }`}
                    >
                      {getIcon(iconName)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>
                <input
                  type="number"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)}
                  min={0}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl flex items-center justify-end gap-3">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!name || saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {saving && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />}
                {editingCategory ? 'Save Changes' : 'Create Category'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
            <div className="flex items-center gap-3 text-amber-600 mb-4">
              <AlertTriangle className="h-6 w-6" />
              <h3 className="text-lg font-semibold">Delete Category</h3>
            </div>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this category? Secrets in this category will become uncategorized.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
              >
                Delete Category
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
