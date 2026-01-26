import type {
  SocialProvider,
  Organization,
  PlatformCharacterLimits,
  PlatformHashtagGuidelines,
  AIHashtagPlacement
} from '../types';

export const PLATFORM_CHARACTER_LIMITS: PlatformCharacterLimits = {
  facebook: 63206,
  instagram: 2200,
  linkedin: 3000,
  tiktok: 2200,
  youtube: 5000,
  twitter: 280,
  google_business: 1500
};

export const PLATFORM_HASHTAG_GUIDELINES: Record<SocialProvider, PlatformHashtagGuidelines> = {
  facebook: {
    max_hashtags: 3,
    placement: 'inline',
    include_in_body: true
  },
  instagram: {
    max_hashtags: 30,
    placement: 'follow_comment',
    include_in_body: false
  },
  linkedin: {
    max_hashtags: 5,
    placement: 'inline',
    include_in_body: true
  },
  tiktok: {
    max_hashtags: 5,
    placement: 'inline',
    include_in_body: true
  },
  youtube: {
    max_hashtags: 15,
    placement: 'inline',
    include_in_body: true
  },
  google_business: {
    max_hashtags: 0,
    placement: 'inline',
    include_in_body: false
  }
};

export const PLATFORM_EMOJI_GUIDELINES: Record<SocialProvider, { recommended: boolean; max_count: number }> = {
  facebook: { recommended: true, max_count: 5 },
  instagram: { recommended: true, max_count: 10 },
  linkedin: { recommended: false, max_count: 2 },
  tiktok: { recommended: true, max_count: 8 },
  youtube: { recommended: true, max_count: 5 },
  google_business: { recommended: false, max_count: 1 }
};

export const PLATFORM_CTA_FORMATS: Record<SocialProvider, string[]> = {
  facebook: [
    'Learn more at [link]',
    'Click the link in bio',
    'Comment below!',
    'Share your thoughts',
    'Tag a friend who needs this'
  ],
  instagram: [
    'Link in bio!',
    'Tap the link in bio',
    'Double-tap if you agree',
    'Save this for later',
    'Share to your story'
  ],
  linkedin: [
    'Read the full article: [link]',
    'Connect with me to learn more',
    'Share your experience below',
    'What are your thoughts?',
    'Follow for more insights'
  ],
  tiktok: [
    'Follow for more!',
    'Link in bio',
    'Duet this video',
    'Comment your thoughts',
    'Share with a friend'
  ],
  youtube: [
    'Subscribe for more content',
    'Like and share this video',
    'Leave a comment below',
    'Check the description for links',
    'Turn on notifications'
  ],
  google_business: [
    'Call us today',
    'Visit us at [address]',
    'Book an appointment',
    'Learn more on our website',
    'Get directions'
  ]
};

export function getPlatformCharacterLimit(platform: SocialProvider): number {
  return PLATFORM_CHARACTER_LIMITS[platform] || 2000;
}

export function getPlatformHashtagPlacement(platform: SocialProvider): AIHashtagPlacement {
  return PLATFORM_HASHTAG_GUIDELINES[platform]?.placement || 'inline';
}

export function getPlatformHashtagMax(platform: SocialProvider): number {
  return PLATFORM_HASHTAG_GUIDELINES[platform]?.max_hashtags || 5;
}

export function getPlatformEmojiGuidelines(platform: SocialProvider): { recommended: boolean; max_count: number } {
  return PLATFORM_EMOJI_GUIDELINES[platform] || { recommended: true, max_count: 5 };
}

export function getPlatformCTAFormats(platform: SocialProvider): string[] {
  return PLATFORM_CTA_FORMATS[platform] || [];
}

export function shouldShowLocalizeOption(organization: Organization | null): boolean {
  if (!organization) return false;
  return !!(
    organization.business_city ||
    organization.business_state ||
    organization.business_country
  );
}

export function getOrganizationLocationString(organization: Organization | null): string {
  if (!organization) return '';

  const parts: string[] = [];
  if (organization.business_city) parts.push(organization.business_city);
  if (organization.business_state) parts.push(organization.business_state);
  if (organization.business_country) parts.push(organization.business_country);

  return parts.join(', ');
}

export interface PlatformContext {
  platform: SocialProvider;
  character_limit: number;
  hashtag_guidelines: PlatformHashtagGuidelines;
  emoji_guidelines: { recommended: boolean; max_count: number };
  cta_formats: string[];
}

export function buildPlatformContext(
  platform: SocialProvider
): PlatformContext {
  return {
    platform,
    character_limit: getPlatformCharacterLimit(platform),
    hashtag_guidelines: PLATFORM_HASHTAG_GUIDELINES[platform],
    emoji_guidelines: PLATFORM_EMOJI_GUIDELINES[platform],
    cta_formats: PLATFORM_CTA_FORMATS[platform]
  };
}

export function buildMultiPlatformContext(
  platforms: SocialProvider[]
): PlatformContext[] {
  return platforms.map(buildPlatformContext);
}

export function getLowestCharacterLimit(platforms: SocialProvider[]): number {
  if (platforms.length === 0) return 2000;
  return Math.min(...platforms.map(getPlatformCharacterLimit));
}

export function getContentLengthEstimate(
  length: 'short' | 'medium' | 'long',
  platform?: SocialProvider
): { min: number; max: number } {
  const platformLimit = platform ? getPlatformCharacterLimit(platform) : 2000;

  switch (length) {
    case 'short':
      return { min: 50, max: Math.min(100, platformLimit) };
    case 'medium':
      return { min: 100, max: Math.min(250, platformLimit) };
    case 'long':
      return { min: 250, max: Math.min(500, platformLimit) };
    default:
      return { min: 100, max: 250 };
  }
}

export function formatCharacterCount(current: number, limit: number): string {
  const remaining = limit - current;
  if (remaining < 0) {
    return `${Math.abs(remaining)} over limit`;
  }
  return `${remaining} remaining`;
}

export function isWithinCharacterLimit(content: string, platform: SocialProvider): boolean {
  return content.length <= getPlatformCharacterLimit(platform);
}

export function getPlatformDisplayName(platform: SocialProvider): string {
  const names: Record<SocialProvider, string> = {
    facebook: 'Facebook',
    instagram: 'Instagram',
    linkedin: 'LinkedIn',
    tiktok: 'TikTok',
    youtube: 'YouTube',
    google_business: 'Google Business'
  };
  return names[platform] || platform;
}

export function extractHashtags(content: string): string[] {
  const hashtagRegex = /#[\w\u0080-\uFFFF]+/g;
  const matches = content.match(hashtagRegex);
  return matches ? [...new Set(matches)] : [];
}

export function countHashtags(content: string): number {
  return extractHashtags(content).length;
}

export function removeHashtags(content: string): string {
  return content.replace(/#[\w\u0080-\uFFFF]+/g, '').replace(/\s+/g, ' ').trim();
}

export function appendHashtags(content: string, hashtags: string[]): string {
  const existingHashtags = extractHashtags(content);
  const newHashtags = hashtags.filter(h => !existingHashtags.includes(h));

  if (newHashtags.length === 0) return content;

  const formattedHashtags = newHashtags.map(h => h.startsWith('#') ? h : `#${h}`);
  return `${content.trim()}\n\n${formattedHashtags.join(' ')}`;
}
