import { useState, useMemo } from 'react';
import {
  Search,
  GripVertical,
  MoreHorizontal,
  Edit,
  Copy,
  ToggleLeft,
  ToggleRight,
  Trash2,
  FolderInput,
  Filter,
  FileText,
  Hash,
  Calendar,
  List,
  CheckSquare,
  Phone,
  Mail,
  Link,
  DollarSign,
  Upload,
  ToggleRight as BoolIcon,
  Radio,
  FolderOpen,
  CheckCircle2,
} from 'lucide-react';
import type { CustomField, CustomFieldGroup, CustomFieldType } from '../../../types';
import { CUSTOM_FIELD_TYPE_LABELS } from '../../../types';

const FIELD_TYPE_ICONS: Record<CustomFieldType, React.ReactNode> = {
  text: <FileText className="w-4 h-4" />,
  textarea: <FileText className="w-4 h-4" />,
  number: <Hash className="w-4 h-4" />,
  currency: <DollarSign className="w-4 h-4" />,
  date: <Calendar className="w-4 h-4" />,
  datetime: <Calendar className="w-4 h-4" />,
  select: <List className="w-4 h-4" />,
  multi_select: <CheckSquare className="w-4 h-4" />,
  boolean: <BoolIcon className="w-4 h-4" />,
  checkbox: <CheckSquare className="w-4 h-4" />,
  radio: <Radio className="w-4 h-4" />,
  phone: <Phone className="w-4 h-4" />,
  email: <Mail className="w-4 h-4" />,
  url: <Link className="w-4 h-4" />,
  file: <Upload className="w-4 h-4" />,
};

interface FieldListPanelProps {
  fields: CustomField[];
  groups: CustomFieldGroup[];
  selectedGroupId: string | null;
  selectedFieldIds: Set<string>;
  onToggleFieldSelection: (fieldId: string) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onEditField: (field: CustomField) => void;
  onDuplicateField: (field: CustomField) => void;
  onToggleFieldActive: (field: CustomField) => void;
  onDeleteField: (field: CustomField) => void;
  onMoveField: (field: CustomField) => void;
  onReorderFields: (fieldIds: string[]) => void;
  canManage: boolean;
  loading?: boolean;
}

export function FieldListPanel({
  fields,
  groups,
  selectedGroupId,
  selectedFieldIds,
  onToggleFieldSelection,
  onSelectAll,
  onClearSelection,
  onEditField,
  onDuplicateField,
  onToggleFieldActive,
  onDeleteField,
  onMoveField,
  onReorderFields,
  canManage,
  loading,
}: FieldListPanelProps) {
  const [search, setSearch] = useState('');
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');
  const [filterType, setFilterType] = useState<CustomFieldType | 'all'>('all');
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const currentGroup = useMemo(() => {
    if (selectedGroupId === null) return null;
    if (selectedGroupId === 'ungrouped') return { id: 'ungrouped', name: 'Ungrouped Fields', description: null };
    return groups.find((g) => g.id === selectedGroupId) || null;
  }, [selectedGroupId, groups]);

  const filteredFields = useMemo(() => {
    let result = [...fields];

    if (search.trim()) {
      const searchLower = search.toLowerCase();
      result = result.filter(
        (f) =>
          f.name.toLowerCase().includes(searchLower) ||
          f.field_key.toLowerCase().includes(searchLower) ||
          (f.help_text && f.help_text.toLowerCase().includes(searchLower))
      );
    }

    if (filterActive !== 'all') {
      result = result.filter((f) => (filterActive === 'active' ? f.active : !f.active));
    }

    if (filterType !== 'all') {
      result = result.filter((f) => f.field_type === filterType);
    }

    return result;
  }, [fields, search, filterActive, filterType]);

  const allSelected = filteredFields.length > 0 && filteredFields.every((f) => selectedFieldIds.has(f.id));
  const someSelected = filteredFields.some((f) => selectedFieldIds.has(f.id));

  function handleDragStart(e: React.DragEvent, fieldId: string) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', fieldId);
    setDraggedId(fieldId);
  }

  function handleDragOver(e: React.DragEvent, fieldId: string) {
    e.preventDefault();
    if (draggedId && draggedId !== fieldId) {
      setDragOverId(fieldId);
    }
  }

  function handleDragLeave() {
    setDragOverId(null);
  }

  function handleDrop(e: React.DragEvent, targetId: string) {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) return;

    const currentIds = filteredFields.map((f) => f.id);
    const draggedIndex = currentIds.indexOf(draggedId);
    const targetIndex = currentIds.indexOf(targetId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    const newIds = [...currentIds];
    newIds.splice(draggedIndex, 1);
    newIds.splice(targetIndex, 0, draggedId);

    onReorderFields(newIds);
    setDraggedId(null);
    setDragOverId(null);
  }

  function handleDragEnd() {
    setDraggedId(null);
    setDragOverId(null);
  }

  const groupTitle = selectedGroupId === null
    ? 'All Fields'
    : currentGroup?.name || 'Fields';

  const groupDescription = currentGroup && 'description' in currentGroup ? currentGroup.description : null;

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-700 bg-slate-800/50">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              {selectedGroupId && selectedGroupId !== 'ungrouped' && (
                <FolderOpen className="w-5 h-5 text-cyan-400" />
              )}
              {groupTitle}
              <span className="text-sm font-normal text-slate-500">
                ({filteredFields.length} field{filteredFields.length !== 1 ? 's' : ''})
              </span>
            </h2>
            {groupDescription && (
              <p className="text-sm text-slate-400 mt-0.5">{groupDescription}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search fields..."
              className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <select
              value={filterActive}
              onChange={(e) => setFilterActive(e.target.value as 'all' | 'active' | 'inactive')}
              className="px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-sm text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>

            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as CustomFieldType | 'all')}
              className="px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-sm text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            >
              <option value="all">All Types</option>
              {Object.entries(CUSTOM_FIELD_TYPE_LABELS).map(([type, label]) => (
                <option key={type} value={type}>{label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {canManage && filteredFields.length > 0 && (
        <div className="px-6 py-2 border-b border-slate-700 bg-slate-800/30 flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() => (allSelected ? onClearSelection() : onSelectAll())}
              className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-slate-900"
            />
            <span className="text-sm text-slate-400">
              {allSelected ? 'Deselect all' : someSelected ? 'Select all' : 'Select all'}
            </span>
          </label>
          {selectedFieldIds.size > 0 && (
            <span className="text-sm text-cyan-400">
              {selectedFieldIds.size} selected
            </span>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {filteredFields.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="p-4 bg-slate-800 rounded-full mb-4">
              <FileText className="w-8 h-8 text-slate-500" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">
              {search || filterActive !== 'all' || filterType !== 'all'
                ? 'No fields match your filters'
                : 'No fields yet'}
            </h3>
            <p className="text-slate-400 text-center max-w-md">
              {search || filterActive !== 'all' || filterType !== 'all'
                ? 'Try adjusting your search or filter criteria.'
                : 'Create your first custom field to start collecting additional data.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-700/50">
            {filteredFields.map((field) => {
              const isSelected = selectedFieldIds.has(field.id);
              const isDragging = draggedId === field.id;
              const isDragOver = dragOverId === field.id;

              return (
                <div
                  key={field.id}
                  draggable={canManage}
                  onDragStart={(e) => handleDragStart(e, field.id)}
                  onDragOver={(e) => handleDragOver(e, field.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, field.id)}
                  onDragEnd={handleDragEnd}
                  className={`
                    flex items-center gap-3 px-6 py-3 transition-all
                    ${isSelected ? 'bg-cyan-500/5' : 'hover:bg-slate-800/50'}
                    ${isDragging ? 'opacity-50' : ''}
                    ${isDragOver ? 'border-t-2 border-cyan-400' : ''}
                    ${!field.active ? 'opacity-60' : ''}
                  `}
                >
                  {canManage && (
                    <>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleFieldSelection(field.id)}
                        className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-slate-900"
                      />
                      <div className="cursor-grab active:cursor-grabbing p-1 text-slate-600 hover:text-slate-400">
                        <GripVertical className="w-4 h-4" />
                      </div>
                    </>
                  )}

                  <div className={`p-2 rounded-lg ${field.active ? 'bg-slate-700' : 'bg-slate-800'}`}>
                    <span className={field.active ? 'text-cyan-400' : 'text-slate-500'}>
                      {FIELD_TYPE_ICONS[field.field_type]}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white truncate">{field.name}</span>
                      {field.is_required && (
                        <span className="px-1.5 py-0.5 text-xs font-medium text-red-400 bg-red-500/20 rounded">
                          Required
                        </span>
                      )}
                      {!field.active && (
                        <span className="px-1.5 py-0.5 text-xs font-medium text-slate-400 bg-slate-700 rounded">
                          Inactive
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs font-mono text-slate-500">{field.field_key}</span>
                      <span className="text-slate-600">|</span>
                      <span className="text-xs text-slate-400">
                        {CUSTOM_FIELD_TYPE_LABELS[field.field_type]}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {field.visible_in_forms && (
                      <span className="p-1 text-slate-500" title="Available in Forms">
                        <FileText className="w-3.5 h-3.5" />
                      </span>
                    )}
                    {field.visible_in_automations && (
                      <span className="p-1 text-slate-500" title="Available in Automations">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </div>

                  {canManage && (
                    <div className="relative">
                      <button
                        onClick={() => setMenuOpen(menuOpen === field.id ? null : field.id)}
                        className="p-2 text-slate-500 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>

                      {menuOpen === field.id && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(null)} />
                          <div className="absolute right-0 top-full mt-1 w-44 bg-slate-800 rounded-lg shadow-xl border border-slate-600 py-1 z-50">
                            <button
                              onClick={() => {
                                onEditField(field);
                                setMenuOpen(null);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white"
                            >
                              <Edit className="w-4 h-4" />
                              Edit
                            </button>
                            <button
                              onClick={() => {
                                onDuplicateField(field);
                                setMenuOpen(null);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white"
                            >
                              <Copy className="w-4 h-4" />
                              Duplicate
                            </button>
                            <button
                              onClick={() => {
                                onMoveField(field);
                                setMenuOpen(null);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white"
                            >
                              <FolderInput className="w-4 h-4" />
                              Move to Group
                            </button>
                            <button
                              onClick={() => {
                                onToggleFieldActive(field);
                                setMenuOpen(null);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white"
                            >
                              {field.active ? (
                                <>
                                  <ToggleLeft className="w-4 h-4" />
                                  Disable
                                </>
                              ) : (
                                <>
                                  <ToggleRight className="w-4 h-4" />
                                  Enable
                                </>
                              )}
                            </button>
                            <hr className="my-1 border-slate-700" />
                            <button
                              onClick={() => {
                                onDeleteField(field);
                                setMenuOpen(null);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10"
                            >
                              <Trash2 className="w-4 h-4" />
                              Delete
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
