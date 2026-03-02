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

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

function buildRedirectUrl(base: string, path: string, params: Record<string, string>): string {
  const qs = new URLSearchParams(params).toString();
  return `${stripTrailingSlash(base)}${path}${qs ? `?${qs}` : ""}`;
}

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

async function fetchAccountsByPlatform(
  lateHeaders: Record<string, string>,
  profileId: string,
  provider: string,
): Promise<Array<Record<string, unknown>>> {
  const listUrl = `${LATE_API_BASE}/accounts?profileId=${encodeURIComponent(profileId)}`;
  console.log("[late-callback] Fetching accounts via GET", listUrl);

  const listResponse = await fetch(listUrl, { headers: lateHeaders });

  if (!listResponse.ok) {
    const errText = await listResponse.text();
    console.error("[late-callback] List accounts failed:", listResponse.status, errText.slice(0, 500));
    return [];
  }

  const listData = await listResponse.json();
  console.log("[late-callback] Raw list response:", JSON.stringify(listData).slice(0, 500));

  const allAccounts: Array<Record<string, unknown>> =
    listData.accounts || (Array.isArray(listData) ? listData : []);

  console.log("[late-callback] Total accounts returned:", allAccounts.length);

  const latePlatformKey = provider === "google_business" ? "googlebusiness" : provider;
  const filtered = allAccounts.filter((a) => {
    const p = ((a.platform as string) || "").toLowerCase();
    return p === latePlatformKey || p === provider;
  });

  console.log("[late-callback] Filtered to", filtered.length, "accounts for provider:", provider);
  return filtered;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lateApiKey = Deno.env.get("LATE_API_KEY")!;
    const lateProfileId = Deno.env.get("LATE_PROFILE_ID") || "69a352613ecb689ae9742cc0";

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

    const lateAccountId = url.searchParams.get("accountId") || url.searchParams.get("account_id");
    const returnPath = url.searchParams.get("return_path")
      ? decodeURIComponent(url.searchParams.get("return_path")!)
      : null;

    const defaultRedirectPath = returnPath || "/marketing/social/accounts";

    if (error) {
      console.error("[late-callback] OAuth error:", error);
      return new Response(null, {
        status: 302,
        headers: { Location: buildRedirectUrl(appBaseUrl, defaultRedirectPath, { error }) },
      });
    }

    if (!orgId || !userId || !provider) {
      return new Response(null, {
        status: 302,
        headers: { Location: buildRedirectUrl(appBaseUrl, defaultRedirectPath, { error: "Missing required callback parameters" }) },
      });
    }

    const lateHeaders = {
      Authorization: `Bearer ${lateApiKey}`,
      Accept: "application/json",
    };

    let accounts: Array<Record<string, unknown>> = [];

    if (lateAccountId) {
      console.log("[late-callback] Fetching specific account:", lateAccountId);
      const accountResponse = await fetch(`${LATE_API_BASE}/accounts/${lateAccountId}`, { headers: lateHeaders });
      if (accountResponse.ok) {
        const accountData = await accountResponse.json();
        const acc = accountData.account || accountData;
        accounts = [acc];
        console.log("[late-callback] Got account:", JSON.stringify(acc).slice(0, 300));
      } else {
        const errText = await accountResponse.text();
        console.warn("[late-callback] Single account fetch failed:", accountResponse.status, errText.slice(0, 300));
      }
    }

    if (accounts.length === 0) {
      accounts = await fetchAccountsByPlatform(lateHeaders, lateProfileId, provider);
    }

    if (accounts.length === 0) {
      console.log("[late-callback] No accounts on first attempt, retrying after 2s...");
      await new Promise((resolve) => setTimeout(resolve, 2000));
      accounts = await fetchAccountsByPlatform(lateHeaders, lateProfileId, provider);
    }

    if (accounts.length === 0) {
      console.error("[late-callback] No accounts found after OAuth for provider:", provider);
      return new Response(null, {
        status: 302,
        headers: { Location: buildRedirectUrl(appBaseUrl, defaultRedirectPath, { error: "No accounts found after authorization. Please try again." }) },
      });
    }

    let savedCount = 0;

    for (const account of accounts) {
      const accountId =
        (account._id as string) ||
        (account.id as string) ||
        (account.accountId as string) ||
        "";

      const displayName =
        (account.displayName as string) ||
        (account.name as string) ||
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
        console.warn("[late-callback] Account missing ID, skipping:", JSON.stringify(account).slice(0, 300));
        continue;
      }

      console.log(`[late-callback] Saving account: id=${accountId}, name=${displayName}, provider=${resolvedProvider}`);

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

    const isReputationFlow = returnPath && returnPath.includes("reputation");
    if (isReputationFlow && (provider === "google_business" || provider === "facebook")) {
      const connectedAccounts = accounts.map((a) => ({
        id: (a._id as string) || (a.id as string) || "",
        name: (a.displayName as string) || (a.name as string) || "",
        platform: ((a.platform as string) || provider).toLowerCase(),
      }));

      await supabase.from("reputation_integration_status").upsert(
        {
          org_id: orgId,
          provider: "late",
          connected: true,
          accounts_connected: JSON.stringify(connectedAccounts),
          last_error: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "org_id,provider" }
      );

      console.log(`[late-callback] Updated reputation_integration_status for org ${orgId}`);
    }

    return new Response(null, {
      status: 302,
      headers: { Location: buildRedirectUrl(appBaseUrl, defaultRedirectPath, { late: "success", count: String(savedCount), provider }) },
    });
  } catch (error) {
    console.error("[late-callback] Error:", error);
    const appBaseUrl = Deno.env.get("APP_BASE_URL") || "https://os.autom8ionlab.com";
    const fallbackPath = "/marketing/social/accounts";
    return new Response(null, {
      status: 302,
      headers: { Location: buildRedirectUrl(appBaseUrl, fallbackPath, { error: "Connection failed unexpectedly" }) },
    });
  }
});
