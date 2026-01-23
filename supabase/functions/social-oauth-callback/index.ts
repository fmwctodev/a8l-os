import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type SocialProvider = "facebook" | "instagram" | "linkedin" | "google_business" | "tiktok" | "youtube";

interface OAuthState {
  id: string;
  organization_id: string;
  user_id: string;
  provider: SocialProvider;
  state_token: string;
  redirect_uri: string;
  meta: Record<string, unknown>;
}

interface TokenResult {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  tokenMeta?: Record<string, unknown>;
}

interface AccountInfo {
  externalAccountId: string;
  displayName: string;
  profileImageUrl?: string;
  accountType: string;
}

const FACEBOOK_APP_ID = Deno.env.get("FACEBOOK_APP_ID") || "";
const FACEBOOK_APP_SECRET = Deno.env.get("FACEBOOK_APP_SECRET") || "";
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID") || "";
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET") || "";
const LINKEDIN_CLIENT_ID = Deno.env.get("LINKEDIN_CLIENT_ID") || "";
const LINKEDIN_CLIENT_SECRET = Deno.env.get("LINKEDIN_CLIENT_SECRET") || "";
const TIKTOK_CLIENT_KEY = Deno.env.get("TIKTOK_CLIENT_KEY") || "";
const TIKTOK_CLIENT_SECRET = Deno.env.get("TIKTOK_CLIENT_SECRET") || "";

async function exchangeFacebookCode(code: string, redirectUri: string): Promise<TokenResult> {
  const params = new URLSearchParams({
    client_id: FACEBOOK_APP_ID,
    client_secret: FACEBOOK_APP_SECRET,
    redirect_uri: redirectUri,
    code,
  });

  const response = await fetch(`https://graph.facebook.com/v18.0/oauth/access_token?${params}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to exchange Facebook code");
  }

  const data = await response.json();

  const llParams = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: FACEBOOK_APP_ID,
    client_secret: FACEBOOK_APP_SECRET,
    fb_exchange_token: data.access_token,
  });

  const llResponse = await fetch(`https://graph.facebook.com/v18.0/oauth/access_token?${llParams}`);
  const llData = llResponse.ok ? await llResponse.json() : data;

  return {
    accessToken: llData.access_token || data.access_token,
    expiresIn: llData.expires_in || data.expires_in,
  };
}

async function getFacebookPages(accessToken: string): Promise<AccountInfo[]> {
  const response = await fetch(
    `https://graph.facebook.com/v18.0/me/accounts?fields=id,name,access_token,picture&access_token=${accessToken}`
  );

  if (!response.ok) return [];

  const data = await response.json();
  return (data.data || []).map((page: Record<string, unknown>) => ({
    externalAccountId: page.id as string,
    displayName: page.name as string,
    profileImageUrl: (page.picture as Record<string, Record<string, string>>)?.data?.url,
    accountType: "page",
    pageAccessToken: page.access_token,
  }));
}

async function exchangeInstagramCode(code: string, redirectUri: string): Promise<TokenResult> {
  return exchangeFacebookCode(code, redirectUri);
}

async function getInstagramAccounts(accessToken: string): Promise<AccountInfo[]> {
  const response = await fetch(
    `https://graph.facebook.com/v18.0/me/accounts?fields=id,name,instagram_business_account{id,username,name,profile_picture_url}&access_token=${accessToken}`
  );

  if (!response.ok) return [];

  const data = await response.json();
  const accounts: AccountInfo[] = [];

  for (const page of data.data || []) {
    if (page.instagram_business_account) {
      accounts.push({
        externalAccountId: page.instagram_business_account.id,
        displayName: page.instagram_business_account.username || page.instagram_business_account.name,
        profileImageUrl: page.instagram_business_account.profile_picture_url,
        accountType: "business",
      });
    }
  }

  return accounts;
}

async function exchangeLinkedInCode(code: string, redirectUri: string): Promise<TokenResult> {
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: LINKEDIN_CLIENT_ID,
    client_secret: LINKEDIN_CLIENT_SECRET,
  });

  const response = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error_description || "Failed to exchange LinkedIn code");
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
}

async function getLinkedInProfile(accessToken: string): Promise<AccountInfo> {
  const response = await fetch("https://api.linkedin.com/v2/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error("Failed to get LinkedIn profile");
  }

  const data = await response.json();
  return {
    externalAccountId: data.id,
    displayName: `${data.localizedFirstName} ${data.localizedLastName}`,
    accountType: "profile",
  };
}

async function exchangeGoogleCode(code: string, redirectUri: string): Promise<TokenResult> {
  const params = new URLSearchParams({
    code,
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error_description || "Failed to exchange Google code");
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
}

async function getGoogleBusinessLocations(accessToken: string): Promise<AccountInfo[]> {
  const accountsResponse = await fetch(
    "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!accountsResponse.ok) return [];

  const accountsData = await accountsResponse.json();
  const accounts: AccountInfo[] = [];

  for (const account of accountsData.accounts || []) {
    const locationsResponse = await fetch(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations?readMask=name,title`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (locationsResponse.ok) {
      const locationsData = await locationsResponse.json();
      for (const location of locationsData.locations || []) {
        accounts.push({
          externalAccountId: location.name,
          displayName: location.title || location.name,
          accountType: "location",
        });
      }
    }
  }

  return accounts;
}

async function getYouTubeChannels(accessToken: string): Promise<AccountInfo[]> {
  const response = await fetch(
    "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!response.ok) return [];

  const data = await response.json();
  return (data.items || []).map((item: Record<string, unknown>) => {
    const snippet = item.snippet as Record<string, unknown>;
    const thumbnails = snippet?.thumbnails as Record<string, Record<string, string>>;
    return {
      externalAccountId: item.id as string,
      displayName: snippet?.title as string || "YouTube Channel",
      profileImageUrl: thumbnails?.default?.url,
      accountType: "channel",
    };
  });
}

async function exchangeTikTokCode(code: string, redirectUri: string): Promise<TokenResult> {
  const params = new URLSearchParams({
    client_key: TIKTOK_CLIENT_KEY,
    client_secret: TIKTOK_CLIENT_SECRET,
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  });

  const response = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error_description || "Failed to exchange TikTok code");
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
    tokenMeta: { open_id: data.open_id },
  };
}

async function getTikTokUser(accessToken: string): Promise<AccountInfo> {
  const response = await fetch(
    "https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url",
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!response.ok) {
    throw new Error("Failed to get TikTok user info");
  }

  const data = await response.json();
  const user = data.data?.user || {};
  return {
    externalAccountId: user.open_id,
    displayName: user.display_name || "TikTok User",
    profileImageUrl: user.avatar_url,
    accountType: "profile",
  };
}

function simpleEncrypt(text: string): string {
  return Buffer.from(text).toString("base64");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");
    const errorDescription = url.searchParams.get("error_description");

    if (error) {
      console.error("OAuth error:", error, errorDescription);
      return new Response(null, {
        status: 302,
        headers: { Location: `/marketing/social?error=${encodeURIComponent(errorDescription || error)}` },
      });
    }

    if (!code || !state) {
      return new Response(
        JSON.stringify({ error: "Missing code or state parameter" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: oauthState, error: stateError } = await supabase
      .from("social_oauth_states")
      .select("*")
      .eq("state_token", state)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (stateError || !oauthState) {
      return new Response(null, {
        status: 302,
        headers: { Location: `/marketing/social?error=${encodeURIComponent("Invalid or expired OAuth state")}` },
      });
    }

    const typedState = oauthState as OAuthState;
    const provider = typedState.provider;
    const callbackUrl = `${supabaseUrl}/functions/v1/social-oauth-callback`;

    let tokenResult: TokenResult;
    let accounts: AccountInfo[] = [];

    switch (provider) {
      case "facebook": {
        tokenResult = await exchangeFacebookCode(code, callbackUrl);
        accounts = await getFacebookPages(tokenResult.accessToken);
        break;
      }
      case "instagram": {
        tokenResult = await exchangeInstagramCode(code, callbackUrl);
        accounts = await getInstagramAccounts(tokenResult.accessToken);
        break;
      }
      case "linkedin": {
        tokenResult = await exchangeLinkedInCode(code, callbackUrl);
        const profile = await getLinkedInProfile(tokenResult.accessToken);
        accounts = [profile];
        break;
      }
      case "google_business": {
        tokenResult = await exchangeGoogleCode(code, callbackUrl);
        accounts = await getGoogleBusinessLocations(tokenResult.accessToken);
        break;
      }
      case "youtube": {
        tokenResult = await exchangeGoogleCode(code, callbackUrl);
        accounts = await getYouTubeChannels(tokenResult.accessToken);
        break;
      }
      case "tiktok": {
        tokenResult = await exchangeTikTokCode(code, callbackUrl);
        const tikTokUser = await getTikTokUser(tokenResult.accessToken);
        accounts = [tikTokUser];
        break;
      }
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }

    if (accounts.length === 0) {
      return new Response(null, {
        status: 302,
        headers: { Location: `/marketing/social?error=${encodeURIComponent("No accounts found for this provider")}` },
      });
    }

    const tokenExpiry = tokenResult.expiresIn
      ? new Date(Date.now() + tokenResult.expiresIn * 1000).toISOString()
      : null;

    for (const account of accounts) {
      const { error: upsertError } = await supabase
        .from("social_accounts")
        .upsert({
          organization_id: typedState.organization_id,
          provider,
          external_account_id: account.externalAccountId,
          display_name: account.displayName,
          profile_image_url: account.profileImageUrl || null,
          access_token_encrypted: simpleEncrypt(tokenResult.accessToken),
          refresh_token_encrypted: tokenResult.refreshToken ? simpleEncrypt(tokenResult.refreshToken) : null,
          token_expiry: tokenExpiry,
          token_meta: tokenResult.tokenMeta || {},
          account_type: account.accountType,
          status: "connected",
          connected_by: typedState.user_id,
        }, {
          onConflict: "organization_id,provider,external_account_id",
        });

      if (upsertError) {
        console.error("Error saving account:", upsertError);
      }
    }

    await supabase.from("social_oauth_states").delete().eq("id", typedState.id);

    const successMessage = `Successfully connected ${accounts.length} ${provider} account(s)`;
    return new Response(null, {
      status: 302,
      headers: { Location: `/marketing/social?success=${encodeURIComponent(successMessage)}` },
    });
  } catch (err) {
    console.error("OAuth callback error:", err);
    const errorMessage = err instanceof Error ? err.message : "OAuth failed";
    return new Response(null, {
      status: 302,
      headers: { Location: `/marketing/social?error=${encodeURIComponent(errorMessage)}` },
    });
  }
});
