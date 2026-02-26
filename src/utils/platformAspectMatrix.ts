export const PLATFORM_RATIOS: Record<string, Record<string, string>> = {
  tiktok: { default: '9:16', story: '9:16' },
  instagram: { default: '1:1', reel: '9:16', story: '9:16', feed: '1:1', carousel: '1:1' },
  youtube: { default: '16:9', short: '9:16' },
  facebook: { default: '1:1', reel: '9:16', story: '9:16' },
  linkedin: { default: '1:1', article: '16:9' },
  twitter: { default: '16:9' },
  google_business: { default: '16:9' },
};

export const VALID_RATIOS = ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '10:16', '16:10'];

export function getRequiredAspectRatio(
  platform: string,
  contentFormat?: string
): string {
  const platformMap = PLATFORM_RATIOS[platform];
  if (!platformMap) return '16:9';

  if (contentFormat && platformMap[contentFormat]) {
    return platformMap[contentFormat];
  }

  return platformMap.default || '16:9';
}

export function validateAspectRatio(
  ratio: string,
  platform: string,
  contentFormat?: string
): { valid: boolean; recommended: string } {
  const recommended = getRequiredAspectRatio(platform, contentFormat);
  return {
    valid: ratio === recommended,
    recommended,
  };
}

export function getPlatformLabel(platform: string): string {
  const labels: Record<string, string> = {
    tiktok: 'TikTok',
    instagram: 'Instagram',
    youtube: 'YouTube',
    facebook: 'Facebook',
    linkedin: 'LinkedIn',
    twitter: 'X (Twitter)',
    google_business: 'Google Business',
  };
  return labels[platform] || platform;
}
