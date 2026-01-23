import { useState, useEffect, useRef } from 'react';
import { X, Upload, Link, FolderOpen, Plus, Trash2, Image } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import {
  createBrandKit,
  updateBrandKit,
  uploadBrandLogo,
  deleteBrandLogo,
  getBrandLogoUrl,
} from '../../../services/brandboard';
import type {
  BrandKitWithVersion,
  BrandLogo,
  BrandKitColors,
  BrandKitFonts,
  BrandLogoLabel,
  BrandColorKey,
} from '../../../types';

interface BrandKitDrawerProps {
  kit: BrandKitWithVersion | null;
  onClose: () => void;
  onSave: () => void;
}

const LOGO_LABELS: { value: BrandLogoLabel; label: string }[] = [
  { value: 'primary', label: 'Primary Logo' },
  { value: 'secondary', label: 'Secondary Logo' },
  { value: 'icon', label: 'Icon / Favicon' },
  { value: 'light', label: 'Light Variant' },
  { value: 'dark', label: 'Dark Variant' },
];

const COLOR_KEYS: { key: BrandColorKey; label: string }[] = [
  { key: 'primary', label: 'Primary' },
  { key: 'secondary', label: 'Secondary' },
  { key: 'accent', label: 'Accent' },
  { key: 'background', label: 'Background' },
  { key: 'text', label: 'Text' },
];

const FONT_SOURCES = [
  { value: 'google', label: 'Google Fonts' },
  { value: 'system', label: 'System Font' },
  { value: 'custom', label: 'Custom' },
];

export function BrandKitDrawer({ kit, onClose, onSave }: BrandKitDrawerProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState(kit?.name || '');
  const [description, setDescription] = useState(kit?.description || '');
  const [logos, setLogos] = useState<BrandLogo[]>(kit?.latest_version?.logos || []);
  const [colors, setColors] = useState<BrandKitColors>(
    kit?.latest_version?.colors || {
      primary: { hex: '#2563eb', name: 'Primary Blue' },
      secondary: { hex: '#475569', name: 'Slate' },
      accent: { hex: '#10b981', name: 'Emerald' },
      background: { hex: '#ffffff', name: 'White' },
      text: { hex: '#0f172a', name: 'Slate 900' },
    }
  );
  const [fonts, setFonts] = useState<BrandKitFonts>(
    kit?.latest_version?.fonts || {
      primary: { name: 'Inter', source: 'google' },
      secondary: { name: 'Inter', source: 'google' },
    }
  );

  const [logoUrls, setLogoUrls] = useState<Record<number, string>>({});
  const [logoTab, setLogoTab] = useState<'upload' | 'url' | 'drive'>('upload');
  const [newLogoUrl, setNewLogoUrl] = useState('');
  const [newLogoLabel, setNewLogoLabel] = useState<BrandLogoLabel>('primary');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadLogoUrls();
  }, [logos]);

  const loadLogoUrls = async () => {
    const urls: Record<number, string> = {};
    for (let i = 0; i < logos.length; i++) {
      const url = await getBrandLogoUrl(logos[i]);
      if (url) urls[i] = url;
    }
    setLogoUrls(urls);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.organization_id) return;

    setUploading(true);
    try {
      const storagePath = await uploadBrandLogo(user.organization_id, file, newLogoLabel);
      setLogos([...logos, { source_type: 'upload', storage_path: storagePath, label: newLogoLabel }]);
    } catch (error) {
      console.error('Failed to upload logo:', error);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAddUrlLogo = () => {
    if (!newLogoUrl) return;
    setLogos([...logos, { source_type: 'url', url: newLogoUrl, label: newLogoLabel }]);
    setNewLogoUrl('');
  };

  const handleRemoveLogo = async (index: number) => {
    const logo = logos[index];
    if (logo.source_type === 'upload' && logo.storage_path && user?.organization_id) {
      try {
        await deleteBrandLogo(user.organization_id, logo.storage_path);
      } catch (error) {
        console.error('Failed to delete logo file:', error);
      }
    }
    setLogos(logos.filter((_, i) => i !== index));
  };

  const handleColorChange = (key: BrandColorKey, hex: string) => {
    setColors({
      ...colors,
      [key]: { ...colors[key], hex },
    });
  };

  const handleColorNameChange = (key: BrandColorKey, colorName: string) => {
    setColors({
      ...colors,
      [key]: { ...colors[key], name: colorName },
    });
  };

  const handleSave = async () => {
    if (!user?.organization_id || !user.id || !name.trim()) return;

    setSaving(true);
    try {
      if (kit) {
        await updateBrandKit(kit.id, { name, description: description || undefined, logos, colors, fonts }, user.id);
      } else {
        await createBrandKit(user.organization_id, { name, description: description || undefined, logos, colors, fonts }, user.id);
      }
      onSave();
    } catch (error) {
      console.error('Failed to save brand kit:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="absolute inset-y-0 right-0 w-full max-w-2xl bg-white shadow-xl flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {kit ? 'Edit Brand Kit' : 'Create Brand Kit'}
          </h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Brand Kit"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of this brand kit..."
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-sm font-medium text-gray-900 mb-4">Logos</h3>

            {logos.length > 0 && (
              <div className="grid grid-cols-2 gap-3 mb-4">
                {logos.map((logo, index) => (
                  <div key={index} className="relative group border border-gray-200 rounded-lg p-3 bg-gray-50">
                    <div className="flex items-center gap-3">
                      {logoUrls[index] ? (
                        <img src={logoUrls[index]} alt={logo.label} className="w-12 h-12 object-contain rounded" />
                      ) : (
                        <div className="w-12 h-12 flex items-center justify-center bg-gray-100 rounded">
                          <Image className="w-5 h-5 text-gray-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 capitalize">{logo.label}</p>
                        <p className="text-xs text-gray-500 capitalize">{logo.source_type}</p>
                      </div>
                      <button
                        onClick={() => handleRemoveLogo(index)}
                        className="p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
              <div className="flex gap-2 mb-4">
                {[
                  { id: 'upload', label: 'Upload', icon: Upload },
                  { id: 'url', label: 'URL', icon: Link },
                  { id: 'drive', label: 'Drive', icon: FolderOpen },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setLogoTab(tab.id as typeof logoTab)}
                    className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                      logoTab === tab.id ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Label</label>
                  <select
                    value={newLogoLabel}
                    onChange={(e) => setNewLogoLabel(e.target.value as BrandLogoLabel)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    {LOGO_LABELS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                {logoTab === 'upload' && (
                  <div className="flex-1">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml,image/webp"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {uploading ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                      ) : (
                        <>
                          <Upload className="w-4 h-4" />
                          Upload File
                        </>
                      )}
                    </button>
                  </div>
                )}

                {logoTab === 'url' && (
                  <>
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Image URL</label>
                      <input
                        type="url"
                        value={newLogoUrl}
                        onChange={(e) => setNewLogoUrl(e.target.value)}
                        placeholder="https://example.com/logo.png"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                    <button
                      onClick={handleAddUrlLogo}
                      disabled={!newLogoUrl}
                      className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </>
                )}

                {logoTab === 'drive' && (
                  <div className="flex-1 text-center py-4 text-sm text-gray-500">
                    Google Drive integration coming soon
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-sm font-medium text-gray-900 mb-4">Colors</h3>
            <div className="grid grid-cols-1 gap-4">
              {COLOR_KEYS.map(({ key, label }) => (
                <div key={key} className="flex items-center gap-4">
                  <div className="flex items-center gap-2 w-32">
                    <input
                      type="color"
                      value={colors[key]?.hex || '#cccccc'}
                      onChange={(e) => handleColorChange(key, e.target.value)}
                      className="w-8 h-8 rounded cursor-pointer border border-gray-300"
                    />
                    <span className="text-sm font-medium text-gray-700">{label}</span>
                  </div>
                  <input
                    type="text"
                    value={colors[key]?.hex || ''}
                    onChange={(e) => handleColorChange(key, e.target.value)}
                    placeholder="#000000"
                    className="w-24 px-2 py-1 border border-gray-300 rounded text-sm font-mono"
                  />
                  <input
                    type="text"
                    value={colors[key]?.name || ''}
                    onChange={(e) => handleColorNameChange(key, e.target.value)}
                    placeholder="Color name (optional)"
                    className="flex-1 px-3 py-1 border border-gray-300 rounded text-sm"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-sm font-medium text-gray-900 mb-4">Fonts</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Primary Font</label>
                <input
                  type="text"
                  value={fonts.primary?.name || ''}
                  onChange={(e) => setFonts({ ...fonts, primary: { ...fonts.primary, name: e.target.value } })}
                  placeholder="Inter"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <select
                  value={fonts.primary?.source || 'google'}
                  onChange={(e) => setFonts({ ...fonts, primary: { ...fonts.primary, source: e.target.value as 'google' | 'system' | 'custom' } })}
                  className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  {FONT_SOURCES.map((src) => (
                    <option key={src.value} value={src.value}>{src.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Secondary Font</label>
                <input
                  type="text"
                  value={fonts.secondary?.name || ''}
                  onChange={(e) => setFonts({ ...fonts, secondary: { ...fonts.secondary, name: e.target.value } })}
                  placeholder="Inter"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <select
                  value={fonts.secondary?.source || 'google'}
                  onChange={(e) => setFonts({ ...fonts, secondary: { ...fonts.secondary, source: e.target.value as 'google' | 'system' | 'custom' } })}
                  className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  {FONT_SOURCES.map((src) => (
                    <option key={src.value} value={src.value}>{src.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : kit ? 'Save Changes' : 'Create Brand Kit'}
          </button>
        </div>
      </div>
    </div>
  );
}
