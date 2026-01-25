import { useState, useRef, useCallback } from 'react';
import { Upload, X, Loader2, Camera } from 'lucide-react';
import { uploadProfilePhoto } from '../../../services/profile';

interface ProfileAvatarUploaderProps {
  currentUrl: string | null;
  userId: string;
  userName: string;
  onUploadComplete: (url: string) => void | Promise<void>;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'w-16 h-16 text-xl',
  md: 'w-24 h-24 text-3xl',
  lg: 'w-32 h-32 text-4xl',
};

const buttonSizeClasses = {
  sm: 'p-1.5',
  md: 'p-2',
  lg: 'p-2.5',
};

export function ProfileAvatarUploader({
  currentUrl,
  userId,
  userName,
  onUploadComplete,
  size = 'md',
}: ProfileAvatarUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const displayUrl = previewUrl || currentUrl;

  const handleFile = useCallback(async (file: File) => {
    setError(null);

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be less than 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    setIsUploading(true);
    try {
      const url = await uploadProfilePhoto(userId, file);
      await onUploadComplete(url);
    } catch (err) {
      console.error('Upload failed:', err);
      setError('Failed to upload image');
      setPreviewUrl(null);
    } finally {
      setIsUploading(false);
    }
  }, [userId, onUploadComplete]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFile(file);
    }
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  }, [handleFile]);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const getInitials = () => {
    return userName.charAt(0).toUpperCase() || 'U';
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className={`
          relative rounded-full cursor-pointer transition-all
          ${sizeClasses[size]}
          ${isDragging ? 'ring-4 ring-cyan-500/50 scale-105' : ''}
        `}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleClick}
      >
        {displayUrl ? (
          <img
            src={displayUrl}
            alt={userName}
            className={`${sizeClasses[size]} rounded-full object-cover border-2 border-slate-700`}
          />
        ) : (
          <div
            className={`
              ${sizeClasses[size]} rounded-full
              bg-gradient-to-br from-cyan-500 to-teal-600
              flex items-center justify-center text-white font-semibold
              border-2 border-slate-700
            `}
          >
            {getInitials()}
          </div>
        )}

        {isUploading && (
          <div className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-white animate-spin" />
          </div>
        )}

        <button
          type="button"
          className={`
            absolute bottom-0 right-0 rounded-full
            bg-slate-800 border border-slate-700
            hover:bg-slate-700 transition-colors
            ${buttonSizeClasses[size]}
          `}
          onClick={(e) => {
            e.stopPropagation();
            handleClick();
          }}
        >
          <Camera className="w-4 h-4 text-slate-300" />
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-400">
          <X className="w-4 h-4" />
          {error}
        </div>
      )}

      <p className="text-xs text-slate-500 text-center">
        Click or drag to upload
        <br />
        Max 5MB, JPG/PNG/GIF
      </p>
    </div>
  );
}
