import { useState } from 'react';
import { Share2, X, Copy, Check, ExternalLink } from 'lucide-react';

interface ShareCalendarModalProps {
  open: boolean;
  onClose: () => void;
  calendarName: string;
  calendarSlug: string;
  typeSlug?: string;
}

type Tab = 'link' | 'inline' | 'popup';

const TABS: { id: Tab; label: string }[] = [
  { id: 'link', label: 'Public link' },
  { id: 'inline', label: 'Inline embed' },
  { id: 'popup', label: 'Popup embed' },
];

function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text).then(
      () => true,
      () => false
    );
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return Promise.resolve(ok);
  } catch {
    return Promise.resolve(false);
  }
}

export function ShareCalendarModal({
  open,
  onClose,
  calendarName,
  calendarSlug,
  typeSlug,
}: ShareCalendarModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>('link');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!open) return null;

  const origin =
    typeof window !== 'undefined' ? window.location.origin : '';
  const widgetSrc =
    (import.meta.env.VITE_BOOKING_WIDGET_URL as string | undefined) ||
    `${origin}/booking-widget.js`;

  const publicPath = typeSlug
    ? `/book/${calendarSlug}/${typeSlug}`
    : `/book/${calendarSlug}`;
  const publicUrl = `${origin}${publicPath}`;

  const inlineSnippet = `<div id="a8l-booking"></div>
<script src="${widgetSrc}"
  data-base-url="${origin}"
  data-calendar-slug="${calendarSlug}"${
    typeSlug ? `\n  data-type-slug="${typeSlug}"` : ''
  }
  data-mode="inline"
  data-target="#a8l-booking"></script>`;

  const popupSnippet = `<script src="${widgetSrc}"
  data-base-url="${origin}"
  data-calendar-slug="${calendarSlug}"${
    typeSlug ? `\n  data-type-slug="${typeSlug}"` : ''
  }
  data-mode="popup"
  data-button-text="Book a meeting"
  data-primary-color="#0891b2"></script>`;

  const handleCopy = async (key: string, value: string) => {
    const ok = await copyToClipboard(value);
    if (ok) {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((c) => (c === key ? null : c)), 1500);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div
          className="bg-slate-900 rounded-xl border border-slate-700 w-full max-w-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-cyan-500/20 rounded-lg flex items-center justify-center">
                <Share2 className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Share</h2>
                <p className="text-xs text-slate-400">
                  {calendarName}
                  {typeSlug ? ` · ${typeSlug}` : ''}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-white rounded"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="px-6 pt-4 border-b border-slate-700">
            <nav className="flex gap-6">
              {TABS.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`py-3 border-b-2 transition-colors text-sm font-medium ${
                      isActive
                        ? 'border-cyan-500 text-cyan-400'
                        : 'border-transparent text-slate-400 hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="p-6 space-y-4">
            {activeTab === 'link' && (
              <>
                <p className="text-sm text-slate-400">
                  Share this URL with clients to send them straight to the
                  booking page.
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={publicUrl}
                    className="flex-1 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    onFocus={(e) => e.currentTarget.select()}
                  />
                  <button
                    onClick={() => handleCopy('link', publicUrl)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-cyan-500 text-white text-sm font-medium hover:bg-cyan-600 transition-colors"
                  >
                    {copiedKey === 'link' ? (
                      <>
                        <Check className="w-4 h-4" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        Copy
                      </>
                    )}
                  </button>
                  <a
                    href={publicUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 text-slate-300 text-sm font-medium hover:bg-slate-700 hover:text-white transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open
                  </a>
                </div>
              </>
            )}

            {activeTab === 'inline' && (
              <>
                <p className="text-sm text-slate-400">
                  Drop this snippet into any page to render the booking
                  calendar inline. The widget will resize itself to fit its
                  contents.
                </p>
                <textarea
                  readOnly
                  value={inlineSnippet}
                  rows={8}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-xs font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
                  onFocus={(e) => e.currentTarget.select()}
                />
                <button
                  onClick={() => handleCopy('inline', inlineSnippet)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-cyan-500 text-white text-sm font-medium hover:bg-cyan-600 transition-colors"
                >
                  {copiedKey === 'inline' ? (
                    <>
                      <Check className="w-4 h-4" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy snippet
                    </>
                  )}
                </button>
              </>
            )}

            {activeTab === 'popup' && (
              <>
                <p className="text-sm text-slate-400">
                  Add a floating "Book a meeting" button that opens the
                  calendar in a modal. Customize <code className="text-slate-300">data-button-text</code> and{' '}
                  <code className="text-slate-300">data-primary-color</code> to match your brand.
                </p>
                <textarea
                  readOnly
                  value={popupSnippet}
                  rows={8}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-xs font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
                  onFocus={(e) => e.currentTarget.select()}
                />
                <button
                  onClick={() => handleCopy('popup', popupSnippet)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-cyan-500 text-white text-sm font-medium hover:bg-cyan-600 transition-colors"
                >
                  {copiedKey === 'popup' ? (
                    <>
                      <Check className="w-4 h-4" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy snippet
                    </>
                  )}
                </button>
              </>
            )}
          </div>

          <div className="px-6 py-4 border-t border-slate-700 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-slate-300 hover:text-white transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
