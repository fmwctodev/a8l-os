import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import { useState, useEffect } from 'react';
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Link as LinkIcon,
  Unlink,
} from 'lucide-react';

interface RichTextBlockProps {
  content: string;
  placeholder?: string;
  onChange: (html: string) => void;
  onFocus?: () => void;
  readOnly?: boolean;
}

export function RichTextBlock({
  content,
  placeholder = 'Start typing...',
  onChange,
  onFocus,
  readOnly = false,
}: RichTextBlockProps) {
  const [focused, setFocused] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
      }),
      Placeholder.configure({ placeholder }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'text-cyan-400 underline' },
      }),
    ],
    content,
    editable: !readOnly,
    editorProps: {
      attributes: {
        class:
          'prose prose-invert prose-sm max-w-none focus:outline-none min-h-[2rem] text-slate-200 leading-relaxed',
      },
    },
    onUpdate: ({ editor: e }) => {
      const html = e.getHTML();
      const isEmpty = e.isEmpty;
      onChange(isEmpty ? '' : html);
    },
    onFocus: () => {
      setFocused(true);
      onFocus?.();
    },
    onBlur: () => setFocused(false),
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML() && content !== '') {
      editor.commands.setContent(content, false);
    }
  }, [content]);

  if (!editor) return null;

  function toggleLink() {
    if (!editor) return;
    if (editor.isActive('link')) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    const url = window.prompt('Enter URL:');
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  }

  return (
    <div className="relative">
      {focused && (
        <div className="flex items-center gap-0.5 mb-2 p-1 bg-slate-700/60 border border-slate-600/50 rounded-lg w-fit">
          <ToolbarButton
            active={editor.isActive('bold')}
            onClick={() => editor.chain().focus().toggleBold().run()}
            title="Bold"
          >
            <Bold className="w-3.5 h-3.5" />
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive('italic')}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            title="Italic"
          >
            <Italic className="w-3.5 h-3.5" />
          </ToolbarButton>
          <div className="w-px h-4 bg-slate-600 mx-0.5" />
          <ToolbarButton
            active={editor.isActive('bulletList')}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            title="Bullet List"
          >
            <List className="w-3.5 h-3.5" />
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive('orderedList')}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            title="Numbered List"
          >
            <ListOrdered className="w-3.5 h-3.5" />
          </ToolbarButton>
          <div className="w-px h-4 bg-slate-600 mx-0.5" />
          <ToolbarButton
            active={editor.isActive('link')}
            onClick={toggleLink}
            title={editor.isActive('link') ? 'Remove Link' : 'Add Link'}
          >
            {editor.isActive('link') ? (
              <Unlink className="w-3.5 h-3.5" />
            ) : (
              <LinkIcon className="w-3.5 h-3.5" />
            )}
          </ToolbarButton>
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}

function ToolbarButton({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      title={title}
      className={`p-1.5 rounded transition-colors ${
        active
          ? 'bg-cyan-600/30 text-cyan-300'
          : 'text-slate-400 hover:text-white hover:bg-slate-600'
      }`}
    >
      {children}
    </button>
  );
}
