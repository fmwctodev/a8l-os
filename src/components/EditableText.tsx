import { useEffect, useRef, useState } from 'react';

interface EditableTextProps {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  multiline?: boolean;
  autoFocus?: boolean;
}

export function EditableText({
  value,
  onChange,
  placeholder = 'Click to edit',
  className = '',
  inputClassName,
  multiline = false,
  autoFocus = false,
}: EditableTextProps) {
  const [editing, setEditing] = useState(autoFocus);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      if ('select' in inputRef.current) inputRef.current.select();
    }
  }, [editing]);

  const commit = () => {
    setEditing(false);
    if (draft !== value) onChange(draft);
  };

  const cancel = () => {
    setEditing(false);
    setDraft(value);
  };

  const stopAndStartEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditing(true);
  };

  if (editing) {
    const handlerProps = {
      value: draft,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setDraft(e.target.value),
      onBlur: commit,
      onClick: (e: React.MouseEvent) => e.stopPropagation(),
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !multiline) {
          e.preventDefault();
          commit();
        }
        if (e.key === 'Enter' && multiline && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          commit();
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          cancel();
        }
      },
      className:
        inputClassName ??
        `${className} bg-white border border-blue-400 rounded px-1 py-0.5 outline-none focus:ring-2 focus:ring-blue-200 w-full`,
    };

    if (multiline) {
      return (
        <textarea
          ref={(el) => {
            inputRef.current = el;
          }}
          rows={2}
          {...handlerProps}
        />
      );
    }
    return (
      <input
        ref={(el) => {
          inputRef.current = el;
        }}
        type="text"
        {...handlerProps}
      />
    );
  }

  return (
    <span
      onClick={stopAndStartEdit}
      title="Click to edit"
      className={`${className} cursor-text hover:bg-gray-100 hover:ring-1 hover:ring-gray-200 rounded px-1 -mx-1 transition-colors`}
    >
      {value || (
        <span className="text-gray-400 italic">{placeholder}</span>
      )}
    </span>
  );
}
