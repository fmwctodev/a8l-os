import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getProposalById, linkMeetingToProposal, unlinkMeetingFromProposal } from '../../services/proposals';
import { callEdgeFunction } from '../../lib/edgeFunction';
import { getMeetingTranscriptionsByContact, getGoogleMeetRecordingsForOrg } from '../../services/meetingTranscriptions';
import { checkDriveConnectionStatus, syncMeetRecordings } from '../../services/googleMeet';
import { parseFile, formatFileSize, ACCEPTED_TYPES, MAX_FILE_SIZE } from '../../utils/fileParser';
import type { ParsedFile } from '../../utils/fileParser';
import type { Proposal, MeetingTranscription, ProposalSectionType } from '../../types';
import {
  ArrowLeft,
  FileText,
  Sparkles,
  Loader2,
  Video,
  CheckCircle,
  ChevronRight,
  Calendar,
  Clock,
  ExternalLink,
  ListChecks,
  User,
  Wand2,
  AlertCircle,
  Upload,
  X,
  FileUp,
  File,
  RefreshCw,
  Search,
  Wifi,
  WifiOff,
  Mic,
  Link2,
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
  const [googleMeetRecordings, setGoogleMeetRecordings] = useState<MeetingTranscription[]>([]);
  const [selectedMeetings, setSelectedMeetings] = useState<string[]>([]);
  const [selectedSections, setSelectedSections] = useState<ProposalSectionType[]>(['intro', 'scope', 'deliverables', 'pricing']);
  const [customInstructions, setCustomInstructions] = useState('');
  const [includeContactHistory, setIncludeContactHistory] = useState(true);
  const [includeOpportunityData, setIncludeOpportunityData] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<BuilderStep>('meetings');
  const [uploadedFiles, setUploadedFiles] = useState<ParsedFile[]>([]);
  const [isParsingFile, setIsParsingFile] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [driveConnected, setDriveConnected] = useState<boolean | null>(null);
  const [loadingRecordings, setLoadingRecordings] = useState(false);
  const [syncingRecordings, setSyncingRecordings] = useState(false);
  const [syncResult, setSyncResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [recordingSearch, setRecordingSearch] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

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

      const linkedMeetingIds = proposalData?.meeting_contexts?.map(mc => mc.meeting_transcription_id) || [];
      setSelectedMeetings(linkedMeetingIds);

      if (proposalData?.contact_id) {
        const meetingsData = await getMeetingTranscriptionsByContact(proposalData.contact_id);
        setMeetings(meetingsData);
      }

      if (proposalData?.org_id) {
        await loadGoogleMeetRecordings(proposalData.org_id);
      }
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadGoogleMeetRecordings = async (orgId: string, search?: string) => {
    try {
      setLoadingRecordings(true);
      const [status, recordings] = await Promise.all([
        checkDriveConnectionStatus(orgId),
        getGoogleMeetRecordingsForOrg(orgId, search),
      ]);
      setDriveConnected(status.connected);
      setGoogleMeetRecordings(recordings);
    } catch (err) {
      console.error('Failed to load Google Meet recordings:', err);
      setDriveConnected(false);
      setGoogleMeetRecordings([]);
    } finally {
      setLoadingRecordings(false);
    }
  };

  const handleSyncRecordings = async () => {
    if (!proposal?.org_id || !user?.id) return;
    try {
      setSyncingRecordings(true);
      setSyncResult(null);
      setSyncError(null);
      const result = await syncMeetRecordings(proposal.org_id, user.id);
      setSyncResult(result);
      await loadGoogleMeetRecordings(proposal.org_id, recordingSearch);
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Failed to sync recordings');
    } finally {
      setSyncingRecordings(false);
    }
  };

  const handleRecordingSearch = useCallback(
    (value: string) => {
      setRecordingSearch(value);
      if (proposal?.org_id) {
        loadGoogleMeetRecordings(proposal.org_id, value);
      }
    },
    [proposal?.org_id]
  );

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

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    setFileError(null);
    const fileArray = Array.from(files);

    for (const file of fileArray) {
      if (file.size > MAX_FILE_SIZE) {
        setFileError(`${file.name} exceeds the 10MB size limit`);
        continue;
      }

      if (uploadedFiles.some((f) => f.name === file.name)) {
        setFileError(`${file.name} is already uploaded`);
        continue;
      }

      try {
        setIsParsingFile(true);
        const parsed = await parseFile(file);
        if (!parsed.text) {
          setFileError(`Could not extract text from ${file.name}`);
          continue;
        }
        setUploadedFiles((prev) => [...prev, parsed]);
      } catch {
        setFileError(`Failed to parse ${file.name}. Please ensure it is a valid PDF, DOCX, or TXT file.`);
      } finally {
        setIsParsingFile(false);
      }
    }
  }, [uploadedFiles]);

  const removeFile = (fileName: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.name !== fileName));
    setFileError(null);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleGenerate = async () => {
    if (!proposal || !user) return;

    try {
      setIsGenerating(true);
      setGenerationError(null);

      const response = await callEdgeFunction('proposal-ai-generate', {
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
        uploaded_documents: uploadedFiles.length > 0
          ? uploadedFiles.map((f) => ({ name: f.name, text: f.text }))
          : undefined,
      });

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
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return null;
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
  };

  const steps: { key: BuilderStep; label: string; icon: typeof FileText }[] = [
    { key: 'meetings', label: 'Context', icon: Video },
    { key: 'sections', label: 'Choose Sections', icon: ListChecks },
    { key: 'generate', label: 'Generate', icon: Sparkles },
    { key: 'review', label: 'Review', icon: FileText },
  ];

  const currentStepIndex = steps.findIndex(s => s.key === currentStep);

  const filteredGoogleMeetRecordings = googleMeetRecordings.filter(r =>
    !meetings.some(m => m.id === r.id)
  );

  const totalSelected = selectedMeetings.length;

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
                <h2 className="text-lg font-semibold text-white">Provide Context</h2>
                <p className="text-slate-400 mt-1">
                  Select meetings and/or upload documents with notes, scope of work, or project briefs to give the AI rich context for generating your proposal.
                </p>
              </div>

              {/* Upload Documents */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  Upload Documents
                </h3>
                <p className="text-xs text-slate-500">
                  PDF, DOCX, or TXT files up to 10MB
                </p>
              </div>

              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
                  isDragOver
                    ? 'border-cyan-400 bg-cyan-500/10'
                    : 'border-slate-600 bg-slate-800/30 hover:border-slate-500 hover:bg-slate-800/50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_TYPES}
                  multiple
                  onChange={(e) => e.target.files && handleFiles(e.target.files)}
                  className="hidden"
                />
                {isParsingFile ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
                    <p className="text-slate-300 text-sm">Extracting text from document...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                      isDragOver ? 'bg-cyan-500/20' : 'bg-slate-700/50'
                    }`}>
                      <FileUp className={`w-6 h-6 ${isDragOver ? 'text-cyan-400' : 'text-slate-400'}`} />
                    </div>
                    <div>
                      <p className="text-slate-300 text-sm">
                        <span className="text-cyan-400 font-medium">Click to upload</span> or drag and drop
                      </p>
                      <p className="text-slate-500 text-xs mt-1">
                        Scope of work, meeting notes, project briefs, RFPs
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {fileError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <p className="text-red-300 text-sm">{fileError}</p>
                </div>
              )}

              {uploadedFiles.length > 0 && (
                <div className="space-y-2">
                  {uploadedFiles.map((file) => (
                    <div
                      key={file.name}
                      className="flex items-center gap-3 p-3 bg-slate-800/60 rounded-lg border border-slate-700 group"
                    >
                      <div className="w-9 h-9 rounded-lg bg-cyan-500/10 flex items-center justify-center flex-shrink-0">
                        <File className="w-4 h-4 text-cyan-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{file.name}</p>
                        <div className="flex items-center gap-3 text-xs text-slate-400">
                          <span>{formatFileSize(file.size)}</span>
                          {file.pageCount && <span>{file.pageCount} page{file.pageCount !== 1 ? 's' : ''}</span>}
                          <span>{file.text.length.toLocaleString()} chars extracted</span>
                        </div>
                      </div>
                      <button
                        onClick={() => removeFile(file.name)}
                        className="p-1.5 rounded-md text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Divider */}
              <div className="flex items-center gap-4 py-2">
                <div className="flex-1 h-px bg-slate-700" />
                <span className="text-xs text-slate-500 uppercase tracking-wider">And / Or</span>
                <div className="flex-1 h-px bg-slate-700" />
              </div>

              {/* Contact-linked meetings */}
              {meetings.length > 0 && (
                <>
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-slate-300 uppercase tracking-wider flex items-center gap-2">
                      <Link2 className="w-4 h-4" />
                      Contact Meetings
                    </h3>
                    <p className="text-xs text-slate-500">Meetings linked to this contact</p>
                  </div>

                  <div className="space-y-3">
                    {meetings.map((meeting) => (
                      <MeetingCard
                        key={meeting.id}
                        meeting={meeting}
                        selected={selectedMeetings.includes(meeting.id)}
                        onToggle={() => toggleMeeting(meeting.id)}
                        formatDate={formatDate}
                        formatDuration={formatDuration}
                      />
                    ))}
                  </div>

                  <div className="flex items-center gap-4 py-2">
                    <div className="flex-1 h-px bg-slate-700" />
                    <span className="text-xs text-slate-500 uppercase tracking-wider">And / Or</span>
                    <div className="flex-1 h-px bg-slate-700" />
                  </div>
                </>
              )}

              {/* Google Meet Recordings Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-slate-300 uppercase tracking-wider flex items-center gap-2">
                      <Video className="w-4 h-4 text-emerald-400" />
                      Google Meet Recordings
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Select past recorded meetings to use as context for generating this proposal
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {driveConnected !== null && (
                      <span className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${
                        driveConnected
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                          : 'bg-slate-700 text-slate-400 border border-slate-600'
                      }`}>
                        {driveConnected ? (
                          <><Wifi className="w-3 h-3" /> Connected</>
                        ) : (
                          <><WifiOff className="w-3 h-3" /> Not connected</>
                        )}
                      </span>
                    )}
                    {driveConnected && (
                      <button
                        onClick={handleSyncRecordings}
                        disabled={syncingRecordings}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 hover:text-white rounded-lg transition-colors disabled:opacity-50"
                      >
                        {syncingRecordings ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3.5 h-3.5" />
                        )}
                        {syncingRecordings ? 'Syncing...' : 'Sync from Drive'}
                      </button>
                    )}
                  </div>
                </div>

                {syncResult && (
                  <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/25 rounded-lg">
                    <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <p className="text-emerald-300 text-sm">
                      Sync complete — {syncResult.imported} new recording{syncResult.imported !== 1 ? 's' : ''} imported
                      {syncResult.skipped > 0 && `, ${syncResult.skipped} already up to date`}
                    </p>
                  </div>
                )}

                {syncError && (
                  <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/25 rounded-lg">
                    <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                    <p className="text-red-300 text-sm">{syncError}</p>
                  </div>
                )}

                {!driveConnected && driveConnected !== null && (
                  <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-6 text-center">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-700/60 flex items-center justify-center">
                      <WifiOff className="w-6 h-6 text-slate-400" />
                    </div>
                    <p className="text-white font-medium mb-1">Google Drive Not Connected</p>
                    <p className="text-slate-400 text-sm mb-4">
                      Connect Google Drive to access your Meet recordings, summaries, and action items.
                    </p>
                    <Link
                      to="/settings/integrations"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Connect in Integrations
                    </Link>
                  </div>
                )}

                {driveConnected && (
                  <>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        type="text"
                        value={recordingSearch}
                        onChange={(e) => handleRecordingSearch(e.target.value)}
                        placeholder="Search recordings..."
                        className="w-full pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/60"
                      />
                    </div>

                    {loadingRecordings ? (
                      <div className="flex items-center justify-center py-10">
                        <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
                        <span className="ml-2 text-sm text-slate-400">Loading recordings...</span>
                      </div>
                    ) : filteredGoogleMeetRecordings.length === 0 ? (
                      <div className="text-center py-10 rounded-xl border border-slate-700/50 bg-slate-800/30">
                        <Mic className="w-8 h-8 text-slate-600 mx-auto mb-3" />
                        <p className="text-slate-400 text-sm font-medium">No recordings found</p>
                        <p className="text-slate-500 text-xs mt-1">
                          {recordingSearch
                            ? 'Try a different search term'
                            : 'Use "Sync from Drive" to import your latest Meet recordings'}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                        {filteredGoogleMeetRecordings.map((recording) => (
                          <MeetingCard
                            key={recording.id}
                            meeting={recording}
                            selected={selectedMeetings.includes(recording.id)}
                            onToggle={() => toggleMeeting(recording.id)}
                            formatDate={formatDate}
                            formatDuration={formatDuration}
                            badge="Google Meet"
                          />
                        ))}
                      </div>
                    )}
                  </>
                )}

                {driveConnected === null && (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 text-slate-500 animate-spin mr-2" />
                    <span className="text-sm text-slate-500">Checking Drive connection...</span>
                  </div>
                )}
              </div>

              {meetings.length === 0 && uploadedFiles.length === 0 && filteredGoogleMeetRecordings.length === 0 && driveConnected === false && (
                <div className="text-center py-6 bg-slate-800/30 rounded-lg border border-slate-700/50">
                  <p className="text-sm text-slate-500">
                    Upload documents above, or continue without context to generate a basic proposal.
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between pt-4">
                {totalSelected > 0 && (
                  <span className="text-sm text-slate-400">
                    <span className="text-cyan-400 font-medium">{totalSelected}</span> meeting{totalSelected !== 1 ? 's' : ''} selected
                  </span>
                )}
                <div className={totalSelected > 0 ? '' : 'ml-auto'}>
                  <button
                    onClick={() => setCurrentStep('sections')}
                    className="flex items-center gap-2 px-6 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors"
                  >
                    Continue
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
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
                    <h3 className="text-sm font-medium text-slate-300 mb-3">Context Sources</h3>
                    <div className="space-y-1">
                      {selectedMeetings.length > 0 && (
                        <p className="text-white">{selectedMeetings.length} meeting{selectedMeetings.length !== 1 ? 's' : ''}</p>
                      )}
                      {uploadedFiles.length > 0 && (
                        <p className="text-white">{uploadedFiles.length} document{uploadedFiles.length !== 1 ? 's' : ''}</p>
                      )}
                      {selectedMeetings.length === 0 && uploadedFiles.length === 0 && (
                        <p className="text-slate-500">None</p>
                      )}
                    </div>
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

interface MeetingCardProps {
  meeting: MeetingTranscription;
  selected: boolean;
  onToggle: () => void;
  formatDate: (d: string) => string;
  formatDuration: (m: number | null) => string | null;
  badge?: string;
}

function MeetingCard({ meeting, selected, onToggle, formatDate, formatDuration, badge }: MeetingCardProps) {
  const duration = formatDuration(meeting.duration_minutes);
  const hasContent = meeting.summary || (meeting.key_points && meeting.key_points.length > 0);

  return (
    <button
      onClick={onToggle}
      className={`w-full p-4 rounded-lg border transition-all text-left group ${
        selected
          ? 'border-cyan-500 bg-cyan-500/10 shadow-[0_0_0_1px_rgba(6,182,212,0.2)]'
          : 'border-slate-700 bg-slate-800/50 hover:border-slate-600 hover:bg-slate-800/70'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${
          selected ? 'border-cyan-500 bg-cyan-500' : 'border-slate-600 group-hover:border-slate-500'
        }`}>
          {selected && <CheckCircle className="w-3.5 h-3.5 text-white" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <h3 className="font-medium text-white text-sm leading-snug">{meeting.meeting_title}</h3>
            {badge && (
              <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 font-medium">
                <Video className="w-2.5 h-2.5" />
                {badge}
              </span>
            )}
            {!hasContent && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/25 font-medium">
                No summary yet
              </span>
            )}
            {meeting.recording_url && (
              <a
                href={meeting.recording_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 text-[10px] text-cyan-400 hover:text-cyan-300 bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/20 transition-colors"
              >
                <Video className="w-2.5 h-2.5" />
                Recording
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-400 mb-2">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {formatDate(meeting.meeting_date)}
            </span>
            {duration && (
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {duration}
              </span>
            )}
            {meeting.participants && meeting.participants.length > 0 && (
              <span className="flex items-center gap-1">
                <User className="w-3.5 h-3.5" />
                {meeting.participants.length} participant{meeting.participants.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {meeting.summary && (
            <p className="text-xs text-slate-300 line-clamp-2 mb-2 leading-relaxed">{meeting.summary}</p>
          )}

          {meeting.key_points && meeting.key_points.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {meeting.key_points.slice(0, 3).map((point, i) => (
                <span
                  key={i}
                  className="text-[10px] bg-slate-700/80 text-slate-300 px-2 py-0.5 rounded-full"
                >
                  {point.length > 45 ? point.substring(0, 45) + '…' : point}
                </span>
              ))}
              {meeting.key_points.length > 3 && (
                <span className="text-[10px] text-slate-500 px-1">
                  +{meeting.key_points.length - 3} more
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
