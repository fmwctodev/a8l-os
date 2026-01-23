const LINKEDIN_CLIENT_ID = import.meta.env.VITE_LINKEDIN_CLIENT_ID || '';

export interface LinkedInProfile {
  id: string;
  localizedFirstName: string;
  localizedLastName: string;
  profilePicture?: {
    displayImage?: string;
  };
}

export interface LinkedInOrganization {
  id: string;
  localizedName: string;
  logoV2?: {
    original?: string;
  };
}

export interface LinkedInTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  scope: string;
}

export function getLinkedInAuthUrl(
  stateToken: string,
  redirectUri: string
): string {
  const scopes = [
    'r_liteprofile',
    'r_emailaddress',
    'w_member_social',
    'r_organization_social',
    'w_organization_social',
    'rw_organization_admin',
  ].join(' ');

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: LINKEDIN_CLIENT_ID,
    redirect_uri: redirectUri,
    state: stateToken,
    scope: scopes,
  });

  return `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
}

export async function exchangeLinkedInCode(
  code: string,
  redirectUri: string,
  clientSecret: string
): Promise<LinkedInTokenResponse> {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: LINKEDIN_CLIENT_ID,
    client_secret: clientSecret,
  });

  const response = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error_description || 'Failed to exchange LinkedIn code');
  }

  return response.json();
}

export async function refreshLinkedInToken(
  refreshToken: string,
  clientSecret: string
): Promise<LinkedInTokenResponse> {
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: LINKEDIN_CLIENT_ID,
    client_secret: clientSecret,
  });

  const response = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error_description || 'Failed to refresh LinkedIn token');
  }

  return response.json();
}

export async function getLinkedInProfile(accessToken: string): Promise<LinkedInProfile> {
  const response = await fetch(
    'https://api.linkedin.com/v2/me?projection=(id,localizedFirstName,localizedLastName,profilePicture(displayImage~:playableStreams))',
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to get LinkedIn profile');
  }

  const data = await response.json();

  let profilePictureUrl: string | undefined;
  if (data['profilePicture']?.['displayImage~']?.elements?.[0]?.identifiers?.[0]?.identifier) {
    profilePictureUrl = data['profilePicture']['displayImage~'].elements[0].identifiers[0].identifier;
  }

  return {
    id: data.id,
    localizedFirstName: data.localizedFirstName,
    localizedLastName: data.localizedLastName,
    profilePicture: profilePictureUrl ? { displayImage: profilePictureUrl } : undefined,
  };
}

export async function getLinkedInOrganizations(
  accessToken: string
): Promise<LinkedInOrganization[]> {
  const response = await fetch(
    'https://api.linkedin.com/v2/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&projection=(elements*(organization~(id,localizedName,logoV2(original~:playableStreams))))',
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0',
      },
    }
  );

  if (!response.ok) {
    return [];
  }

  const data = await response.json();
  const organizations: LinkedInOrganization[] = [];

  for (const element of data.elements || []) {
    if (element['organization~']) {
      const org = element['organization~'];
      let logoUrl: string | undefined;
      if (org.logoV2?.['original~']?.elements?.[0]?.identifiers?.[0]?.identifier) {
        logoUrl = org.logoV2['original~'].elements[0].identifiers[0].identifier;
      }

      organizations.push({
        id: org.id,
        localizedName: org.localizedName,
        logoV2: logoUrl ? { original: logoUrl } : undefined,
      });
    }
  }

  return organizations;
}

export async function validateLinkedInToken(accessToken: string): Promise<boolean> {
  try {
    const response = await fetch('https://api.linkedin.com/v2/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return response.ok;
  } catch {
    return false;
  }
}

export function getLinkedInUrn(type: 'person' | 'organization', id: string): string {
  return `urn:li:${type}:${id}`;
}
