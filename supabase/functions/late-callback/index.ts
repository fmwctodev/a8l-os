import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const LATE_API_BASE = "https://api.getlate.dev/v1";

const LATE_PLATFORM_TO_PROVIDER: Record<string, string> = {
  facebook: "facebook",
  instagram: "instagram",
  linkedin: "linkedin",
  googlebusiness: "google_business",
  tiktok: "tiktok",
  youtube: "youtube",
  reddit: "reddit",
};

function resolveAccountType(provider: string): string {
  switch (provider) {
    case "facebook":
      return "page";
    case "instagram":
      return "business";
    case "linkedin":
      return "profile";
    case "google_business":
      return "location";
    case "youtube":
      return "channel";
    case "tiktok":
      return "profile";
    case "reddit":
      return "profile";
    default:
      return "profile";
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lateApiKey = Deno.env.get("LATE_API_KEY")!;
    const appBaseUrl =
      Deno.env.get("APP_BASE_URL") ||
      supabaseUrl.replace(/\.supabase\.co.*/, ".supabase.co");

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const url = new URL(req.url);
    const orgId = url.searchParams.get("org_id");
    const userId = url.searchParams.get("user_id");
    const provider = url.searchParams.get("provider");
    const profileId = url.searchParams.get("profile_id");
    const error = url.searchParams.get("error");
    const accountId = url.searchParams.get("accountId") || url.searchParams.get("account_id");

    if (error) {
      console.error("[late-callback] OAuth error:", error);
      return new Response(null, {
        status: 302,
        headers: {
          Location: `${appBaseUrl}/marketing/social/accounts?error=${encodeURIComponent(error)}`,
        },
      });
    }

    if (!orgId || !userId || !provider) {
      return new Response(null, {
        status: 302,
        headers: {
          Location: `${appBaseUrl}/marketing/social/accounts?error=${encodeURIComponent("Missing required callback parameters")}`,
        },
      });
    }

    let accounts: Array<Record<string, unknown>> = [];

    if (accountId) {
      const accountResponse = await fetch(
        `${LATE_API_BASE}/accounts/${accountId}`,
        {
          headers: {
            Authorization: `Bearer ${lateApiKey}`,
            Accept: "application/json",
          },
        }
      );

      if (accountResponse.ok) {
        const accountData = await accountResponse.json();
        accounts = [accountData];
      }
    }

    if (accounts.length === 0 && profileId) {
      const listResponse = await fetch(
        `${LATE_API_BASE}/accounts?profileId=${profileId}`,
        {
          headers: {
            Authorization: `Bearer ${lateApiKey}`,
            Accept: "application/json",
          },
        }
      );

      if (listResponse.ok) {
        const listData = await listResponse.json();
        const allAccounts = listData.accounts || listData.data || listData || [];
        accounts = Array.isArray(allAccounts) ? allAccounts : [];

        const latePlatformKey = provider === "google_business" ? "googlebusiness" : provider;
        accounts = accounts.filter(
          (a) =>
            (a.platform as string)?.toLowerCase() === latePlatformKey ||
            (a.provider as string)?.toLowerCase() === latePlatformKey
        );
      }
    }

    if (accounts.length === 0) {
      console.error("[late-callback] No accounts found after OAuth");
      return new Response(null, {
        status: 302,
        headers: {
          Location: `${appBaseUrl}/marketing/social/accounts?error=${encodeURIComponent("No accounts found after authorization")}`,
        },
      });
    }

    let savedCount = 0;

    for (const account of accounts) {
      const lateAccountId =
        (account.id as string) ||
        (account.accountId as string) ||
        "";
      const displayName =
        (account.name as string) ||
        (account.username as string) ||
        (account.displayName as string) ||
        `${provider} Account`;
      const avatarUrl =
        (account.avatar as string) ||
        (account.avatarUrl as string) ||
        (account.profile_picture_url as string) ||
        null;
      const externalId =
        (account.externalId as string) ||
        (account.socialId as string) ||
        lateAccountId;
      const accountType = resolveAccountType(provider);

      const { error: lateUpsertError } = await supabase
        .from("late_connections")
        .upsert(
          {
            org_id: orgId,
            connected_by_user_id: userId,
            late_account_id: lateAccountId,
            late_profile_id: profileId,
            platform: provider,
            account_name: displayName,
            avatar_url: avatarUrl,
            status: "connected",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "org_id,late_account_id" }
        );

      if (lateUpsertError) {
        console.error("[late-callback] Late connection upsert failed:", lateUpsertError);
      }

      const { error: socialUpsertError } = await supabase
        .from("social_accounts")
        .upsert(
          {
            organization_id: orgId,
            provider,
            external_account_id: externalId,
            display_name: displayName,
            profile_image_url: avatarUrl,
            account_type: accountType,
            status: "connected",
            last_error: null,
            connected_by: userId,
            token_meta: {
              late_account_id: lateAccountId,
              late_profile_id: profileId,
              connected_via: "late_dev",
            },
            updated_at: new Date().toISOString(),
          },
          { onConflict: "organization_id,provider,external_account_id" }
        );

      if (socialUpsertError) {
        console.error("[late-callback] Social account upsert failed:", socialUpsertError);
      } else {
        savedCount++;
      }
    }

    console.log(
      `[late-callback] Saved ${savedCount} account(s) for org ${orgId}, provider ${provider}`
    );

    return new Response(null, {
      status: 302,
      headers: {
        Location: `${appBaseUrl}/marketing/social/accounts?late=success&count=${savedCount}`,
      },
    });
  } catch (error) {
    console.error("[late-callback] Error:", error);
    const appBaseUrl =
      Deno.env.get("APP_BASE_URL") || "https://app.example.com";
    return new Response(null, {
      status: 302,
      headers: {
        Location: `${appBaseUrl}/marketing/social/accounts?error=${encodeURIComponent("Connection failed unexpectedly")}`,
      },
    });
  }
});
