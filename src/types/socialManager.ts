import type { SocialProvider } from './index';

export type SocialAIThreadStatus = 'active' | 'archived';
export type SocialAIMessageRole = 'user' | 'assistant' | 'system';
export type SocialAIMessageType =
  | 'text'
  | 'url_scrape'
  | 'youtube_transcript'
  | 'file_upload'
  | 'post_draft'
  | 'campaign_request'
  | 'image_suggestion';

export type SocialCampaignFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly';
export type SocialCampaignStatus = 'active' | 'paused' | 'completed';
export type HookStylePreset = 'question' | 'statistic' | 'story' | 'bold_claim' | 'educational';
export type EmojiFrequency = 'none' | 'minimal' | 'moderate' | 'heavy';

export interface PlatformDraft {
  platform: SocialProvider;
  hook: string;
  body: string;
  cta: string;
  hashtags: string[];
  visual_style_suggestion: string;
  engagement_prediction: number;
  character_count: number;
}

export interface SocialAIThread {
  id: string;
  organization_id: string;
  user_id: string;
  title: string;
  status: SocialAIThreadStatus;
  created_at: string;
  updated_at: string;
  last_message?: SocialAIMessage | null;
}

export interface SocialAIMessage {
  id: string;
  thread_id: string;
  role: SocialAIMessageRole;
  content: string;
  message_type: SocialAIMessageType;
  attachments: SocialAIAttachment[];
  generated_posts: PlatformDraft[] | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface SocialAIAttachment {
  type: 'url' | 'youtube' | 'file' | 'image';
  url?: string;
  filename?: string;
  title?: string;
  content?: string;
}

export interface SocialCampaign {
  id: string;
  organization_id: string;
  created_by: string;
  name: string;
  description: string;
  theme: string;
  frequency: SocialCampaignFrequency;
  platforms: SocialProvider[];
  content_type: string;
  hook_style_preset: HookStylePreset;
  approval_required: boolean;
  autopilot_mode: boolean;
  status: SocialCampaignStatus;
  next_generation_at: string | null;
  last_generated_at: string | null;
  post_count: number;
  created_at: string;
  updated_at: string;
}

export interface GuidelineBlock {
  content: string;
}

export interface SocialGuideline {
  id: string;
  organization_id: string;
  user_id: string | null;
  content_themes: GuidelineBlock[];
  image_style: GuidelineBlock[];
  writing_style: GuidelineBlock[];
  tone_preferences: TonePreferences;
  words_to_avoid: string[];
  hashtag_preferences: HashtagPreferences;
  cta_rules: string[];
  emoji_rules: EmojiRules;
  industry_positioning: string;
  visual_style_rules: string[];
  platform_tweaks: Record<string, PlatformTweak>;
  created_at: string;
  updated_at: string;
}

export interface TonePreferences {
  formality: number;
  friendliness: number;
  energy: number;
  confidence: number;
}

export interface HashtagPreferences {
  preferred: string[];
  banned: string[];
}

export interface EmojiRules {
  frequency: EmojiFrequency;
  banned: string[];
}

export interface PlatformTweak {
  tone_override?: string;
  additional_rules?: string;
  hashtag_limit?: number;
}

export interface SocialContentPattern {
  id: string;
  organization_id: string;
  post_id: string | null;
  hook_type: string;
  content_topic: string;
  hashtags_used: string[];
  visual_style: string;
  posting_hour: number;
  posting_day: number;
  engagement_rate: number;
  reach: number;
  clicks: number;
  platform: string;
  analyzed_at: string | null;
  created_at: string;
}

export interface SocialCampaignFilters {
  status?: SocialCampaignStatus[];
  search?: string;
}

export interface ChatSendMessageParams {
  threadId: string;
  content: string;
  messageType?: SocialAIMessageType;
  attachments?: SocialAIAttachment[];
}
