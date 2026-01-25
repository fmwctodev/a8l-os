import { useState, useRef } from 'react';
import { Plus, X, Upload, Image as ImageIcon, Save, Trash2, Type } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import { updateBrandKitVisualIdentity, uploadBrandLogo, getBrandLogoUrl } from '../../../../services/brandboard';
import type { BrandKitWithVersion, BrandLogo, BrandKitColors, BrandKitFonts, BrandColor } from '../../../../types';

interface VisualIdentityTabProps {
  kit: BrandKitWithVersion;
  onUpdate: () => void;
  canManage: boolean;
}

interface ColorInputProps {
  label: string;
  color: BrandColor | undefined;
  onChange: (color: BrandColor) => void;
  disabled: boolean;
}

function ColorInput({ label, color, onChange, disabled }: ColorInputProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative">
        <input
          type="color"
          value={color?.hex || '#000000'}
          onChange={(e) => onChange({ ...color, hex: e.target.value })}
          disabled={disabled}
          className="w-10 h-10 rounded-lg border border-slate-600 cursor-pointer disabled:cursor-not-allowed bg-transparent"
        />
      </div>
      <div className="flex-1">
        <label className="block text-xs text-slate-400 mb-1">{label}</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={color?.hex || ''}
            onChange={(e) => onChange({ ...color, hex: e.target.value })}
            disabled={disabled}
            placeholder="#000000"
            className="w-24 px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 disabled:opacity-60"
          />
          <input
            type="text"
            value={color?.name || ''}
            onChange={(e) => onChange({ ...color, hex: color?.hex || '#000000', name: e.target.value })}
            disabled={disabled}
            placeholder="Name (optional)"
            className="flex-1 px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 disabled:opacity-60"
          />
        </div>
      </div>
    </div>
  );
}

export function VisualIdentityTab({ kit, onUpdate, canManage }: VisualIdentityTabProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [logos, setLogos] = useState<BrandLogo[]>(kit.latest_version?.logos || []);
  const [colors, setColors] = useState<BrandKitColors>(kit.latest_version?.colors || {});
  const [fonts, setFonts] = useState<BrandKitFonts>(kit.latest_version?.fonts || {});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadLabel, setUploadLabel] = useState<string>('primary');
  const [hasChanges, setHasChanges] = useState(false);
  const [logoUrls, setLogoUrls] = useState<Record<number, string>>({});

  const isEditable = kit.status === 'draft' && canManage;

  useState(() => {
    logos.forEach(async (logo, idx) => {
      const url = await getBrandLogoUrl(logo);
      if (url) {
        setLogoUrls((prev) => ({ ...prev, [idx]: url }));
      }
    });
  });

  const handleColorChange = (key: keyof BrandKitColors, value: BrandColor) => {
    setColors((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleFontChange = (key: keyof BrandKitFonts, field: 'name' | 'source', value: string) => {
    setFonts((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }));
    setHasChanges(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.organization_id) return;

    setUploading(true);
    try {
      const storagePath = await uploadBrandLogo(user.organization_id, file, uploadLabel);
      const newLogo: BrandLogo = {
        source_type: 'upload',
        storage_path: storagePath,
        label: uploadLabel as BrandLogo['label'],
      };
      setLogos((prev) => [...prev, newLogo]);
      setHasChanges(true);
    } catch (error) {
      console.error('Failed to upload logo:', error);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveLogo = (index: number) => {
    setLogos((prev) => prev.filter((_, i) => i !== index));
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!user?.id) return;
    setSaving(true);
    try {
      await updateBrandKitVisualIdentity(kit.id, { logos, colors, fonts }, user.id);
      setHasChanges(false);
      onUpdate();
    } catch (error) {
      console.error('Failed to save:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-white">Logos</h2>
            <p className="text-sm text-slate-400 mt-1">Upload your brand logos for different use cases</p>
          </div>
          {isEditable && (
            <div className="flex items-center gap-2">
              <select
                value={uploadLabel}
                onChange={(e) => setUploadLabel(e.target.value)}
                className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:ring-2 focus:ring-cyan-500"
              >
                <option value="primary">Primary Logo</option>
                <option value="secondary">Secondary Logo</option>
                <option value="icon">Icon / Mark</option>
                <option value="light">Light Background</option>
                <option value="dark">Dark Background</option>
              </select>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-700 text-white text-sm font-medium rounded-lg hover:bg-slate-600 transition-colors disabled:opacity-50"
              >
                <Upload className="w-4 h-4" />
                {uploading ? 'Uploading...' : 'Upload'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          )}
        </div>

        {logos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 bg-slate-900/50 rounded-lg border border-dashed border-slate-700">
            <ImageIcon className="w-12 h-12 text-slate-600 mb-3" />
            <p className="text-slate-400 text-sm">No logos uploaded yet</p>
            {isEditable && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="mt-3 text-cyan-400 text-sm hover:text-cyan-300"
              >
                Upload your first logo
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {logos.map((logo, idx) => (
              <div key={idx} className="relative group">
                <div className="aspect-square bg-slate-900 rounded-lg border border-slate-700 flex items-center justify-center p-4">
                  {logoUrls[idx] ? (
                    <img src={logoUrls[idx]} alt={logo.label} className="max-w-full max-h-full object-contain" />
                  ) : (
                    <ImageIcon className="w-8 h-8 text-slate-600" />
                  )}
                </div>
                <div className="absolute bottom-2 left-2 right-2">
                  <span className="text-xs bg-slate-800/90 text-slate-300 px-2 py-1 rounded capitalize">
                    {logo.label}
                  </span>
                </div>
                {isEditable && (
                  <button
                    onClick={() => handleRemoveLogo(idx)}
                    className="absolute top-2 right-2 p-1.5 bg-red-500/80 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-white">Colors</h2>
          <p className="text-sm text-slate-400 mt-1">Define your brand color palette</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ColorInput
            label="Primary Color"
            color={colors.primary}
            onChange={(c) => handleColorChange('primary', c)}
            disabled={!isEditable}
          />
          <ColorInput
            label="Secondary Color"
            color={colors.secondary}
            onChange={(c) => handleColorChange('secondary', c)}
            disabled={!isEditable}
          />
          <ColorInput
            label="Accent Color"
            color={colors.accent}
            onChange={(c) => handleColorChange('accent', c)}
            disabled={!isEditable}
          />
          <ColorInput
            label="Background Color"
            color={colors.background}
            onChange={(c) => handleColorChange('background', c)}
            disabled={!isEditable}
          />
          <ColorInput
            label="Text Color"
            color={colors.text}
            onChange={(c) => handleColorChange('text', c)}
            disabled={!isEditable}
          />
        </div>

        {colors.primary?.hex && (
          <div className="mt-6 pt-6 border-t border-slate-700">
            <label className="block text-sm text-slate-400 mb-3">Preview</label>
            <div className="flex gap-2">
              {Object.entries(colors).map(([key, color]) => color?.hex && (
                <div key={key} className="text-center">
                  <div
                    className="w-12 h-12 rounded-lg border border-slate-600 shadow-inner"
                    style={{ backgroundColor: color.hex }}
                  />
                  <span className="text-xs text-slate-400 mt-1 block capitalize">{key}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Type className="w-5 h-5" />
            Typography
          </h2>
          <p className="text-sm text-slate-400 mt-1">Set your brand fonts</p>
        </div>

        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Primary Font</label>
            <div className="flex gap-3">
              <input
                type="text"
                value={fonts.primary?.name || ''}
                onChange={(e) => handleFontChange('primary', 'name', e.target.value)}
                disabled={!isEditable}
                placeholder="e.g., Inter, Roboto"
                className="flex-1 px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 disabled:opacity-60"
              />
              <select
                value={fonts.primary?.source || 'google'}
                onChange={(e) => handleFontChange('primary', 'source', e.target.value)}
                disabled={!isEditable}
                className="px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-cyan-500 disabled:opacity-60"
              >
                <option value="google">Google Fonts</option>
                <option value="system">System Font</option>
                <option value="custom">Custom</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Secondary Font</label>
            <div className="flex gap-3">
              <input
                type="text"
                value={fonts.secondary?.name || ''}
                onChange={(e) => handleFontChange('secondary', 'name', e.target.value)}
                disabled={!isEditable}
                placeholder="e.g., Georgia, Merriweather"
                className="flex-1 px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 disabled:opacity-60"
              />
              <select
                value={fonts.secondary?.source || 'google'}
                onChange={(e) => handleFontChange('secondary', 'source', e.target.value)}
                disabled={!isEditable}
                className="px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-cyan-500 disabled:opacity-60"
              >
                <option value="google">Google Fonts</option>
                <option value="system">System Font</option>
                <option value="custom">Custom</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {hasChanges && isEditable && (
        <div className="flex justify-end sticky bottom-6">
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-teal-600 text-white text-sm font-medium rounded-lg hover:from-cyan-600 hover:to-teal-700 transition-all disabled:opacity-50 shadow-lg shadow-cyan-500/20"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Visual Identity'}
          </button>
        </div>
      )}
    </div>
  );
}
