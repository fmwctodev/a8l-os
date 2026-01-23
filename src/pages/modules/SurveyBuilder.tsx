import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Eye,
  Settings,
  Plus,
  Trash2,
  GripVertical,
  Globe,
  Type,
  AlignLeft,
  Hash,
  ChevronDown,
  CheckSquare,
  Star,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { getSurveyById, updateSurvey, publishSurvey, unpublishSurvey } from '../../services/surveys';
import type { Survey, SurveyQuestion, SurveyQuestionType, SurveyStep, SurveySettings } from '../../types';

const QUESTION_TYPES: { type: SurveyQuestionType; label: string; icon: React.ElementType }[] = [
  { type: 'short_text', label: 'Short Text', icon: Type },
  { type: 'long_text', label: 'Long Text', icon: AlignLeft },
  { type: 'number', label: 'Number', icon: Hash },
  { type: 'single_choice', label: 'Single Choice', icon: ChevronDown },
  { type: 'multiple_choice', label: 'Multiple Choice', icon: CheckSquare },
  { type: 'rating', label: 'Rating', icon: Star },
  { type: 'nps', label: 'NPS Score', icon: Star },
  { type: 'opinion_scale', label: 'Opinion Scale', icon: Layers },
];

function generateId(): string {
  return `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function SurveyBuilder() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'questions' | 'settings'>('questions');
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [previewMode, setPreviewMode] = useState(false);

  useEffect(() => {
    if (id) loadSurvey();
  }, [id]);

  async function loadSurvey() {
    try {
      setLoading(true);
      const data = await getSurveyById(id!);
      if (data) {
        setSurvey(data);
      } else {
        navigate('/marketing/surveys');
      }
    } catch (error) {
      console.error('Failed to load survey:', error);
      navigate('/marketing/surveys');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!survey) return;

    try {
      setSaving(true);
      await updateSurvey(survey.id, {
        name: survey.name,
        description: survey.description,
        definition: survey.definition,
        settings: survey.settings,
      });
    } catch (error) {
      console.error('Failed to save survey:', error);
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    if (!survey) return;

    try {
      await handleSave();
      const updated = await publishSurvey(survey.id);
      setSurvey(updated);
    } catch (error) {
      console.error('Failed to publish survey:', error);
    }
  }

  async function handleUnpublish() {
    if (!survey) return;

    try {
      const updated = await unpublishSurvey(survey.id);
      setSurvey(updated);
    } catch (error) {
      console.error('Failed to unpublish survey:', error);
    }
  }

  function addStep() {
    if (!survey) return;

    const newStep: SurveyStep = {
      id: generateId(),
      title: `Step ${survey.definition.steps.length + 1}`,
      questions: [],
    };

    setSurvey({
      ...survey,
      definition: {
        ...survey.definition,
        steps: [...survey.definition.steps, newStep],
      },
    });
    setActiveStepIndex(survey.definition.steps.length);
  }

  function addQuestion(type: SurveyQuestionType) {
    if (!survey) return;

    const typeConfig = QUESTION_TYPES.find((q) => q.type === type);
    const newQuestion: SurveyQuestion = {
      id: generateId(),
      type,
      text: typeConfig?.label || 'Question',
      required: false,
    };

    if (type === 'single_choice' || type === 'multiple_choice') {
      newQuestion.options = [
        { id: generateId(), label: 'Option 1', value: 'option_1', score: 0 },
        { id: generateId(), label: 'Option 2', value: 'option_2', score: 0 },
      ];
    }

    if (type === 'rating') {
      newQuestion.min = 1;
      newQuestion.max = 5;
    }

    if (type === 'nps') {
      newQuestion.min = 0;
      newQuestion.max = 10;
    }

    if (type === 'opinion_scale') {
      newQuestion.min = 1;
      newQuestion.max = 5;
      newQuestion.minLabel = 'Strongly Disagree';
      newQuestion.maxLabel = 'Strongly Agree';
    }

    const steps = [...survey.definition.steps];
    steps[activeStepIndex] = {
      ...steps[activeStepIndex],
      questions: [...steps[activeStepIndex].questions, newQuestion],
    };

    setSurvey({
      ...survey,
      definition: { ...survey.definition, steps },
    });
    setSelectedQuestionId(newQuestion.id);
  }

  function updateQuestion(questionId: string, updates: Partial<SurveyQuestion>) {
    if (!survey) return;

    const steps = survey.definition.steps.map((step) => ({
      ...step,
      questions: step.questions.map((q) =>
        q.id === questionId ? { ...q, ...updates } : q
      ),
    }));

    setSurvey({
      ...survey,
      definition: { ...survey.definition, steps },
    });
  }

  function removeQuestion(questionId: string) {
    if (!survey) return;

    const steps = survey.definition.steps.map((step) => ({
      ...step,
      questions: step.questions.filter((q) => q.id !== questionId),
    }));

    setSurvey({
      ...survey,
      definition: { ...survey.definition, steps },
    });
    if (selectedQuestionId === questionId) {
      setSelectedQuestionId(null);
    }
  }

  function removeStep(stepIndex: number) {
    if (!survey || survey.definition.steps.length <= 1) return;

    const steps = survey.definition.steps.filter((_, i) => i !== stepIndex);
    setSurvey({
      ...survey,
      definition: { ...survey.definition, steps },
    });
    if (activeStepIndex >= steps.length) {
      setActiveStepIndex(steps.length - 1);
    }
  }

  function updateStep(stepIndex: number, updates: Partial<SurveyStep>) {
    if (!survey) return;

    const steps = [...survey.definition.steps];
    steps[stepIndex] = { ...steps[stepIndex], ...updates };

    setSurvey({
      ...survey,
      definition: { ...survey.definition, steps },
    });
  }

  function updateSettings(updates: Partial<SurveySettings>) {
    if (!survey) return;

    setSurvey({
      ...survey,
      settings: { ...survey.settings, ...updates },
    });
  }

  const currentStep = survey?.definition.steps[activeStepIndex];
  const selectedQuestion = currentStep?.questions.find(
    (q) => q.id === selectedQuestionId
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!survey) return null;

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-4">
          <Link
            to="/marketing/surveys"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </Link>
          <div>
            <input
              type="text"
              value={survey.name}
              onChange={(e) => setSurvey({ ...survey, name: e.target.value })}
              className="text-xl font-semibold text-gray-900 border-none focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 -ml-2"
            />
            <div className="text-sm text-gray-500 ml-2">
              {survey.status === 'published' ? (
                <span className="text-green-600">Published</span>
              ) : (
                <span>Draft</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPreviewMode(!previewMode)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
              previewMode
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Eye className="w-4 h-4" />
            Preview
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save'}
          </button>
          {survey.status === 'published' ? (
            <button
              onClick={handleUnpublish}
              className="flex items-center gap-2 px-4 py-2 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 transition-colors"
            >
              Unpublish
            </button>
          ) : (
            <button
              onClick={handlePublish}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Globe className="w-4 h-4" />
              Publish
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-64 border-r border-gray-200 bg-white overflow-y-auto">
          <div className="p-4">
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setActiveTab('questions')}
                className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === 'questions'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Questions
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === 'settings'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Settings className="w-4 h-4 inline mr-1" />
                Settings
              </button>
            </div>

            {activeTab === 'questions' ? (
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Steps
                    </span>
                    <button
                      onClick={addStep}
                      className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="space-y-1">
                    {survey.definition.steps.map((step, index) => (
                      <button
                        key={step.id}
                        onClick={() => setActiveStepIndex(index)}
                        className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors ${
                          activeStepIndex === index
                            ? 'bg-blue-100 text-blue-700'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <span className="truncate">
                          {index + 1}. {step.title}
                        </span>
                        {survey.definition.steps.length > 1 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeStep(index);
                            }}
                            className="p-1 text-gray-400 hover:text-red-500"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-4">
                  <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                    Add Question
                  </div>
                  {QUESTION_TYPES.map((qType) => (
                    <button
                      key={qType.type}
                      onClick={() => addQuestion(qType.type)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <qType.icon className="w-4 h-4 text-gray-400" />
                      {qType.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <SurveySettingsPanel
                settings={survey.settings}
                onUpdate={updateSettings}
              />
            )}
          </div>
        </div>

        <div className="flex-1 bg-gray-50 overflow-y-auto p-6">
          {previewMode ? (
            <SurveyPreview survey={survey} />
          ) : (
            <div className="max-w-2xl mx-auto">
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                {currentStep && (
                  <>
                    <div className="mb-6">
                      <input
                        type="text"
                        value={currentStep.title}
                        onChange={(e) =>
                          updateStep(activeStepIndex, { title: e.target.value })
                        }
                        placeholder="Step Title"
                        className="text-lg font-semibold text-gray-900 border-none focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 -ml-2 w-full"
                      />
                      <input
                        type="text"
                        value={currentStep.description || ''}
                        onChange={(e) =>
                          updateStep(activeStepIndex, {
                            description: e.target.value,
                          })
                        }
                        placeholder="Step description (optional)"
                        className="text-sm text-gray-500 border-none focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 -ml-2 w-full mt-1"
                      />
                    </div>

                    {currentStep.questions.length === 0 ? (
                      <div className="text-center py-12 text-gray-500">
                        <Plus className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                        <p>Add questions from the left panel</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {currentStep.questions.map((question, index) => (
                          <QuestionCard
                            key={question.id}
                            question={question}
                            index={index}
                            isSelected={selectedQuestionId === question.id}
                            onSelect={() => setSelectedQuestionId(question.id)}
                            onRemove={() => removeQuestion(question.id)}
                          />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {selectedQuestion && !previewMode && (
          <div className="w-80 border-l border-gray-200 bg-white overflow-y-auto">
            <QuestionEditor
              question={selectedQuestion}
              onUpdate={(updates) => updateQuestion(selectedQuestion.id, updates)}
              onClose={() => setSelectedQuestionId(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function QuestionCard({
  question,
  index,
  isSelected,
  onSelect,
  onRemove,
}: {
  question: SurveyQuestion;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const qType = QUESTION_TYPES.find((q) => q.type === question.type);
  const Icon = qType?.icon || Type;

  return (
    <div
      onClick={onSelect}
      className={`group flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
        isSelected
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <GripVertical className="w-4 h-4 text-gray-400" />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-gray-500">Q{index + 1}</span>
          <Icon className="w-4 h-4 text-gray-400" />
          {question.required && (
            <span className="text-red-500 text-sm">*</span>
          )}
        </div>
        <div className="font-medium text-gray-900">{question.text}</div>
        <div className="text-sm text-gray-500 mt-1">{qType?.label}</div>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

function QuestionEditor({
  question,
  onUpdate,
  onClose,
}: {
  question: SurveyQuestion;
  onUpdate: (updates: Partial<SurveyQuestion>) => void;
  onClose: () => void;
}) {
  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Question Settings</h3>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
          &times;
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Question Text
          </label>
          <textarea
            value={question.text}
            onChange={(e) => onUpdate({ text: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description (optional)
          </label>
          <input
            type="text"
            value={question.description || ''}
            onChange={(e) => onUpdate({ description: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="required"
            checked={question.required}
            onChange={(e) => onUpdate({ required: e.target.checked })}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <label htmlFor="required" className="text-sm text-gray-700">
            Required
          </label>
        </div>

        {(question.type === 'single_choice' ||
          question.type === 'multiple_choice') && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Options
            </label>
            <div className="space-y-2">
              {(question.options || []).map((option, idx) => (
                <div key={option.id} className="flex gap-2">
                  <input
                    type="text"
                    value={option.label}
                    onChange={(e) => {
                      const newOptions = [...(question.options || [])];
                      newOptions[idx] = {
                        ...option,
                        label: e.target.value,
                        value: e.target.value.toLowerCase().replace(/\s+/g, '_'),
                      };
                      onUpdate({ options: newOptions });
                    }}
                    placeholder="Option label"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="number"
                    value={option.score || 0}
                    onChange={(e) => {
                      const newOptions = [...(question.options || [])];
                      newOptions[idx] = {
                        ...option,
                        score: parseInt(e.target.value) || 0,
                      };
                      onUpdate({ options: newOptions });
                    }}
                    placeholder="Score"
                    className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={() => {
                      const newOptions = (question.options || []).filter(
                        (_, i) => i !== idx
                      );
                      onUpdate({ options: newOptions });
                    }}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => {
                  const newId = `opt_${Date.now()}`;
                  const newOptions = [
                    ...(question.options || []),
                    {
                      id: newId,
                      label: `Option ${(question.options || []).length + 1}`,
                      value: `option_${(question.options || []).length + 1}`,
                      score: 0,
                    },
                  ];
                  onUpdate({ options: newOptions });
                }}
                className="w-full px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                + Add Option
              </button>
            </div>
          </div>
        )}

        {(question.type === 'rating' ||
          question.type === 'nps' ||
          question.type === 'opinion_scale') && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Min
                </label>
                <input
                  type="number"
                  value={question.min || 0}
                  onChange={(e) =>
                    onUpdate({ min: parseInt(e.target.value) || 0 })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max
                </label>
                <input
                  type="number"
                  value={question.max || 10}
                  onChange={(e) =>
                    onUpdate({ max: parseInt(e.target.value) || 10 })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            {question.type === 'opinion_scale' && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Min Label
                  </label>
                  <input
                    type="text"
                    value={question.minLabel || ''}
                    onChange={(e) => onUpdate({ minLabel: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Label
                  </label>
                  <input
                    type="text"
                    value={question.maxLabel || ''}
                    onChange={(e) => onUpdate({ maxLabel: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function SurveySettingsPanel({
  settings,
  onUpdate,
}: {
  settings: SurveySettings;
  onUpdate: (updates: Partial<SurveySettings>) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Thank You Message
        </label>
        <textarea
          value={settings.thankYouMessage || ''}
          onChange={(e) => onUpdate({ thankYouMessage: e.target.value })}
          rows={3}
          placeholder="Thank you for completing this survey!"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Redirect URL (optional)
        </label>
        <input
          type="url"
          value={settings.redirectUrl || ''}
          onChange={(e) => onUpdate({ redirectUrl: e.target.value })}
          placeholder="https://..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="showProgress"
          checked={settings.showProgressBar ?? true}
          onChange={(e) => onUpdate({ showProgressBar: e.target.checked })}
          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <label htmlFor="showProgress" className="text-sm text-gray-700">
          Show progress bar
        </label>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="allowBack"
          checked={settings.allowBackNavigation ?? true}
          onChange={(e) => onUpdate({ allowBackNavigation: e.target.checked })}
          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <label htmlFor="allowBack" className="text-sm text-gray-700">
          Allow back navigation
        </label>
      </div>

      <div className="border-t border-gray-200 pt-4">
        <div className="text-sm font-medium text-gray-700 mb-2">Score Bands</div>
        <p className="text-xs text-gray-500 mb-3">
          Define score ranges to categorize responses (visible only in CRM)
        </p>
        <div className="space-y-2">
          {(settings.scoreBands || []).map((band, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <input
                type="number"
                value={band.minScore}
                onChange={(e) => {
                  const bands = [...(settings.scoreBands || [])];
                  bands[idx] = { ...band, minScore: parseInt(e.target.value) || 0 };
                  onUpdate({ scoreBands: bands });
                }}
                placeholder="Min"
                className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-gray-400">-</span>
              <input
                type="number"
                value={band.maxScore}
                onChange={(e) => {
                  const bands = [...(settings.scoreBands || [])];
                  bands[idx] = { ...band, maxScore: parseInt(e.target.value) || 0 };
                  onUpdate({ scoreBands: bands });
                }}
                placeholder="Max"
                className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                value={band.label}
                onChange={(e) => {
                  const bands = [...(settings.scoreBands || [])];
                  bands[idx] = { ...band, label: e.target.value };
                  onUpdate({ scoreBands: bands });
                }}
                placeholder="Label"
                className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={() => {
                  const bands = (settings.scoreBands || []).filter(
                    (_, i) => i !== idx
                  );
                  onUpdate({ scoreBands: bands });
                }}
                className="p-1 text-red-500 hover:bg-red-50 rounded"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          <button
            onClick={() => {
              const bands = [
                ...(settings.scoreBands || []),
                { minScore: 0, maxScore: 10, label: 'New Band' },
              ];
              onUpdate({ scoreBands: bands });
            }}
            className="w-full px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          >
            + Add Score Band
          </button>
        </div>
      </div>
    </div>
  );
}

function SurveyPreview({ survey }: { survey: Survey }) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const currentStep = survey.definition.steps[currentStepIndex];
  const totalSteps = survey.definition.steps.length;
  const progress = ((currentStepIndex + 1) / totalSteps) * 100;

  return (
    <div className="max-w-xl mx-auto">
      <div className="bg-white rounded-xl border border-gray-200 p-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">
          {survey.name}
        </h2>
        {survey.description && (
          <p className="text-gray-500 mb-6">{survey.description}</p>
        )}

        {survey.settings.showProgressBar && (
          <div className="mb-6">
            <div className="flex justify-between text-sm text-gray-500 mb-1">
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

        <div className="mb-6">
          <h3 className="text-lg font-medium text-gray-900">{currentStep.title}</h3>
          {currentStep.description && (
            <p className="text-sm text-gray-500 mt-1">{currentStep.description}</p>
          )}
        </div>

        <div className="space-y-6">
          {currentStep.questions.map((question, idx) => (
            <div key={question.id}>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                {idx + 1}. {question.text}
                {question.required && <span className="text-red-500 ml-1">*</span>}
              </label>
              {question.description && (
                <p className="text-sm text-gray-500 mb-2">{question.description}</p>
              )}

              {question.type === 'short_text' && (
                <input
                  type="text"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}

              {question.type === 'long_text' && (
                <textarea
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}

              {question.type === 'number' && (
                <input
                  type="number"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}

              {question.type === 'single_choice' && (
                <div className="space-y-2">
                  {(question.options || []).map((option) => (
                    <label key={option.id} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name={question.id}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              )}

              {question.type === 'multiple_choice' && (
                <div className="space-y-2">
                  {(question.options || []).map((option) => (
                    <label key={option.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
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
                      className="p-2 text-gray-400 hover:text-yellow-400"
                    >
                      <Star className="w-6 h-6" />
                    </button>
                  ))}
                </div>
              )}

              {question.type === 'nps' && (
                <div className="flex gap-1">
                  {Array.from({ length: 11 }, (_, i) => i).map((n) => (
                    <button
                      key={n}
                      type="button"
                      className="w-10 h-10 border border-gray-300 rounded hover:bg-blue-50 hover:border-blue-500 text-sm font-medium"
                    >
                      {n}
                    </button>
                  ))}
                </div>
              )}

              {question.type === 'opinion_scale' && (
                <div>
                  <div className="flex gap-1 mb-1">
                    {Array.from(
                      { length: (question.max || 5) - (question.min || 1) + 1 },
                      (_, i) => (question.min || 1) + i
                    ).map((n) => (
                      <button
                        key={n}
                        type="button"
                        className="flex-1 py-2 border border-gray-300 rounded hover:bg-blue-50 hover:border-blue-500 text-sm font-medium"
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>{question.minLabel}</span>
                    <span>{question.maxLabel}</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex justify-between mt-8">
          <button
            onClick={() => setCurrentStepIndex(Math.max(0, currentStepIndex - 1))}
            disabled={currentStepIndex === 0 || !survey.settings.allowBackNavigation}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Back
          </button>
          <button
            onClick={() =>
              setCurrentStepIndex(Math.min(totalSteps - 1, currentStepIndex + 1))
            }
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            {currentStepIndex === totalSteps - 1 ? 'Submit' : 'Next'}
            {currentStepIndex < totalSteps - 1 && <ArrowRight className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
