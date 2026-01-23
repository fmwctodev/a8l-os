const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

export interface GoogleBusinessLocation {
  name: string;
  locationName: string;
  title: string;
  primaryPhone?: string;
  address?: {
    addressLines?: string[];
    locality?: string;
    administrativeArea?: string;
    postalCode?: string;
    regionCode?: string;
  };
  websiteUri?: string;
  primaryCategory?: {
    displayName?: string;
  };
}

export interface GoogleBusinessAccount {
  name: string;
  accountName: string;
  type: string;
}

export interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type: string;
}

export function getGoogleBusinessAuthUrl(
  stateToken: string,
  redirectUri: string
): string {
  const scopes = [
    'openid',
    'profile',
    'email',
    'https://www.googleapis.com/auth/business.manage',
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

export async function exchangeGoogleBusinessCode(
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
    throw new Error(error.error_description || 'Failed to exchange Google code');
  }

  return response.json();
}

export async function refreshGoogleBusinessToken(
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
    throw new Error(error.error_description || 'Failed to refresh Google token');
  }

  return response.json();
}

export async function getGoogleBusinessAccounts(
  accessToken: string
): Promise<GoogleBusinessAccount[]> {
  const response = await fetch(
    'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to get Google Business accounts');
  }

  const data = await response.json();
  return data.accounts || [];
}

export async function getGoogleBusinessLocations(
  accessToken: string,
  accountName: string
): Promise<GoogleBusinessLocation[]> {
  const response = await fetch(
    `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations?readMask=name,title,primaryPhone,websiteUri,primaryCategory`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to get Google Business locations');
  }

  const data = await response.json();
  return data.locations || [];
}

export async function validateGoogleBusinessToken(accessToken: string): Promise<boolean> {
  try {
    const response = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?access_token=${accessToken}`
    );
    return response.ok;
  } catch {
    return false;
  }
}

export function extractLocationId(locationName: string): string {
  const parts = locationName.split('/');
  return parts[parts.length - 1];
}

export function extractAccountId(accountName: string): string {
  const parts = accountName.split('/');
  return parts[parts.length - 1];
}
