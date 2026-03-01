import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const LATE_API_BASE = "https://getlate.dev/api/v1";

const LATE_PLATFORM_TO_PROVIDER: Record<string, string> = {
  facebook: "facebook",
  instagram: "instagram",
  linkedin: "linkedin",
  googlebusiness: "google_business",
  google_business: "google_business",
  tiktok: "tiktok",
  youtube: "youtube",
  reddit: "reddit",
};

function resolveAccountType(provider: string): string {
  switch (provider) {
    case "facebook": return "page";
    case "instagram": return "business";
    case "linkedin": return "profile";
    case "google_business": return "location";
    case "youtube": return "channel";
    case "tiktok": return "profile";
    case "reddit": return "profile";
    default: return "profile";
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

    const appBaseUrlDefault = Deno.env.get("APP_BASE_URL") || "https://os.autom8ionlab.com";

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const url = new URL(req.url);
    const orgId = url.searchParams.get("org_id");
    const userId = url.searchParams.get("user_id");
    const provider = url.searchParams.get("provider");
    const appBaseUrl = url.searchParams.get("app_base_url")
      ? decodeURIComponent(url.searchParams.get("app_base_url")!)
      : appBaseUrlDefault;
    const error = url.searchParams.get("error");

    // Late.dev may pass these on callback
    const lateAccountId = url.searchParams.get("accountId") || url.searchParams.get("account_id");

    if (error) {
      console.error("[late-callback] OAuth error:", error);
      return new Response(null, {
        status: 302,
        headers: { Location: `${appBaseUrl}/marketing/social/accounts?error=${encodeURIComponent(error)}` },
      });
    }

    if (!orgId || !userId || !provider) {
      return new Response(null, {
        status: 302,
        headers: { Location: `${appBaseUrl}/marketing/social/accounts?error=${encodeURIComponent("Missing required callback parameters")}` },
      });
    }

    const lateHeaders = {
      Authorization: `Bearer ${lateApiKey}`,
      Accept: "application/json",
    };

    let accounts: Array<Record<string, unknown>> = [];

    // If Late.dev passed back a specific accountId on the redirect, fetch just that account
    if (lateAccountId) {
      console.log("[late-callback] Fetching specific account:", lateAccountId);
      const accountResponse = await fetch(`${LATE_API_BASE}/accounts/${lateAccountId}`, { headers: lateHeaders });
      if (accountResponse.ok) {
        const accountData = await accountResponse.json();
        const acc = accountData.account || accountData;
        accounts = [acc];
        console.log("[late-callback] Got account:", JSON.stringify(acc).slice(0, 200));
      } else {
        console.warn("[late-callback] Single account fetch failed:", accountResponse.status);
      }
    }

    // Fall back: list all accounts and filter by platform
    if (accounts.length === 0) {
      console.log("[late-callback] Listing all accounts via GET /v1/accounts/list-accounts");
      const listResponse = await fetch(`${LATE_API_BASE}/accounts/list-accounts`, { headers: lateHeaders });

      if (listResponse.ok) {
        const listData = await listResponse.json();
        const allAccounts: Array<Record<string, unknown>> =
          listData.accounts || listData.data || (Array.isArray(listData) ? listData : []);

        console.log("[late-callback] Total accounts returned:", allAccounts.length);

        const latePlatformKey = provider === "google_business" ? "googlebusiness" : provider;
        accounts = allAccounts.filter((a) => {
          const p = ((a.platform as string) || (a.provider as string) || "").toLowerCase();
          return p === latePlatformKey || p === provider;
        });

        console.log("[late-callback] Filtered to", accounts.length, "accounts for provider:", provider);
      } else {
        const errText = await listResponse.text();
        console.error("[late-callback] List accounts failed:", listResponse.status, errText.slice(0, 300));
      }
    }

    if (accounts.length === 0) {
      console.error("[late-callback] No accounts found after OAuth for provider:", provider);
      return new Response(null, {
        status: 302,
        headers: { Location: `${appBaseUrl}/marketing/social/accounts?error=${encodeURIComponent("No accounts found after authorization. Please try again.")}` },
      });
    }

    let savedCount = 0;

    for (const account of accounts) {
      const accountId =
        (account.id as string) ||
        (account._id as string) ||
        (account.accountId as string) ||
        "";

      const displayName =
        (account.name as string) ||
        (account.displayName as string) ||
        (account.username as string) ||
        `${provider} Account`;

      const avatarUrl =
        (account.avatar as string) ||
        (account.avatarUrl as string) ||
        (account.profilePicture as string) ||
        (account.profile_picture_url as string) ||
        null;

      const externalId =
        (account.externalId as string) ||
        (account.socialId as string) ||
        (account.platformUserId as string) ||
        accountId;

      const resolvedProvider = LATE_PLATFORM_TO_PROVIDER[
        ((account.platform as string) || provider).toLowerCase()
      ] || provider;

      const accountType = resolveAccountType(resolvedProvider);

      if (!accountId) {
        console.warn("[late-callback] Account missing ID, skipping:", JSON.stringify(account).slice(0, 200));
        continue;
      }

      // Upsert into late_connections
      const { error: lateUpsertError } = await supabase
        .from("late_connections")
        .upsert(
          {
            org_id: orgId,
            connected_by_user_id: userId,
            late_account_id: accountId,
            platform: resolvedProvider,
            account_name: displayName,
            avatar_url: avatarUrl,
            status: "connected",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "org_id,late_account_id" }
        );

      if (lateUpsertError) {
        console.error("[late-callback] late_connections upsert failed:", lateUpsertError);
      }

      // Upsert into social_accounts
      const { error: socialUpsertError } = await supabase
        .from("social_accounts")
        .upsert(
          {
            organization_id: orgId,
            provider: resolvedProvider,
            external_account_id: externalId,
            display_name: displayName,
            profile_image_url: avatarUrl,
            account_type: accountType,
            status: "connected",
            last_error: null,
            connected_by: userId,
            token_meta: {
              late_account_id: accountId,
              connected_via: "late_dev",
            },
            updated_at: new Date().toISOString(),
          },
          { onConflict: "organization_id,provider,external_account_id" }
        );

      if (socialUpsertError) {
        console.error("[late-callback] social_accounts upsert failed:", socialUpsertError);
      } else {
        savedCount++;
      }
    }

    console.log(`[late-callback] Saved ${savedCount} account(s) for org ${orgId}, provider ${provider}`);

    return new Response(null, {
      status: 302,
      headers: { Location: `${appBaseUrl}/marketing/social/accounts?late=success&count=${savedCount}` },
    });
  } catch (error) {
    console.error("[late-callback] Error:", error);
    const appBaseUrl = Deno.env.get("APP_BASE_URL") || "https://os.autom8ionlab.com";
    return new Response(null, {
      status: 302,
      headers: { Location: `${appBaseUrl}/marketing/social/accounts?error=${encodeURIComponent("Connection failed unexpectedly")}` },
    });
  }
});
