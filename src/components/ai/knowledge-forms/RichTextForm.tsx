import { useState, useRef, useEffect } from 'react';
import {
  FileText,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  ListOrdered,
  Link as LinkIcon,
  Code,
} from 'lucide-react';
import { FormFooter } from './FormFooter';
import type { RichTextSourceConfig } from '../../../types';

interface RichTextFormProps {
  existingConfig: Record<string, unknown>;
  onSave: (config: Record<string, unknown>) => void;
  onCancel: () => void;
  saving: boolean;
  isEditing: boolean;
}

export function RichTextForm({
  existingConfig,
  onSave,
  onCancel,
  saving,
  isEditing,
}: RichTextFormProps) {
  const config = existingConfig as Partial<RichTextSourceConfig>;
  const [content, setContent] = useState(config.content || '');
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editorRef.current && config.content) {
      editorRef.current.innerHTML = config.content;
    }
  }, []);

  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  };

  const handleInput = () => {
    if (editorRef.current) {
      setContent(editorRef.current.innerHTML);
    }
  };

  const handleSubmit = () => {
    const plainText = editorRef.current?.innerText || '';
    const newConfig: RichTextSourceConfig = {
      content,
      plainText,
    };
    onSave(newConfig);
  };

  return (
    <div>
      <div className="flex items-center gap-3 p-4 bg-slate-800/50 rounded-lg border border-slate-700 mb-6">
        <FileText className="w-6 h-6 text-amber-400" />
        <div>
          <h3 className="font-medium text-white">Rich Text</h3>
          <p className="text-sm text-slate-400">Create formatted content with a rich text editor.</p>
        </div>
      </div>

      <div className="border border-slate-700 rounded-lg overflow-hidden">
        <div className="flex flex-wrap items-center gap-1 px-3 py-2 bg-slate-800 border-b border-slate-700">
          <select
            onChange={(e) => execCommand('formatBlock', e.target.value)}
            className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-sm text-white"
            defaultValue=""
          >
            <option value="" disabled>Paragraph</option>
            <option value="p">Paragraph</option>
            <option value="h1">Heading 1</option>
            <option value="h2">Heading 2</option>
            <option value="h3">Heading 3</option>
          </select>

          <div className="w-px h-6 bg-slate-600 mx-2" />

          <button
            onClick={() => execCommand('bold')}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded"
            title="Bold"
          >
            <Bold className="w-4 h-4" />
          </button>
          <button
            onClick={() => execCommand('italic')}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded"
            title="Italic"
          >
            <Italic className="w-4 h-4" />
          </button>
          <button
            onClick={() => execCommand('underline')}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded"
            title="Underline"
          >
            <Underline className="w-4 h-4" />
          </button>
          <button
            onClick={() => execCommand('strikeThrough')}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded"
            title="Strikethrough"
          >
            <Strikethrough className="w-4 h-4" />
          </button>

          <div className="w-px h-6 bg-slate-600 mx-2" />

          <button
            onClick={() => execCommand('justifyLeft')}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded"
            title="Align Left"
          >
            <AlignLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => execCommand('justifyCenter')}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded"
            title="Align Center"
          >
            <AlignCenter className="w-4 h-4" />
          </button>
          <button
            onClick={() => execCommand('justifyRight')}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded"
            title="Align Right"
          >
            <AlignRight className="w-4 h-4" />
          </button>

          <div className="w-px h-6 bg-slate-600 mx-2" />

          <button
            onClick={() => execCommand('insertUnorderedList')}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded"
            title="Bullet List"
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => execCommand('insertOrderedList')}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded"
            title="Numbered List"
          >
            <ListOrdered className="w-4 h-4" />
          </button>

          <div className="w-px h-6 bg-slate-600 mx-2" />

          <button
            onClick={() => {
              const url = prompt('Enter URL:');
              if (url) execCommand('createLink', url);
            }}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded"
            title="Insert Link"
          >
            <LinkIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => execCommand('formatBlock', 'pre')}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded"
            title="Code Block"
          >
            <Code className="w-4 h-4" />
          </button>
        </div>

        <div
          ref={editorRef}
          contentEditable
          onInput={handleInput}
          className="min-h-[300px] p-4 bg-slate-800/50 text-white focus:outline-none prose prose-invert max-w-none"
          style={{ whiteSpace: 'pre-wrap' }}
        />
      </div>

      <FormFooter
        onCancel={onCancel}
        onSubmit={handleSubmit}
        saving={saving}
        isEditing={isEditing}
        disabled={!content.trim()}
        submitLabel="Save"
      />
    </div>
  );
}
