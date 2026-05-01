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
  ChevronsUpDown,
  CheckSquare,
  Circle,
  Star,
  Layers,
  ArrowRight,
  Grid3X3,
  List,
  ListChecks,
  Image,
  GitBranch,
  X,
  Code,
  FileCode,
  Copy,
  ExternalLink,
  Clock,
  Calendar,
  Mail,
  Phone,
  Building2,
  Link as LinkIcon,
  MapPin,
  Map,
  Mailbox,
  EyeOff,
  ShieldCheck,
  Upload,
  Minus,
  DollarSign,
  CreditCard,
  ShoppingCart,
  Smartphone,
  BadgeCheck,
  Calculator,
  Columns,
  Tag,
  SlidersHorizontal,
  UserCheck,
} from 'lucide-react';
import { getSurveyById, updateSurvey, publishSurvey, unpublishSurvey } from '../../services/surveys';
import type { Survey, SurveyQuestion, SurveyQuestionType, SurveyStep, SurveySettings, SurveyBranchRule } from '../../types';
import {
  US_STATES,
  COUNTRIES,
  COMMON_TIMEZONES,
  currencySymbol,
} from '../../constants/formFieldOptions';
import { EditableText } from '../../components/EditableText';
import { ThemePicker } from '../../components/ThemePicker';
import { SubmitRulesEditor } from '../../components/SubmitRulesEditor';
import { Monitor, LayoutTemplate, Sparkles } from 'lucide-react';
import { SURVEY_TEMPLATES, type SurveyTemplate } from '../../constants/surveyTemplates';

interface QuestionTypeConfig {
  type: SurveyQuestionType;
  label: string;
  icon: React.ElementType;
  category: 'contact' | 'address' | 'input' | 'choice' | 'survey' | 'advanced' | 'layout' | 'special';
}

const QUESTION_TYPES: QuestionTypeConfig[] = [
  { type: 'first_name', label: 'First Name', icon: Type, category: 'contact' },
  { type: 'last_name', label: 'Last Name', icon: Type, category: 'contact' },
  { type: 'full_name', label: 'Full Name', icon: Type, category: 'contact' },
  { type: 'email', label: 'Email', icon: Mail, category: 'contact' },
  { type: 'phone', label: 'Phone', icon: Phone, category: 'contact' },
  { type: 'company', label: 'Company Name', icon: Building2, category: 'contact' },
  { type: 'website', label: 'URL / Website', icon: LinkIcon, category: 'contact' },

  { type: 'address', label: 'Address', icon: MapPin, category: 'address' },
  { type: 'city', label: 'City', icon: Building2, category: 'address' },
  { type: 'state', label: 'State', icon: Map, category: 'address' },
  { type: 'postal_code', label: 'Postal / Zip Code', icon: Mailbox, category: 'address' },
  { type: 'country', label: 'Country', icon: Globe, category: 'address' },
  { type: 'timezone', label: 'Timezone', icon: Clock, category: 'address' },

  { type: 'short_answer', label: 'Single Line / Short Text', icon: Type, category: 'input' },
  { type: 'long_answer', label: 'Multi Line / Long Text', icon: AlignLeft, category: 'input' },
  { type: 'textbox_list', label: 'Textbox List', icon: List, category: 'input' },
  { type: 'number', label: 'Number', icon: Hash, category: 'input' },
  { type: 'monetary', label: 'Monetary', icon: DollarSign, category: 'input' },
  { type: 'date', label: 'Date Picker', icon: Calendar, category: 'input' },

  { type: 'multiple_choice', label: 'Radio Select', icon: Circle, category: 'choice' },
  { type: 'dropdown', label: 'Single Dropdown', icon: ChevronDown, category: 'choice' },
  { type: 'multi_dropdown', label: 'Multi Dropdown', icon: ChevronsUpDown, category: 'choice' },
  { type: 'multi_select', label: 'Multi-Select Checkboxes', icon: CheckSquare, category: 'choice' },
  { type: 'checkbox', label: 'Checkbox', icon: CheckSquare, category: 'choice' },
  { type: 'checkbox_group', label: 'Checkbox Group', icon: ListChecks, category: 'choice' },
  { type: 'yes_no', label: 'Yes / No', icon: CheckSquare, category: 'choice' },

  { type: 'rating', label: 'Star Rating', icon: Star, category: 'survey' },
  { type: 'nps', label: 'NPS Score', icon: Layers, category: 'survey' },
  { type: 'opinion_scale', label: 'Opinion Scale', icon: SlidersHorizontal, category: 'survey' },
  { type: 'matrix', label: 'Matrix Grid', icon: Grid3X3, category: 'survey' },
  { type: 'ranking', label: 'Ranking', icon: List, category: 'survey' },
  { type: 'image_choice', label: 'Image Choice', icon: Image, category: 'survey' },
  { type: 'contact_capture', label: 'Contact Capture', icon: UserCheck, category: 'survey' },

  { type: 'source', label: 'Source', icon: Tag, category: 'advanced' },
  { type: 'payment', label: 'Payment Element', icon: CreditCard, category: 'advanced' },
  { type: 'product_selection', label: 'Product Selection', icon: ShoppingCart, category: 'advanced' },
  { type: 'sms_verification', label: 'SMS Verification', icon: Smartphone, category: 'advanced' },
  { type: 'email_validation', label: 'Email Validation', icon: BadgeCheck, category: 'advanced' },
  { type: 'math_calculation', label: 'Math Calculation', icon: Calculator, category: 'advanced' },

  { type: 'divider', label: 'Section Divider', icon: Minus, category: 'layout' },
  { type: 'column', label: 'Column / Layout', icon: Columns, category: 'layout' },
  { type: 'custom_html', label: 'Custom HTML', icon: FileCode, category: 'layout' },

  { type: 'file_upload', label: 'File Upload', icon: Upload, category: 'special' },
  { type: 'hidden', label: 'Hidden Field', icon: EyeOff, category: 'special' },
  { type: 'consent', label: 'Consent Checkbox', icon: ShieldCheck, category: 'special' },
];

const QUESTION_CATEGORIES = [
  { id: 'contact', label: 'Contact Fields' },
  { id: 'address', label: 'Address Fields' },
  { id: 'input', label: 'Input Fields' },
  { id: 'choice', label: 'Choice Fields' },
  { id: 'survey', label: 'Survey Questions' },
  { id: 'advanced', label: 'Advanced' },
  { id: 'layout', label: 'Layout' },
  { id: 'special', label: 'Special' },
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
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [showEmbedModal, setShowEmbedModal] = useState(false);
  const [showBranchingPanel, setShowBranchingPanel] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);

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
    const isLayoutType = type === 'divider' || type === 'column' || type === 'custom_html';
    const newQuestion: SurveyQuestion = {
      id: generateId(),
      type,
      label: isLayoutType ? '' : (typeConfig?.label || 'Question'),
      required: false,
    };

    if (
      type === 'multiple_choice' ||
      type === 'multi_select' ||
      type === 'dropdown' ||
      type === 'multi_dropdown' ||
      type === 'checkbox_group' ||
      type === 'product_selection'
    ) {
      newQuestion.options = [
        { id: generateId(), label: 'Option 1', value: 'option_1', score: 0 },
        { id: generateId(), label: 'Option 2', value: 'option_2', score: 0 },
      ];
    }

    if (type === 'yes_no') {
      newQuestion.options = [
        { id: generateId(), label: 'Yes', value: 'yes', score: 1 },
        { id: generateId(), label: 'No', value: 'no', score: 0 },
      ];
    }

    if (type === 'rating') {
      newQuestion.minValue = 1;
      newQuestion.maxValue = 5;
    }

    if (type === 'nps') {
      newQuestion.minValue = 0;
      newQuestion.maxValue = 10;
      newQuestion.minLabel = 'Not at all likely';
      newQuestion.maxLabel = 'Extremely likely';
    }

    if (type === 'opinion_scale') {
      newQuestion.minValue = 1;
      newQuestion.maxValue = 5;
      newQuestion.minLabel = 'Strongly Disagree';
      newQuestion.maxLabel = 'Strongly Agree';
    }

    if (type === 'matrix') {
      newQuestion.matrixRows = [
        { id: generateId(), label: 'Row 1' },
        { id: generateId(), label: 'Row 2' },
      ];
      newQuestion.matrixColumns = [
        { id: generateId(), label: 'Poor', value: '1', score: 1 },
        { id: generateId(), label: 'Fair', value: '2', score: 2 },
        { id: generateId(), label: 'Good', value: '3', score: 3 },
        { id: generateId(), label: 'Excellent', value: '4', score: 4 },
      ];
    }

    if (type === 'ranking') {
      newQuestion.options = [
        { id: generateId(), label: 'Item 1', value: 'item_1' },
        { id: generateId(), label: 'Item 2', value: 'item_2' },
        { id: generateId(), label: 'Item 3', value: 'item_3' },
      ];
    }

    if (type === 'image_choice') {
      newQuestion.imageOptions = [
        { id: generateId(), label: 'Option 1', value: 'option_1', imageUrl: 'https://images.pexels.com/photos/1181671/pexels-photo-1181671.jpeg?w=200&h=200&fit=crop' },
        { id: generateId(), label: 'Option 2', value: 'option_2', imageUrl: 'https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg?w=200&h=200&fit=crop' },
      ];
    }

    if (type === 'file_upload') {
      newQuestion.fileUploadConfig = {
        maxSizeBytes: 10485760,
        allowedTypes: ['image/*', 'application/pdf', '.doc', '.docx'],
        maxFiles: 1,
      };
    }

    if (type === 'monetary') {
      newQuestion.currency = 'USD';
    }

    if (type === 'custom_html') {
      newQuestion.htmlContent = '<p>Custom HTML content</p>';
    }

    if (type === 'math_calculation') {
      newQuestion.formula = '';
    }

    if (type === 'column') {
      newQuestion.columnCount = 2;
    }

    if (type === 'textbox_list') {
      newQuestion.options = [
        { id: generateId(), label: 'Item', value: '' },
      ];
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

  function updateStepBranchRules(stepIndex: number, rules: SurveyBranchRule[]) {
    if (!survey) return;

    const steps = [...survey.definition.steps];
    steps[stepIndex] = { ...steps[stepIndex], branchRules: rules };

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
          {previewMode && (
            <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
              <button
                onClick={() => setPreviewDevice('desktop')}
                title="Desktop preview"
                className={`p-1.5 rounded ${
                  previewDevice === 'desktop'
                    ? 'bg-white shadow text-gray-900'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Monitor className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPreviewDevice('mobile')}
                title="Mobile preview"
                className={`p-1.5 rounded ${
                  previewDevice === 'mobile'
                    ? 'bg-white shadow text-gray-900'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Smartphone className="w-4 h-4" />
              </button>
            </div>
          )}
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
          <button
            onClick={() => setShowBranchingPanel(!showBranchingPanel)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
              showBranchingPanel ? 'bg-green-100 text-green-700' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <GitBranch className="w-4 h-4" />
            Logic
          </button>
          {survey.status === 'published' ? (
            <>
              <button
                onClick={() => setShowEmbedModal(true)}
                className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Code className="w-4 h-4" />
                Embed
              </button>
              <button
                onClick={handleUnpublish}
                className="flex items-center gap-2 px-4 py-2 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 transition-colors"
              >
                Unpublish
              </button>
            </>
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
                  {QUESTION_CATEGORIES.map((category) => {
                    const categoryQuestions = QUESTION_TYPES.filter(q => q.category === category.id);
                    return (
                      <div key={category.id} className="mb-3">
                        <div className="text-xs text-gray-400 px-3 py-1">{category.label}</div>
                        {categoryQuestions.map((qType) => (
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
                    );
                  })}
                </div>
              </div>
            ) : (
              <SurveySettingsPanel
                settings={survey.settings}
                onUpdate={updateSettings}
                availableFields={survey.definition.steps
                  .flatMap((s) => s.questions)
                  .filter((q) => q.type !== 'divider' && q.type !== 'column' && q.type !== 'custom_html' && q.type !== 'hidden')
                  .map((q) => ({ id: q.id, label: q.label || `(unnamed ${q.type})` }))}
              />
            )}
          </div>
        </div>

        <div className="flex-1 bg-gray-50 overflow-y-auto p-6">
          {previewMode ? (
            <div
              className={
                previewDevice === 'mobile'
                  ? 'mx-auto max-w-[375px] border border-gray-300 rounded-2xl shadow-lg overflow-hidden'
                  : ''
              }
            >
              <SurveyPreview survey={survey} />
            </div>
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
                        <p className="mb-4">Add questions from the left panel</p>
                        <button
                          onClick={() => setShowTemplateModal(true)}
                          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                        >
                          <LayoutTemplate className="w-4 h-4" />
                          Start from a template
                        </button>
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
                            onUpdate={(updates) => updateQuestion(question.id, updates)}
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

        {selectedQuestion && !previewMode && !showBranchingPanel && (
          <div className="w-80 border-l border-gray-200 bg-white overflow-y-auto">
            <QuestionEditor
              question={selectedQuestion}
              onUpdate={(updates) => updateQuestion(selectedQuestion.id, updates)}
              onClose={() => setSelectedQuestionId(null)}
            />
          </div>
        )}

        {showBranchingPanel && currentStep && !previewMode && (
          <div className="w-96 border-l border-gray-200 bg-white overflow-y-auto">
            <BranchingRuleBuilder
              step={currentStep}
              stepIndex={activeStepIndex}
              allSteps={survey.definition.steps}
              onUpdateRules={(rules) => updateStepBranchRules(activeStepIndex, rules)}
              onClose={() => setShowBranchingPanel(false)}
            />
          </div>
        )}
      </div>

      {showEmbedModal && survey.public_slug && (
        <SurveyEmbedModal survey={survey} onClose={() => setShowEmbedModal(false)} />
      )}

      {showTemplateModal && (
        <SurveyTemplateModal
          onClose={() => setShowTemplateModal(false)}
          onApply={(template) => {
            const steps: SurveyStep[] = template.steps.map((ts) => ({
              id: generateId(),
              title: ts.title,
              description: ts.description,
              questions: ts.questions.map((tq) => ({
                id: generateId(),
                type: tq.type,
                label: tq.label,
                description: tq.description,
                required: tq.required ?? false,
                placeholder: tq.placeholder,
                minValue: tq.minValue,
                maxValue: tq.maxValue,
                minLabel: tq.minLabel,
                maxLabel: tq.maxLabel,
                options: tq.options?.map((o) => ({ ...o, id: generateId() })),
              })),
              branchRules: [],
            }));
            setSurvey({
              ...survey,
              definition: { ...survey.definition, steps },
              settings: {
                ...survey.settings,
                oneQuestionPerStep: template.oneQuestionPerStep ?? survey.settings.oneQuestionPerStep,
                showProgressBar: true,
              },
            });
            setActiveStepIndex(0);
            setShowTemplateModal(false);
          }}
        />
      )}
    </div>
  );
}

function SurveyTemplateModal({
  onClose,
  onApply,
}: {
  onClose: () => void;
  onApply: (template: SurveyTemplate) => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Start from a template</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="p-6 grid sm:grid-cols-2 gap-4 overflow-y-auto">
          {SURVEY_TEMPLATES.map((template) => {
            const totalQuestions = template.steps.reduce((n, s) => n + s.questions.length, 0);
            return (
              <button
                key={template.id}
                onClick={() => onApply(template)}
                className="text-left p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
              >
                <div className="flex items-center gap-2 mb-2">
                  <LayoutTemplate className="w-4 h-4 text-blue-600" />
                  <span className="font-semibold text-gray-900">{template.name}</span>
                </div>
                <p className="text-sm text-gray-600 mb-3">{template.description}</p>
                <div className="text-xs text-gray-500">
                  {template.steps.length} step{template.steps.length === 1 ? '' : 's'} ·
                  {' '}{totalQuestions} question{totalQuestions === 1 ? '' : 's'}
                  {template.oneQuestionPerStep && ' · one-at-a-time'}
                </div>
              </button>
            );
          })}
        </div>
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <p className="text-xs text-gray-500">
            Applying a template replaces all current steps and questions. You can still edit, add, and remove after.
          </p>
        </div>
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
  onUpdate,
}: {
  question: SurveyQuestion;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onUpdate: (updates: Partial<SurveyQuestion>) => void;
}) {
  const qType = QUESTION_TYPES.find((q) => q.type === question.type);
  const Icon = qType?.icon || Type;
  const isLayoutOnly = question.type === 'divider' || question.type === 'column' || question.type === 'custom_html';

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
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-gray-500 shrink-0">Q{index + 1}</span>
          <Icon className="w-4 h-4 text-gray-400 shrink-0" />
          {question.required && (
            <span className="text-red-500 text-sm">*</span>
          )}
        </div>
        {isLayoutOnly ? (
          <div className="font-medium text-gray-500 italic">{qType?.label}</div>
        ) : (
          <EditableText
            value={question.label}
            onChange={(next) => onUpdate({ label: next })}
            placeholder="Untitled question"
            className="font-medium text-gray-900"
          />
        )}
        <div className="text-sm text-gray-500 mt-1">{qType?.label}</div>
        {question.options && question.options.length > 0 && !isLayoutOnly && (
          <div className="mt-2 space-y-1">
            {question.options.map((opt, i) => (
              <div key={opt.id} className="flex items-center gap-2 text-xs text-gray-600 pl-1">
                <span className="w-1 h-1 bg-gray-400 rounded-full shrink-0" />
                <EditableText
                  value={opt.label}
                  onChange={(next) => {
                    const nextOptions = [...(question.options || [])];
                    nextOptions[i] = { ...nextOptions[i], label: next };
                    onUpdate({ options: nextOptions });
                  }}
                  placeholder={`Option ${i + 1}`}
                  className="text-gray-600"
                />
              </div>
            ))}
          </div>
        )}
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
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Question Text</label>
          <textarea
            value={question.label}
            onChange={(e) => onUpdate({ label: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
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
          <label htmlFor="required" className="text-sm text-gray-700">Required</label>
        </div>

        {(question.type === 'multiple_choice' || question.type === 'multi_select' || question.type === 'ranking') && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Options</label>
            <div className="space-y-2">
              {(question.options || []).map((option, idx) => (
                <div key={option.id} className="flex gap-2">
                  <input
                    type="text"
                    value={option.label}
                    onChange={(e) => {
                      const newOptions = [...(question.options || [])];
                      newOptions[idx] = { ...option, label: e.target.value, value: e.target.value.toLowerCase().replace(/\s+/g, '_') };
                      onUpdate({ options: newOptions });
                    }}
                    placeholder="Option label"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {question.type !== 'ranking' && (
                    <input
                      type="number"
                      value={option.score || 0}
                      onChange={(e) => {
                        const newOptions = [...(question.options || [])];
                        newOptions[idx] = { ...option, score: parseInt(e.target.value) || 0 };
                        onUpdate({ options: newOptions });
                      }}
                      placeholder="Score"
                      className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  )}
                  <button
                    onClick={() => onUpdate({ options: (question.options || []).filter((_, i) => i !== idx) })}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => {
                  const newOptions = [
                    ...(question.options || []),
                    { id: `opt_${Date.now()}`, label: `Option ${(question.options || []).length + 1}`, value: `option_${(question.options || []).length + 1}`, score: 0 },
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

        {question.type === 'image_choice' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Image Options</label>
            <div className="space-y-3">
              {(question.imageOptions || []).map((option, idx) => (
                <div key={option.id} className="p-3 border border-gray-200 rounded-lg space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={option.label}
                      onChange={(e) => {
                        const newOptions = [...(question.imageOptions || [])];
                        newOptions[idx] = { ...option, label: e.target.value, value: e.target.value.toLowerCase().replace(/\s+/g, '_') };
                        onUpdate({ imageOptions: newOptions });
                      }}
                      placeholder="Label"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={() => onUpdate({ imageOptions: (question.imageOptions || []).filter((_, i) => i !== idx) })}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <input
                    type="url"
                    value={option.imageUrl}
                    onChange={(e) => {
                      const newOptions = [...(question.imageOptions || [])];
                      newOptions[idx] = { ...option, imageUrl: e.target.value };
                      onUpdate({ imageOptions: newOptions });
                    }}
                    placeholder="Image URL"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {option.imageUrl && (
                    <img src={option.imageUrl} alt={option.label} className="w-full h-24 object-cover rounded" />
                  )}
                </div>
              ))}
              <button
                onClick={() => {
                  const newOptions = [
                    ...(question.imageOptions || []),
                    { id: `img_${Date.now()}`, label: `Option ${(question.imageOptions || []).length + 1}`, value: `option_${(question.imageOptions || []).length + 1}`, imageUrl: '' },
                  ];
                  onUpdate({ imageOptions: newOptions });
                }}
                className="w-full px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                + Add Image Option
              </button>
            </div>
          </div>
        )}

        {question.type === 'matrix' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rows (Items to rate)</label>
              <div className="space-y-2">
                {(question.matrixRows || []).map((row, idx) => (
                  <div key={row.id} className="flex gap-2">
                    <input
                      type="text"
                      value={row.label}
                      onChange={(e) => {
                        const newRows = [...(question.matrixRows || [])];
                        newRows[idx] = { ...row, label: e.target.value };
                        onUpdate({ matrixRows: newRows });
                      }}
                      placeholder="Row label"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={() => onUpdate({ matrixRows: (question.matrixRows || []).filter((_, i) => i !== idx) })}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => {
                    const newRows = [...(question.matrixRows || []), { id: `row_${Date.now()}`, label: `Row ${(question.matrixRows || []).length + 1}` }];
                    onUpdate({ matrixRows: newRows });
                  }}
                  className="w-full px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  + Add Row
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Columns (Rating scale)</label>
              <div className="space-y-2">
                {(question.matrixColumns || []).map((col, idx) => (
                  <div key={col.id} className="flex gap-2">
                    <input
                      type="text"
                      value={col.label}
                      onChange={(e) => {
                        const newCols = [...(question.matrixColumns || [])];
                        newCols[idx] = { ...col, label: e.target.value, value: e.target.value.toLowerCase().replace(/\s+/g, '_') };
                        onUpdate({ matrixColumns: newCols });
                      }}
                      placeholder="Column label"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="number"
                      value={col.score || 0}
                      onChange={(e) => {
                        const newCols = [...(question.matrixColumns || [])];
                        newCols[idx] = { ...col, score: parseInt(e.target.value) || 0 };
                        onUpdate({ matrixColumns: newCols });
                      }}
                      placeholder="Score"
                      className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={() => onUpdate({ matrixColumns: (question.matrixColumns || []).filter((_, i) => i !== idx) })}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => {
                    const newCols = [...(question.matrixColumns || []), { id: `col_${Date.now()}`, label: `Column ${(question.matrixColumns || []).length + 1}`, value: `col_${(question.matrixColumns || []).length + 1}`, score: 0 }];
                    onUpdate({ matrixColumns: newCols });
                  }}
                  className="w-full px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  + Add Column
                </button>
              </div>
            </div>
          </>
        )}

        {(question.type === 'rating' || question.type === 'nps') && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Min</label>
                <input
                  type="number"
                  value={question.minValue || 0}
                  onChange={(e) => onUpdate({ minValue: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max</label>
                <input
                  type="number"
                  value={question.maxValue || 10}
                  onChange={(e) => onUpdate({ maxValue: parseInt(e.target.value) || 10 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            {question.type === 'nps' && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Min Label</label>
                  <input
                    type="text"
                    value={question.minLabel || ''}
                    onChange={(e) => onUpdate({ minLabel: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Label</label>
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
  availableFields,
}: {
  settings: SurveySettings;
  onUpdate: (updates: Partial<SurveySettings>) => void;
  availableFields: { id: string; label: string }[];
}) {
  const [activeSection, setActiveSection] = useState<'theme' | 'completion' | 'behavior' | 'logic' | 'scoring' | 'limits'>('theme');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1 p-1 bg-gray-100 rounded-lg">
        {[
          { id: 'theme', label: 'Theme' },
          { id: 'completion', label: 'Done' },
          { id: 'behavior', label: 'Flow' },
          { id: 'logic', label: 'Logic' },
          { id: 'scoring', label: 'Score' },
          { id: 'limits', label: 'Limits' },
        ].map((section) => (
          <button
            key={section.id}
            onClick={() => setActiveSection(section.id as typeof activeSection)}
            className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeSection === section.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {section.label}
          </button>
        ))}
      </div>

      {activeSection === 'theme' && (
        <ThemePicker
          value={settings.theme}
          onChange={(theme) => onUpdate({ theme })}
        />
      )}

      {activeSection === 'logic' && (
        <SubmitRulesEditor
          rules={settings.submitRules || []}
          onChange={(submitRules) => onUpdate({ submitRules })}
          availableFields={availableFields}
        />
      )}

      {activeSection === 'completion' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Thank You Message</label>
            <textarea
              value={settings.thankYouMessage || ''}
              onChange={(e) => onUpdate({ thankYouMessage: e.target.value })}
              rows={3}
              placeholder="Thank you for completing this survey!"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Redirect URL (optional)</label>
            <input
              type="url"
              value={settings.redirectUrl || ''}
              onChange={(e) => onUpdate({ redirectUrl: e.target.value })}
              placeholder="https://..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.showScoreToRespondent || false}
              onChange={(e) => onUpdate({ showScoreToRespondent: e.target.checked })}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Show score to respondent</span>
          </label>
        </div>
      )}

      {activeSection === 'behavior' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Progress Bar</label>
            <select
              value={settings.progressBarStyle || 'percentage'}
              onChange={(e) => onUpdate({ progressBarStyle: e.target.value as SurveySettings['progressBarStyle'] })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="percentage">Percentage Bar</option>
              <option value="steps">Step Counter</option>
              <option value="none">Hidden</option>
            </select>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.showBackButton ?? true}
              onChange={(e) => onUpdate({ showBackButton: e.target.checked, allowBackNavigation: e.target.checked })}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Show back button</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.oneQuestionPerStep || false}
              onChange={(e) => onUpdate({ oneQuestionPerStep: e.target.checked })}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">One question at a time</span>
          </label>
          {settings.oneQuestionPerStep && (
            <p className="text-xs text-gray-500 ml-6">Each question on its own screen — better for paid-ad funnels and mobile</p>
          )}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.saveAndContinueEnabled || false}
              onChange={(e) => onUpdate({ saveAndContinueEnabled: e.target.checked })}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Save and continue later</span>
          </label>
          {settings.saveAndContinueEnabled && (
            <p className="text-xs text-gray-500 ml-6">Users can save progress and receive email link to continue</p>
          )}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.partialCompletionEnabled || false}
              onChange={(e) => onUpdate({ partialCompletionEnabled: e.target.checked })}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Create contact on partial completion</span>
          </label>
          {settings.partialCompletionEnabled && (
            <p className="text-xs text-gray-500 ml-6">Capture leads as soon as email or phone is collected, even if they don't finish the survey</p>
          )}
        </div>
      )}

      {activeSection === 'scoring' && (
        <div className="space-y-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.scoringEnabled || false}
              onChange={(e) => onUpdate({ scoringEnabled: e.target.checked })}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Enable scoring</span>
          </label>
          {settings.scoringEnabled && (
            <>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.weightedScoring || false}
                  onChange={(e) => onUpdate({ weightedScoring: e.target.checked })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Weighted scoring</span>
              </label>
              <div className="pt-2 border-t border-gray-200">
                <div className="text-sm font-medium text-gray-700 mb-2">Score Bands</div>
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
                        className="w-14 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                        className="w-14 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                        onClick={() => onUpdate({ scoreBands: (settings.scoreBands || []).filter((_, i) => i !== idx) })}
                        className="p-1 text-red-500 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => onUpdate({ scoreBands: [...(settings.scoreBands || []), { minScore: 0, maxScore: 10, label: 'New Band' }] })}
                    className="w-full px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    + Add Score Band
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {activeSection === 'limits' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Response Limit</label>
            <input
              type="number"
              value={settings.responseLimit || ''}
              onChange={(e) => onUpdate({ responseLimit: e.target.value ? parseInt(e.target.value) : undefined })}
              placeholder="Unlimited"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">Maximum submissions before survey closes</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Expiration Date</label>
            <input
              type="datetime-local"
              value={settings.expiresAt ? settings.expiresAt.slice(0, 16) : ''}
              onChange={(e) => onUpdate({ expiresAt: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      )}
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
          {currentStep.questions.map((question, idx) => {
            if (question.type === 'hidden') return null;

            if (question.type === 'divider') {
              return (
                <div key={question.id} className="py-2">
                  <hr className="border-gray-200" />
                  {question.label && (
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mt-3">{question.label}</p>
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
                    <div key={i} className="border border-dashed border-gray-300 rounded-lg p-4 text-center text-xs text-gray-400">
                      Column {i + 1}
                    </div>
                  ))}
                </div>
              );
            }

            if (question.type === 'custom_html') {
              return (
                <div
                  key={question.id}
                  className="prose prose-sm max-w-none border border-dashed border-gray-200 rounded-lg p-3"
                  dangerouslySetInnerHTML={{ __html: question.htmlContent || '<p class="text-gray-400 text-sm">Custom HTML</p>' }}
                />
              );
            }

            const isCheckboxType = question.type === 'checkbox' || question.type === 'consent';

            return (
              <div key={question.id}>
                {!isCheckboxType && (
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    {idx + 1}. {question.label}
                    {question.required && <span className="text-red-500 ml-1">*</span>}
                  </label>
                )}
                {question.description && (
                  <p className="text-sm text-gray-500 mb-2">{question.description}</p>
                )}

                {question.type === 'short_answer' && (
                  <input type="text" placeholder={question.placeholder} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                )}

                {question.type === 'long_answer' && (
                  <textarea rows={4} placeholder={question.placeholder} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                )}

                {question.type === 'textbox_list' && (
                  <div className="space-y-2">
                    {(question.options || [{ id: 'tmp', label: 'Item', value: '' }]).map((_, i) => (
                      <input key={i} type="text" placeholder={`Item ${i + 1}`} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    ))}
                  </div>
                )}

                {question.type === 'number' && (
                  <input type="number" placeholder={question.placeholder} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                )}

                {question.type === 'monetary' && (
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">{currencySymbol(question.currency)}</span>
                    <input type="number" step="0.01" placeholder={question.placeholder || '0.00'} className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                )}

                {question.type === 'date' && (
                  <input type="date" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                )}

                {question.type === 'email' && (
                  <input type="email" placeholder={question.placeholder || 'you@example.com'} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                )}

                {question.type === 'phone' && (
                  <input type="tel" placeholder={question.placeholder} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                )}

                {question.type === 'website' && (
                  <input type="url" placeholder={question.placeholder || 'https://'} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                )}

                {(question.type === 'first_name' ||
                  question.type === 'last_name' ||
                  question.type === 'full_name' ||
                  question.type === 'company' ||
                  question.type === 'address' ||
                  question.type === 'city' ||
                  question.type === 'postal_code' ||
                  question.type === 'source') && (
                  <input type="text" placeholder={question.placeholder} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                )}

                {question.type === 'state' && (
                  <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">{question.placeholder || 'Select state...'}</option>
                    {US_STATES.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                )}

                {question.type === 'country' && (
                  <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">{question.placeholder || 'Select country...'}</option>
                    {COUNTRIES.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                )}

                {question.type === 'timezone' && (
                  <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">{question.placeholder || 'Select timezone...'}</option>
                    {COMMON_TIMEZONES.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                )}

                {(question.type === 'multiple_choice' || question.type === 'yes_no') && (
                  <div className="space-y-2">
                    {(question.options || []).map((option) => (
                      <label key={option.id} className="flex items-center gap-2">
                        <input type="radio" name={question.id} className="text-blue-600 focus:ring-blue-500" />
                        <span>{option.label}</span>
                      </label>
                    ))}
                  </div>
                )}

                {(question.type === 'dropdown' || question.type === 'product_selection') && (
                  <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">{question.placeholder || 'Select...'}</option>
                    {(question.options || []).map((opt) => (
                      <option key={opt.id} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                )}

                {question.type === 'multi_dropdown' && (
                  <select multiple size={Math.min(5, (question.options || []).length || 3)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {(question.options || []).map((opt) => (
                      <option key={opt.id} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                )}

                {(question.type === 'multi_select' || question.type === 'checkbox_group') && (
                  <div className="space-y-2">
                    {(question.options || []).map((option) => (
                      <label key={option.id} className="flex items-center gap-2">
                        <input type="checkbox" className="rounded text-blue-600 focus:ring-blue-500" />
                        <span>{option.label}</span>
                      </label>
                    ))}
                  </div>
                )}

                {isCheckboxType && (
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded text-blue-600 focus:ring-blue-500 mt-0.5" />
                    <span className="text-sm text-gray-700">{question.label}</span>
                  </label>
                )}

                {question.type === 'file_upload' && (
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                    <p className="text-sm text-gray-600">Click to upload or drag and drop</p>
                    <p className="text-xs text-gray-400 mt-1">Max {Math.round((question.fileUploadConfig?.maxSizeBytes || 10485760) / 1048576)}MB</p>
                  </div>
                )}

                {question.type === 'rating' && (
                  <div className="flex gap-2">
                    {Array.from(
                      { length: (question.maxValue || 5) - (question.minValue || 1) + 1 },
                      (_, i) => (question.minValue || 1) + i
                    ).map((n) => (
                      <button key={n} type="button" className="p-2 text-gray-400 hover:text-yellow-400">
                        <Star className="w-6 h-6" />
                      </button>
                    ))}
                  </div>
                )}

                {question.type === 'nps' && (
                  <div className="flex gap-1 flex-wrap">
                    {Array.from({ length: 11 }, (_, i) => i).map((n) => (
                      <button key={n} type="button" className="w-10 h-10 border border-gray-300 rounded hover:bg-blue-50 hover:border-blue-500 text-sm font-medium">{n}</button>
                    ))}
                  </div>
                )}

                {question.type === 'opinion_scale' && (
                  <div>
                    <div className="flex gap-1 mb-1">
                      {Array.from(
                        { length: (question.maxValue || 5) - (question.minValue || 1) + 1 },
                        (_, i) => (question.minValue || 1) + i
                      ).map((n) => (
                        <button key={n} type="button" className="flex-1 py-2 border border-gray-300 rounded hover:bg-blue-50 hover:border-blue-500 text-sm font-medium">{n}</button>
                      ))}
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>{question.minLabel}</span>
                      <span>{question.maxLabel}</span>
                    </div>
                  </div>
                )}

                {question.type === 'matrix' && question.matrixRows && question.matrixColumns && (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr>
                          <th className="p-2"></th>
                          {question.matrixColumns.map((col) => (
                            <th key={col.id} className="p-2 text-center text-xs text-gray-600">{col.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {question.matrixRows.map((row) => (
                          <tr key={row.id} className="border-t border-gray-200">
                            <td className="p-2 text-sm text-gray-700">{row.label}</td>
                            {question.matrixColumns!.map((col) => (
                              <td key={col.id} className="p-2 text-center">
                                <input type="radio" name={`${question.id}-${row.id}`} className="text-blue-600 focus:ring-blue-500" />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {question.type === 'ranking' && (
                  <div className="space-y-2">
                    {(question.options || []).map((opt, i) => (
                      <div key={opt.id} className="flex items-center gap-2 p-2 border border-gray-200 rounded">
                        <span className="w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-sm font-medium">{i + 1}</span>
                        <span className="flex-1 text-sm">{opt.label}</span>
                      </div>
                    ))}
                  </div>
                )}

                {question.type === 'image_choice' && (
                  <div className="grid grid-cols-2 gap-2">
                    {(question.imageOptions || []).map((opt) => (
                      <div key={opt.id} className="border border-gray-200 rounded-lg overflow-hidden">
                        <img src={opt.imageUrl} alt={opt.label} className="w-full aspect-square object-cover" />
                        <div className="p-2 text-center text-sm text-gray-700">{opt.label}</div>
                      </div>
                    ))}
                  </div>
                )}

                {question.type === 'contact_capture' && (
                  <div className="grid grid-cols-2 gap-2">
                    <input type="text" placeholder="First name" className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <input type="text" placeholder="Last name" className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <input type="email" placeholder="Email" className="col-span-2 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                )}

                {question.type === 'payment' && (
                  <div className="border border-gray-300 rounded-lg p-4 bg-gray-50 text-sm text-gray-600 flex items-center gap-2">
                    <CreditCard className="w-4 h-4" />
                    <span>Payment field — connect Stripe to collect payments here.</span>
                  </div>
                )}

                {question.type === 'sms_verification' && (
                  <div className="space-y-2">
                    <input type="tel" placeholder="Phone number" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <div className="flex gap-2">
                      <input type="text" placeholder="Verification code" className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      <button type="button" className="px-3 py-2 text-sm bg-gray-200 text-gray-700 rounded-lg">Send code</button>
                    </div>
                  </div>
                )}

                {question.type === 'email_validation' && (
                  <div className="flex gap-2">
                    <input type="email" placeholder={question.placeholder || 'you@example.com'} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <button type="button" className="px-3 py-2 text-sm bg-gray-200 text-gray-700 rounded-lg">Verify</button>
                  </div>
                )}

                {question.type === 'math_calculation' && (
                  <input type="text" readOnly placeholder={question.formula ? `= ${question.formula}` : 'Computed value'} className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-500" />
                )}
              </div>
            );
          })}
        </div>

        <div className="flex justify-between mt-8">
          <button
            onClick={() => setCurrentStepIndex(Math.max(0, currentStepIndex - 1))}
            disabled={currentStepIndex === 0 || !survey.settings.showBackButton}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Back
          </button>
          <button
            onClick={() => setCurrentStepIndex(Math.min(totalSteps - 1, currentStepIndex + 1))}
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

function BranchingRuleBuilder({
  step,
  stepIndex,
  allSteps,
  onUpdateRules,
  onClose,
}: {
  step: SurveyStep;
  stepIndex: number;
  allSteps: SurveyStep[];
  onUpdateRules: (rules: SurveyBranchRule[]) => void;
  onClose: () => void;
}) {
  const rules = step.branchRules || [];
  const questions = step.questions;

  function addRule() {
    const newRule: SurveyBranchRule = {
      id: generateId(),
      questionId: questions[0]?.id || '',
      operator: 'equals',
      value: '',
      action: 'go_to_step',
      goToStepIndex: Math.min(stepIndex + 2, allSteps.length - 1),
    };
    onUpdateRules([...rules, newRule]);
  }

  function updateRule(ruleId: string, updates: Partial<SurveyBranchRule>) {
    onUpdateRules(rules.map((r) => (r.id === ruleId ? { ...r, ...updates } : r)));
  }

  function removeRule(ruleId: string) {
    onUpdateRules(rules.filter((r) => r.id !== ruleId));
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Branching Logic</h3>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="text-sm text-gray-600 mb-4">
        <p>Step {stepIndex + 1}: {step.title}</p>
        <p className="text-xs text-gray-500 mt-1">
          Define rules to control which step comes next based on answers
        </p>
      </div>

      {rules.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg">
          <GitBranch className="w-10 h-10 mx-auto text-gray-300 mb-2" />
          <p className="text-sm text-gray-500">No branching rules</p>
          <p className="text-xs text-gray-400">Default: Go to next step</p>
        </div>
      ) : (
        <div className="space-y-4">
          {rules.map((rule, idx) => {
            const sourceQuestion = questions.find((q) => q.id === rule.questionId);
            return (
              <div key={rule.id} className="p-4 bg-gray-50 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500 uppercase">
                    Rule {idx + 1}
                  </span>
                  <button
                    onClick={() => removeRule(rule.id)}
                    className="p-1 text-gray-400 hover:text-red-500"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-1">When answer to</label>
                  <select
                    value={rule.questionId}
                    onChange={(e) => updateRule(rule.id, { questionId: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {questions.map((q) => (
                      <option key={q.id} value={q.id}>{q.label}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={rule.operator}
                    onChange={(e) => updateRule(rule.id, { operator: e.target.value as SurveyBranchRule['operator'] })}
                    className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="equals">Equals</option>
                    <option value="not_equals">Not equals</option>
                    <option value="contains">Contains</option>
                    <option value="greater_than">Greater than</option>
                    <option value="less_than">Less than</option>
                    <option value="is_any">Is any of</option>
                    <option value="is_empty">Is empty</option>
                  </select>

                  {rule.operator !== 'is_empty' && (
                    <>
                      {sourceQuestion?.options ? (
                        <select
                          value={Array.isArray(rule.value) ? rule.value[0] : rule.value as string}
                          onChange={(e) => updateRule(rule.id, { value: e.target.value })}
                          className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Select...</option>
                          {sourceQuestion.options.map((opt) => (
                            <option key={opt.id} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={rule.value as string}
                          onChange={(e) => updateRule(rule.id, { value: e.target.value })}
                          placeholder="Value"
                          className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      )}
                    </>
                  )}
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-1">Then</label>
                  <select
                    value={rule.action}
                    onChange={(e) => updateRule(rule.id, { action: e.target.value as SurveyBranchRule['action'] })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="go_to_step">Go to step</option>
                    <option value="skip_question">Skip question</option>
                    <option value="end_survey">End survey</option>
                  </select>
                </div>

                {rule.action === 'go_to_step' && (
                  <select
                    value={rule.goToStepIndex ?? 0}
                    onChange={(e) => updateRule(rule.id, { goToStepIndex: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {allSteps.map((s, i) => (
                      <option key={s.id} value={i} disabled={i <= stepIndex}>
                        Step {i + 1}: {s.title}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            );
          })}
        </div>
      )}

      {questions.length > 0 && (
        <button
          onClick={addRule}
          className="w-full mt-4 px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
        >
          + Add Branching Rule
        </button>
      )}

      {questions.length === 0 && (
        <p className="text-xs text-gray-400 text-center mt-4">
          Add questions to this step to create branching rules
        </p>
      )}

      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="text-xs text-gray-500">
          <p className="font-medium mb-1">Default behavior:</p>
          <p>If no rules match, survey continues to Step {Math.min(stepIndex + 2, allSteps.length)}</p>
        </div>
      </div>
    </div>
  );
}

function SurveyEmbedModal({ survey, onClose }: { survey: Survey; onClose: () => void }) {
  const [embedType, setEmbedType] = useState<'inline' | 'popup' | 'link'>('inline');
  const [copied, setCopied] = useState(false);

  const baseUrl = window.location.origin;
  const surveyUrl = `${baseUrl}/s/${survey.public_slug}`;
  const containerId = `a8l-survey-${survey.public_slug}`;

  const getEmbedCode = () => {
    if (embedType === 'link') {
      return surveyUrl;
    }

    if (embedType === 'popup') {
      return `<script src="${baseUrl}/forms-widget.js"
  data-base-url="${baseUrl}"
  data-survey-slug="${survey.public_slug}"
  data-mode="popup"
  data-button-text="Take Survey"
  data-primary-color="#0891b2"></script>`;
    }

    return `<div id="${containerId}"></div>
<script src="${baseUrl}/forms-widget.js"
  data-base-url="${baseUrl}"
  data-survey-slug="${survey.public_slug}"
  data-mode="inline"
  data-target="#${containerId}"></script>`;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getEmbedCode());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Embed Survey</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Embed Type</label>
            <div className="flex gap-2">
              {[
                { id: 'inline', label: 'Inline', desc: 'Embed directly in page' },
                { id: 'popup', label: 'Popup', desc: 'Floating button + modal' },
                { id: 'link', label: 'Link', desc: 'Share customer-facing URL' },
              ].map((type) => (
                <button
                  key={type.id}
                  onClick={() => setEmbedType(type.id as typeof embedType)}
                  className={`flex-1 p-3 rounded-lg border-2 text-left transition-colors ${
                    embedType === type.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-medium text-gray-900">{type.label}</div>
                  <div className="text-xs text-gray-500">{type.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                {embedType === 'link' ? 'Direct Link' : 'Embed Code'}
              </label>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                {copied ? 'Copied!' : <><Copy className="w-4 h-4" /> Copy</>}
              </button>
            </div>
            <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto whitespace-pre-wrap">
              {getEmbedCode()}
            </pre>
          </div>

          {embedType === 'link' && (
            <a
              href={surveyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Open Survey
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
