import { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, Folder, FolderOpen, HardDrive } from 'lucide-react';
import type { DriveFolder } from '../../types';
import { getDriveFolders } from '../../services/driveFiles';

interface FolderTreeProps {
  userId: string;
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string | null, folderName: string) => void;
}

interface FolderNodeProps {
  folder: DriveFolder;
  level: number;
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string | null, folderName: string) => void;
  userId: string;
}

function FolderNode({
  folder,
  level,
  selectedFolderId,
  onSelectFolder,
  userId,
}: FolderNodeProps) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<DriveFolder[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  const isSelected = selectedFolderId === folder.drive_folder_id;

  const loadChildren = async () => {
    if (hasLoaded) return;
    setLoading(true);
    try {
      const folders = await getDriveFolders(userId, folder.drive_folder_id);
      setChildren(folders);
      setHasLoaded(true);
    } catch (err) {
      console.error('Failed to load subfolders:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!expanded) {
      await loadChildren();
    }
    setExpanded(!expanded);
  };

  const handleSelect = () => {
    onSelectFolder(folder.drive_folder_id, folder.name);
  };

  return (
    <div>
      <div
        className={`flex items-center gap-1 px-2 py-1.5 cursor-pointer rounded-md transition-colors ${
          isSelected
            ? 'bg-cyan-500/10 text-cyan-400'
            : 'hover:bg-slate-700 text-slate-400 hover:text-slate-200'
        }`}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={handleSelect}
      >
        <button
          onClick={handleToggle}
          className="p-0.5 hover:bg-slate-600 rounded"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-slate-500 border-t-slate-300 rounded-full animate-spin" />
          ) : expanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </button>
        {expanded ? (
          <FolderOpen className="w-4 h-4 text-yellow-400" />
        ) : (
          <Folder className="w-4 h-4 text-yellow-400" />
        )}
        <span className="text-sm truncate">{folder.name}</span>
      </div>
      {expanded && children.length > 0 && (
        <div>
          {children.map((child) => (
            <FolderNode
              key={child.id}
              folder={child}
              level={level + 1}
              selectedFolderId={selectedFolderId}
              onSelectFolder={onSelectFolder}
              userId={userId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function FolderTree({
  userId,
  selectedFolderId,
  onSelectFolder,
}: FolderTreeProps) {
  const [rootFolders, setRootFolders] = useState<DriveFolder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRootFolders();
  }, [userId]);

  const loadRootFolders = async () => {
    setLoading(true);
    try {
      const folders = await getDriveFolders(userId, null);
      if (folders.length === 0) {
        setRootFolders([
          {
            id: 'root',
            organization_id: '',
            user_id: userId,
            drive_folder_id: 'root',
            name: 'My Drive',
            parent_drive_folder_id: null,
            path: '/',
            last_synced_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ]);
      } else {
        setRootFolders(folders);
      }
    } catch (err) {
      console.error('Failed to load folders:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-2">
          <div className="h-6 bg-slate-700 rounded w-3/4" />
          <div className="h-6 bg-slate-700 rounded w-1/2 ml-4" />
          <div className="h-6 bg-slate-700 rounded w-2/3 ml-4" />
        </div>
      </div>
    );
  }

  return (
    <div className="py-2">
      <div className="px-3 mb-2">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Folders
        </h3>
      </div>
      <div
        className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer rounded-md mx-2 transition-colors ${
          selectedFolderId === null
            ? 'bg-cyan-500/10 text-cyan-400'
            : 'hover:bg-slate-700 text-slate-400 hover:text-slate-200'
        }`}
        onClick={() => onSelectFolder(null, 'All Files')}
      >
        <HardDrive className="w-4 h-4" />
        <span className="text-sm font-medium">All Files</span>
      </div>
      <div className="mt-2">
        {rootFolders.map((folder) => (
          <FolderNode
            key={folder.id}
            folder={folder}
            level={0}
            selectedFolderId={selectedFolderId}
            onSelectFolder={onSelectFolder}
            userId={userId}
          />
        ))}
      </div>
    </div>
  );
}
