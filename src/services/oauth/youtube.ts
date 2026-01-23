const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

export interface YouTubeChannel {
  id: string;
  title: string;
  description?: string;
  customUrl?: string;
  thumbnailUrl?: string;
  subscriberCount?: number;
  videoCount?: number;
  viewCount?: number;
}

export interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type: string;
}

export function getYouTubeAuthUrl(
  stateToken: string,
  redirectUri: string
): string {
  const scopes = [
    'openid',
    'profile',
    'email',
    'https://www.googleapis.com/auth/youtube',
    'https://www.googleapis.com/auth/youtube.upload',
    'https://www.googleapis.com/auth/youtube.readonly',
  ].join(' ');

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes,
    state: stateToken,
    access_type: 'offline',
    prompt: 'consent',
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeYouTubeCode(
  code: string,
  redirectUri: string,
  clientSecret: string
): Promise<GoogleTokenResponse> {
  const params = new URLSearchParams({
    code,
    client_id: GOOGLE_CLIENT_ID,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error_description || 'Failed to exchange YouTube code');
  }

  return response.json();
}

export async function refreshYouTubeToken(
  refreshToken: string,
  clientSecret: string
): Promise<GoogleTokenResponse> {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error_description || 'Failed to refresh YouTube token');
  }

  return response.json();
}

export async function getYouTubeChannels(accessToken: string): Promise<YouTubeChannel[]> {
  const response = await fetch(
    'https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&mine=true',
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to get YouTube channels');
  }

  const data = await response.json();

  return (data.items || []).map((item: Record<string, unknown>) => {
    const snippet = item.snippet as Record<string, unknown> | undefined;
    const statistics = item.statistics as Record<string, unknown> | undefined;
    const thumbnails = snippet?.thumbnails as Record<string, { url?: string }> | undefined;

    return {
      id: item.id as string,
      title: (snippet?.title as string) || '',
      description: snippet?.description as string | undefined,
      customUrl: snippet?.customUrl as string | undefined,
      thumbnailUrl: thumbnails?.default?.url,
      subscriberCount: statistics?.subscriberCount ? parseInt(statistics.subscriberCount as string, 10) : undefined,
      videoCount: statistics?.videoCount ? parseInt(statistics.videoCount as string, 10) : undefined,
      viewCount: statistics?.viewCount ? parseInt(statistics.viewCount as string, 10) : undefined,
    };
  });
}

export async function getYouTubeChannelById(
  accessToken: string,
  channelId: string
): Promise<YouTubeChannel | null> {
  const response = await fetch(
    `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channelId}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  const item = data.items?.[0];

  if (!item) return null;

  const snippet = item.snippet as Record<string, unknown> | undefined;
  const statistics = item.statistics as Record<string, unknown> | undefined;
  const thumbnails = snippet?.thumbnails as Record<string, { url?: string }> | undefined;

  return {
    id: item.id,
    title: (snippet?.title as string) || '',
    description: snippet?.description as string | undefined,
    customUrl: snippet?.customUrl as string | undefined,
    thumbnailUrl: thumbnails?.default?.url,
    subscriberCount: statistics?.subscriberCount ? parseInt(statistics.subscriberCount as string, 10) : undefined,
    videoCount: statistics?.videoCount ? parseInt(statistics.videoCount as string, 10) : undefined,
    viewCount: statistics?.viewCount ? parseInt(statistics.viewCount as string, 10) : undefined,
  };
}

export async function validateYouTubeToken(accessToken: string): Promise<boolean> {
  try {
    const response = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?access_token=${accessToken}`
    );
    return response.ok;
  } catch {
    return false;
  }
}

export interface YouTubeVideoUploadInit {
  uploadUrl: string;
  videoId?: string;
}

export async function initResumableUpload(
  accessToken: string,
  metadata: {
    title: string;
    description?: string;
    tags?: string[];
    categoryId?: string;
    privacyStatus?: 'public' | 'unlisted' | 'private';
  }
): Promise<YouTubeVideoUploadInit> {
  const response = await fetch(
    'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Upload-Content-Type': 'video/*',
      },
      body: JSON.stringify({
        snippet: {
          title: metadata.title,
          description: metadata.description || '',
          tags: metadata.tags || [],
          categoryId: metadata.categoryId || '22',
        },
        status: {
          privacyStatus: metadata.privacyStatus || 'private',
          selfDeclaredMadeForKids: false,
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to init YouTube upload');
  }

  const uploadUrl = response.headers.get('Location');
  if (!uploadUrl) {
    throw new Error('No upload URL returned from YouTube');
  }

  return { uploadUrl };
}
