import { useCallback, useRef } from 'react';
import { X } from 'lucide-react';
import { RichTextBlock } from './RichTextBlock';
import type { GuidelineBlock } from '../../types/socialManager';

interface GuidelineBlockEditorProps {
  title: string;
  blocks: GuidelineBlock[];
  onChange: (blocks: GuidelineBlock[]) => void;
  readOnly?: boolean;
}

export function GuidelineBlockEditor({
  title,
  blocks,
  onChange,
  readOnly = false,
}: GuidelineBlockEditorProps) {
  const pendingNewBlock = useRef(false);

  const handleBlockChange = useCallback(
    (index: number, html: string) => {
      const updated = [...blocks];
      updated[index] = { content: html };
      onChange(updated);
    },
    [blocks, onChange]
  );

  const handleRemoveBlock = useCallback(
    (index: number) => {
      onChange(blocks.filter((_, i) => i !== index));
    },
    [blocks, onChange]
  );

  const handleNewBlockFocus = useCallback(() => {
    if (pendingNewBlock.current) return;
    pendingNewBlock.current = true;
    onChange([...blocks, { content: '' }]);
    requestAnimationFrame(() => {
      pendingNewBlock.current = false;
    });
  }, [blocks, onChange]);

  const handleNewBlockChange = useCallback(
    (html: string) => {
      if (html) {
        onChange([...blocks, { content: html }]);
      }
    },
    [blocks, onChange]
  );

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-700/50">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
      </div>

      <div className="divide-y divide-slate-700/40">
        {blocks.map((block, index) => (
          <div key={index} className="flex gap-3 px-5 py-4 group">
            <div className="flex-shrink-0 mt-1">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-amber-400/15 border border-amber-400/30 text-amber-300 text-xs font-semibold">
                {index + 1}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <RichTextBlock
                content={block.content}
                onChange={(html) => handleBlockChange(index, html)}
                readOnly={readOnly}
              />
            </div>
            {!readOnly && (
              <div className="flex-shrink-0 mt-1">
                <button
                  type="button"
                  onClick={() => handleRemoveBlock(index)}
                  className="p-1 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                  title="Remove block"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        ))}

        {!readOnly && (
          <div className="flex gap-3 px-5 py-4">
            <div className="flex-shrink-0 mt-1">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-amber-400/10 border border-amber-400/20 text-amber-400/50 text-xs font-semibold">
                {blocks.length + 1}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <RichTextBlock
                key={`new-${blocks.length}`}
                content=""
                placeholder="Start typing..."
                onChange={handleNewBlockChange}
                onFocus={handleNewBlockFocus}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
