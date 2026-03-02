import { useState } from 'react';
import {
  Star, Send, Wand2, Trash2, ExternalLink, Clock, AlertTriangle,
  Loader2, Copy, Check, X
} from 'lucide-react';
import type { ReputationReview, ReputationAIDraft } from '../../services/reputationReviews';
import {
  replyToReview, deleteReply, generateAIDrafts, applyDraft
} from '../../services/reputationReviews';

interface Props {
  review: ReputationReview;
  onUpdate: () => void;
  onClose: () => void;
}

const platformLabels: Record<string, string> = {
  googlebusiness: 'Google Business Profile',
  facebook: 'Facebook',
};

const toneLabels: Record<string, { label: string; color: string }> = {
  professional: { label: 'Professional', color: 'bg-slate-100 text-slate-700' },
  friendly: { label: 'Friendly', color: 'bg-sky-100 text-sky-700' },
  fix_it: { label: 'Problem-Solving', color: 'bg-amber-100 text-amber-700' },
};

export function ReviewDetailPanel({ review, onUpdate, onClose }: Props) {
  const [replyText, setReplyText] = useState('');
  const [posting, setPosting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [drafts, setDrafts] = useState<ReputationAIDraft[]>([]);
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDrafts, setShowDrafts] = useState(false);
  const [customInstructions, setCustomInstructions] = useState('');
  const [showInstructions, setShowInstructions] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function handlePostReply() {
    if (!replyText.trim()) return;
    setPosting(true);
    setError(null);
    try {
      await replyToReview(review.id, replyText.trim());
      setReplyText('');
      setDrafts([]);
      setSelectedDraftId(null);
      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post reply');
    } finally {
      setPosting(false);
    }
  }

  async function handleDeleteReply() {
    setDeleting(true);
    setError(null);
    try {
      await deleteReply(review.id);
      setConfirmDelete(false);
      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete reply');
    } finally {
      setDeleting(false);
    }
  }

  async function handleGenerateDrafts() {
    setGenerating(true);
    setError(null);
    try {
      const result = await generateAIDrafts(
        review.id,
        customInstructions.trim() || undefined
      );
      setDrafts(result.drafts);
      setShowDrafts(true);
      setShowInstructions(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate AI drafts');
    } finally {
      setGenerating(false);
    }
  }

  function selectDraft(draft: ReputationAIDraft) {
    setReplyText(draft.draft_text);
    setSelectedDraftId(draft.id);
  }

  async function handleApplyDraft() {
    if (!selectedDraftId) return;
    try {
      await applyDraft(selectedDraftId);
    } catch {
    }
  }

  function handleCopyReply() {
    if (!review.reply_text) return;
    navigator.clipboard.writeText(review.reply_text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900">Review Detail</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 lg:hidden">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-5 py-4 space-y-5">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
              {review.reviewer_profile_image ? (
                <img src={review.reviewer_profile_image} alt="" className="w-11 h-11 rounded-full object-cover" />
              ) : (
                <span className="text-sm font-semibold text-gray-500">
                  {(review.reviewer_name || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </span>
              )}
            </div>
            <div>
              <div className="font-medium text-gray-900 text-sm">
                {review.reviewer_name || 'Anonymous'}
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    className={`w-4 h-4 ${s <= review.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}`}
                  />
                ))}
                <span className="text-xs text-gray-500 ml-1">{review.rating}/5</span>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {platformLabels[review.platform] || review.platform} &bull;{' '}
                {new Date(review.review_created_at).toLocaleDateString('en-US', {
                  month: 'short', day: 'numeric', year: 'numeric'
                })}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {review.sla_breached && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-50 text-red-700 text-xs font-medium rounded-md">
                <Clock className="w-3 h-3" />
                SLA Breached
              </span>
            )}
            {review.escalated && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-50 text-amber-700 text-xs font-medium rounded-md">
                <AlertTriangle className="w-3 h-3" />
                Escalated
              </span>
            )}
            {review.priority !== 'normal' && (
              <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-md capitalize">
                {review.priority} Priority
              </span>
            )}
            {review.has_reply && (
              <span className="px-2 py-1 bg-green-50 text-green-700 text-xs font-medium rounded-md">
                Replied
              </span>
            )}
          </div>

          {review.review_text && (
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                {review.review_text}
              </p>
            </div>
          )}

          {review.review_url && (
            <a
              href={review.review_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              View on {platformLabels[review.platform] || 'platform'}
              <ExternalLink className="w-3 h-3" />
            </a>
          )}

          {review.has_reply && review.reply_text && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-green-800">Your Reply</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleCopyReply}
                    className="p-1 text-green-600 hover:text-green-700"
                    title="Copy reply"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                  {review.platform === 'googlebusiness' && (
                    <>
                      {!confirmDelete ? (
                        <button
                          onClick={() => setConfirmDelete(true)}
                          className="p-1 text-red-400 hover:text-red-600"
                          title="Delete reply"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={handleDeleteReply}
                            disabled={deleting}
                            className="px-2 py-0.5 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                          >
                            {deleting ? 'Deleting...' : 'Confirm'}
                          </button>
                          <button
                            onClick={() => setConfirmDelete(false)}
                            className="px-2 py-0.5 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                {review.reply_text}
              </p>
              {review.reply_created_at && (
                <p className="text-xs text-green-600 mt-2">
                  {new Date(review.reply_created_at).toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
                  })}
                </p>
              )}
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {!review.has_reply && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                  AI Reply Drafts
                </span>
                <div className="flex items-center gap-2">
                  {!showInstructions && (
                    <button
                      onClick={() => setShowInstructions(true)}
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      + Instructions
                    </button>
                  )}
                  <button
                    onClick={handleGenerateDrafts}
                    disabled={generating}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-xs font-medium rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 transition-all shadow-sm"
                  >
                    {generating ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-3.5 h-3.5" />
                        Generate 3 Drafts
                      </>
                    )}
                  </button>
                </div>
              </div>

              {showInstructions && (
                <div className="space-y-2">
                  <textarea
                    value={customInstructions}
                    onChange={(e) => setCustomInstructions(e.target.value)}
                    placeholder="E.g., mention our new loyalty program, apologize for the wait time..."
                    rows={2}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                  <button
                    onClick={() => { setShowInstructions(false); setCustomInstructions(''); }}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    Remove instructions
                  </button>
                </div>
              )}

              {showDrafts && drafts.length > 0 && (
                <div className="space-y-2">
                  {drafts.map((draft) => {
                    const tone = toneLabels[draft.tone_preset] || { label: draft.tone_preset, color: 'bg-gray-100 text-gray-600' };
                    const isSelected = selectedDraftId === draft.id;
                    return (
                      <button
                        key={draft.id}
                        onClick={() => selectDraft(draft)}
                        className={`w-full text-left p-3 rounded-lg border transition-colors ${
                          isSelected
                            ? 'border-blue-400 bg-blue-50 ring-1 ring-blue-200'
                            : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${tone.color}`}>
                            {tone.label}
                          </span>
                          {isSelected && (
                            <span className="text-[10px] text-blue-600 font-medium">Selected</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-700 line-clamp-3 leading-relaxed">
                          {draft.draft_text}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}

              <div>
                <textarea
                  value={replyText}
                  onChange={(e) => {
                    setReplyText(e.target.value);
                    if (selectedDraftId) setSelectedDraftId(null);
                  }}
                  placeholder="Write your reply or select an AI draft above..."
                  rows={4}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2">
                {replyText && (
                  <button
                    onClick={() => { setReplyText(''); setSelectedDraftId(null); }}
                    className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800"
                  >
                    Clear
                  </button>
                )}
                <button
                  onClick={() => {
                    handleApplyDraft();
                    handlePostReply();
                  }}
                  disabled={posting || !replyText.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {posting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Posting...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Post Reply
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
