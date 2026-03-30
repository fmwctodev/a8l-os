import { Sparkles, X } from 'lucide-react';
import { useAssistant } from '../../contexts/AssistantContext';

export function AssistantFAB() {
  const { togglePanel, isPanelOpen, profile } = useAssistant();

  if (!profile?.enabled) return null;

  return (
    <button
      onClick={togglePanel}
      className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 group touch-manipulation"
      title="Clara AI Assistant (Ctrl+Shift+K)"
    >
      <span className="absolute inset-0 rounded-full bg-cyan-500/20 animate-ping" style={{ animationDuration: '3s' }} />
      <span
        className={`
          relative flex items-center justify-center w-14 h-14 rounded-full
          bg-gradient-to-br from-cyan-500 to-teal-600
          shadow-lg shadow-cyan-500/25
          transition-all duration-200 ease-out
          group-hover:scale-105 group-hover:shadow-cyan-500/40
        `}
      >
        {isPanelOpen ? (
          <X className="w-5 h-5 text-white transition-transform duration-200" />
        ) : (
          <Sparkles className="w-5 h-5 text-white transition-transform duration-200" />
        )}
      </span>
    </button>
  );
}
