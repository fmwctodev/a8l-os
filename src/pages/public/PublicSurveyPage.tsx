import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle, AlertCircle, Loader2, ArrowLeft, ArrowRight, Star, GripVertical } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Survey, SurveyQuestion } from '../../types';

export function PublicSurveyPage() {
  const { slug } = useParams<{ slug: string }>();
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (slug) loadSurvey();
  }, [slug]);

  async function loadSurvey() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('surveys')
        .select('*')
        .eq('public_slug', slug)
        .eq('status', 'published')
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        setError('Survey not found or no longer available');
        return;
      }

      setSurvey(data);
    } catch (err) {
      console.error('Failed to load survey:', err);
      setError('Failed to load survey');
    } finally {
      setLoading(false);
    }
  }

  function validateCurrentStep(): boolean {
    if (!survey) return false;

    const currentStep = survey.definition.steps[currentStepIndex];
    const errors: Record<string, string> = {};

    for (const question of currentStep.questions) {
      if (question.required) {
        const answer = answers[question.id];
        if (answer === undefined || answer === '' || (Array.isArray(answer) && answer.length === 0)) {
          errors[question.id] = 'This question is required';
        }
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function handleNext() {
    if (!survey || !validateCurrentStep()) return;

    if (currentStepIndex < survey.definition.steps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
      setValidationErrors({});
    } else {
      handleSubmit();
    }
  }

  function handleBack() {
    if (!survey?.settings.allowBackNavigation || currentStepIndex === 0) return;
    setCurrentStepIndex(currentStepIndex - 1);
    setValidationErrors({});
  }

  async function handleSubmit() {
    if (!survey || !validateCurrentStep()) return;

    try {
      setSubmitting(true);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/survey-submit`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            surveyId: survey.id,
            answers,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Submission failed');
      }

      setSubmitted(true);

      if (survey.settings.redirectUrl) {
        setTimeout(() => {
          window.location.href = survey.settings.redirectUrl!;
        }, 2000);
      }
    } catch (err) {
      console.error('Submission error:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit survey');
    } finally {
      setSubmitting(false);
    }
  }

  function updateAnswer(questionId: string, value: unknown) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    if (validationErrors[questionId]) {
      setValidationErrors((prev) => {
        const next = { ...prev };
        delete next[questionId];
        return next;
      });
    }
  }

  function renderQuestion(question: SurveyQuestion, index: number) {
    const hasError = !!validationErrors[question.id];
    const answer = answers[question.id];

    return (
      <div key={question.id} className="mb-8">
        <label className="block text-base font-medium text-gray-900 mb-2">
          {index + 1}. {question.text}
          {question.required && <span className="text-red-500 ml-1">*</span>}
        </label>
        {question.description && (
          <p className="text-sm text-gray-500 mb-3">{question.description}</p>
        )}

        {question.type === 'short_text' && (
          <input
            type="text"
            value={String(answer || '')}
            onChange={(e) => updateAnswer(question.id, e.target.value)}
            className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
              hasError
                ? 'border-red-300 focus:ring-red-500'
                : 'border-gray-300 focus:ring-blue-500'
            }`}
          />
        )}

        {question.type === 'long_text' && (
          <textarea
            value={String(answer || '')}
            onChange={(e) => updateAnswer(question.id, e.target.value)}
            rows={4}
            className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
              hasError
                ? 'border-red-300 focus:ring-red-500'
                : 'border-gray-300 focus:ring-blue-500'
            }`}
          />
        )}

        {question.type === 'number' && (
          <input
            type="number"
            value={answer !== undefined ? String(answer) : ''}
            onChange={(e) => updateAnswer(question.id, e.target.value ? Number(e.target.value) : undefined)}
            className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
              hasError
                ? 'border-red-300 focus:ring-red-500'
                : 'border-gray-300 focus:ring-blue-500'
            }`}
          />
        )}

        {question.type === 'single_choice' && (
          <div className="space-y-2">
            {(question.options || []).map((option) => (
              <label
                key={option.id}
                className={`flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${
                  answer === option.value
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name={question.id}
                  checked={answer === option.value}
                  onChange={() => updateAnswer(question.id, option.value)}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span className="text-gray-700">{option.label}</span>
              </label>
            ))}
          </div>
        )}

        {question.type === 'multiple_choice' && (
          <div className="space-y-2">
            {(question.options || []).map((option) => {
              const selected = Array.isArray(answer) && answer.includes(option.value);
              return (
                <label
                  key={option.id}
                  className={`flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${
                    selected
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={(e) => {
                      const current = Array.isArray(answer) ? answer : [];
                      const newValue = e.target.checked
                        ? [...current, option.value]
                        : current.filter((v) => v !== option.value);
                      updateAnswer(question.id, newValue);
                    }}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-gray-700">{option.label}</span>
                </label>
              );
            })}
          </div>
        )}

        {question.type === 'rating' && (
          <div className="flex gap-2">
            {Array.from(
              { length: (question.max || 5) - (question.min || 1) + 1 },
              (_, i) => (question.min || 1) + i
            ).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => updateAnswer(question.id, n)}
                className={`p-2 transition-colors ${
                  answer !== undefined && n <= Number(answer)
                    ? 'text-yellow-400'
                    : 'text-gray-300 hover:text-yellow-300'
                }`}
              >
                <Star className="w-8 h-8 fill-current" />
              </button>
            ))}
          </div>
        )}

        {question.type === 'nps' && (
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 11 }, (_, i) => i).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => updateAnswer(question.id, n)}
                className={`w-12 h-12 border rounded-lg font-medium transition-colors ${
                  answer === n
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'border-gray-300 text-gray-700 hover:border-blue-500 hover:bg-blue-50'
                }`}
              >
                {n}
              </button>
            ))}
            <div className="w-full flex justify-between text-xs text-gray-500 mt-1">
              <span>Not at all likely</span>
              <span>Extremely likely</span>
            </div>
          </div>
        )}

        {question.type === 'opinion_scale' && (
          <div>
            <div className="flex gap-2">
              {Array.from(
                { length: (question.max || 5) - (question.min || 1) + 1 },
                (_, i) => (question.min || 1) + i
              ).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => updateAnswer(question.id, n)}
                  className={`flex-1 py-3 border rounded-lg font-medium transition-colors ${
                    answer === n
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'border-gray-300 text-gray-700 hover:border-blue-500 hover:bg-blue-50'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-2">
              <span>{question.minLabel || 'Strongly Disagree'}</span>
              <span>{question.maxLabel || 'Strongly Agree'}</span>
            </div>
          </div>
        )}

        {question.type === 'matrix' && question.matrixRows && question.matrixColumns && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="p-2 text-left"></th>
                  {question.matrixColumns.map(col => (
                    <th key={col.id} className="p-2 text-center text-sm text-gray-600 min-w-[80px]">
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {question.matrixRows.map(row => {
                  const rowAnswer = (answer as Record<string, string>)?.[row.id];
                  return (
                    <tr key={row.id} className="border-t border-gray-200">
                      <td className="p-3 text-sm text-gray-700">{row.label}</td>
                      {question.matrixColumns!.map(col => (
                        <td key={col.id} className="p-2 text-center">
                          <input
                            type="radio"
                            name={`${question.id}-${row.id}`}
                            checked={rowAnswer === col.value}
                            onChange={() => {
                              const current = (answer as Record<string, string>) || {};
                              updateAnswer(question.id, { ...current, [row.id]: col.value });
                            }}
                            className="text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {question.type === 'ranking' && question.options && (
          <RankingInput
            options={question.options}
            value={(answer as string[]) || []}
            onChange={(newValue) => updateAnswer(question.id, newValue)}
          />
        )}

        {question.type === 'image_choice' && question.imageOptions && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {question.imageOptions.map(option => {
              const isSelected = answer === option.value;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => updateAnswer(question.id, option.value)}
                  className={`relative rounded-lg overflow-hidden border-2 transition-all ${
                    isSelected
                      ? 'border-blue-500 ring-2 ring-blue-200'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <img
                    src={option.imageUrl}
                    alt={option.label}
                    className="w-full aspect-square object-cover"
                  />
                  <div className={`p-2 text-center text-sm ${
                    isSelected ? 'bg-blue-50 text-blue-700' : 'bg-white text-gray-700'
                  }`}>
                    {option.label}
                  </div>
                  {isSelected && (
                    <div className="absolute top-2 right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                      <CheckCircle className="w-4 h-4 text-white" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {hasError && (
          <p className="mt-2 text-sm text-red-500">{validationErrors[question.id]}</p>
        )}
      </div>
    );
  }

  function RankingInput({
    options,
    value,
    onChange,
  }: {
    options: { id: string; label: string; value: string }[];
    value: string[];
    onChange: (newValue: string[]) => void;
  }) {
    const [items, setItems] = useState<string[]>([]);
    const [draggedIdx, setDraggedIdx] = useState<number | null>(null);

    useEffect(() => {
      if (value.length > 0) {
        setItems(value);
      } else {
        setItems(options.map(o => o.value));
      }
    }, [options]);

    function handleDragStart(idx: number) {
      setDraggedIdx(idx);
    }

    function handleDragOver(e: React.DragEvent, idx: number) {
      e.preventDefault();
      if (draggedIdx === null || draggedIdx === idx) return;

      const newItems = [...items];
      const draggedItem = newItems[draggedIdx];
      newItems.splice(draggedIdx, 1);
      newItems.splice(idx, 0, draggedItem);
      setItems(newItems);
      setDraggedIdx(idx);
    }

    function handleDragEnd() {
      setDraggedIdx(null);
      onChange(items);
    }

    function getLabel(val: string): string {
      return options.find(o => o.value === val)?.label || val;
    }

    return (
      <div className="space-y-2">
        <p className="text-xs text-gray-500 mb-2">Drag to reorder (1 = highest priority)</p>
        {items.map((item, idx) => (
          <div
            key={item}
            draggable
            onDragStart={() => handleDragStart(idx)}
            onDragOver={(e) => handleDragOver(e, idx)}
            onDragEnd={handleDragEnd}
            className={`flex items-center gap-3 p-3 bg-white border rounded-lg cursor-grab ${
              draggedIdx === idx ? 'opacity-50 border-blue-500' : 'border-gray-200'
            }`}
          >
            <span className="w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-sm font-medium">
              {idx + 1}
            </span>
            <GripVertical className="w-4 h-4 text-gray-400" />
            <span className="flex-1 text-gray-700">{getLabel(item)}</span>
          </div>
        ))}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error && !survey) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Survey Not Available</h1>
          <p className="text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Thank You!</h1>
          <p className="text-gray-500">
            {survey?.settings.thankYouMessage || 'Your response has been submitted successfully.'}
          </p>
          {survey?.settings.redirectUrl && (
            <p className="text-sm text-gray-400 mt-4">Redirecting...</p>
          )}
        </div>
      </div>
    );
  }

  if (!survey) return null;

  const currentStep = survey.definition.steps[currentStepIndex];
  const totalSteps = survey.definition.steps.length;
  const progress = ((currentStepIndex + 1) / totalSteps) * 100;
  const isLastStep = currentStepIndex === totalSteps - 1;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">{survey.name}</h1>
          {survey.description && (
            <p className="text-gray-500 mb-6">{survey.description}</p>
          )}

          {survey.settings.showProgressBar && (
            <div className="mb-8">
              <div className="flex justify-between text-sm text-gray-500 mb-2">
                <span>Step {currentStepIndex + 1} of {totalSteps}</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
              <div className="text-sm text-red-600">{error}</div>
            </div>
          )}

          <div className="mb-8">
            <h2 className="text-lg font-medium text-gray-900 mb-1">{currentStep.title}</h2>
            {currentStep.description && (
              <p className="text-sm text-gray-500">{currentStep.description}</p>
            )}
          </div>

          <div>
            {currentStep.questions.map((question, idx) => renderQuestion(question, idx))}
          </div>

          <div className="flex justify-between mt-8 pt-6 border-t border-gray-200">
            <button
              onClick={handleBack}
              disabled={currentStepIndex === 0 || !survey.settings.allowBackNavigation}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>

            <button
              onClick={handleNext}
              disabled={submitting}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Submitting...
                </>
              ) : isLastStep ? (
                'Submit'
              ) : (
                <>
                  Next
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
