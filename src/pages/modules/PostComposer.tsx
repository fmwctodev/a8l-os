import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Send,
  Save,
  Sparkles,
  X,
  Loader2,
  Globe,
  ChevronDown,
  CheckCircle,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getSocialAccounts } from '../../services/socialAccounts';
import { getAccountGroups, createAccountGroup } from '../../services/socialAccountGroups';
import {
  createSocialPost,
  updateSocialPost,
  getSocialPostById,
  getCharacterLimits,
  submitForApproval,
} from '../../services/socialPosts';
import {
  AccountSelector,
  ContentComposer,
  PlatformAdvancedOptions,
  PostPreviewPanel,
  CreateGroupModal,
} from '../../components/social-planner';
import type {
  SocialAccount,
  SocialAccountGroup,
  SocialProvider,
  SocialPostMedia,
  SocialPlatformOptions,
} from '../../types';

const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Phoenix', label: 'Arizona (MST)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HST)' },
  { value: 'UTC', label: 'UTC' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)' },
];

const MAX_FILE_SIZE = 100 * 1024 * 1024;

export function PostComposer() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [groups, setGroups] = useState<SocialAccountGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [body, setBody] = useState('');
  const [followUpComment, setFollowUpComment] = useState('');
  const [media, setMedia] = useState<SocialPostMedia[]>([]);
  const [selectedTargets, setSelectedTargets] = useState<string[]>([]);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [scheduleTz, setScheduleTz] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [platformOptions, setPlatformOptions] = useState<SocialPlatformOptions>({});
  const [customizePerChannel, setCustomizePerChannel] = useState(false);

  const [showAIModal, setShowAIModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);

  const [activePreviewTab, setActivePreviewTab] = useState<SocialProvider | 'all'>('all');
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [showPostDropdown, setShowPostDropdown] = useState(false);
  const [showSchedulePanel, setShowSchedulePanel] = useState(false);

  const isEdit = !!id;
  const characterLimits = getCharacterLimits();

  useEffect(() => {
    loadData();
  }, [user?.organization_id, id]);

  async function loadData() {
    if (!user?.organization_id) return;

    try {
      setLoading(true);
      const [accountsData, groupsData] = await Promise.all([
        getSocialAccounts(user.organization_id),
        getAccountGroups(user.organization_id),
      ]);
      setAccounts(accountsData.filter(a => a.status === 'connected'));
      setGroups(groupsData);

      if (id) {
        const post = await getSocialPostById(id);
        if (post) {
          setBody(post.body);
          setFollowUpComment(post.first_comment || '');
          setMedia(post.media);
          setSelectedTargets(post.targets);
          if (post.scheduled_at_utc) {
            const date = new Date(post.scheduled_at_utc);
            setScheduleDate(date.toISOString().split('T')[0]);
            setScheduleTime(date.toTimeString().slice(0, 5));
          }
          setScheduleTz(post.scheduled_timezone || 'UTC');
          setRequiresApproval(post.requires_approval || false);
          if (post.link_preview?.url) {
            setLinkUrl(post.link_preview.url);
          }
          if (post.platform_options) {
            setPlatformOptions(post.platform_options);
          }
          setCustomizePerChannel(post.customized_per_channel || false);
        }
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  }

  function getSelectedProviders(): SocialProvider[] {
    const providers = new Set<SocialProvider>();
    selectedTargets.forEach(targetId => {
      const account = accounts.find(a => a.id === targetId);
      if (account) providers.add(account.provider);
    });
    return Array.from(providers);
  }

  function getLowestCharLimit(): number {
    const selectedProviders = getSelectedProviders();
    if (selectedProviders.length === 0) return 1500;
    return Math.min(...selectedProviders.map(p => characterLimits[p]?.text || 1500));
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files?.length) return;

    const newMedia: SocialPostMedia[] = [];

    for (const file of Array.from(files)) {
      if (file.size > MAX_FILE_SIZE) {
        alert(`File "${file.name}" exceeds the 100MB limit`);
        continue;
      }

      const isVideo = file.type.startsWith('video/');
      const mediaItem: SocialPostMedia = {
        id: crypto.randomUUID(),
        type: isVideo ? 'video' : 'image',
        url: URL.createObjectURL(file),
        filename: file.name,
        mimeType: file.type,
        size: file.size,
        status: 'uploaded',
      };

      newMedia.push(mediaItem);
    }

    setMedia(prev => [...prev, ...newMedia]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function removeMedia(mediaId: string) {
    setMedia(prev => prev.filter(m => m.id !== mediaId));
  }

  async function handleGenerateCaption() {
    if (!aiPrompt.trim()) return;

    setAiGenerating(true);
    setAiSuggestions([]);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const response = await fetch(`${supabaseUrl}/functions/v1/ai-caption-generator`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          prompt: aiPrompt,
          platforms: getSelectedProviders(),
          tone: 'professional',
          includeHashtags: true,
          includeEmojis: true,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setAiSuggestions(data.suggestions || []);
      } else {
        setAiSuggestions([
          `Check out our latest update! ${aiPrompt} #business #growth`,
          `Exciting news! ${aiPrompt} Follow us for more updates!`,
          `We're thrilled to share: ${aiPrompt} What do you think?`,
        ]);
      }
    } catch {
      setAiSuggestions([
        `Check out our latest update! ${aiPrompt} #business #growth`,
        `Exciting news! ${aiPrompt} Follow us for more updates!`,
        `We're thrilled to share: ${aiPrompt} What do you think?`,
      ]);
    } finally {
      setAiGenerating(false);
    }
  }

  function useSuggestion(suggestion: string) {
    setBody(suggestion);
    setShowAIModal(false);
    setAiPrompt('');
    setAiSuggestions([]);
  }

  async function handleSave(action: 'draft' | 'post' | 'schedule') {
    if (!user?.organization_id) return;
    if (selectedTargets.length === 0) {
      alert('Please select at least one account to post to');
      return;
    }
    if (!body.trim()) {
      alert('Please enter post content');
      return;
    }

    setSaving(true);

    try {
      let scheduledAtUtc: string | undefined;
      if (action === 'schedule' && scheduleDate && scheduleTime) {
        const localDate = new Date(`${scheduleDate}T${scheduleTime}`);
        scheduledAtUtc = localDate.toISOString();
      }

      const postData = {
        body,
        media,
        targets: selectedTargets,
        scheduledAtUtc: action === 'post' ? new Date().toISOString() : scheduledAtUtc,
        scheduledTimezone: scheduleTz,
        requiresApproval: action === 'schedule' && requiresApproval,
        firstComment: followUpComment || undefined,
        linkUrl: linkUrl || undefined,
        platformOptions,
        customizedPerChannel: customizePerChannel,
      };

      if (isEdit && id) {
        await updateSocialPost(id, postData);
      } else {
        const post = await createSocialPost(user.organization_id, user.id, postData);

        if (action === 'schedule' && requiresApproval && scheduledAtUtc) {
          await submitForApproval(post.id, scheduledAtUtc, scheduleTz);
        }
      }

      navigate('/marketing/social');
    } catch (error) {
      console.error('Failed to save post:', error);
      alert('Failed to save post');
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateGroup(name: string, accountIds: string[], description?: string) {
    if (!user?.organization_id) return;
    await createAccountGroup(user.organization_id, name, accountIds, user.id, description);
    const groupsData = await getAccountGroups(user.organization_id);
    setGroups(groupsData);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const selectedProviders = getSelectedProviders();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/marketing/social"
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-500" />
            </Link>
            <span className="text-sm text-gray-500">Back</span>
          </div>
          <h1 className="text-lg font-semibold text-gray-900">
            {isEdit ? 'Edit Post' : 'New Social Post'}
          </h1>
          <div className="w-24" />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-start justify-between gap-4 mb-6">
                <div className="flex-1">
                  <AccountSelector
                    accounts={accounts}
                    groups={groups}
                    selectedIds={selectedTargets}
                    onSelectionChange={setSelectedTargets}
                    onCreateGroup={() => setShowCreateGroupModal(true)}
                    onAddAccount={() => navigate('/settings/integrations')}
                  />
                </div>

                {selectedTargets.length > 0 && (
                  <label className="flex items-center gap-2 cursor-pointer whitespace-nowrap">
                    <div
                      className={`w-10 h-6 rounded-full transition-colors ${
                        customizePerChannel ? 'bg-blue-600' : 'bg-gray-200'
                      }`}
                      onClick={() => setCustomizePerChannel(!customizePerChannel)}
                    >
                      <div
                        className={`w-5 h-5 rounded-full bg-white shadow-sm transform transition-transform mt-0.5 ${
                          customizePerChannel ? 'translate-x-4.5 ml-0.5' : 'translate-x-0.5'
                        }`}
                      />
                    </div>
                    <span className="text-sm text-gray-600">Customize for each channel</span>
                  </label>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,video/*"
                onChange={handleFileSelect}
                className="hidden"
              />

              <ContentComposer
                value={body}
                onChange={setBody}
                followUpComment={followUpComment}
                onFollowUpChange={setFollowUpComment}
                showFollowUp={selectedProviders.some(p => ['facebook', 'instagram'].includes(p))}
                characterLimit={getLowestCharLimit()}
                platforms={selectedProviders}
                media={media}
                onMediaAdd={() => fileInputRef.current?.click()}
                onMediaRemove={removeMedia}
                onAIClick={() => setShowAIModal(true)}
                linkUrl={linkUrl}
                onLinkChange={setLinkUrl}
              />

              {selectedProviders.length > 0 && (
                <div className="mt-4">
                  <PlatformAdvancedOptions
                    platforms={selectedProviders}
                    options={platformOptions}
                    onChange={setPlatformOptions}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-2">
            <PostPreviewPanel
              accounts={accounts}
              selectedIds={selectedTargets}
              body={body}
              media={media}
              activeTab={activePreviewTab}
              onTabChange={setActivePreviewTab}
            />
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 py-4">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-end gap-3">
          <button
            onClick={() => handleSave('draft')}
            disabled={saving}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Save for later
          </button>

          <div className="relative">
            <div className="flex">
              <button
                onClick={() => {
                  if (showSchedulePanel) {
                    handleSave('schedule');
                  } else {
                    handleSave('post');
                  }
                }}
                disabled={saving || selectedTargets.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-l-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {showSchedulePanel ? 'Schedule' : 'Post'}
              </button>
              <button
                onClick={() => setShowPostDropdown(!showPostDropdown)}
                disabled={saving || selectedTargets.length === 0}
                className="px-2 py-2 bg-blue-600 text-white rounded-r-lg hover:bg-blue-700 transition-colors disabled:opacity-50 border-l border-blue-500"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>

            {showPostDropdown && (
              <div className="absolute bottom-full right-0 mb-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden z-50">
                <button
                  onClick={() => {
                    setShowSchedulePanel(false);
                    setShowPostDropdown(false);
                    handleSave('post');
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  Post Now
                </button>
                <button
                  onClick={() => {
                    setShowSchedulePanel(true);
                    setShowPostDropdown(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <Calendar className="w-4 h-4" />
                  Schedule
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {showSchedulePanel && (
        <div className="fixed bottom-20 right-4 bg-white border border-gray-200 rounded-xl shadow-lg p-4 w-80 z-40">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-gray-900">Schedule Post</h3>
            <button
              onClick={() => setShowSchedulePanel(false)}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">Time</label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">Timezone</label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <select
                  value={scheduleTz}
                  onChange={(e) => setScheduleTz(e.target.value)}
                  className="w-full pl-10 pr-8 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
                >
                  {TIMEZONES.map(tz => (
                    <option key={tz.value} value={tz.value}>{tz.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            <label className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                checked={requiresApproval}
                onChange={(e) => setRequiresApproval(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Requires approval before posting</span>
            </label>
          </div>
        </div>
      )}

      {showAIModal && (
        <AIGeneratorModal
          onClose={() => {
            setShowAIModal(false);
            setAiPrompt('');
            setAiSuggestions([]);
          }}
          prompt={aiPrompt}
          onPromptChange={setAiPrompt}
          suggestions={aiSuggestions}
          generating={aiGenerating}
          onGenerate={handleGenerateCaption}
          onUseSuggestion={useSuggestion}
        />
      )}

      {showCreateGroupModal && (
        <CreateGroupModal
          accounts={accounts}
          onClose={() => setShowCreateGroupModal(false)}
          onSave={handleCreateGroup}
        />
      )}

      {showPostDropdown && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowPostDropdown(false)}
        />
      )}
    </div>
  );
}

function AIGeneratorModal({
  onClose,
  prompt,
  onPromptChange,
  suggestions,
  generating,
  onGenerate,
  onUseSuggestion,
}: {
  onClose: () => void;
  prompt: string;
  onPromptChange: (value: string) => void;
  suggestions: string[];
  generating: boolean;
  onGenerate: () => void;
  onUseSuggestion: (suggestion: string) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-500" />
            <h2 className="text-lg font-semibold text-gray-900">
              AI Caption Generator
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              What is your post about?
            </label>
            <textarea
              value={prompt}
              onChange={(e) => onPromptChange(e.target.value)}
              placeholder="E.g., Announcing our new product launch, sharing tips for remote work, promoting our holiday sale..."
              className="w-full h-24 px-4 py-3 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <button
            onClick={onGenerate}
            disabled={generating || !prompt.trim()}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate Captions
              </>
            )}
          </button>

          {suggestions.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-700">Suggestions</h3>
              {suggestions.map((suggestion, idx) => (
                <div
                  key={idx}
                  className="p-4 border border-gray-200 rounded-lg hover:border-blue-200 hover:bg-blue-50 transition-colors"
                >
                  <p className="text-sm text-gray-800 mb-3">{suggestion}</p>
                  <button
                    onClick={() => onUseSuggestion(suggestion)}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Use this caption
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
