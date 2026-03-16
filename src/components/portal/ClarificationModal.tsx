import { useState } from 'react';
import { MessageSquare, Send, AlertCircle } from 'lucide-react';

interface Props {
  authorName: string;
  onSend: (message: string) => Promise<void>;
  onClose: () => void;
}

export function ClarificationModal({ authorName, onSend, onClose }: Props) {
  const [message, setMessage] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  async function handleSend() {
    if (!message.trim()) return;
    setProcessing(true);
    setError('');
    try {
      await onSend(message.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send. Please try again.');
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">Request Clarification</h2>
            <p className="text-sm text-gray-500">Send a message to the project team</p>
          </div>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          Ask a question or request more information before making a decision. The project team will be notified.
        </p>

        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Your message <span className="text-red-500">*</span>
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            placeholder="What additional information do you need?"
            className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 resize-none text-gray-900 placeholder-gray-400"
            autoFocus
          />
          <p className="mt-1 text-xs text-gray-400">Sending as: {authorName}</p>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
            <AlertCircle className="w-4 h-4 flex-none" />
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={processing || !message.trim()}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl transition-colors"
          >
            <Send className="w-4 h-4" />
            {processing ? 'Sending...' : 'Send Message'}
          </button>
        </div>
      </div>
    </div>
  );
}
