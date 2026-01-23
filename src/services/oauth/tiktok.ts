const TIKTOK_CLIENT_KEY = import.meta.env.VITE_TIKTOK_CLIENT_KEY || '';

export interface TikTokUser {
  open_id: string;
  union_id?: string;
  avatar_url?: string;
  avatar_url_100?: string;
  avatar_large_url?: string;
  display_name: string;
  bio_description?: string;
  profile_deep_link?: string;
  is_verified?: boolean;
  follower_count?: number;
  following_count?: number;
  likes_count?: number;
  video_count?: number;
}

export interface TikTokTokenResponse {
  access_token: string;
  expires_in: number;
  open_id: string;
  refresh_token: string;
  refresh_expires_in: number;
  scope: string;
  token_type: string;
}

export function getTikTokAuthUrl(
  stateToken: string,
  redirectUri: string
): string {
  const scopes = [
    'user.info.basic',
    'video.publish',
    'video.upload',
  ].join(',');

  const params = new URLSearchParams({
    client_key: TIKTOK_CLIENT_KEY,
    redirect_uri: redirectUri,
    state: stateToken,
    scope: scopes,
    response_type: 'code',
  });

  return `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`;
}

export async function exchangeTikTokCode(
  code: string,
  redirectUri: string,
  clientSecret: string
): Promise<TikTokTokenResponse> {
  const params = new URLSearchParams({
    client_key: TIKTOK_CLIENT_KEY,
    client_secret: clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  });

  const response = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error_description || error.error || 'Failed to exchange TikTok code');
  }

  return response.json();
}

export async function refreshTikTokToken(
  refreshToken: string,
  clientSecret: string
): Promise<TikTokTokenResponse> {
  const params = new URLSearchParams({
    client_key: TIKTOK_CLIENT_KEY,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const response = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error_description || error.error || 'Failed to refresh TikTok token');
  }

  return response.json();
}

export async function getTikTokUserInfo(accessToken: string): Promise<TikTokUser> {
  const fields = [
    'open_id',
    'union_id',
    'avatar_url',
    'avatar_url_100',
    'avatar_large_url',
    'display_name',
    'bio_description',
    'profile_deep_link',
    'is_verified',
    'follower_count',
    'following_count',
    'likes_count',
    'video_count',
  ].join(',');

  const response = await fetch(
    `https://open.tiktokapis.com/v2/user/info/?fields=${fields}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to get TikTok user info');
  }

  const data = await response.json();
  return data.data.user;
}

export async function revokeTikTokToken(
  accessToken: string,
  clientSecret: string
): Promise<void> {
  const params = new URLSearchParams({
    client_key: TIKTOK_CLIENT_KEY,
    client_secret: clientSecret,
    token: accessToken,
  });

  const response = await fetch('https://open.tiktokapis.com/v2/oauth/revoke/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error_description || 'Failed to revoke TikTok token');
  }
}

export async function validateTikTokToken(accessToken: string): Promise<boolean> {
  try {
    const response = await fetch(
      'https://open.tiktokapis.com/v2/user/info/?fields=open_id',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    return response.ok;
  } catch {
    return false;
  }
}

export interface TikTokVideoUploadInit {
  upload_url: string;
  publish_id: string;
}

export async function initVideoUpload(
  accessToken: string,
  videoSize: number
): Promise<TikTokVideoUploadInit> {
  const response = await fetch(
    'https://open.tiktokapis.com/v2/post/publish/video/init/',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        post_info: {
          title: '',
          privacy_level: 'SELF_ONLY',
          disable_duet: false,
          disable_comment: false,
          disable_stitch: false,
        },
        source_info: {
          source: 'FILE_UPLOAD',
          video_size: videoSize,
          chunk_size: videoSize,
          total_chunk_count: 1,
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to init TikTok video upload');
  }

  const data = await response.json();
  return {
    upload_url: data.data.upload_url,
    publish_id: data.data.publish_id,
  };
}
