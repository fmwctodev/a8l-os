import { useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { CheckCircle, AlertCircle, Loader2, ArrowLeft, ArrowRight, Star, Heart, ThumbsUp, Flag, Lightbulb, GripVertical, Plus, X, Upload, CreditCard } from 'lucide-react';
import { SignaturePad } from '../../components/SignaturePad';
import { supabase } from '../../lib/supabase';
import type { Survey, SurveyQuestion } from '../../types';
import {
  US_STATES,
  COUNTRIES,
  COMMON_TIMEZONES,
  currencySymbol,
} from '../../constants/formFieldOptions';
import { getTheme, themeStyleVars } from '../../constants/formThemes';
import { evaluateRule } from '../../components/SubmitRulesEditor';
import { evalFormula } from '../../utils/formulaEvaluator';

export function PublicSurveyPage() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [disqualifyMessage, setDisqualifyMessage] = useState<string | null>(null);
  const [customSuccessMessage, setCustomSuccessMessage] = useState<string | null>(null);
  const [hasSavedPartial, setHasSavedPartial] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [currentQuestionInStep, setCurrentQuestionInStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  const embed = useMemo(() => {
    const v = searchParams.get('embed');
    return v === '1' || v === 'true';
  }, [searchParams]);

  useEffect(() => {
    if (slug) loadSurvey();
  }, [slug]);

  useEffect(() => {
    if (!survey?.settings.captchaEnabled || !survey.settings.captchaSiteKey) return;
    if (typeof window === 'undefined') return;
    if (document.getElementById('hcaptcha-script')) return;
    const s = document.createElement('script');
    s.id = 'hcaptcha-script';
    s.src = 'https://js.hcaptcha.com/1/api.js';
    s.async = true;
    s.defer = true;
    document.head.appendChild(s);
  }, [survey?.settings.captchaEnabled, survey?.settings.captchaSiteKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    interface CaptchaWindow extends Window {
      __onHCaptcha?: (token: string) => void;
      __onHCaptchaExpired?: () => void;
    }
    (window as CaptchaWindow).__onHCaptcha = (token: string) => setCaptchaToken(token);
    (window as CaptchaWindow).__onHCaptchaExpired = () => setCaptchaToken(null);
  }, []);

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

      const defaults: Record<string, unknown> = {};
      const allQuestions: SurveyQuestion[] = (data.definition?.steps || []).flatMap((s: { questions?: SurveyQuestion[] }) => s.questions || []);
      for (const q of allQuestions) {
        if (q.type === 'source') {
          const sourceParam = searchParams.get('source');
          if (sourceParam) { defaults[q.id] = sourceParam; continue; }
        }
        if (q.type === 'hidden') {
          const key = q.hiddenParamKey || q.id;
          const v = searchParams.get(key);
          if (v) { defaults[q.id] = v; continue; }
        }
        if (q.defaultValue === undefined || q.defaultValue === null || q.defaultValue === '') continue;
        if (q.type === 'checkbox' || q.type === 'consent') {
          defaults[q.id] = q.defaultValue === 'true' || q.defaultValue === true;
        } else if (q.type === 'number' || q.type === 'monetary' || q.type === 'rating' || q.type === 'nps') {
          const n = parseFloat(String(q.defaultValue));
          defaults[q.id] = isNaN(n) ? q.defaultValue : n;
        } else {
          defaults[q.id] = q.defaultValue;
        }
      }
      if (Object.keys(defaults).length > 0) {
        setAnswers((prev) => ({ ...defaults, ...prev }));
      }

      // Sticky Contact prefill from localStorage
      if (data.settings?.stickyContact && typeof window !== 'undefined') {
        try {
          const raw = window.localStorage.getItem(`sticky_survey_${data.id}`);
          if (raw) {
            const sticky = JSON.parse(raw) as Record<string, unknown>;
            setAnswers((prev) => ({ ...sticky, ...prev }));
          }
        } catch {
          // ignore
        }
      }
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
    const oneAtATime = !!survey.settings.oneQuestionPerStep;
    const errors: Record<string, string> = {};
    const questionsToValidate = oneAtATime
      ? [currentStep.questions[currentQuestionInStep]].filter(Boolean)
      : currentStep.questions;

    for (const question of questionsToValidate) {
      const answer = answers[question.id];
      const isEmpty = answer === undefined || answer === '' || (Array.isArray(answer) && answer.length === 0);

      if (question.required && isEmpty) {
        errors[question.id] = 'This question is required';
        continue;
      }

      if (question.type === 'multi_select' || question.type === 'checkbox_group') {
        const selected = (answer as string[]) || [];
        if (question.minSelections && selected.length < question.minSelections) {
          errors[question.id] = `Select at least ${question.minSelections} option${question.minSelections === 1 ? '' : 's'}`;
        } else if (question.maxSelections && selected.length > question.maxSelections) {
          errors[question.id] = `Select at most ${question.maxSelections} option${question.maxSelections === 1 ? '' : 's'}`;
        }
      }

      if (question.allowOther) {
        const otherText = String(answers[`${question.id}__other`] || '').trim();
        if ((question.type === 'multiple_choice' || question.type === 'dropdown') && answer === '__other__' && !otherText) {
          errors[question.id] = 'Please specify your "Other" answer';
        } else if ((question.type === 'multi_select' || question.type === 'checkbox_group') && Array.isArray(answer) && answer.includes('__other__') && !otherText) {
          errors[question.id] = 'Please specify your "Other" answer';
        }
      }

      if (question.validationRules && !isEmpty) {
        const value = String(answer ?? '');
        const numValue = typeof answer === 'number' ? answer : parseFloat(value);
        for (const rule of question.validationRules) {
          if (errors[question.id]) break;
          if (rule.type === 'min_length' && value.length < Number(rule.value)) {
            errors[question.id] = rule.message || `Minimum ${rule.value} characters required`;
          } else if (rule.type === 'max_length' && value.length > Number(rule.value)) {
            errors[question.id] = rule.message || `Maximum ${rule.value} characters allowed`;
          } else if (rule.type === 'pattern') {
            try {
              if (!new RegExp(String(rule.value)).test(value)) {
                errors[question.id] = rule.message || 'Invalid format';
              }
            } catch {
              // bad pattern
            }
          } else if (rule.type === 'min' && !isNaN(numValue) && numValue < Number(rule.value)) {
            errors[question.id] = rule.message || `Must be at least ${rule.value}`;
          } else if (rule.type === 'max' && !isNaN(numValue) && numValue > Number(rule.value)) {
            errors[question.id] = rule.message || `Must be at most ${rule.value}`;
          } else if (rule.type === 'min_date' && value < String(rule.value)) {
            errors[question.id] = rule.message || `Must be on or after ${rule.value}`;
          } else if (rule.type === 'max_date' && value > String(rule.value)) {
            errors[question.id] = rule.message || `Must be on or before ${rule.value}`;
          } else if (rule.type === 'format') {
            if (question.type === 'email') {
              if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                errors[question.id] = rule.message || 'Please enter a valid email address';
              }
            } else if (question.type === 'phone') {
              const digits = value.replace(/\D+/g, '');
              if (digits.length < 7 || digits.length > 15) {
                errors[question.id] = rule.message || 'Please enter a valid phone number';
              }
            } else if (question.type === 'website') {
              try {
                const u = new URL(value.includes('://') ? value : `https://${value}`);
                if (!u.hostname.includes('.')) throw new Error();
              } catch {
                errors[question.id] = rule.message || 'Please enter a valid URL';
              }
            }
          }
        }
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function handleNext() {
    if (!survey || !validateCurrentStep()) return;
    const oneAtATime = !!survey.settings.oneQuestionPerStep;
    const currentStep = survey.definition.steps[currentStepIndex];
    const isLastQuestionInStep = currentQuestionInStep >= currentStep.questions.length - 1;
    const isLastStep = currentStepIndex >= survey.definition.steps.length - 1;

    if (oneAtATime && !isLastQuestionInStep) {
      setCurrentQuestionInStep(currentQuestionInStep + 1);
      setValidationErrors({});
      return;
    }

    if (!isLastStep) {
      maybeSendPartial();
      setCurrentStepIndex(currentStepIndex + 1);
      setCurrentQuestionInStep(0);
      setValidationErrors({});
    } else {
      handleSubmit();
    }
  }

  function maybeSendPartial() {
    if (!survey || hasSavedPartial || !survey.settings.partialCompletionEnabled) return;

    const hasContactInfo = survey.definition.steps.some((step) =>
      step.questions.some((q) => {
        const answer = answers[q.id];
        if (answer === undefined || answer === null || answer === '') return false;
        if (q.type === 'email' || q.type === 'phone') return true;
        if (q.type === 'contact_capture' && typeof answer === 'object') {
          const co = answer as Record<string, string>;
          return !!(co.email || co.phone);
        }
        return false;
      })
    );
    if (!hasContactInfo) return;

    setHasSavedPartial(true);
    fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/survey-submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        surveyId: survey.id,
        answers,
        partial: true,
      }),
    }).catch((err) => {
      console.warn('Partial submission failed (non-blocking):', err);
    });
  }

  function handleBack() {
    if (!survey?.settings.allowBackNavigation) return;
    const oneAtATime = !!survey.settings.oneQuestionPerStep;

    if (oneAtATime && currentQuestionInStep > 0) {
      setCurrentQuestionInStep(currentQuestionInStep - 1);
      setValidationErrors({});
      return;
    }

    if (currentStepIndex === 0) return;
    const prevStep = survey.definition.steps[currentStepIndex - 1];
    setCurrentStepIndex(currentStepIndex - 1);
    setCurrentQuestionInStep(oneAtATime ? Math.max(0, prevStep.questions.length - 1) : 0);
    setValidationErrors({});
  }

  async function handleSubmit() {
    if (!survey || !validateCurrentStep()) return;

    const submitRules = survey.settings.submitRules || [];

    const disqualifyHit = submitRules.find(
      (r) => r.action === 'disqualify' && evaluateRule(r, answers)
    );
    if (disqualifyHit) {
      setDisqualifyMessage(disqualifyHit.payload || "Sorry, you don't qualify based on your answers.");
      return;
    }

    if (survey.settings.captchaEnabled && survey.settings.captchaSiteKey && !captchaToken) {
      setError('Please complete the captcha challenge.');
      return;
    }

    try {
      setSubmitting(true);

      const enrichedAnswers: Record<string, unknown> = { ...answers };
      for (const step of survey.definition.steps) {
        for (const q of step.questions) {
          if (q.type === 'math_calculation') {
            enrichedAnswers[q.id] = evalFormula(q.formula, answers as Record<string, unknown>);
          }
          if (q.allowOther) {
            const otherText = String(answers[`${q.id}__other`] || '').trim();
            const current = enrichedAnswers[q.id];
            if (current === '__other__') {
              enrichedAnswers[q.id] = otherText ? `__other:${otherText}` : '__other__';
            } else if (Array.isArray(current) && current.includes('__other__')) {
              enrichedAnswers[q.id] = current.map((v) =>
                v === '__other__' ? (otherText ? `__other:${otherText}` : '__other__') : v
              );
            }
          }
        }
      }
      // strip the temp __other inputs
      for (const k of Object.keys(enrichedAnswers)) {
        if (k.endsWith('__other')) delete enrichedAnswers[k];
      }

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
            answers: enrichedAnswers,
            _captcha_token: captchaToken,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Submission failed');
      }

      const matchedRule = submitRules.find(
        (r) => (r.action === 'redirect' || r.action === 'message') && evaluateRule(r, answers)
      );

      if (matchedRule?.action === 'redirect' && matchedRule.payload) {
        window.location.href = matchedRule.payload;
        return;
      }

      if (matchedRule?.action === 'message' && matchedRule.payload) {
        setCustomSuccessMessage(matchedRule.payload);
      }

      setSubmitted(true);

      if (survey.settings.stickyContact && typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(`sticky_survey_${survey.id}`, JSON.stringify(answers));
        } catch {
          // ignore
        }
      }

      if (!matchedRule && survey.settings.redirectUrl) {
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

  function optionsLayoutClass(question: SurveyQuestion): string {
    switch (question.optionsLayout) {
      case 'horizontal':
        return 'flex flex-wrap gap-3';
      case 'columns_2':
        return 'grid grid-cols-1 sm:grid-cols-2 gap-2';
      case 'columns_3':
        return 'grid grid-cols-1 sm:grid-cols-3 gap-2';
      default:
        return 'space-y-2';
    }
  }

  function renderQuestion(question: SurveyQuestion, index: number) {
    const hasError = !!validationErrors[question.id];
    const answer = answers[question.id];
    const inputClass = `w-full px-4 py-3 bg-[var(--form-input-bg)] text-[var(--form-input-text)] placeholder:text-[var(--form-input-placeholder)] border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
      hasError ? 'border-red-500/40 focus:ring-red-500' : 'border-[var(--form-input-border)] focus:ring-[var(--form-accent-solid)]'
    }`;

    if (question.type === 'hidden') return null;

    if (question.type === 'divider') {
      return (
        <div key={question.id} className="py-4">
          <hr className="border-[var(--form-input-border)]" />
          {question.label && (
            <p className="text-sm text-[var(--form-text-muted)] mt-2">{question.label}</p>
          )}
        </div>
      );
    }

    if (question.type === 'section') {
      return (
        <div key={question.id} className="py-2">
          {question.label && (
            <h3 className="text-base font-semibold text-[var(--form-text-primary)] mb-2">{question.label}</h3>
          )}
          <hr className="border-[var(--form-input-border)]" />
        </div>
      );
    }

    if (question.type === 'heading') {
      const level = question.headingLevel || 'h2';
      const sizeCls =
        level === 'h1' ? 'text-3xl' :
        level === 'h2' ? 'text-2xl' :
        level === 'h3' ? 'text-xl' :
        'text-lg';
      const Tag = level as 'h1' | 'h2' | 'h3' | 'h4';
      return <Tag key={question.id} className={`${sizeCls} font-semibold text-[var(--form-text-primary)]`}>{question.label}</Tag>;
    }

    if (question.type === 'paragraph') {
      return <p key={question.id} className="text-sm text-[var(--form-text-secondary)] whitespace-pre-line">{question.label}</p>;
    }

    if (question.type === 'column') {
      // Column / Layout markers are grouped at the parent loop; the marker itself is invisible.
      return null;
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
    const hideLabel = question.labelAlignment === 'inline';

    return (
      <div key={question.id} className={`mb-8 ${question.customClassName || ''}`.trim()}>
        {!isCheckboxType && !hideLabel && (
          <label className="block text-base font-medium text-[var(--form-text-primary)] mb-2">
            {index + 1}. {question.label}
            {question.required && <span className="text-[var(--form-error-text)] ml-1">*</span>}
          </label>
        )}
        {question.description && (
          <p className="text-sm text-[var(--form-text-muted)] mb-3">{question.description}</p>
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
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--form-text-muted)] text-sm pointer-events-none">
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

        {question.type === 'phone' && question.phoneFormat !== 'international' && (
          <input
            type="tel"
            value={String(answer || '')}
            onChange={(e) => updateAnswer(question.id, e.target.value)}
            placeholder={question.placeholder}
            className={inputClass}
          />
        )}

        {question.type === 'phone' && question.phoneFormat === 'international' && (() => {
          const fullValue = String(answer || '');
          const match = fullValue.match(/^(\+\d{1,3})\s?(.*)$/);
          const dialCode = match?.[1] || '+1';
          const localNumber = match?.[2] ?? fullValue;
          const setBoth = (code: string, num: string) => {
            updateAnswer(question.id, num.trim() ? `${code} ${num.trim()}` : code);
          };
          return (
            <div className="flex gap-2">
              <select
                value={dialCode}
                onChange={(e) => setBoth(e.target.value, localNumber)}
                className={`px-3 ${inputClass}`}
              >
                {[
                  ['+1', 'US/CA +1'], ['+44', 'UK +44'], ['+61', 'AU +61'], ['+33', 'FR +33'],
                  ['+49', 'DE +49'], ['+34', 'ES +34'], ['+39', 'IT +39'], ['+91', 'IN +91'],
                  ['+81', 'JP +81'], ['+86', 'CN +86'], ['+52', 'MX +52'], ['+55', 'BR +55'],
                ].map(([code, label]) => (
                  <option key={code} value={code}>{label}</option>
                ))}
              </select>
              <input
                type="tel"
                value={localNumber}
                onChange={(e) => setBoth(dialCode, e.target.value)}
                placeholder={question.placeholder || 'Phone number'}
                className={`flex-1 ${inputClass}`}
              />
            </div>
          );
        })()}

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

        {question.type === 'address' && (() => {
          const addr = (answer as Record<string, string> | undefined) || {};
          const setSub = (key: string, value: string) => {
            updateAnswer(question.id, { ...addr, [key]: value });
          };
          return (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                value={addr.street || ''}
                onChange={(e) => setSub('street', e.target.value)}
                placeholder="Street address"
                className={`sm:col-span-2 ${inputClass}`}
              />
              <input
                type="text"
                value={addr.city || ''}
                onChange={(e) => setSub('city', e.target.value)}
                placeholder="City"
                className={inputClass}
              />
              <select
                value={addr.state || ''}
                onChange={(e) => setSub('state', e.target.value)}
                className={inputClass}
              >
                <option value="">State / Region</option>
                {US_STATES.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <input
                type="text"
                value={addr.postal_code || ''}
                onChange={(e) => setSub('postal_code', e.target.value)}
                placeholder="Postal / Zip code"
                className={inputClass}
              />
              <select
                value={addr.country || ''}
                onChange={(e) => setSub('country', e.target.value)}
                className={inputClass}
              >
                <option value="">Country</option>
                {COUNTRIES.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          );
        })()}

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
            <div className={optionsLayoutClass(question)}>
              {(question.options || []).map((option) => (
                <label
                  key={option.id}
                  className={`flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${
                    answer === option.value
                      ? 'border-[var(--form-selected-border)] bg-[var(--form-selected-bg)]'
                      : 'border-[var(--form-input-border)] hover:border-[var(--form-input-border)]'
                  }`}
                >
                  <input
                    type="radio"
                    name={question.id}
                    checked={answer === option.value}
                    onChange={() => updateAnswer(question.id, option.value)}
                    className="text-[var(--form-accent-solid)] focus:ring-[var(--form-accent-solid)]"
                  />
                  <span className="text-[var(--form-text-secondary)]">{option.label}</span>
                </label>
              ))}
              {question.allowOther && (
                <label
                  className={`flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${
                    answer === '__other__'
                      ? 'border-[var(--form-selected-border)] bg-[var(--form-selected-bg)]'
                      : 'border-[var(--form-input-border)] hover:border-[var(--form-input-border)]'
                  }`}
                >
                  <input
                    type="radio"
                    name={question.id}
                    checked={answer === '__other__'}
                    onChange={() => updateAnswer(question.id, '__other__')}
                    className="text-[var(--form-accent-solid)] focus:ring-[var(--form-accent-solid)]"
                  />
                  <span className="text-[var(--form-text-secondary)]">Other</span>
                </label>
              )}
            </div>
            {question.allowOther && answer === '__other__' && (
              <input
                type="text"
                value={String(answers[`${question.id}__other`] || '')}
                onChange={(e) => updateAnswer(`${question.id}__other`, e.target.value)}
                placeholder="Please specify..."
                className={inputClass}
              />
            )}
          </div>
        )}

        {(question.type === 'dropdown' || question.type === 'product_selection') && (
          <div className="space-y-2">
            <select
              value={String(answer || '')}
              onChange={(e) => updateAnswer(question.id, e.target.value)}
              className={inputClass}
            >
              <option value="">{question.placeholder || 'Select an option'}</option>
              {(question.options || []).map((opt) => (
                <option key={opt.id} value={opt.value}>{opt.label}</option>
              ))}
              {question.allowOther && question.type === 'dropdown' && <option value="__other__">Other</option>}
            </select>
            {question.allowOther && answer === '__other__' && (
              <input
                type="text"
                value={String(answers[`${question.id}__other`] || '')}
                onChange={(e) => updateAnswer(`${question.id}__other`, e.target.value)}
                placeholder="Please specify..."
                className={inputClass}
              />
            )}
          </div>
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

        {(question.type === 'multi_select' || question.type === 'checkbox_group') && (() => {
          const selectedArr = Array.isArray(answer) ? (answer as string[]) : [];
          const otherSelected = selectedArr.includes('__other__');
          return (
            <div className="space-y-2">
              <div className={optionsLayoutClass(question)}>
                {(question.options || []).map((option) => {
                  const selected = selectedArr.includes(option.value);
                  return (
                    <label
                      key={option.id}
                      className={`flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${
                        selected
                          ? 'border-[var(--form-selected-border)] bg-[var(--form-selected-bg)]'
                          : 'border-[var(--form-input-border)] hover:border-[var(--form-input-border)]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={(e) => {
                          const newValue = e.target.checked
                            ? [...selectedArr, option.value]
                            : selectedArr.filter((v) => v !== option.value);
                          updateAnswer(question.id, newValue);
                        }}
                        className="rounded text-[var(--form-accent-solid)] focus:ring-[var(--form-accent-solid)]"
                      />
                      <span className="text-[var(--form-text-secondary)]">{option.label}</span>
                    </label>
                  );
                })}
                {question.allowOther && (
                  <label
                    className={`flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${
                      otherSelected
                        ? 'border-[var(--form-selected-border)] bg-[var(--form-selected-bg)]'
                        : 'border-[var(--form-input-border)] hover:border-[var(--form-input-border)]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={otherSelected}
                      onChange={(e) => {
                        const newValue = e.target.checked
                          ? [...selectedArr, '__other__']
                          : selectedArr.filter((v) => v !== '__other__');
                        updateAnswer(question.id, newValue);
                      }}
                      className="rounded text-[var(--form-accent-solid)] focus:ring-[var(--form-accent-solid)]"
                    />
                    <span className="text-[var(--form-text-secondary)]">Other</span>
                  </label>
                )}
              </div>
              {question.allowOther && otherSelected && (
                <input
                  type="text"
                  value={String(answers[`${question.id}__other`] || '')}
                  onChange={(e) => updateAnswer(`${question.id}__other`, e.target.value)}
                  placeholder="Please specify..."
                  className={inputClass}
                />
              )}
            </div>
          );
        })()}

        {isCheckboxType && (
          <div className="space-y-2">
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={Boolean(answer)}
                onChange={(e) => updateAnswer(question.id, e.target.checked)}
                className="mt-1 rounded border-[var(--form-input-border)] text-[var(--form-accent-solid)] focus:ring-[var(--form-accent-solid)]"
              />
              <span className="text-[var(--form-text-secondary)]">{question.label}</span>
            </label>
            {question.type === 'consent' && question.consentDescription && (
              <div
                className="text-xs text-[var(--form-text-muted)] pl-6 [&_a]:text-[var(--form-accent-solid)] [&_a]:underline"
                dangerouslySetInnerHTML={{ __html: question.consentDescription }}
              />
            )}
          </div>
        )}

        {question.type === 'signature' && (
          <SignaturePad
            value={String(answer || '')}
            onChange={(dataUrl) => updateAnswer(question.id, dataUrl)}
            height={question.signaturePadHeight ?? 120}
            hasError={hasError}
          />
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
                    className="flex-1 px-4 py-3 border border-[var(--form-input-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--form-accent-solid)]"
                  />
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => updateAnswer(question.id, items.filter((_, j) => j !== i))}
                      className="p-2 text-[var(--form-text-muted)] hover:text-[var(--form-error-text)]"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => updateAnswer(question.id, [...items, ''])}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-[var(--form-accent-solid)] hover:bg-[var(--form-accent-solid)]/20 rounded-lg"
              >
                <Plus className="w-4 h-4" />
                Add item
              </button>
            </div>
          );
        })()}

        {question.type === 'file_upload' && (
          <div className="border-2 border-dashed border-[var(--form-input-border)] rounded-lg p-6 text-center">
            <Upload className="w-8 h-8 mx-auto text-[var(--form-text-muted)] mb-2" />
            <p className="text-sm text-[var(--form-text-secondary)]">Click to upload or drag and drop</p>
            <p className="text-xs text-[var(--form-text-muted)] mt-1">
              Max {Math.round((question.fileUploadConfig?.maxSizeBytes || 10485760) / 1048576)}MB
            </p>
          </div>
        )}

        {question.type === 'rating' && (() => {
          const max = question.maxValue || 5;
          const min = 1;
          const Icon =
            question.ratingIcon === 'heart' ? Heart :
            question.ratingIcon === 'thumb' ? ThumbsUp :
            question.ratingIcon === 'flag' ? Flag :
            question.ratingIcon === 'lightbulb' ? Lightbulb :
            Star;
          const selectedColor = question.ratingIconColor || '#fbbf24';
          const unselectedColor = question.ratingIconColorUnselected || '#94a3b8';
          const storage = question.ratingDataStorage || 'absolute';
          const currentNum = (() => {
            const a = answer;
            if (typeof a === 'number') return a;
            if (typeof a === 'string') {
              if (storage === 'percentage') return Math.round((parseFloat(a) / 100) * max);
              if (storage === 'fraction') return parseInt(a.split('/')[0]) || 0;
              return parseInt(a) || 0;
            }
            return 0;
          })();
          const onPick = (n: number) => {
            if (storage === 'percentage') updateAnswer(question.id, Math.round((n / max) * 100));
            else if (storage === 'fraction') updateAnswer(question.id, `${n}/${max}`);
            else updateAnswer(question.id, n);
          };
          return (
            <div className="flex gap-2">
              {Array.from({ length: max - min + 1 }, (_, i) => min + i).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => onPick(n)}
                  className="p-2 transition-colors"
                  style={{ color: n <= currentNum ? selectedColor : unselectedColor }}
                >
                  <Icon className="w-8 h-8 fill-current" />
                </button>
              ))}
            </div>
          );
        })()}

        {question.type === 'nps' && (
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 11 }, (_, i) => i).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => updateAnswer(question.id, n)}
                className={`w-12 h-12 border rounded-lg font-medium transition-colors ${
                  answer === n
                    ? 'bg-[var(--form-accent-solid)] border-[var(--form-accent-solid)] text-[var(--form-accent-text)]'
                    : 'border-[var(--form-input-border)] text-[var(--form-text-secondary)] hover:border-[var(--form-accent-solid)] hover:bg-[var(--form-selected-bg)]'
                }`}
              >
                {n}
              </button>
            ))}
            <div className="w-full flex justify-between text-xs text-[var(--form-text-muted)] mt-1">
              <span>{question.minLabel || 'Not at all likely'}</span>
              <span>{question.maxLabel || 'Extremely likely'}</span>
            </div>
          </div>
        )}

        {question.type === 'opinion_scale' && (() => {
          const min = question.minValue ?? 1;
          const max = question.maxValue ?? 5;
          const explicitSteps = question.scaleSteps ?? (max - min + 1);
          const steps = Math.min(10, Math.max(2, explicitSteps));
          const stepValues = Array.from({ length: steps }, (_, i) => Math.round(min + i * ((max - min) / Math.max(1, steps - 1))));
          return (
            <div>
              <div className="flex gap-2">
                {stepValues.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => updateAnswer(question.id, n)}
                    className={`flex-1 py-3 border rounded-lg font-medium transition-colors ${
                      answer === n
                        ? 'bg-[var(--form-accent-solid)] border-[var(--form-accent-solid)] text-[var(--form-accent-text)]'
                        : 'border-[var(--form-input-border)] text-[var(--form-text-secondary)] hover:border-[var(--form-accent-solid)] hover:bg-[var(--form-selected-bg)]'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <div className="flex justify-between text-xs text-[var(--form-text-muted)] mt-2">
                <span>{question.minLabel || 'Strongly Disagree'}</span>
                <span>{question.maxLabel || 'Strongly Agree'}</span>
              </div>
            </div>
          );
        })()}

        {question.type === 'contact_capture' && (() => {
          const value = (answer as Record<string, string>) || {};
          return (
            <div className="grid grid-cols-2 gap-3">
              <input type="text" value={value.first_name || ''} onChange={(e) => updateAnswer(question.id, { ...value, first_name: e.target.value })} placeholder="First name" className="px-4 py-3 border border-[var(--form-input-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--form-accent-solid)]" />
              <input type="text" value={value.last_name || ''} onChange={(e) => updateAnswer(question.id, { ...value, last_name: e.target.value })} placeholder="Last name" className="px-4 py-3 border border-[var(--form-input-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--form-accent-solid)]" />
              <input type="email" value={value.email || ''} onChange={(e) => updateAnswer(question.id, { ...value, email: e.target.value })} placeholder="Email" className="col-span-2 px-4 py-3 border border-[var(--form-input-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--form-accent-solid)]" />
              <input type="tel" value={value.phone || ''} onChange={(e) => updateAnswer(question.id, { ...value, phone: e.target.value })} placeholder="Phone (optional)" className="col-span-2 px-4 py-3 border border-[var(--form-input-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--form-accent-solid)]" />
            </div>
          );
        })()}

        {question.type === 'payment' && (
          <div className="border border-[var(--form-input-border)] rounded-lg p-4 bg-[var(--form-input-bg)]/60 text-sm text-[var(--form-text-secondary)] flex items-center gap-2">
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
                  className="flex-1 px-4 py-3 border border-[var(--form-input-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--form-accent-solid)]"
                />
                <button type="button" disabled className="px-3 py-2 text-sm bg-[var(--form-input-bg)] text-[var(--form-text-secondary)] rounded-lg" title="SMS sending not yet configured">
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
                hasError ? 'border-red-500/40 focus:ring-red-500' : 'border-[var(--form-input-border)] focus:ring-[var(--form-accent-solid)]'
              }`}
            />
            <button type="button" disabled className="px-3 py-2 text-sm bg-[var(--form-input-bg)] text-[var(--form-text-secondary)] rounded-lg" title="Email validation not yet configured">
              Verify
            </button>
          </div>
        )}

        {question.type === 'math_calculation' && (() => {
          const computed = evalFormula(question.formula, answers as Record<string, unknown>);
          const display =
            computed !== null
              ? question.currency
                ? `${currencySymbol(question.currency)}${computed.toFixed(2)}`
                : String(computed)
              : '';
          return (
            <input
              type="text"
              readOnly
              value={display}
              placeholder={question.formula ? `= ${question.formula}` : 'Configure formula in question settings'}
              className="w-full px-4 py-3 bg-[var(--form-input-bg)]/60 border border-[var(--form-input-border)] rounded-lg text-[var(--form-text-muted)]"
            />
          );
        })()}

        {question.type === 'matrix' && question.matrixRows && question.matrixColumns && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="p-2 text-left"></th>
                  {question.matrixColumns.map(col => (
                    <th key={col.id} className="p-2 text-center text-sm text-[var(--form-text-secondary)] min-w-[80px]">
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {question.matrixRows.map(row => {
                  const rowAnswer = (answer as Record<string, string>)?.[row.id];
                  return (
                    <tr key={row.id} className="border-t border-[var(--form-input-border)]">
                      <td className="p-3 text-sm text-[var(--form-text-secondary)]">{row.label}</td>
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
                            className="text-[var(--form-accent-solid)] focus:ring-[var(--form-accent-solid)]"
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
                      ? 'border-[var(--form-accent-solid)] ring-2 ring-[var(--form-accent-solid)]/30'
                      : 'border-[var(--form-input-border)] hover:border-[var(--form-input-border)]'
                  }`}
                >
                  <img
                    src={option.imageUrl}
                    alt={option.label}
                    className="w-full aspect-square object-cover"
                  />
                  <div className={`p-2 text-center text-sm ${
                    isSelected ? 'bg-[var(--form-accent-solid)]/20 text-[var(--form-accent-solid)]' : 'bg-[var(--form-card-bg)] text-[var(--form-text-secondary)]'
                  }`}>
                    {option.label}
                  </div>
                  {isSelected && (
                    <div className="absolute top-2 right-2 w-6 h-6 bg-[var(--form-accent-solid)]/200 rounded-full flex items-center justify-center">
                      <CheckCircle className="w-4 h-4 text-[var(--form-accent-text)]" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {hasError && (
          <p className="mt-2 text-sm text-[var(--form-error-text)]">{validationErrors[question.id]}</p>
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
        <p className="text-xs text-[var(--form-text-muted)] mb-2">Drag to reorder (1 = highest priority)</p>
        {items.map((item, idx) => (
          <div
            key={item}
            draggable
            onDragStart={() => handleDragStart(idx)}
            onDragOver={(e) => handleDragOver(e, idx)}
            onDragEnd={handleDragEnd}
            className={`flex items-center gap-3 p-3 bg-[var(--form-card-bg)] border rounded-lg cursor-grab ${
              draggedIdx === idx ? 'opacity-50 border-[var(--form-accent-solid)]' : 'border-[var(--form-input-border)]'
            }`}
          >
            <span className="w-6 h-6 bg-[var(--form-accent-solid)]/20 text-[var(--form-accent-solid)] rounded-full flex items-center justify-center text-sm font-medium">
              {idx + 1}
            </span>
            <GripVertical className="w-4 h-4 text-[var(--form-text-muted)]" />
            <span className="flex-1 text-[var(--form-text-secondary)]">{getLabel(item)}</span>
          </div>
        ))}
      </div>
    );
  }

  const theme = getTheme(survey?.settings?.theme);
  const themeStyle = themeStyleVars(theme);
  const rootClass = embed
    ? 'bg-[var(--form-page-bg)] p-4'
    : 'min-h-screen bg-[var(--form-page-bg)] py-12 px-4';
  const centeredRootClass = embed
    ? 'bg-[var(--form-page-bg)] flex items-center justify-center p-4'
    : 'min-h-screen bg-[var(--form-page-bg)] flex items-center justify-center p-4';

  if (loading) {
    return (
      <div className={centeredRootClass} style={themeStyle}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--form-accent-solid)]" />
      </div>
    );
  }

  if (error && !survey) {
    return (
      <div className={centeredRootClass} style={themeStyle}>
        <div className="max-w-md w-full bg-[var(--form-card-bg)] rounded-2xl border border-[var(--form-card-border)] p-8 text-center">
          <AlertCircle className="w-12 h-12 text-[var(--form-error-text)] mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-[var(--form-text-primary)] mb-2">Survey Not Available</h1>
          <p className="text-[var(--form-text-muted)]">{error}</p>
        </div>
      </div>
    );
  }

  if (disqualifyMessage) {
    return (
      <div className={centeredRootClass} style={themeStyle}>
        <div className="max-w-md w-full bg-[var(--form-card-bg)] rounded-2xl border border-[var(--form-card-border)] p-8 text-center">
          <AlertCircle className="w-12 h-12 text-[var(--form-text-muted)] mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-[var(--form-text-primary)] mb-2">Thanks for your interest</h1>
          <p className="text-[var(--form-text-muted)] whitespace-pre-line">{disqualifyMessage}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    const message = customSuccessMessage || survey?.settings.thankYouMessage || 'Your response has been submitted successfully.';
    return (
      <div className={centeredRootClass} style={themeStyle}>
        <div className="max-w-md w-full bg-[var(--form-card-bg)] rounded-2xl border border-[var(--form-card-border)] p-8 text-center">
          <CheckCircle className="w-12 h-12 text-[var(--form-success-text)] mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-[var(--form-text-primary)] mb-2">Thank You!</h1>
          <p className="text-[var(--form-text-muted)] whitespace-pre-line">{message}</p>
          {!customSuccessMessage && survey?.settings.redirectUrl && (
            <p className="text-sm text-[var(--form-text-muted)] mt-4">Redirecting...</p>
          )}
        </div>
      </div>
    );
  }

  if (!survey) return null;

  const currentStep = survey.definition.steps[currentStepIndex];
  const totalSteps = survey.definition.steps.length;
  const oneAtATime = !!survey.settings.oneQuestionPerStep;
  const totalQuestions = survey.definition.steps.reduce((n, s) => n + s.questions.length, 0);
  const completedQuestions = survey.definition.steps
    .slice(0, currentStepIndex)
    .reduce((n, s) => n + s.questions.length, 0) + (oneAtATime ? currentQuestionInStep : currentStep.questions.length);
  const progress = oneAtATime
    ? Math.min(100, ((completedQuestions + 1) / Math.max(1, totalQuestions)) * 100)
    : ((currentStepIndex + 1) / totalSteps) * 100;
  const isLastStep = currentStepIndex === totalSteps - 1;
  const isLastQuestionInStep = currentQuestionInStep >= currentStep.questions.length - 1;
  const isLastQuestionOverall = oneAtATime ? (isLastStep && isLastQuestionInStep) : isLastStep;
  const visibleQuestions = oneAtATime
    ? [currentStep.questions[currentQuestionInStep]].filter(Boolean)
    : currentStep.questions;
  const isAtStart = oneAtATime
    ? currentStepIndex === 0 && currentQuestionInStep === 0
    : currentStepIndex === 0;

  return (
    <div className={rootClass} style={themeStyle}>
      <div className="max-w-2xl mx-auto">
        <div className="bg-[var(--form-card-bg)] rounded-2xl border border-[var(--form-card-border)] p-8">
          <h1 className="text-2xl font-semibold text-[var(--form-text-primary)] mb-2">{survey.name}</h1>
          {survey.description && (
            <p className="text-[var(--form-text-muted)] mb-6">{survey.description}</p>
          )}

          {survey.settings.showProgressBar && (
            <div className="mb-8">
              <div className="flex justify-between text-sm text-[var(--form-text-muted)] mb-2">
                <span>
                  {oneAtATime
                    ? `Question ${completedQuestions + 1} of ${totalQuestions}`
                    : `Step ${currentStepIndex + 1} of ${totalSteps}`}
                </span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="h-2 bg-[var(--form-input-bg)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[var(--form-accent-solid)] transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 bg-[var(--form-error-bg)] border border-[var(--form-error-border)] rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-[var(--form-error-text)] mt-0.5" />
              <div className="text-sm text-[var(--form-error-text)]">{error}</div>
            </div>
          )}

          {!oneAtATime && (
            <div className="mb-8">
              <h2 className="text-lg font-medium text-[var(--form-text-primary)] mb-1">{currentStep.title}</h2>
              {currentStep.description && (
                <p className="text-sm text-[var(--form-text-muted)]">{currentStep.description}</p>
              )}
            </div>
          )}

          <div>
            {(() => {
              const isLayoutOrFullRow = (q: SurveyQuestion) =>
                q.type === 'heading' ||
                q.type === 'section' ||
                q.type === 'divider' ||
                q.type === 'paragraph' ||
                q.type === 'custom_html' ||
                q.type === 'hidden' ||
                q.type === 'consent' ||
                q.type === 'checkbox' ||
                q.type === 'file_upload' ||
                q.type === 'signature' ||
                q.type === 'matrix' ||
                q.type === 'image_choice' ||
                q.type === 'rating' ||
                q.type === 'nps' ||
                q.type === 'opinion_scale' ||
                q.type === 'contact_capture' ||
                q.type === 'ranking';

              const widthToPct = (q: SurveyQuestion): number => {
                if (q.customWidthPercent) return Math.max(5, Math.min(100, q.customWidthPercent));
                return 100;
              };

              type Group = { questions: SurveyQuestion[]; equalSplit: boolean };
              const groups: Group[] = [];
              let i = 0;
              while (i < visibleQuestions.length) {
                const q = visibleQuestions[i];
                if (q.type === 'column') {
                  const n = q.columnCount || 2;
                  const taken: SurveyQuestion[] = [];
                  let j = i + 1;
                  while (j < visibleQuestions.length && taken.length < n) {
                    const c = visibleQuestions[j];
                    if (c.type === 'column') break;
                    taken.push(c);
                    j++;
                  }
                  if (taken.length > 0) {
                    groups.push({ questions: taken, equalSplit: true });
                    i = j;
                    continue;
                  }
                  i++;
                  continue;
                }
                if (isLayoutOrFullRow(q)) {
                  groups.push({ questions: [q], equalSplit: false });
                  i++;
                  continue;
                }
                const row: SurveyQuestion[] = [q];
                let total = widthToPct(q);
                i++;
                while (i < visibleQuestions.length) {
                  const next = visibleQuestions[i];
                  if (next.type === 'column' || isLayoutOrFullRow(next)) break;
                  const nextW = widthToPct(next);
                  if (total + nextW > 100.5) break;
                  row.push(next);
                  total += nextW;
                  i++;
                }
                groups.push({ questions: row, equalSplit: false });
              }

              let renderedIdx = 0;
              return groups.map((group, gi) => {
                const onlyFullRow = group.questions.length === 1 && (
                  isLayoutOrFullRow(group.questions[0]) || widthToPct(group.questions[0]) >= 100
                );
                if (onlyFullRow) {
                  const q = group.questions[0];
                  const node = renderQuestion(q, oneAtATime ? completedQuestions : renderedIdx);
                  if (q.type !== 'hidden' && q.type !== 'divider' && q.type !== 'heading' && q.type !== 'paragraph' && q.type !== 'section' && q.type !== 'custom_html') {
                    renderedIdx++;
                  }
                  return <div key={`g${gi}`}>{node}</div>;
                }
                return (
                  <div key={`g${gi}`} className="flex flex-wrap gap-3">
                    {group.questions.map((q) => {
                      const pct = group.equalSplit ? 100 / group.questions.length : widthToPct(q);
                      const node = renderQuestion(q, oneAtATime ? completedQuestions : renderedIdx);
                      renderedIdx++;
                      return (
                        <div
                          key={q.id}
                          style={{ flex: `1 1 calc(${pct}% - 0.75rem)`, minWidth: 0 }}
                        >
                          {node}
                        </div>
                      );
                    })}
                  </div>
                );
              });
            })()}
          </div>

          {survey.settings.captchaEnabled && survey.settings.captchaSiteKey && isLastQuestionOverall && (
            <div className="mt-6 flex justify-center">
              <div
                className="h-captcha"
                data-sitekey={survey.settings.captchaSiteKey}
                data-callback="__onHCaptcha"
                data-expired-callback="__onHCaptchaExpired"
                data-theme="dark"
              />
            </div>
          )}

          <div className="flex justify-between mt-8 pt-6 border-t border-[var(--form-input-border)]">
            <button
              onClick={handleBack}
              disabled={isAtStart || !survey.settings.allowBackNavigation}
              className="flex items-center gap-2 px-4 py-2 text-[var(--form-text-secondary)] hover:bg-[var(--form-input-bg)]/40 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>

            <button
              onClick={handleNext}
              disabled={submitting}
              className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-[var(--form-accent-from)] to-[var(--form-accent-to)] text-[var(--form-accent-text)] font-medium rounded-lg hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--form-accent-solid)] focus:ring-offset-2 focus:ring-offset-[var(--form-page-bg)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Submitting...
                </>
              ) : isLastQuestionOverall ? (
                currentStep.submitButtonText || 'Submit'
              ) : (
                <>
                  {currentStep.nextButtonText || 'Next'}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
        {!embed && (
          <p className="text-center text-[var(--form-text-muted)] text-sm mt-6 opacity-70">
            Powered by Your CRM
          </p>
        )}
      </div>
    </div>
  );
}
