import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Star, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import type { ReviewRequest, ReputationSettings } from '../../types';

export function ReviewPage() {
  const { slug } = useParams<{ slug: string }>();
  const [reviewRequest, setReviewRequest] = useState<ReviewRequest | null>(null);
  const [settings, setSettings] = useState<ReputationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [hoverRating, setHoverRating] = useState<number | null>(null);

  useEffect(() => {
    if (slug) loadData();
  }, [slug]);

  async function loadData() {
    try {
      setLoading(true);

      const requestResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/review-submit`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            action: 'load',
            slug,
          }),
        }
      );

      if (!requestResponse.ok) {
        const errorData = await requestResponse.json();
        throw new Error(errorData.error || 'Failed to load review request');
      }

      const data = await requestResponse.json();
      setReviewRequest(data.reviewRequest);
      setSettings(data.settings);

      if (data.reviewRequest.clicked_at === null) {
        await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/review-submit`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({
              action: 'track_click',
              slug,
            }),
          }
        );
      }
    } catch (err) {
      console.error('Failed to load review request:', err);
      setError(err instanceof Error ? err.message : 'Failed to load review request');
    } finally {
      setLoading(false);
    }
  }

  async function handleRatingSelect(rating: number) {
    if (reviewRequest?.completed_at) return;

    setSelectedRating(rating);

    if (!settings) return;

    if (rating >= settings.smart_threshold) {
      await handleSubmit(rating, '');
    } else {
      setShowFeedbackForm(true);
    }
  }

  async function handleSubmit(rating: number, feedbackComment: string) {
    if (!reviewRequest || !settings) return;

    try {
      setSubmitting(true);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/review-submit`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            action: 'submit',
            slug,
            rating,
            comment: feedbackComment,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Submission failed');
      }

      const result = await response.json();
      setSubmitted(true);

      if (result.redirectUrl && rating >= settings.smart_threshold) {
        setTimeout(() => {
          window.location.href = result.redirectUrl;
        }, 2000);
      }
    } catch (err) {
      console.error('Submission error:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleFeedbackSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selectedRating === null) return;
    await handleSubmit(selectedRating, comment);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error && !reviewRequest) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-gray-200 p-8 text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Review Not Available</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    const brandColor = settings?.brand_primary_color || '#3B82F6';
    const isPositive = selectedRating && selectedRating >= (settings?.smart_threshold || 4);

    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-gray-200 p-8 text-center">
          {settings?.brand_logo_url && (
            <img
              src={settings.brand_logo_url}
              alt={settings.brand_name || 'Company'}
              className="h-16 mx-auto mb-6 object-contain"
            />
          )}
          <CheckCircle className="w-16 h-16 mx-auto mb-4" style={{ color: brandColor }} />
          <h1 className="text-2xl font-bold text-gray-900 mb-3">Thank You!</h1>
          <p className="text-gray-600 mb-4">
            {isPositive
              ? 'We appreciate your positive feedback! Redirecting you to leave a public review...'
              : 'Thank you for sharing your feedback with us. We take all feedback seriously and will use it to improve.'}
          </p>
          {isPositive && <p className="text-sm text-gray-400">Redirecting...</p>}
        </div>
      </div>
    );
  }

  if (reviewRequest?.completed_at) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-gray-200 p-8 text-center">
          <AlertCircle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Already Submitted</h1>
          <p className="text-gray-600">You have already submitted your review. Thank you!</p>
        </div>
      </div>
    );
  }

  const brandColor = settings?.brand_primary_color || '#3B82F6';
  const brandName = settings?.brand_name || 'us';
  const contactName = reviewRequest?.contact?.first_name || 'there';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8 md:p-12">
          {settings?.brand_logo_url && (
            <div className="flex justify-center mb-8">
              <img
                src={settings.brand_logo_url}
                alt={brandName}
                className="h-20 object-contain"
              />
            </div>
          )}

          {!showFeedbackForm ? (
            <>
              <h1 className="text-3xl font-bold text-gray-900 mb-3 text-center">
                Hi {contactName}!
              </h1>
              <p className="text-xl text-gray-600 mb-8 text-center">
                How was your experience with {brandName}?
              </p>

              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-red-600">{error}</div>
                </div>
              )}

              <div className="flex justify-center gap-3 mb-8">
                {[1, 2, 3, 4, 5].map((rating) => (
                  <button
                    key={rating}
                    type="button"
                    onClick={() => handleRatingSelect(rating)}
                    onMouseEnter={() => setHoverRating(rating)}
                    onMouseLeave={() => setHoverRating(null)}
                    disabled={submitting}
                    className="transition-all duration-200 transform hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 rounded-full p-2"
                    style={{
                      focusRingColor: brandColor,
                    }}
                  >
                    <Star
                      className="w-12 h-12 md:w-16 md:h-16"
                      fill={
                        (selectedRating && rating <= selectedRating) ||
                        (hoverRating && rating <= hoverRating)
                          ? brandColor
                          : 'none'
                      }
                      stroke={
                        (selectedRating && rating <= selectedRating) ||
                        (hoverRating && rating <= hoverRating)
                          ? brandColor
                          : '#D1D5DB'
                      }
                      strokeWidth={2}
                    />
                  </button>
                ))}
              </div>

              <div className="flex justify-between text-sm text-gray-500 px-4">
                <span>Not satisfied</span>
                <span>Very satisfied</span>
              </div>
            </>
          ) : (
            <form onSubmit={handleFeedbackSubmit}>
              <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">
                We Value Your Feedback
              </h2>
              <p className="text-gray-600 mb-6 text-center">
                Please tell us how we can improve your experience.
              </p>

              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-red-600">{error}</div>
                </div>
              )}

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Your feedback (optional)
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={5}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 transition-colors resize-none"
                  style={{
                    focusRingColor: brandColor,
                  }}
                  placeholder="Help us understand what went wrong..."
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 px-6 text-white font-medium rounded-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                style={{
                  backgroundColor: brandColor,
                  focusRingColor: brandColor,
                }}
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Submitting...
                  </span>
                ) : (
                  'Submit Feedback'
                )}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">
          Powered by {settings?.brand_name || 'Review System'}
        </p>
      </div>
    </div>
  );
}
