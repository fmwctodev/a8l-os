import { useState, useEffect } from 'react';
import {
  X,
  Star,
  Link as LinkIcon,
  ExternalLink,
  MessageSquare,
  Mail,
  Calendar,
  Sparkles,
  Send,
  AlertTriangle,
  Eye,
  EyeOff,
  Ban,
  ThumbsUp,
  ThumbsDown,
  Loader2,
  Brain,
  Tag,
  TrendingUp
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { usePermission } from '../../hooks/usePermission';
import type { Review, ReviewAIAnalysis } from '../../types';
import {
  respondToReview,
  generateAIReply,
  postReplyToProvider,
  analyzeReview,
  markReviewAsSpam,
  hideReview,
  getAIAnalysis
} from '../../services/reviews';

interface ReviewDetailModalProps {
  review: Review;
  onClose: () => void;
  onUpdate?: () => void;
}

export function ReviewDetailModal({ review: initialReview, onClose, onUpdate }: ReviewDetailModalProps) {
  const { user } = useAuth();
  const canReply = usePermission('reputation.reply');
  const canManage = usePermission('reputation.manage');

  const [review, setReview] = useState(initialReview);
  const [replyText, setReplyText] = useState(review.response || '');
  const [isGeneratingReply, setIsGeneratingReply] = useState(false);
  const [isPostingReply, setIsPostingReply] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<ReviewAIAnalysis | null>(
    review.ai_analysis || null
  );
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'analysis' | 'reply'>('details');

  const providerLabels: Record<string, string> = {
    google: 'Google',
    facebook: 'Facebook',
    internal: 'Internal Feedback',
  };

  const providerColors: Record<string, string> = {
    google: 'bg-red-100 text-red-700',
    facebook: 'bg-blue-100 text-blue-700',
    internal: 'bg-gray-100 text-gray-700',
  };

  useEffect(() => {
    if (!aiAnalysis && review.comment) {
      loadAIAnalysis();
    }
  }, [review.id]);

  async function loadAIAnalysis() {
    try {
      const analysis = await getAIAnalysis(review.id);
      if (analysis) {
        setAiAnalysis(analysis);
      }
    } catch (err) {
      console.error('Failed to load AI analysis:', err);
    }
  }

  async function handleGenerateReply() {
    if (!review.id) return;

    setIsGeneratingReply(true);
    setError(null);

    try {
      const { reply } = await generateAIReply(review.id);
      setReplyText(reply);
      setActiveTab('reply');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate reply');
    } finally {
      setIsGeneratingReply(false);
    }
  }

  async function handleAnalyze() {
    if (!review.id) return;

    setIsAnalyzing(true);
    setError(null);

    try {
      const analysis = await analyzeReview(review.id);
      setAiAnalysis(analysis);
      setActiveTab('analysis');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze review');
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function handlePostReply() {
    if (!user?.id || !user?.organization_id || !replyText.trim()) return;

    setIsPostingReply(true);
    setError(null);

    try {
      if (review.provider === 'internal') {
        const updated = await respondToReview(review.id, replyText, user.id, 'manual');
        setReview({ ...review, ...updated });
      } else {
        const result = await postReplyToProvider(
          review.id,
          replyText,
          user.organization_id,
          user.id
        );

        if (!result.success) {
          throw new Error(result.error || 'Failed to post reply');
        }

        setReview({
          ...review,
          response: replyText,
          responded_at: new Date().toISOString(),
          responded_by: user.id,
        });
      }

      onUpdate?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post reply');
    } finally {
      setIsPostingReply(false);
    }
  }

  async function handleToggleSpam() {
    if (!user?.id) return;

    try {
      await markReviewAsSpam(review.id, !review.is_spam, user.id);
      setReview({ ...review, is_spam: !review.is_spam });
      onUpdate?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update review');
    }
  }

  async function handleToggleHidden() {
    if (!user?.id) return;

    try {
      await hideReview(review.id, !review.hidden, user.id);
      setReview({ ...review, hidden: !review.hidden });
      onUpdate?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update review');
    }
  }

  const sentimentColors = {
    positive: 'text-green-600 bg-green-50',
    neutral: 'text-amber-600 bg-amber-50',
    negative: 'text-red-600 bg-red-50',
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-semibold text-gray-900">Review Details</h2>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className="w-5 h-5"
                  fill={star <= review.rating ? '#FFA500' : 'none'}
                  stroke={star <= review.rating ? '#FFA500' : '#D1D5DB'}
                  strokeWidth={2}
                />
              ))}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="border-b border-gray-200">
          <div className="flex gap-1 px-6">
            {[
              { id: 'details', label: 'Details' },
              { id: 'analysis', label: 'AI Analysis', icon: Brain },
              { id: 'reply', label: 'Reply', icon: MessageSquare },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.icon && <tab.icon className="w-4 h-4" />}
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
            <AlertTriangle className="w-4 h-4" />
            {error}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'details' && (
            <div className="space-y-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${providerColors[review.provider]}`}>
                    {providerLabels[review.provider]}
                  </span>
                  {!review.published && (
                    <span className="px-3 py-1 rounded-full text-sm font-medium bg-amber-100 text-amber-700">
                      Private
                    </span>
                  )}
                  {review.is_spam && (
                    <span className="px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-700">
                      Spam
                    </span>
                  )}
                  {review.hidden && (
                    <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-700">
                      Hidden
                    </span>
                  )}
                  {review.responded_at && (
                    <span className="px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-700">
                      Replied
                    </span>
                  )}
                </div>

                {canManage && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleToggleHidden}
                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      title={review.hidden ? 'Unhide review' : 'Hide review'}
                    >
                      {review.hidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={handleToggleSpam}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title={review.is_spam ? 'Unmark as spam' : 'Mark as spam'}
                    >
                      <Ban className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Reviewer</h3>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="font-medium text-gray-900">{review.reviewer_name}</div>
                  {review.reviewer_email && (
                    <div className="text-sm text-gray-600 mt-1">{review.reviewer_email}</div>
                  )}
                </div>
              </div>

              {review.contact && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Linked Contact</h3>
                  <Link
                    to={`/contacts/${review.contact.id}`}
                    className="p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between hover:bg-blue-100 transition-colors"
                  >
                    <div>
                      <div className="font-medium text-gray-900">
                        {review.contact.first_name} {review.contact.last_name}
                      </div>
                      <div className="text-sm text-gray-600">
                        {review.contact.email} {review.contact.phone && `\u2022 ${review.contact.phone}`}
                      </div>
                    </div>
                    <ExternalLink className="w-5 h-5 text-blue-600" />
                  </Link>
                </div>
              )}

              {review.comment && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Comment</h3>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-gray-700 whitespace-pre-wrap">{review.comment}</p>
                  </div>
                </div>
              )}

              {review.response && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Your Response</h3>
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-gray-700 whitespace-pre-wrap">{review.response}</p>
                    {review.responded_at && (
                      <p className="text-xs text-gray-500 mt-2">
                        Responded {new Date(review.responded_at).toLocaleString()}
                        {review.response_source === 'ai' && ' (AI-generated)'}
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  <span>{new Date(review.received_at).toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'analysis' && (
            <div className="space-y-6">
              {!aiAnalysis ? (
                <div className="text-center py-12">
                  <Brain className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No AI Analysis Yet</h3>
                  <p className="text-gray-500 mb-6">
                    Analyze this review to get sentiment analysis, themes, and suggested replies.
                  </p>
                  <button
                    onClick={handleAnalyze}
                    disabled={isAnalyzing || !review.comment}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Analyze Review
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className={`p-4 rounded-lg ${sentimentColors[aiAnalysis.sentiment_label]}`}>
                      <div className="flex items-center gap-2 mb-1">
                        {aiAnalysis.sentiment_label === 'positive' ? (
                          <ThumbsUp className="w-5 h-5" />
                        ) : aiAnalysis.sentiment_label === 'negative' ? (
                          <ThumbsDown className="w-5 h-5" />
                        ) : (
                          <TrendingUp className="w-5 h-5" />
                        )}
                        <span className="font-medium capitalize">{aiAnalysis.sentiment_label}</span>
                      </div>
                      <div className="text-2xl font-bold">
                        {(aiAnalysis.sentiment_score * 100).toFixed(0)}%
                      </div>
                      <div className="text-sm opacity-75">Sentiment Score</div>
                    </div>

                    <div className="p-4 bg-gray-50 rounded-lg">
                      <div className="text-sm text-gray-500 mb-1">Analyzed by</div>
                      <div className="font-medium text-gray-900 capitalize">
                        {aiAnalysis.ai_provider}
                      </div>
                      <div className="text-sm text-gray-500 mt-2">
                        {aiAnalysis.model_used}
                      </div>
                    </div>
                  </div>

                  {aiAnalysis.summary && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 mb-2">Summary</h3>
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-gray-700">{aiAnalysis.summary}</p>
                      </div>
                    </div>
                  )}

                  {aiAnalysis.themes.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 mb-2">Themes</h3>
                      <div className="flex flex-wrap gap-2">
                        {aiAnalysis.themes.map((theme, i) => (
                          <span
                            key={i}
                            className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm font-medium"
                          >
                            {theme}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {aiAnalysis.tags.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                        <Tag className="w-4 h-4" />
                        Tags
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {aiAnalysis.tags.map((tag, i) => (
                          <span
                            key={i}
                            className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {aiAnalysis.key_phrases.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 mb-2">Key Phrases</h3>
                      <div className="space-y-1">
                        {aiAnalysis.key_phrases.map((phrase, i) => (
                          <div key={i} className="text-gray-600 text-sm">
                            "{phrase}"
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {aiAnalysis.suggested_reply && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 mb-2">Suggested Reply</h3>
                      <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                        <p className="text-gray-700 whitespace-pre-wrap">{aiAnalysis.suggested_reply}</p>
                        <button
                          onClick={() => {
                            setReplyText(aiAnalysis.suggested_reply || '');
                            setActiveTab('reply');
                          }}
                          className="mt-3 text-sm text-amber-700 hover:text-amber-800 font-medium"
                        >
                          Use this reply
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {activeTab === 'reply' && (
            <div className="space-y-4">
              {review.responded_at && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <h3 className="text-sm font-medium text-green-800 mb-2">Current Response</h3>
                  <p className="text-gray-700 whitespace-pre-wrap">{review.response}</p>
                  <p className="text-xs text-gray-500 mt-2">
                    Responded {new Date(review.responded_at).toLocaleString()}
                  </p>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">
                    {review.responded_at ? 'Update Response' : 'Write Response'}
                  </label>
                  {canReply && (
                    <button
                      onClick={handleGenerateReply}
                      disabled={isGeneratingReply}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {isGeneratingReply ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          Generate with AI
                        </>
                      )}
                    </button>
                  )}
                </div>
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  rows={6}
                  placeholder="Write your response to this review..."
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              {review.provider !== 'internal' && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
                  <strong>Note:</strong> This reply will be posted to {providerLabels[review.provider]} using your connected account.
                </div>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-gray-200 px-6 py-4 flex items-center justify-between bg-gray-50">
          <div className="flex items-center gap-2">
            {activeTab === 'details' && !aiAnalysis && review.comment && (
              <button
                onClick={handleAnalyze}
                disabled={isAnalyzing}
                className="flex items-center gap-2 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-white transition-colors disabled:opacity-50"
              >
                {isAnalyzing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Brain className="w-4 h-4" />
                )}
                Analyze
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-white transition-colors"
            >
              Close
            </button>
            {activeTab === 'reply' && canReply && (
              <button
                onClick={handlePostReply}
                disabled={isPostingReply || !replyText.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isPostingReply ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Posting...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    {review.provider === 'internal' ? 'Save Response' : 'Post Reply'}
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
