import { Loader2 } from 'lucide-react';

interface FormFooterProps {
  onCancel: () => void;
  onSubmit: () => void;
  saving: boolean;
  isEditing: boolean;
  disabled?: boolean;
  submitLabel?: string;
}

export function FormFooter({
  onCancel,
  onSubmit,
  saving,
  isEditing,
  disabled,
  submitLabel,
}: FormFooterProps) {
  return (
    <div className="flex justify-end gap-3 pt-6 mt-6 border-t border-slate-700">
      <button
        onClick={onCancel}
        className="px-4 py-2 text-slate-300 hover:text-white transition-colors"
      >
        Cancel
      </button>
      <button
        onClick={onSubmit}
        disabled={saving || disabled}
        className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
        {submitLabel || (isEditing ? 'Save Changes' : 'Create')}
      </button>
    </div>
  );
}
