const FACEBOOK_APP_ID = import.meta.env.VITE_FACEBOOK_APP_ID || '';
const FACEBOOK_GRAPH_VERSION = 'v18.0';

export interface InstagramAccount {
  id: string;
  username: string;
  name: string;
  profile_picture_url?: string;
  followers_count?: number;
  connected_facebook_page_id: string;
}

export interface InstagramTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
}

export function getInstagramAuthUrl(
  stateToken: string,
  redirectUri: string
): string {
  const scopes = [
    'instagram_basic',
    'instagram_content_publish',
    'instagram_manage_insights',
    'pages_show_list',
    'pages_read_engagement',
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

export async function exchangeInstagramCode(
  code: string,
  redirectUri: string,
  appSecret: string
): Promise<InstagramTokenResponse> {
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
    throw new Error(error.error?.message || 'Failed to exchange Instagram code');
  }

  return response.json();
}

export async function getInstagramAccounts(
  accessToken: string
): Promise<InstagramAccount[]> {
  const pagesResponse = await fetch(
    `https://graph.facebook.com/${FACEBOOK_GRAPH_VERSION}/me/accounts?fields=id,name,instagram_business_account{id,username,name,profile_picture_url,followers_count}&access_token=${accessToken}`
  );

  if (!pagesResponse.ok) {
    const error = await pagesResponse.json();
    throw new Error(error.error?.message || 'Failed to get Instagram accounts');
  }

  const pagesData = await pagesResponse.json();
  const accounts: InstagramAccount[] = [];

  for (const page of pagesData.data || []) {
    if (page.instagram_business_account) {
      accounts.push({
        id: page.instagram_business_account.id,
        username: page.instagram_business_account.username,
        name: page.instagram_business_account.name || page.instagram_business_account.username,
        profile_picture_url: page.instagram_business_account.profile_picture_url,
        followers_count: page.instagram_business_account.followers_count,
        connected_facebook_page_id: page.id,
      });
    }
  }

  return accounts;
}

export async function getInstagramAccountInfo(
  instagramAccountId: string,
  accessToken: string
): Promise<InstagramAccount | null> {
  const response = await fetch(
    `https://graph.facebook.com/${FACEBOOK_GRAPH_VERSION}/${instagramAccountId}?fields=id,username,name,profile_picture_url,followers_count&access_token=${accessToken}`
  );

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  return {
    id: data.id,
    username: data.username,
    name: data.name || data.username,
    profile_picture_url: data.profile_picture_url,
    followers_count: data.followers_count,
    connected_facebook_page_id: '',
  };
}

export async function refreshInstagramToken(
  longLivedToken: string
): Promise<InstagramTokenResponse> {
  const params = new URLSearchParams({
    grant_type: 'ig_refresh_token',
    access_token: longLivedToken,
  });

  const response = await fetch(
    `https://graph.instagram.com/refresh_access_token?${params.toString()}`
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to refresh Instagram token');
  }

  return response.json();
}

export async function validateInstagramToken(accessToken: string): Promise<boolean> {
  try {
    const response = await fetch(
      `https://graph.facebook.com/${FACEBOOK_GRAPH_VERSION}/me?access_token=${accessToken}`
    );
    return response.ok;
  } catch {
    return false;
  }
}
