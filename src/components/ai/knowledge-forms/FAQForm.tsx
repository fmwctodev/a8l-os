import { useState } from 'react';
import { HelpCircle, Plus, Trash2 } from 'lucide-react';
import { FormFooter } from './FormFooter';
import type { FAQSourceConfig } from '../../../types';

interface FAQFormProps {
  existingConfig: Record<string, unknown>;
  onSave: (config: Record<string, unknown>) => void;
  onCancel: () => void;
  saving: boolean;
  isEditing: boolean;
}

export function FAQForm({
  existingConfig,
  onSave,
  onCancel,
  saving,
  isEditing,
}: FAQFormProps) {
  const config = existingConfig as Partial<FAQSourceConfig>;
  const [faqs, setFaqs] = useState<Array<{ question: string; answer: string }>>(
    config.faqs || [{ question: '', answer: '' }]
  );
  const [activeIndex, setActiveIndex] = useState(0);

  const handleQuestionChange = (index: number, value: string) => {
    const updated = [...faqs];
    updated[index].question = value;
    setFaqs(updated);
  };

  const handleAnswerChange = (index: number, value: string) => {
    const updated = [...faqs];
    updated[index].answer = value;
    setFaqs(updated);
  };

  const handleAddFaq = () => {
    setFaqs([...faqs, { question: '', answer: '' }]);
    setActiveIndex(faqs.length);
  };

  const handleRemoveFaq = (index: number) => {
    if (faqs.length <= 1) return;
    const updated = faqs.filter((_, i) => i !== index);
    setFaqs(updated);
    if (activeIndex >= updated.length) {
      setActiveIndex(updated.length - 1);
    }
  };

  const handleSubmit = () => {
    const validFaqs = faqs.filter((f) => f.question.trim() && f.answer.trim());
    if (validFaqs.length === 0) return;

    const newConfig: FAQSourceConfig = { faqs: validFaqs };
    onSave(newConfig);
  };

  const currentFaq = faqs[activeIndex];
  const hasValidFaq = faqs.some((f) => f.question.trim() && f.answer.trim());

  return (
    <div>
      <div className="flex items-center gap-3 p-4 bg-slate-800/50 rounded-lg border border-slate-700 mb-6">
        <HelpCircle className="w-6 h-6 text-cyan-400" />
        <div>
          <h3 className="font-medium text-white">FAQs</h3>
          <p className="text-sm text-slate-400">Write a question and answer pair to help your bot answer common questions.</p>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="w-48 flex-shrink-0">
          <div className="space-y-1">
            {faqs.map((faq, index) => (
              <button
                key={index}
                onClick={() => setActiveIndex(index)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                  activeIndex === index
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <span className="truncate">
                  {faq.question.trim() || `Q&A ${index + 1}`}
                </span>
                {faqs.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveFaq(index);
                    }}
                    className="p-1 text-slate-500 hover:text-red-400"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </button>
            ))}
          </div>
          <button
            onClick={handleAddFaq}
            className="w-full flex items-center justify-center gap-2 mt-2 px-3 py-2 border border-dashed border-slate-600 rounded-lg text-sm text-slate-400 hover:border-slate-500 hover:text-white transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Q&A
          </button>
        </div>

        <div className="flex-1 space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="flex items-center justify-center w-6 h-6 bg-cyan-500/10 text-cyan-400 rounded-full text-sm font-medium">
                Q
              </span>
              <label className="text-sm font-medium text-slate-300">Question</label>
            </div>
            <textarea
              value={currentFaq?.question || ''}
              onChange={(e) => handleQuestionChange(activeIndex, e.target.value)}
              maxLength={1000}
              rows={3}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
              placeholder="Your question goes here"
            />
            <div className="text-right text-xs text-slate-500 mt-1">
              {currentFaq?.question.length || 0}/1000 characters
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="flex items-center justify-center w-6 h-6 bg-emerald-500/10 text-emerald-400 rounded-full text-sm font-medium">
                A
              </span>
              <label className="text-sm font-medium text-slate-300">Answer</label>
            </div>
            <textarea
              value={currentFaq?.answer || ''}
              onChange={(e) => handleAnswerChange(activeIndex, e.target.value)}
              maxLength={1000}
              rows={5}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
              placeholder="Your answer goes here"
            />
            <div className="text-right text-xs text-slate-500 mt-1">
              {currentFaq?.answer.length || 0}/1000 characters
            </div>
          </div>
        </div>
      </div>

      <FormFooter
        onCancel={onCancel}
        onSubmit={handleSubmit}
        saving={saving}
        isEditing={isEditing}
        disabled={!hasValidFaq}
        submitLabel="Save"
      />
    </div>
  );
}
