import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  ImageOff,
  Play,
} from 'lucide-react';

export interface LightboxItem {
  url: string;
  thumbnailUrl?: string | null;
  mediaType: 'image' | 'video';
  filename?: string;
}

interface MediaLightboxProps {
  items: LightboxItem[];
  startIndex?: number;
  onClose: () => void;
}

export function MediaLightbox({ items, startIndex = 0, onClose }: MediaLightboxProps) {
  const [index, setIndex] = useState(startIndex);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [visible, setVisible] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);

  const current = items[index];
  const hasMultiple = items.length > 1;

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(false);
  }, [index]);

  const handleClose = useCallback(() => {
    setVisible(false);
    setTimeout(onClose, 200);
  }, [onClose]);

  const prev = useCallback(() => {
    setIndex((i) => (i > 0 ? i - 1 : items.length - 1));
  }, [items.length]);

  const next = useCallback(() => {
    setIndex((i) => (i < items.length - 1 ? i + 1 : 0));
  }, [items.length]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') handleClose();
      if (e.key === 'ArrowLeft' && hasMultiple) prev();
      if (e.key === 'ArrowRight' && hasMultiple) next();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleClose, prev, next, hasMultiple]);

  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === backdropRef.current) handleClose();
  }

  if (!current) return null;

  return createPortal(
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className={`fixed inset-0 z-[70] flex items-center justify-center bg-black/90 transition-opacity duration-200 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
        <a
          href={current.url}
          target="_blank"
          rel="noopener noreferrer"
          download
          className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          title="Download"
          onClick={(e) => e.stopPropagation()}
        >
          <Download className="w-5 h-5" />
        </a>
        <button
          onClick={handleClose}
          className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {hasMultiple && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); prev(); }}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-10"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); next(); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-10"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </>
      )}

      <div
        className={`max-w-[90vw] max-h-[85vh] flex items-center justify-center transition-transform duration-200 ${
          visible ? 'scale-100' : 'scale-95'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {loading && !error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-white/60 animate-spin" />
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center gap-3 text-white/60">
            <ImageOff className="w-12 h-12" />
            <span className="text-sm">Media unavailable or expired</span>
          </div>
        )}

        {current.mediaType === 'video' ? (
          <video
            key={current.url}
            src={current.url}
            poster={current.thumbnailUrl || undefined}
            controls
            autoPlay
            muted
            className={`max-w-[90vw] max-h-[85vh] rounded-lg ${loading && !error ? 'opacity-0' : 'opacity-100'} transition-opacity`}
            onLoadedData={() => setLoading(false)}
            onError={() => { setLoading(false); setError(true); }}
          />
        ) : (
          <img
            key={current.url}
            src={current.url}
            alt=""
            className={`max-w-[90vw] max-h-[85vh] object-contain rounded-lg ${loading && !error ? 'opacity-0' : 'opacity-100'} transition-opacity`}
            onLoad={() => setLoading(false)}
            onError={() => { setLoading(false); setError(true); }}
          />
        )}
      </div>

      {hasMultiple && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10">
          <span className="text-white/70 text-sm font-medium tabular-nums">
            {index + 1} / {items.length}
          </span>
          <div className="flex items-center gap-1.5 ml-2">
            {items.map((_, i) => (
              <button
                key={i}
                onClick={(e) => { e.stopPropagation(); setIndex(i); }}
                className={`rounded-full transition-all ${
                  i === index
                    ? 'w-2.5 h-2.5 bg-white'
                    : 'w-2 h-2 bg-white/40 hover:bg-white/60'
                }`}
              />
            ))}
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}

export function InlineVideoPlayer({
  src,
  poster,
  className = '',
}: {
  src: string;
  poster?: string | null;
  className?: string;
}) {
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  function handlePlay(e: React.MouseEvent) {
    e.stopPropagation();
    setPlaying(true);
    videoRef.current?.play();
  }

  return (
    <div className={`relative ${className}`}>
      <video
        ref={videoRef}
        src={src}
        poster={poster || undefined}
        controls={playing}
        muted
        playsInline
        className="w-full h-full object-cover"
        onEnded={() => setPlaying(false)}
      />
      {!playing && (
        <button
          onClick={handlePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors"
        >
          <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
            <Play className="w-5 h-5 text-gray-900 ml-0.5" />
          </div>
        </button>
      )}
    </div>
  );
}
