const FACEBOOK_APP_ID = import.meta.env.VITE_FACEBOOK_APP_ID || '';
const FACEBOOK_GRAPH_VERSION = 'v18.0';

export interface FacebookPage {
  id: string;
  name: string;
  access_token: string;
  picture?: { data?: { url?: string } };
}

export interface FacebookTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
}

export function getFacebookAuthUrl(
  stateToken: string,
  redirectUri: string
): string {
  const scopes = [
    'pages_show_list',
    'pages_read_engagement',
    'pages_manage_posts',
    'pages_read_user_content',
    'publish_video',
  ].join(',');

  const params = new URLSearchParams({
    client_id: FACEBOOK_APP_ID,
    redirect_uri: redirectUri,
    state: stateToken,
    scope: scopes,
    response_type: 'code',
  });

  return `https://www.facebook.com/${FACEBOOK_GRAPH_VERSION}/dialog/oauth?${params.toString()}`;
}

export async function exchangeFacebookCode(
  code: string,
  redirectUri: string,
  appSecret: string
): Promise<FacebookTokenResponse> {
  const params = new URLSearchParams({
    client_id: FACEBOOK_APP_ID,
    client_secret: appSecret,
    redirect_uri: redirectUri,
    code,
  });

  const response = await fetch(
    `https://graph.facebook.com/${FACEBOOK_GRAPH_VERSION}/oauth/access_token?${params.toString()}`
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to exchange Facebook code');
  }

  return response.json();
}

export async function getLongLivedToken(
  shortLivedToken: string,
  appSecret: string
): Promise<FacebookTokenResponse> {
  const params = new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: FACEBOOK_APP_ID,
    client_secret: appSecret,
    fb_exchange_token: shortLivedToken,
  });

  const response = await fetch(
    `https://graph.facebook.com/${FACEBOOK_GRAPH_VERSION}/oauth/access_token?${params.toString()}`
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to get long-lived token');
  }

  return response.json();
}

export async function getFacebookPages(accessToken: string): Promise<FacebookPage[]> {
  const response = await fetch(
    `https://graph.facebook.com/${FACEBOOK_GRAPH_VERSION}/me/accounts?fields=id,name,access_token,picture&access_token=${accessToken}`
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to get Facebook pages');
  }

  const data = await response.json();
  return data.data || [];
}

export async function getPageLongLivedToken(
  pageId: string,
  userAccessToken: string
): Promise<string> {
  const response = await fetch(
    `https://graph.facebook.com/${FACEBOOK_GRAPH_VERSION}/${pageId}?fields=access_token&access_token=${userAccessToken}`
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to get page token');
  }

  const data = await response.json();
  return data.access_token;
}

export async function refreshFacebookToken(
  refreshToken: string,
  appSecret: string
): Promise<FacebookTokenResponse | null> {
  return null;
}

export async function validateFacebookToken(accessToken: string): Promise<boolean> {
  try {
    const response = await fetch(
      `https://graph.facebook.com/${FACEBOOK_GRAPH_VERSION}/me?access_token=${accessToken}`
    );
    return response.ok;
  } catch {
    return false;
  }
}
