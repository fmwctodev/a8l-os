import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Image,
  Video,
  Calendar,
  Clock,
  Send,
  Save,
  Sparkles,
  X,
  Upload,
  Trash2,
  AlertCircle,
  CheckCircle,
  Facebook,
  Instagram,
  Linkedin,
  Youtube,
  MapPin,
  Music2,
  Link as LinkIcon,
  MessageSquare,
  Eye,
  Loader2,
  Globe,
  ChevronDown,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getSocialAccounts } from '../../services/socialAccounts';
import {
  createSocialPost,
  updateSocialPost,
  getSocialPostById,
  getCharacterLimits,
  getMediaRequirements,
} from '../../services/socialPosts';
import type { SocialAccount, SocialPost, SocialProvider, SocialPostMedia } from '../../types';

const PROVIDER_ICONS: Record<SocialProvider, React.ElementType> = {
  facebook: Facebook,
  instagram: Instagram,
  linkedin: Linkedin,
  google_business: MapPin,
  tiktok: Music2,
  youtube: Youtube,
};

const PROVIDER_COLORS: Record<SocialProvider, string> = {
  facebook: '#1877F2',
  instagram: '#E4405F',
  linkedin: '#0A66C2',
  google_business: '#4285F4',
  tiktok: '#000000',
  youtube: '#FF0000',
};

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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [body, setBody] = useState('');
  const [firstComment, setFirstComment] = useState('');
  const [media, setMedia] = useState<SocialPostMedia[]>([]);
  const [selectedTargets, setSelectedTargets] = useState<string[]>([]);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [scheduleTz, setScheduleTz] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [showLinkInput, setShowLinkInput] = useState(false);

  const [showAIModal, setShowAIModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);

  const [activePreview, setActivePreview] = useState<SocialProvider | null>(null);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});

  const isEdit = !!id;
  const characterLimits = getCharacterLimits();
  const mediaRequirements = getMediaRequirements();

  useEffect(() => {
    loadData();
  }, [user?.organization_id, id]);

  async function loadData() {
    if (!user?.organization_id) return;

    try {
      setLoading(true);
      const accountsData = await getSocialAccounts(user.organization_id);
      setAccounts(accountsData.filter(a => a.status === 'connected'));

      if (id) {
        const post = await getSocialPostById(id);
        if (post) {
          setBody(post.body);
          setFirstComment(post.first_comment || '');
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
            setShowLinkInput(true);
          }
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
    if (selectedProviders.length === 0) return 63206;
    return Math.min(...selectedProviders.map(p => characterLimits[p]?.text || 63206));
  }

  function toggleTarget(accountId: string) {
    setSelectedTargets(prev =>
      prev.includes(accountId)
        ? prev.filter(id => id !== accountId)
        : [...prev, accountId]
    );
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
        status: 'pending',
      };

      newMedia.push(mediaItem);

      simulateUpload(mediaItem.id);
    }

    setMedia(prev => [...prev, ...newMedia]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function simulateUpload(mediaId: string) {
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 30;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        setMedia(prev =>
          prev.map(m =>
            m.id === mediaId ? { ...m, status: 'uploaded' as const } : m
          )
        );
      }
      setUploadProgress(prev => ({ ...prev, [mediaId]: Math.min(progress, 100) }));
    }, 300);
  }

  function removeMedia(mediaId: string) {
    setMedia(prev => prev.filter(m => m.id !== mediaId));
    setUploadProgress(prev => {
      const newProgress = { ...prev };
      delete newProgress[mediaId];
      return newProgress;
    });
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

  async function handleSave(publish: boolean) {
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
      if (scheduleDate && scheduleTime) {
        const localDate = new Date(`${scheduleDate}T${scheduleTime}`);
        scheduledAtUtc = localDate.toISOString();
      }

      const postData = {
        body,
        media,
        targets: selectedTargets,
        scheduledAtUtc: publish ? scheduledAtUtc : undefined,
        scheduledTimezone: scheduleTz,
        requiresApproval,
        firstComment: firstComment || undefined,
        linkUrl: linkUrl || undefined,
      };

      if (isEdit && id) {
        await updateSocialPost(id, postData);
      } else {
        await createSocialPost(user.organization_id, user.id, postData);
      }

      navigate('/marketing/social');
    } catch (error) {
      console.error('Failed to save post:', error);
      alert('Failed to save post');
    } finally {
      setSaving(false);
    }
  }

  const showFirstComment = getSelectedProviders().some(p =>
    ['facebook', 'instagram'].includes(p)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-rose-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to="/marketing/social"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </Link>
          <div>
            <h1 className="text-2xl font-semibold text-white">
              {isEdit ? 'Edit Post' : 'Create Post'}
            </h1>
            <p className="text-sm text-gray-500">
              Compose and schedule your social media content
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleSave(false)}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            Save Draft
          </button>
          <button
            onClick={() => handleSave(true)}
            disabled={saving || selectedTargets.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : scheduleDate ? (
              <Calendar className="w-4 h-4" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            {scheduleDate ? 'Schedule' : 'Publish Now'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-gray-900">Content</h2>
              <button
                onClick={() => setShowAIModal(true)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-rose-600 bg-rose-50 rounded-lg hover:bg-rose-100 transition-colors"
              >
                <Sparkles className="w-4 h-4" />
                AI Caption
              </button>
            </div>

            <div className="relative">
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="What do you want to share?"
                className="w-full h-40 px-4 py-3 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
              />
              <div className="absolute bottom-3 right-3 text-sm">
                <span className={body.length > getLowestCharLimit() ? 'text-red-500' : 'text-gray-400'}>
                  {body.length}
                </span>
                <span className="text-gray-300"> / {getLowestCharLimit()}</span>
              </div>
            </div>

            {getSelectedProviders().length > 1 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {getSelectedProviders().map(provider => {
                  const limit = characterLimits[provider]?.text || 0;
                  const isOver = body.length > limit;
                  return (
                    <span
                      key={provider}
                      className={`text-xs px-2 py-1 rounded-full ${
                        isOver ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {provider}: {body.length}/{limit}
                    </span>
                  );
                })}
              </div>
            )}

            {showFirstComment && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <MessageSquare className="w-4 h-4 inline mr-1" />
                  First Comment (Instagram/Facebook)
                </label>
                <textarea
                  value={firstComment}
                  onChange={(e) => setFirstComment(e.target.value)}
                  placeholder="Add hashtags or additional content as a first comment..."
                  className="w-full h-20 px-4 py-3 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent text-sm"
                />
              </div>
            )}

            <div className="mt-4 flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,video/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-3 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <Image className="w-4 h-4" />
                Add Media
              </button>
              <button
                onClick={() => setShowLinkInput(!showLinkInput)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                  showLinkInput
                    ? 'bg-rose-100 text-rose-600'
                    : 'text-gray-600 bg-gray-100 hover:bg-gray-200'
                }`}
              >
                <LinkIcon className="w-4 h-4" />
                Add Link
              </button>
            </div>

            {showLinkInput && (
              <div className="mt-3">
                <input
                  type="url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                />
              </div>
            )}

            {media.length > 0 && (
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                {media.map((item) => (
                  <div key={item.id} className="relative group">
                    {item.type === 'video' ? (
                      <div className="aspect-square bg-gray-900 rounded-lg flex items-center justify-center">
                        <Video className="w-8 h-8 text-white" />
                      </div>
                    ) : (
                      <img
                        src={item.url}
                        alt={item.filename}
                        className="aspect-square object-cover rounded-lg"
                      />
                    )}
                    {item.status === 'pending' && (
                      <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                        <div className="w-3/4">
                          <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-rose-500 transition-all"
                              style={{ width: `${uploadProgress[item.id] || 0}%` }}
                            />
                          </div>
                          <div className="text-center text-white text-xs mt-1">
                            {Math.round(uploadProgress[item.id] || 0)}%
                          </div>
                        </div>
                      </div>
                    )}
                    <button
                      onClick={() => removeMedia(item.id)}
                      className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    {item.type === 'video' && (
                      <span className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-black/50 text-white text-xs rounded">
                        Video
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="mt-3 text-xs text-gray-400">
              Max file size: 100MB. Supported: Images (JPG, PNG, GIF, WebP), Videos (MP4, MOV)
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Schedule</h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="date"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Time
                </label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Timezone
                </label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <select
                    value={scheduleTz}
                    onChange={(e) => setScheduleTz(e.target.value)}
                    className="w-full pl-10 pr-8 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent appearance-none"
                  >
                    {TIMEZONES.map(tz => (
                      <option key={tz.value} value={tz.value}>{tz.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>
            </div>

            <div className="mt-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={requiresApproval}
                  onChange={(e) => setRequiresApproval(e.target.checked)}
                  className="rounded border-gray-300 text-rose-600 focus:ring-rose-500"
                />
                <span className="text-sm text-gray-700">
                  Requires approval before posting
                </span>
              </label>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">
              Post To ({selectedTargets.length} selected)
            </h2>

            {accounts.length === 0 ? (
              <div className="text-center py-6">
                <AlertCircle className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500 mb-3">
                  No connected accounts
                </p>
                <Link
                  to="/marketing/social"
                  className="text-sm text-rose-600 hover:text-rose-700"
                >
                  Connect accounts
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {accounts.map((account) => {
                  const Icon = PROVIDER_ICONS[account.provider];
                  const color = PROVIDER_COLORS[account.provider];
                  const isSelected = selectedTargets.includes(account.id);

                  return (
                    <button
                      key={account.id}
                      onClick={() => toggleTarget(account.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-colors ${
                        isSelected
                          ? 'border-rose-500 bg-rose-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div
                        className="p-2 rounded-lg"
                        style={{ backgroundColor: color + '20' }}
                      >
                        <Icon className="w-5 h-5" style={{ color }} />
                      </div>
                      <div className="flex-1 text-left">
                        <div className="font-medium text-gray-900 text-sm">
                          {account.display_name}
                        </div>
                        <div className="text-xs text-gray-500 capitalize">
                          {account.provider.replace('_', ' ')}
                        </div>
                      </div>
                      {isSelected && (
                        <CheckCircle className="w-5 h-5 text-rose-500" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-gray-900">Preview</h2>
              <button
                onClick={() => setActivePreview(null)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                <Eye className="w-4 h-4" />
              </button>
            </div>

            {selectedTargets.length === 0 ? (
              <div className="text-center py-6 text-gray-400 text-sm">
                Select accounts to preview
              </div>
            ) : (
              <div>
                <div className="flex gap-1 mb-4 overflow-x-auto pb-2">
                  {getSelectedProviders().map(provider => {
                    const Icon = PROVIDER_ICONS[provider];
                    const color = PROVIDER_COLORS[provider];
                    const isActive = activePreview === provider;

                    return (
                      <button
                        key={provider}
                        onClick={() => setActivePreview(provider)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-colors ${
                          isActive
                            ? 'text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                        style={isActive ? { backgroundColor: color } : {}}
                      >
                        <Icon className="w-3 h-3" />
                        {provider.replace('_', ' ')}
                      </button>
                    );
                  })}
                </div>

                <PostPreview
                  provider={activePreview || getSelectedProviders()[0]}
                  body={body}
                  media={media}
                  account={accounts.find(a =>
                    a.provider === (activePreview || getSelectedProviders()[0])
                  )}
                />
              </div>
            )}
          </div>
        </div>
      </div>

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
    </div>
  );
}

function PostPreview({
  provider,
  body,
  media,
  account,
}: {
  provider: SocialProvider;
  body: string;
  media: SocialPostMedia[];
  account?: SocialAccount;
}) {
  const Icon = PROVIDER_ICONS[provider];
  const color = PROVIDER_COLORS[provider];

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="p-3 border-b border-gray-100 flex items-center gap-2">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center"
          style={{ backgroundColor: color + '20' }}
        >
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
        <div>
          <div className="font-medium text-sm text-gray-900">
            {account?.display_name || 'Account Name'}
          </div>
          <div className="text-xs text-gray-400">Just now</div>
        </div>
      </div>

      <div className="p-3">
        <p className="text-sm text-gray-800 whitespace-pre-wrap">
          {body || 'Your post content will appear here...'}
        </p>
      </div>

      {media.length > 0 && (
        <div className={`${media.length === 1 ? '' : 'grid grid-cols-2 gap-0.5'}`}>
          {media.slice(0, 4).map((item, idx) => (
            <div key={item.id} className="relative aspect-square bg-gray-100">
              {item.type === 'video' ? (
                <div className="w-full h-full flex items-center justify-center bg-gray-900">
                  <Video className="w-8 h-8 text-white" />
                </div>
              ) : (
                <img
                  src={item.url}
                  alt=""
                  className="w-full h-full object-cover"
                />
              )}
              {idx === 3 && media.length > 4 && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <span className="text-white font-bold text-xl">
                    +{media.length - 4}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="p-3 border-t border-gray-100 flex items-center justify-between text-gray-400">
        <div className="flex items-center gap-4 text-xs">
          <span>Like</span>
          <span>Comment</span>
          <span>Share</span>
        </div>
      </div>
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
            <Sparkles className="w-5 h-5 text-rose-500" />
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
              className="w-full h-24 px-4 py-3 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
            />
          </div>

          <button
            onClick={onGenerate}
            disabled={generating || !prompt.trim()}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors disabled:opacity-50"
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
                  className="p-4 border border-gray-200 rounded-lg hover:border-rose-200 hover:bg-rose-50 transition-colors"
                >
                  <p className="text-sm text-gray-800 mb-3">{suggestion}</p>
                  <button
                    onClick={() => onUseSuggestion(suggestion)}
                    className="text-sm text-rose-600 hover:text-rose-700 font-medium"
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
