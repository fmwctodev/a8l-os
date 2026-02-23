import { Sparkles } from 'lucide-react';
import { useAssistant } from '../../contexts/AssistantContext';

interface AskClaraButtonProps {
  module: string;
  recordId: string;
  prompt?: string;
  label?: string;
  size?: 'sm' | 'md';
}

export function AskClaraButton({
  module,
  recordId,
  prompt,
  label = 'Ask Clara',
  size = 'sm',
}: AskClaraButtonProps) {
  const { openWithContext, profile } = useAssistant();

  if (!profile?.enabled) return null;

  const sizeClasses = size === 'sm'
    ? 'px-2.5 py-1 text-[11px] gap-1'
    : 'px-3 py-1.5 text-xs gap-1.5';

  return (
    <button
      onClick={() => openWithContext(module, recordId, prompt)}
      className={`flex items-center ${sizeClasses} bg-cyan-600/10 border border-cyan-500/20 rounded-lg text-cyan-400 hover:bg-cyan-600/20 hover:border-cyan-500/30 transition-colors font-medium`}
    >
      <Sparkles className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      {label}
    </button>
  );
}
