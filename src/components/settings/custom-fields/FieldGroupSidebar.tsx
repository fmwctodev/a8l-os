import { useState, useRef, useEffect } from 'react';
import {
  ChevronRight,
  GripVertical,
  Plus,
  MoreHorizontal,
  Edit,
  Trash2,
  FolderOpen,
  Layers,
} from 'lucide-react';
import type { CustomFieldGroup, CustomField, CustomFieldScope } from '../../../types';

interface FieldGroupSidebarProps {
  scope: CustomFieldScope;
  groups: CustomFieldGroup[];
  ungroupedFields: CustomField[];
  selectedGroupId: string | null;
  onSelectGroup: (groupId: string | null) => void;
  onEditGroup: (group: CustomFieldGroup) => void;
  onDeleteGroup: (group: CustomFieldGroup) => void;
  onCreateGroup: () => void;
  onReorderGroups: (groupIds: string[]) => void;
  canManage: boolean;
}

export function FieldGroupSidebar({
  groups,
  ungroupedFields,
  selectedGroupId,
  onSelectGroup,
  onEditGroup,
  onDeleteGroup,
  onCreateGroup,
  onReorderGroups,
  canManage,
}: FieldGroupSidebarProps) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const totalFieldCount = groups.reduce((sum, g) => sum + (g.fields?.length || 0), 0) + ungroupedFields.length;

  useEffect(() => {
    if (editingName && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingName]);

  function handleDragStart(e: React.DragEvent, groupId: string) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', groupId);
    setDraggedId(groupId);
  }

  function handleDragOver(e: React.DragEvent, groupId: string) {
    e.preventDefault();
    if (draggedId && draggedId !== groupId) {
      setDragOverId(groupId);
    }
  }

  function handleDragLeave() {
    setDragOverId(null);
  }

  function handleDrop(e: React.DragEvent, targetId: string) {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) return;

    const currentIds = groups.map((g) => g.id);
    const draggedIndex = currentIds.indexOf(draggedId);
    const targetIndex = currentIds.indexOf(targetId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    const newIds = [...currentIds];
    newIds.splice(draggedIndex, 1);
    newIds.splice(targetIndex, 0, draggedId);

    onReorderGroups(newIds);
    setDraggedId(null);
    setDragOverId(null);
  }

  function handleDragEnd() {
    setDraggedId(null);
    setDragOverId(null);
  }

  function handleDoubleClick(group: CustomFieldGroup) {
    if (!canManage) return;
    setEditingName(group.id);
    setEditValue(group.name);
  }

  function handleNameSubmit(group: CustomFieldGroup) {
    if (editValue.trim() && editValue.trim() !== group.name) {
      onEditGroup({ ...group, name: editValue.trim() });
    }
    setEditingName(null);
  }

  function handleKeyDown(e: React.KeyboardEvent, group: CustomFieldGroup) {
    if (e.key === 'Enter') {
      handleNameSubmit(group);
    } else if (e.key === 'Escape') {
      setEditingName(null);
    }
  }

  return (
    <div className="w-72 flex-shrink-0 flex flex-col border-r border-slate-700 bg-slate-900/50">
      <div className="px-4 py-3 border-b border-slate-700">
        <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wide">Groups</h3>
      </div>

      <div className="flex-1 overflow-y-auto">
        <button
          onClick={() => onSelectGroup(null)}
          className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
            selectedGroupId === null
              ? 'bg-cyan-500/10 border-l-2 border-cyan-500'
              : 'hover:bg-slate-800 border-l-2 border-transparent'
          }`}
        >
          <Layers className="w-4 h-4 text-slate-400" />
          <span className="flex-1 text-sm font-medium text-white">All Fields</span>
          <span className="text-xs text-slate-500 bg-slate-700 px-2 py-0.5 rounded-full">
            {totalFieldCount}
          </span>
        </button>

        <div className="px-3 py-2">
          <div className="h-px bg-slate-700" />
        </div>

        {groups.map((group) => {
          const isSelected = selectedGroupId === group.id;
          const isDragging = draggedId === group.id;
          const isDragOver = dragOverId === group.id;
          const fieldCount = group.fields?.length || 0;

          return (
            <div
              key={group.id}
              draggable={canManage}
              onDragStart={(e) => handleDragStart(e, group.id)}
              onDragOver={(e) => handleDragOver(e, group.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, group.id)}
              onDragEnd={handleDragEnd}
              className={`
                relative flex items-center gap-2 px-2 py-2 mx-2 rounded-lg transition-all
                ${isSelected ? 'bg-cyan-500/10 ring-1 ring-cyan-500/30' : 'hover:bg-slate-800'}
                ${isDragging ? 'opacity-50' : ''}
                ${isDragOver ? 'ring-2 ring-cyan-400' : ''}
              `}
            >
              {canManage && (
                <div className="cursor-grab active:cursor-grabbing p-1 text-slate-600 hover:text-slate-400">
                  <GripVertical className="w-3.5 h-3.5" />
                </div>
              )}

              <button
                onClick={() => onSelectGroup(group.id)}
                onDoubleClick={() => handleDoubleClick(group)}
                className="flex-1 flex items-center gap-2 min-w-0"
              >
                <FolderOpen className={`w-4 h-4 ${isSelected ? 'text-cyan-400' : 'text-slate-500'}`} />
                {editingName === group.id ? (
                  <input
                    ref={inputRef}
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => handleNameSubmit(group)}
                    onKeyDown={(e) => handleKeyDown(e, group)}
                    onClick={(e) => e.stopPropagation()}
                    className="flex-1 bg-slate-800 border border-cyan-500 rounded px-2 py-0.5 text-sm text-white focus:outline-none"
                  />
                ) : (
                  <span className={`flex-1 text-sm truncate ${isSelected ? 'text-white font-medium' : 'text-slate-300'}`}>
                    {group.name}
                  </span>
                )}
                <span className="text-xs text-slate-500 bg-slate-700/50 px-1.5 py-0.5 rounded">
                  {fieldCount}
                </span>
              </button>

              {canManage && (
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(menuOpen === group.id ? null : group.id);
                    }}
                    className="p-1 text-slate-500 hover:text-white rounded hover:bg-slate-700"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>

                  {menuOpen === group.id && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(null)} />
                      <div className="absolute right-0 top-full mt-1 w-36 bg-slate-800 rounded-lg shadow-xl border border-slate-600 py-1 z-50">
                        <button
                          onClick={() => {
                            onEditGroup(group);
                            setMenuOpen(null);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white"
                        >
                          <Edit className="w-4 h-4" />
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            onDeleteGroup(group);
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

              {isSelected && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-cyan-500 rounded-r" />
              )}
            </div>
          );
        })}

        {ungroupedFields.length > 0 && (
          <>
            <div className="px-3 py-2">
              <div className="h-px bg-slate-700" />
            </div>
            <button
              onClick={() => onSelectGroup('ungrouped')}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                selectedGroupId === 'ungrouped'
                  ? 'bg-cyan-500/10 border-l-2 border-cyan-500'
                  : 'hover:bg-slate-800 border-l-2 border-transparent'
              }`}
            >
              <ChevronRight className="w-4 h-4 text-slate-500" />
              <span className="flex-1 text-sm text-slate-400">Ungrouped</span>
              <span className="text-xs text-slate-500 bg-slate-700 px-2 py-0.5 rounded-full">
                {ungroupedFields.length}
              </span>
            </button>
          </>
        )}
      </div>

      {canManage && (
        <div className="p-3 border-t border-slate-700">
          <button
            onClick={onCreateGroup}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-slate-300 border border-slate-600 border-dashed rounded-lg hover:bg-slate-800 hover:border-slate-500 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Group
          </button>
        </div>
      )}
    </div>
  );
}
