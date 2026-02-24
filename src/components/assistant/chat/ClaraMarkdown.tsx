import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';

interface ClaraMarkdownProps {
  content: string;
}

const components: Components = {
  p: ({ children }) => (
    <p className="text-xs text-slate-200 leading-relaxed mb-1.5 last:mb-0">{children}</p>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-slate-100">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="italic text-slate-300">{children}</em>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-cyan-400 hover:text-cyan-300 underline underline-offset-2 transition-colors"
    >
      {children}
    </a>
  ),
  ul: ({ children }) => (
    <ul className="text-xs text-slate-200 leading-relaxed space-y-1 my-1.5 ml-1">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="text-xs text-slate-200 leading-relaxed space-y-1 my-1.5 ml-1 list-decimal list-inside">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="text-xs text-slate-200 leading-relaxed">
      <span className="text-slate-500 mr-1">&#8226;</span>
      {children}
    </li>
  ),
  h1: ({ children }) => (
    <p className="text-sm font-semibold text-slate-100 mb-1">{children}</p>
  ),
  h2: ({ children }) => (
    <p className="text-xs font-semibold text-slate-100 mb-1">{children}</p>
  ),
  h3: ({ children }) => (
    <p className="text-xs font-semibold text-slate-200 mb-0.5">{children}</p>
  ),
  h4: ({ children }) => (
    <p className="text-xs font-medium text-slate-200 mb-0.5">{children}</p>
  ),
  code: ({ children, className }) => {
    const isBlock = className?.includes('language-');
    if (isBlock) {
      return (
        <pre className="text-[10px] text-slate-300 bg-slate-900/60 rounded px-2 py-1.5 overflow-x-auto my-1.5">
          <code>{children}</code>
        </pre>
      );
    }
    return (
      <code className="text-[11px] text-cyan-300 bg-slate-900/50 rounded px-1 py-0.5">{children}</code>
    );
  },
  pre: ({ children }) => <>{children}</>,
  hr: () => <hr className="border-slate-700/50 my-2" />,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-cyan-500/30 pl-2 my-1.5 text-slate-400 italic">
      {children}
    </blockquote>
  ),
};

export function ClaraMarkdown({ content }: ClaraMarkdownProps) {
  return <ReactMarkdown components={components}>{content}</ReactMarkdown>;
}
