import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getProposalById, linkMeetingToProposal, unlinkMeetingFromProposal } from '../../services/proposals';
import { getMeetingTranscriptionsByContact } from '../../services/meetingTranscriptions';
import type { Proposal, MeetingTranscription, ProposalSectionType } from '../../types';
import {
  ArrowLeft,
  FileText,
  Sparkles,
  Loader2,
  Video,
  CheckCircle,
  Circle,
  ChevronRight,
  Calendar,
  Clock,
  ExternalLink,
  MessageSquare,
  ListChecks,
  User,
  Wand2,
  AlertCircle,
} from 'lucide-react';

type BuilderStep = 'meetings' | 'sections' | 'generate' | 'review';

const SECTION_OPTIONS: { type: ProposalSectionType; label: string; description: string }[] = [
  { type: 'intro', label: 'Introduction', description: 'Opening statement and executive summary' },
  { type: 'scope', label: 'Scope of Work', description: 'Detailed project scope and objectives' },
  { type: 'deliverables', label: 'Deliverables', description: 'What will be delivered' },
  { type: 'timeline', label: 'Timeline', description: 'Project schedule and milestones' },
  { type: 'pricing', label: 'Pricing', description: 'Cost breakdown and payment terms' },
  { type: 'terms', label: 'Terms & Conditions', description: 'Legal terms and conditions' },
];

export function ProposalBuilder() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [meetings, setMeetings] = useState<MeetingTranscription[]>([]);
  const [selectedMeetings, setSelectedMeetings] = useState<string[]>([]);
  const [selectedSections, setSelectedSections] = useState<ProposalSectionType[]>(['intro', 'scope', 'deliverables', 'pricing']);
  const [customInstructions, setCustomInstructions] = useState('');
  const [includeContactHistory, setIncludeContactHistory] = useState(true);
  const [includeOpportunityData, setIncludeOpportunityData] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<BuilderStep>('meetings');

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const proposalData = await getProposalById(id!);
      setProposal(proposalData);

      if (proposalData?.contact_id) {
        const meetingsData = await getMeetingTranscriptionsByContact(proposalData.contact_id);
        setMeetings(meetingsData);

        const linkedMeetingIds = proposalData.meeting_contexts?.map(mc => mc.meeting_transcription_id) || [];
        setSelectedMeetings(linkedMeetingIds);
      }
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMeeting = async (meetingId: string) => {
    if (!proposal) return;

    const isSelected = selectedMeetings.includes(meetingId);
    const newSelected = isSelected
      ? selectedMeetings.filter(id => id !== meetingId)
      : [...selectedMeetings, meetingId];

    setSelectedMeetings(newSelected);

    try {
      if (isSelected) {
        await unlinkMeetingFromProposal(proposal.id, meetingId);
      } else {
        await linkMeetingToProposal(proposal.id, meetingId, proposal.org_id);
      }
    } catch (err) {
      console.error('Failed to update meeting link:', err);
      setSelectedMeetings(selectedMeetings);
    }
  };

  const toggleSection = (sectionType: ProposalSectionType) => {
    setSelectedSections(prev =>
      prev.includes(sectionType)
        ? prev.filter(s => s !== sectionType)
        : [...prev, sectionType]
    );
  };

  const handleGenerate = async () => {
    if (!proposal || !user) return;

    try {
      setIsGenerating(true);
      setGenerationError(null);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/proposal-ai-generate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            proposal_id: proposal.id,
            contact_id: proposal.contact_id,
            opportunity_id: proposal.opportunity_id,
            meeting_ids: selectedMeetings,
            template_id: proposal.template_id,
            custom_instructions: customInstructions || undefined,
            sections_to_generate: selectedSections,
            include_contact_history: includeContactHistory,
            include_opportunity_data: includeOpportunityData,
            user_id: user.id,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Generation failed');
      }

      setCurrentStep('review');
    } catch (err) {
      console.error('Failed to generate:', err);
      setGenerationError(err instanceof Error ? err.message : 'Failed to generate proposal content');
    } finally {
      setIsGenerating(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return '-';
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
  };

  const steps: { key: BuilderStep; label: string; icon: typeof FileText }[] = [
    { key: 'meetings', label: 'Select Meetings', icon: Video },
    { key: 'sections', label: 'Choose Sections', icon: ListChecks },
    { key: 'generate', label: 'Generate', icon: Sparkles },
    { key: 'review', label: 'Review', icon: FileText },
  ];

  const currentStepIndex = steps.findIndex(s => s.key === currentStep);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400">
        <FileText className="w-12 h-12 mb-4 opacity-50" />
        <p>Proposal not found</p>
        <Link to="/proposals" className="mt-4 text-cyan-400 hover:text-cyan-300">
          Back to Proposals
        </Link>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-900">
      <div className="px-6 py-4 border-b border-slate-700/50">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(`/proposals/${proposal.id}`)}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-400" />
            </button>
            <div>
              <h1 className="text-xl font-semibold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-cyan-400" />
                AI Proposal Builder
              </h1>
              <p className="text-sm text-slate-400 mt-0.5">{proposal.title}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center">
          {steps.map((step, index) => (
            <div key={step.key} className="flex items-center">
              <button
                onClick={() => index <= currentStepIndex && setCurrentStep(step.key)}
                disabled={index > currentStepIndex}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  currentStep === step.key
                    ? 'bg-cyan-500/20 text-cyan-300'
                    : index < currentStepIndex
                    ? 'text-emerald-400 hover:bg-slate-800'
                    : 'text-slate-500 cursor-not-allowed'
                }`}
              >
                {index < currentStepIndex ? (
                  <CheckCircle className="w-5 h-5" />
                ) : (
                  <step.icon className="w-5 h-5" />
                )}
                <span className="text-sm font-medium">{step.label}</span>
              </button>
              {index < steps.length - 1 && (
                <ChevronRight className="w-5 h-5 text-slate-600 mx-2" />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto">
          {currentStep === 'meetings' && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h2 className="text-lg font-semibold text-white">Select Meeting Context</h2>
                <p className="text-slate-400 mt-1">
                  Choose meetings to include as context for AI generation. Meeting notes, key points, and action items will help create a more personalized proposal.
                </p>
              </div>

              {meetings.length === 0 ? (
                <div className="text-center py-12 bg-slate-800/50 rounded-lg border border-slate-700">
                  <Video className="w-10 h-10 mx-auto mb-3 text-slate-500" />
                  <p className="text-slate-400">No meetings found for this contact</p>
                  <p className="text-sm text-slate-500 mt-1">
                    You can still generate a proposal without meeting context
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {meetings.map((meeting) => (
                    <button
                      key={meeting.id}
                      onClick={() => toggleMeeting(meeting.id)}
                      className={`w-full p-4 rounded-lg border transition-colors text-left ${
                        selectedMeetings.includes(meeting.id)
                          ? 'border-cyan-500 bg-cyan-500/10'
                          : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                          selectedMeetings.includes(meeting.id)
                            ? 'border-cyan-500 bg-cyan-500'
                            : 'border-slate-600'
                        }`}>
                          {selectedMeetings.includes(meeting.id) && (
                            <CheckCircle className="w-4 h-4 text-white" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-medium text-white">{meeting.meeting_title}</h3>
                            {meeting.recording_url && (
                              <a
                                href={meeting.recording_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded"
                              >
                                <Video className="w-3 h-3" />
                                Recording
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-slate-400 mb-3">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              {formatDate(meeting.meeting_date)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              {formatDuration(meeting.duration_minutes)}
                            </span>
                            <span className="flex items-center gap-1">
                              <User className="w-4 h-4" />
                              {meeting.participants.length} participants
                            </span>
                          </div>
                          {meeting.summary && (
                            <p className="text-sm text-slate-300 line-clamp-2 mb-2">{meeting.summary}</p>
                          )}
                          {meeting.key_points && meeting.key_points.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {meeting.key_points.slice(0, 3).map((point, i) => (
                                <span
                                  key={i}
                                  className="text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded"
                                >
                                  {point.length > 50 ? point.substring(0, 50) + '...' : point}
                                </span>
                              ))}
                              {meeting.key_points.length > 3 && (
                                <span className="text-xs text-slate-500">
                                  +{meeting.key_points.length - 3} more
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              <div className="flex justify-end pt-4">
                <button
                  onClick={() => setCurrentStep('sections')}
                  className="flex items-center gap-2 px-6 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors"
                >
                  Continue
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {currentStep === 'sections' && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h2 className="text-lg font-semibold text-white">Choose Sections to Generate</h2>
                <p className="text-slate-400 mt-1">
                  Select which proposal sections the AI should generate
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {SECTION_OPTIONS.map((section) => (
                  <button
                    key={section.type}
                    onClick={() => toggleSection(section.type)}
                    className={`p-4 rounded-lg border transition-colors text-left ${
                      selectedSections.includes(section.type)
                        ? 'border-cyan-500 bg-cyan-500/10'
                        : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                        selectedSections.includes(section.type)
                          ? 'border-cyan-500 bg-cyan-500'
                          : 'border-slate-600'
                      }`}>
                        {selectedSections.includes(section.type) && (
                          <CheckCircle className="w-3 h-3 text-white" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-white">{section.label}</p>
                        <p className="text-sm text-slate-400">{section.description}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <div className="flex justify-between pt-4">
                <button
                  onClick={() => setCurrentStep('meetings')}
                  className="flex items-center gap-2 px-4 py-2 text-slate-400 hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
                <button
                  onClick={() => setCurrentStep('generate')}
                  disabled={selectedSections.length === 0}
                  className="flex items-center gap-2 px-6 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                >
                  Continue
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {currentStep === 'generate' && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h2 className="text-lg font-semibold text-white">Configure Generation</h2>
                <p className="text-slate-400 mt-1">
                  Add any additional instructions and review your settings
                </p>
              </div>

              <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-6 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-sm font-medium text-slate-300 mb-3">Selected Meetings</h3>
                    <p className="text-white">
                      {selectedMeetings.length === 0 ? 'None' : `${selectedMeetings.length} meeting(s)`}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-slate-300 mb-3">Selected Sections</h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedSections.map((s) => (
                        <span key={s} className="px-2 py-1 bg-cyan-500/20 text-cyan-300 rounded text-sm">
                          {SECTION_OPTIONS.find(o => o.type === s)?.label}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={includeContactHistory}
                      onChange={(e) => setIncludeContactHistory(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-cyan-500"
                    />
                    <div>
                      <span className="text-white">Include contact history</span>
                      <p className="text-sm text-slate-400">Use notes and timeline events from the contact</p>
                    </div>
                  </label>

                  {proposal.opportunity_id && (
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={includeOpportunityData}
                        onChange={(e) => setIncludeOpportunityData(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-cyan-500"
                      />
                      <div>
                        <span className="text-white">Include opportunity data</span>
                        <p className="text-sm text-slate-400">Use deal value, pipeline stage, and source</p>
                      </div>
                    </label>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Additional Instructions (Optional)
                  </label>
                  <textarea
                    value={customInstructions}
                    onChange={(e) => setCustomInstructions(e.target.value)}
                    placeholder="Add any specific instructions for the AI, such as tone preferences, specific points to emphasize, or topics to avoid..."
                    className="w-full h-32 px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                  />
                </div>
              </div>

              {generationError && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                  <p className="text-red-300">{generationError}</p>
                </div>
              )}

              <div className="flex justify-between pt-4">
                <button
                  onClick={() => setCurrentStep('sections')}
                  className="flex items-center gap-2 px-4 py-2 text-slate-400 hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-4 h-4" />
                      Generate Proposal
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {currentStep === 'review' && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-emerald-400" />
                </div>
                <h2 className="text-lg font-semibold text-white">Generation Complete!</h2>
                <p className="text-slate-400 mt-1">
                  Your proposal content has been generated. Review and edit it on the proposal page.
                </p>
              </div>

              <div className="flex justify-center gap-4">
                <button
                  onClick={() => setCurrentStep('meetings')}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
                >
                  <Sparkles className="w-4 h-4" />
                  Generate More
                </button>
                <button
                  onClick={() => navigate(`/proposals/${proposal.id}`)}
                  className="flex items-center gap-2 px-6 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors"
                >
                  <FileText className="w-4 h-4" />
                  View Proposal
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
