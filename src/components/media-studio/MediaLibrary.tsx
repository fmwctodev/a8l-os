import { useState, useEffect } from 'react';
import {
  Image,
  Video,
  Loader2,
  Plus,
  Download,
  Clock,
  FolderOpen,
  Filter,
  Eye,
  Play,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import type { MediaAsset } from '../../services/mediaGeneration';
import { getMediaAssets } from '../../services/mediaGeneration';
import { MediaLightbox, type LightboxItem } from '../ui/MediaLightbox';

interface MediaLibraryProps {
  onAttach?: (asset: MediaAsset) => void;
  compact?: boolean;
}

export default function MediaLibrary({ onAttach, compact }: MediaLibraryProps) {
  const { user } = useAuth();
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'image' | 'video'>('all');
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useEffect(() => {
    if (user?.organization_id) {
      loadAssets();
    }
  }, [user?.organization_id, filter]);

  async function loadAssets() {
    if (!user?.organization_id) return;
    try {
      setLoading(true);
      const data = await getMediaAssets(user.organization_id, {
        type: filter === 'all' ? undefined : filter,
        limit: compact ? 20 : 50,
      });
      setAssets(data);
    } catch (err) {
      console.error('Failed to load media assets:', err);
    } finally {
      setLoading(false);
    }
  }

  function formatExpiry(expiresAt: string): string {
    const diff = new Date(expiresAt).getTime() - Date.now();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (days <= 0) return 'Expired';
    if (days === 1) return '1 day left';
    return `${days} days left`;
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
          <FolderOpen className="w-3.5 h-3.5" />
          Media Library
        </h4>
        <div className="flex items-center gap-1">
          <Filter className="w-3 h-3 text-gray-400" />
          {(['all', 'image', 'video'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                filter === f
                  ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {f === 'all' ? 'All' : f === 'image' ? 'Images' : 'Videos'}
            </button>
          ))}
        </div>
      </div>

      {lightboxIndex !== null && (
        <MediaLightbox
          items={assets.map((a): LightboxItem => ({
            url: a.public_url,
            thumbnailUrl: a.thumbnail_url,
            mediaType: a.media_type,
          }))}
          startIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}

      {assets.length === 0 ? (
        <div className="text-center py-6 text-gray-400">
          <Image className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No generated media yet</p>
          <p className="text-xs mt-1">
            Generate images or videos to see them here
          </p>
        </div>
      ) : (
        <div
          className={`grid gap-2 ${
            compact ? 'grid-cols-3' : 'grid-cols-4'
          } max-h-[360px] overflow-y-auto pr-1`}
        >
          {assets.map((asset, idx) => (
            <div
              key={asset.id}
              className="relative group rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800"
            >
              {asset.media_type === 'image' ? (
                <img
                  src={asset.public_url}
                  alt="Generated media"
                  className="w-full aspect-square object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-full aspect-square flex items-center justify-center bg-gray-100 dark:bg-gray-800 relative">
                  {asset.thumbnail_url ? (
                    <img
                      src={asset.thumbnail_url}
                      alt="Video thumbnail"
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <Video className="w-8 h-8 text-gray-400" />
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                    <div className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center">
                      <Play className="w-3.5 h-3.5 text-gray-900 ml-0.5" />
                    </div>
                  </div>
                </div>
              )}

              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-white/80 flex items-center gap-0.5">
                    <Clock className="w-2.5 h-2.5" />
                    {formatExpiry(asset.expires_at)}
                  </span>
                  <span className="text-[10px] text-white/60">
                    {formatSize(asset.file_size_bytes)}
                  </span>
                </div>
              </div>

              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100">
                <button
                  onClick={() => setLightboxIndex(idx)}
                  className="p-2 bg-white rounded-full shadow-md hover:bg-gray-100 transition-colors"
                  title="Preview"
                >
                  <Eye className="w-3.5 h-3.5 text-gray-900" />
                </button>
                {onAttach && (
                  <button
                    onClick={() => onAttach(asset)}
                    className="p-2 bg-white rounded-full shadow-md hover:bg-gray-100 transition-colors"
                    title="Attach to post"
                  >
                    <Plus className="w-3.5 h-3.5 text-gray-900" />
                  </button>
                )}
                <a
                  href={asset.public_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 bg-white rounded-full shadow-md hover:bg-gray-100 transition-colors"
                  title="Download"
                >
                  <Download className="w-3.5 h-3.5 text-gray-900" />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
