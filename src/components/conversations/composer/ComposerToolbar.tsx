import type { ReactNode } from 'react';

interface ComposerToolbarProps {
  leftIcons: ReactNode;
  centerContent?: ReactNode;
  onClear: () => void;
  onSend: () => void;
  sendDisabled: boolean;
  sending: boolean;
}

export function ComposerToolbar({
  leftIcons,
  centerContent,
  onClear,
  onSend,
  sendDisabled,
  sending,
}: ComposerToolbarProps) {
  return (
    <div className="flex items-center justify-between px-4 py-2 border-t border-gray-200">
      <div className="flex items-center gap-1">
        {leftIcons}
      </div>

      <div className="flex items-center gap-3">
        {centerContent && (
          <span className="text-sm text-gray-400 mr-2">{centerContent}</span>
        )}
        <button
          onClick={onClear}
          className="px-4 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Clear
        </button>
        <button
          onClick={onSend}
          disabled={sendDisabled}
          className="px-6 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {sending ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mx-2" />
          ) : (
            'Send'
          )}
        </button>
      </div>
    </div>
  );
}
