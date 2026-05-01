import { useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { CheckCircle, AlertCircle, Loader2, ArrowLeft, ArrowRight, Star, GripVertical, Plus, X, Upload, CreditCard } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Survey, SurveyQuestion } from '../../types';
import {
  US_STATES,
  COUNTRIES,
  COMMON_TIMEZONES,
  currencySymbol,
} from '../../constants/formFieldOptions';

export function PublicSurveyPage() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const embed = useMemo(() => {
    const v = searchParams.get('embed');
    return v === '1' || v === 'true';
  }, [searchParams]);

  useEffect(() => {
    if (slug) loadSurvey();
  }, [slug]);

  useEffect(() => {
    if (!embed) return;
    if (typeof window === 'undefined' || window.parent === window) return;
    const post = () => {
      const height = Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight
      );
      window.parent.postMessage({ type: 'forms-widget:height', height }, '*');
      window.parent.postMessage({ type: 'autom8ion:resize', height }, '*');
    };
    post();
    const observer = new ResizeObserver(post);
    observer.observe(document.body);
    window.addEventListener('load', post);
    return () => {
      observer.disconnect();
      window.removeEventListener('load', post);
    };
  }, [embed, loading, submitted, error, currentStepIndex]);

  useEffect(() => {
    if (!embed || !submitted) return;
    if (typeof window === 'undefined' || window.parent === window) return;
    const payload = { surveyId: survey?.id, slug: survey?.public_slug };
    window.parent.postMessage({ type: 'forms-widget:submitted', payload }, '*');
    window.parent.postMessage({ type: 'autom8ion:survey:complete', payload }, '*');
  }, [embed, submitted, survey?.id, survey?.public_slug]);

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
    const inputClass = `w-full px-4 py-3 bg-slate-800 text-white placeholder-slate-500 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
      hasError ? 'border-red-500/40 focus:ring-red-500' : 'border-slate-700 focus:ring-cyan-500'
    }`;

    if (question.type === 'hidden') return null;

    if (question.type === 'divider') {
      return (
        <div key={question.id} className="py-4">
          <hr className="border-slate-700" />
          {question.label && (
            <p className="text-sm text-slate-400 mt-2">{question.label}</p>
          )}
        </div>
      );
    }

    if (question.type === 'column') {
      return (
        <div
          key={question.id}
          className="grid gap-3"
          style={{ gridTemplateColumns: `repeat(${question.columnCount || 2}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: question.columnCount || 2 }).map((_, i) => (
            <div key={i} />
          ))}
        </div>
      );
    }

    if (question.type === 'custom_html') {
      return (
        <div
          key={question.id}
          className="prose prose-sm max-w-none mb-6"
          dangerouslySetInnerHTML={{ __html: question.htmlContent || '' }}
        />
      );
    }

    const isCheckboxType = question.type === 'checkbox' || question.type === 'consent';

    return (
      <div key={question.id} className="mb-8">
        {!isCheckboxType && (
          <label className="block text-base font-medium text-white mb-2">
            {index + 1}. {question.label}
            {question.required && <span className="text-red-300 ml-1">*</span>}
          </label>
        )}
        {question.description && (
          <p className="text-sm text-slate-400 mb-3">{question.description}</p>
        )}

        {question.type === 'short_answer' && (
          <input
            type="text"
            value={String(answer || '')}
            onChange={(e) => updateAnswer(question.id, e.target.value)}
            placeholder={question.placeholder}
            className={inputClass}
          />
        )}

        {question.type === 'long_answer' && (
          <textarea
            value={String(answer || '')}
            onChange={(e) => updateAnswer(question.id, e.target.value)}
            rows={4}
            placeholder={question.placeholder}
            className={inputClass}
          />
        )}

        {question.type === 'number' && (
          <input
            type="number"
            value={answer !== undefined ? String(answer) : ''}
            onChange={(e) => updateAnswer(question.id, e.target.value ? Number(e.target.value) : undefined)}
            placeholder={question.placeholder}
            className={inputClass}
          />
        )}

        {question.type === 'monetary' && (
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">
              {currencySymbol(question.currency)}
            </span>
            <input
              type="number"
              step="0.01"
              value={String(answer || '')}
              onChange={(e) => updateAnswer(question.id, e.target.value)}
              placeholder={question.placeholder || '0.00'}
              className={`pl-8 ${inputClass}`}
            />
          </div>
        )}

        {question.type === 'date' && (
          <input
            type="date"
            value={String(answer || '')}
            onChange={(e) => updateAnswer(question.id, e.target.value)}
            className={inputClass}
          />
        )}

        {question.type === 'email' && (
          <input
            type="email"
            value={String(answer || '')}
            onChange={(e) => updateAnswer(question.id, e.target.value)}
            placeholder={question.placeholder || 'you@example.com'}
            className={inputClass}
          />
        )}

        {question.type === 'phone' && (
          <input
            type="tel"
            value={String(answer || '')}
            onChange={(e) => updateAnswer(question.id, e.target.value)}
            placeholder={question.placeholder}
            className={inputClass}
          />
        )}

        {question.type === 'website' && (
          <input
            type="url"
            value={String(answer || '')}
            onChange={(e) => updateAnswer(question.id, e.target.value)}
            placeholder={question.placeholder || 'https://'}
            className={inputClass}
          />
        )}

        {(question.type === 'first_name' ||
          question.type === 'last_name' ||
          question.type === 'full_name' ||
          question.type === 'company' ||
          question.type === 'address' ||
          question.type === 'city' ||
          question.type === 'postal_code' ||
          question.type === 'source') && (
          <input
            type="text"
            value={String(answer || '')}
            onChange={(e) => updateAnswer(question.id, e.target.value)}
            placeholder={question.placeholder}
            className={inputClass}
          />
        )}

        {question.type === 'state' && (
          <select
            value={String(answer || '')}
            onChange={(e) => updateAnswer(question.id, e.target.value)}
            className={inputClass}
          >
            <option value="">{question.placeholder || 'Select state...'}</option>
            {US_STATES.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        )}

        {question.type === 'country' && (
          <select
            value={String(answer || '')}
            onChange={(e) => updateAnswer(question.id, e.target.value)}
            className={inputClass}
          >
            <option value="">{question.placeholder || 'Select country...'}</option>
            {COUNTRIES.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        )}

        {question.type === 'timezone' && (
          <select
            value={String(answer || '')}
            onChange={(e) => updateAnswer(question.id, e.target.value)}
            className={inputClass}
          >
            <option value="">{question.placeholder || 'Select timezone...'}</option>
            {COMMON_TIMEZONES.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        )}

        {(question.type === 'multiple_choice' || question.type === 'yes_no') && (
          <div className="space-y-2">
            {(question.options || []).map((option) => (
              <label
                key={option.id}
                className={`flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${
                  answer === option.value
                    ? 'border-cyan-500 bg-cyan-500/20'
                    : 'border-slate-700 hover:border-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name={question.id}
                  checked={answer === option.value}
                  onChange={() => updateAnswer(question.id, option.value)}
                  className="text-cyan-400 focus:ring-cyan-500"
                />
                <span className="text-slate-300">{option.label}</span>
              </label>
            ))}
          </div>
        )}

        {(question.type === 'dropdown' || question.type === 'product_selection') && (
          <select
            value={String(answer || '')}
            onChange={(e) => updateAnswer(question.id, e.target.value)}
            className={inputClass}
          >
            <option value="">{question.placeholder || 'Select an option'}</option>
            {(question.options || []).map((opt) => (
              <option key={opt.id} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        )}

        {question.type === 'multi_dropdown' && (
          <select
            multiple
            size={Math.min(6, (question.options || []).length || 3)}
            value={(answer as string[]) || []}
            onChange={(e) => {
              const selected = Array.from(e.target.selectedOptions).map((o) => o.value);
              updateAnswer(question.id, selected);
            }}
            className={inputClass}
          >
            {(question.options || []).map((opt) => (
              <option key={opt.id} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        )}

        {(question.type === 'multi_select' || question.type === 'checkbox_group') && (
          <div className="space-y-2">
            {(question.options || []).map((option) => {
              const selected = Array.isArray(answer) && answer.includes(option.value);
              return (
                <label
                  key={option.id}
                  className={`flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${
                    selected
                      ? 'border-cyan-500 bg-cyan-500/20'
                      : 'border-slate-700 hover:border-slate-700'
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
                    className="rounded text-cyan-400 focus:ring-cyan-500"
                  />
                  <span className="text-slate-300">{option.label}</span>
                </label>
              );
            })}
          </div>
        )}

        {isCheckboxType && (
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={Boolean(answer)}
              onChange={(e) => updateAnswer(question.id, e.target.checked)}
              className="mt-1 rounded border-slate-700 text-cyan-400 focus:ring-cyan-500"
            />
            <span className="text-slate-300">{question.label}</span>
          </label>
        )}

        {question.type === 'textbox_list' && (() => {
          const items = Array.isArray(answer) ? (answer as string[]) : [''];
          return (
            <div className="space-y-2">
              {items.map((item, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="text"
                    value={item}
                    onChange={(e) => {
                      const next = [...items];
                      next[i] = e.target.value;
                      updateAnswer(question.id, next);
                    }}
                    placeholder={question.placeholder || `Item ${i + 1}`}
                    className="flex-1 px-4 py-3 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => updateAnswer(question.id, items.filter((_, j) => j !== i))}
                      className="p-2 text-slate-500 hover:text-red-300"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => updateAnswer(question.id, [...items, ''])}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-cyan-400 hover:bg-cyan-500/20 rounded-lg"
              >
                <Plus className="w-4 h-4" />
                Add item
              </button>
            </div>
          );
        })()}

        {question.type === 'file_upload' && (
          <div className="border-2 border-dashed border-slate-700 rounded-lg p-6 text-center">
            <Upload className="w-8 h-8 mx-auto text-slate-500 mb-2" />
            <p className="text-sm text-slate-300">Click to upload or drag and drop</p>
            <p className="text-xs text-slate-500 mt-1">
              Max {Math.round((question.fileUploadConfig?.maxSizeBytes || 10485760) / 1048576)}MB
            </p>
          </div>
        )}

        {question.type === 'rating' && (
          <div className="flex gap-2">
            {Array.from(
              { length: (question.maxValue || 5) - (question.minValue || 1) + 1 },
              (_, i) => (question.minValue || 1) + i
            ).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => updateAnswer(question.id, n)}
                className={`p-2 transition-colors ${
                  answer !== undefined && n <= Number(answer)
                    ? 'text-yellow-400'
                    : 'text-slate-600 hover:text-yellow-300'
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
                    ? 'bg-cyan-500 border-cyan-500 text-white'
                    : 'border-slate-700 text-slate-300 hover:border-cyan-500 hover:bg-cyan-500/10'
                }`}
              >
                {n}
              </button>
            ))}
            <div className="w-full flex justify-between text-xs text-slate-400 mt-1">
              <span>{question.minLabel || 'Not at all likely'}</span>
              <span>{question.maxLabel || 'Extremely likely'}</span>
            </div>
          </div>
        )}

        {question.type === 'opinion_scale' && (
          <div>
            <div className="flex gap-2">
              {Array.from(
                { length: (question.maxValue || 5) - (question.minValue || 1) + 1 },
                (_, i) => (question.minValue || 1) + i
              ).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => updateAnswer(question.id, n)}
                  className={`flex-1 py-3 border rounded-lg font-medium transition-colors ${
                    answer === n
                      ? 'bg-cyan-500 border-cyan-500 text-white'
                      : 'border-slate-700 text-slate-300 hover:border-cyan-500 hover:bg-cyan-500/10'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <div className="flex justify-between text-xs text-slate-400 mt-2">
              <span>{question.minLabel || 'Strongly Disagree'}</span>
              <span>{question.maxLabel || 'Strongly Agree'}</span>
            </div>
          </div>
        )}

        {question.type === 'contact_capture' && (() => {
          const value = (answer as Record<string, string>) || {};
          return (
            <div className="grid grid-cols-2 gap-3">
              <input type="text" value={value.first_name || ''} onChange={(e) => updateAnswer(question.id, { ...value, first_name: e.target.value })} placeholder="First name" className="px-4 py-3 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500" />
              <input type="text" value={value.last_name || ''} onChange={(e) => updateAnswer(question.id, { ...value, last_name: e.target.value })} placeholder="Last name" className="px-4 py-3 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500" />
              <input type="email" value={value.email || ''} onChange={(e) => updateAnswer(question.id, { ...value, email: e.target.value })} placeholder="Email" className="col-span-2 px-4 py-3 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500" />
              <input type="tel" value={value.phone || ''} onChange={(e) => updateAnswer(question.id, { ...value, phone: e.target.value })} placeholder="Phone (optional)" className="col-span-2 px-4 py-3 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500" />
            </div>
          );
        })()}

        {question.type === 'payment' && (
          <div className="border border-slate-700 rounded-lg p-4 bg-slate-800/60 text-sm text-slate-300 flex items-center gap-2">
            <CreditCard className="w-4 h-4" />
            <span>Payment processing not yet configured for this survey.</span>
          </div>
        )}

        {question.type === 'sms_verification' && (() => {
          const value = (answer as Record<string, string>) || {};
          return (
            <div className="space-y-2">
              <input
                type="tel"
                value={value.phone || ''}
                onChange={(e) => updateAnswer(question.id, { ...value, phone: e.target.value })}
                placeholder="Phone number"
                className={inputClass}
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  value={value.code || ''}
                  onChange={(e) => updateAnswer(question.id, { ...value, code: e.target.value })}
                  placeholder="Verification code"
                  className="flex-1 px-4 py-3 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
                <button type="button" disabled className="px-3 py-2 text-sm bg-slate-700 text-slate-300 rounded-lg" title="SMS sending not yet configured">
                  Send code
                </button>
              </div>
            </div>
          );
        })()}

        {question.type === 'email_validation' && (
          <div className="flex gap-2">
            <input
              type="email"
              value={String(answer || '')}
              onChange={(e) => updateAnswer(question.id, e.target.value)}
              placeholder={question.placeholder || 'you@example.com'}
              className={`flex-1 px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                hasError ? 'border-red-500/40 focus:ring-red-500' : 'border-slate-700 focus:ring-cyan-500'
              }`}
            />
            <button type="button" disabled className="px-3 py-2 text-sm bg-slate-700 text-slate-300 rounded-lg" title="Email validation not yet configured">
              Verify
            </button>
          </div>
        )}

        {question.type === 'math_calculation' && (
          <input
            type="text"
            readOnly
            value={String(answer || '')}
            placeholder={question.formula ? `= ${question.formula}` : 'Computed value'}
            className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-lg text-slate-400"
          />
        )}

        {question.type === 'matrix' && question.matrixRows && question.matrixColumns && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="p-2 text-left"></th>
                  {question.matrixColumns.map(col => (
                    <th key={col.id} className="p-2 text-center text-sm text-slate-300 min-w-[80px]">
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {question.matrixRows.map(row => {
                  const rowAnswer = (answer as Record<string, string>)?.[row.id];
                  return (
                    <tr key={row.id} className="border-t border-slate-700">
                      <td className="p-3 text-sm text-slate-300">{row.label}</td>
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
                            className="text-cyan-400 focus:ring-cyan-500"
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
                      ? 'border-cyan-500 ring-2 ring-cyan-500/30'
                      : 'border-slate-700 hover:border-slate-700'
                  }`}
                >
                  <img
                    src={option.imageUrl}
                    alt={option.label}
                    className="w-full aspect-square object-cover"
                  />
                  <div className={`p-2 text-center text-sm ${
                    isSelected ? 'bg-cyan-500/20 text-cyan-300' : 'bg-slate-900 text-slate-300'
                  }`}>
                    {option.label}
                  </div>
                  {isSelected && (
                    <div className="absolute top-2 right-2 w-6 h-6 bg-cyan-500/200 rounded-full flex items-center justify-center">
                      <CheckCircle className="w-4 h-4 text-white" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {hasError && (
          <p className="mt-2 text-sm text-red-300">{validationErrors[question.id]}</p>
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
        <p className="text-xs text-slate-400 mb-2">Drag to reorder (1 = highest priority)</p>
        {items.map((item, idx) => (
          <div
            key={item}
            draggable
            onDragStart={() => handleDragStart(idx)}
            onDragOver={(e) => handleDragOver(e, idx)}
            onDragEnd={handleDragEnd}
            className={`flex items-center gap-3 p-3 bg-slate-900 border rounded-lg cursor-grab ${
              draggedIdx === idx ? 'opacity-50 border-cyan-500' : 'border-slate-700'
            }`}
          >
            <span className="w-6 h-6 bg-cyan-500/20 text-cyan-300 rounded-full flex items-center justify-center text-sm font-medium">
              {idx + 1}
            </span>
            <GripVertical className="w-4 h-4 text-slate-500" />
            <span className="flex-1 text-slate-300">{getLabel(item)}</span>
          </div>
        ))}
      </div>
    );
  }

  const rootClass = embed
    ? 'bg-slate-950 p-4'
    : 'min-h-screen bg-slate-950 py-12 px-4';
  const centeredRootClass = embed
    ? 'bg-slate-950 flex items-center justify-center p-4'
    : 'min-h-screen bg-slate-950 flex items-center justify-center p-4';

  if (loading) {
    return (
      <div className={centeredRootClass}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500" />
      </div>
    );
  }

  if (error && !survey) {
    return (
      <div className={centeredRootClass}>
        <div className="max-w-md w-full bg-slate-900 rounded-2xl border border-slate-800 p-8 text-center">
          <AlertCircle className="w-12 h-12 text-red-300 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-white mb-2">Survey Not Available</h1>
          <p className="text-slate-400">{error}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className={centeredRootClass}>
        <div className="max-w-md w-full bg-slate-900 rounded-2xl border border-slate-800 p-8 text-center">
          <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-white mb-2">Thank You!</h1>
          <p className="text-slate-400">
            {survey?.settings.thankYouMessage || 'Your response has been submitted successfully.'}
          </p>
          {survey?.settings.redirectUrl && (
            <p className="text-sm text-slate-500 mt-4">Redirecting...</p>
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
    <div className={rootClass}>
      <div className="max-w-2xl mx-auto">
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-8">
          <h1 className="text-2xl font-semibold text-white mb-2">{survey.name}</h1>
          {survey.description && (
            <p className="text-slate-400 mb-6">{survey.description}</p>
          )}

          {survey.settings.showProgressBar && (
            <div className="mb-8">
              <div className="flex justify-between text-sm text-slate-400 mb-2">
                <span>Step {currentStepIndex + 1} of {totalSteps}</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-cyan-500 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-300 mt-0.5" />
              <div className="text-sm text-red-300">{error}</div>
            </div>
          )}

          <div className="mb-8">
            <h2 className="text-lg font-medium text-white mb-1">{currentStep.title}</h2>
            {currentStep.description && (
              <p className="text-sm text-slate-400">{currentStep.description}</p>
            )}
          </div>

          <div>
            {currentStep.questions.map((question, idx) => renderQuestion(question, idx))}
          </div>

          <div className="flex justify-between mt-8 pt-6 border-t border-slate-700">
            <button
              onClick={handleBack}
              disabled={currentStepIndex === 0 || !survey.settings.allowBackNavigation}
              className="flex items-center gap-2 px-4 py-2 text-slate-300 hover:bg-slate-800 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>

            <button
              onClick={handleNext}
              disabled={submitting}
              className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-cyan-500 to-teal-600 text-white font-medium rounded-lg hover:from-cyan-600 hover:to-teal-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
        {!embed && (
          <p className="text-center text-slate-500 text-sm mt-6">
            Powered by Your CRM
          </p>
        )}
      </div>
    </div>
  );
}
