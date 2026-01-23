export * from './facebook';
export * from './instagram';
export * from './linkedin';
export * from './googleBusiness';
export * from './tiktok';
export * from './youtube';

import type { SocialProvider } from '../../types';

export function getOAuthUrl(
  provider: SocialProvider,
  stateToken: string,
  redirectUri: string
): string {
  switch (provider) {
    case 'facebook': {
      const { getFacebookAuthUrl } = require('./facebook');
      return getFacebookAuthUrl(stateToken, redirectUri);
    }
    case 'instagram': {
      const { getInstagramAuthUrl } = require('./instagram');
      return getInstagramAuthUrl(stateToken, redirectUri);
    }
    case 'linkedin': {
      const { getLinkedInAuthUrl } = require('./linkedin');
      return getLinkedInAuthUrl(stateToken, redirectUri);
    }
    case 'google_business': {
      const { getGoogleBusinessAuthUrl } = require('./googleBusiness');
      return getGoogleBusinessAuthUrl(stateToken, redirectUri);
    }
    case 'tiktok': {
      const { getTikTokAuthUrl } = require('./tiktok');
      return getTikTokAuthUrl(stateToken, redirectUri);
    }
    case 'youtube': {
      const { getYouTubeAuthUrl } = require('./youtube');
      return getYouTubeAuthUrl(stateToken, redirectUri);
    }
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

export const PROVIDER_SCOPES: Record<SocialProvider, string[]> = {
  facebook: ['pages_show_list', 'pages_read_engagement', 'pages_manage_posts', 'publish_video'],
  instagram: ['instagram_basic', 'instagram_content_publish', 'instagram_manage_insights'],
  linkedin: ['r_liteprofile', 'w_member_social', 'r_organization_social', 'w_organization_social'],
  google_business: ['https://www.googleapis.com/auth/business.manage'],
  tiktok: ['user.info.basic', 'video.publish', 'video.upload'],
  youtube: ['https://www.googleapis.com/auth/youtube', 'https://www.googleapis.com/auth/youtube.upload'],
};

export const PROVIDER_REFRESH_SUPPORT: Record<SocialProvider, boolean> = {
  facebook: false,
  instagram: true,
  linkedin: true,
  google_business: true,
  tiktok: true,
  youtube: true,
};

export const PROVIDER_TOKEN_LIFETIME_DAYS: Record<SocialProvider, number> = {
  facebook: 60,
  instagram: 60,
  linkedin: 365,
  google_business: 1,
  tiktok: 1,
  youtube: 1,
};
