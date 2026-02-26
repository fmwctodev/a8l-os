import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const UNIPILE_TO_PROVIDER: Record<string, string> = {
  LINKEDIN: "linkedin",
  FACEBOOK: "facebook",
  INSTAGRAM: "instagram",
  GOOGLE: "google_business",
  TIKTOK: "tiktok",
};

interface UnipileAccountPayload {
  status: string;
  account_id: string;
  name?: string;
}

interface UnipileAccountStatusPayload {
  AccountStatus?: {
    account_id: string;
    account_type: string;
    message: string;
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const unipileDsn = Deno.env.get("UNIPILE_DSN")!;
    const unipileApiKey = Deno.env.get("UNIPILE_API_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const rawBody = await req.text();
    console.log("[unipile-account-webhook] Received:", rawBody);

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid JSON" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (payload.AccountStatus) {
      return await handleStatusUpdate(
        supabase,
        payload as unknown as UnipileAccountStatusPayload
      );
    }

    return await handleAccountCreation(
      supabase,
      payload as unknown as UnipileAccountPayload,
      unipileDsn,
      unipileApiKey
    );
  } catch (error) {
    console.error("[unipile-account-webhook] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

async function handleAccountCreation(
  supabase: ReturnType<typeof createClient>,
  payload: UnipileAccountPayload,
  unipileDsn: string,
  unipileApiKey: string
): Promise<Response> {
  const { status, account_id, name } = payload;

  console.log(
    `[unipile-account-webhook] Account creation: status=${status}, account_id=${account_id}, name=${name}`
  );

  if (status !== "CREATION_SUCCESS" && status !== "RECONNECTED") {
    console.log(`[unipile-account-webhook] Ignoring status: ${status}`);
    return new Response(JSON.stringify({ success: true, action: "ignored" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!account_id) {
    return new Response(
      JSON.stringify({ success: false, error: "Missing account_id" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  if (status === "RECONNECTED") {
    const { error: updateError } = await supabase
      .from("social_accounts")
      .update({ status: "connected", last_error: null, updated_at: new Date().toISOString() })
      .eq("unipile_account_id", account_id);

    if (updateError) {
      console.error("[unipile-account-webhook] Reconnect update failed:", updateError);
    }

    return new Response(
      JSON.stringify({ success: true, action: "reconnected" }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const nameParts = name?.split(":") || [];
  const orgId = nameParts[0];
  const userId = nameParts[1];
  const requestedProvider = nameParts[2];

  if (!orgId || !userId) {
    console.error("[unipile-account-webhook] Invalid name tag:", name);
    return new Response(
      JSON.stringify({ success: false, error: "Invalid name parameter" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  let accountDetails: Record<string, unknown> = {};
  try {
    const detailsResponse = await fetch(
      `${unipileDsn}/api/v1/accounts/${account_id}`,
      {
        headers: {
          "X-API-KEY": unipileApiKey,
          Accept: "application/json",
        },
      }
    );

    if (detailsResponse.ok) {
      accountDetails = await detailsResponse.json();
      console.log(
        "[unipile-account-webhook] Account details:",
        JSON.stringify(accountDetails)
      );
    } else {
      console.warn(
        "[unipile-account-webhook] Could not fetch account details:",
        detailsResponse.status
      );
    }
  } catch (e) {
    console.warn("[unipile-account-webhook] Account details fetch failed:", e);
  }

  const unipileType = (accountDetails.type as string) || "";
  let provider =
    requestedProvider ||
    UNIPILE_TO_PROVIDER[unipileType.toUpperCase()] ||
    "facebook";

  if (provider === "google_business" && requestedProvider === "youtube") {
    provider = "youtube";
  }

  const displayName =
    (accountDetails.name as string) ||
    (accountDetails.email as string) ||
    `${unipileType} Account`;

  const profileImageUrl =
    (accountDetails.profile_picture_url as string) ||
    (accountDetails.avatar_url as string) ||
    null;

  const externalId =
    (accountDetails.id as string) || account_id;

  const accountType = resolveAccountType(provider, accountDetails);

  const { error: upsertError } = await supabase
    .from("social_accounts")
    .upsert(
      {
        organization_id: orgId,
        provider,
        external_account_id: externalId,
        unipile_account_id: account_id,
        display_name: displayName,
        profile_image_url: profileImageUrl,
        account_type: accountType,
        status: "connected",
        last_error: null,
        connected_by: userId,
        token_meta: {
          unipile_type: unipileType,
          connected_via: "unipile_hosted_auth",
          raw_details: accountDetails,
        },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,provider,external_account_id" }
    );

  if (upsertError) {
    console.error("[unipile-account-webhook] Upsert failed:", upsertError);
    return new Response(
      JSON.stringify({ success: false, error: "Failed to save account" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  console.log(
    `[unipile-account-webhook] Account saved: provider=${provider}, name=${displayName}`
  );

  return new Response(
    JSON.stringify({ success: true, action: "created", provider }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

async function handleStatusUpdate(
  supabase: ReturnType<typeof createClient>,
  payload: UnipileAccountStatusPayload
): Promise<Response> {
  const accountStatus = payload.AccountStatus!;
  const { account_id, account_type, message } = accountStatus;

  console.log(
    `[unipile-account-webhook] Status update: account=${account_id}, type=${account_type}, message=${message}`
  );

  let newStatus: string;
  let lastError: string | null = null;

  switch (message) {
    case "OK":
    case "SYNC_SUCCESS":
    case "CREATION_SUCCESS":
    case "RECONNECTED":
      newStatus = "connected";
      break;
    case "CREDENTIALS":
      newStatus = "token_expiring";
      lastError = "Credentials need to be refreshed";
      break;
    case "ERROR":
    case "STOPPED":
      newStatus = "error";
      lastError = `Account sync ${message.toLowerCase()}`;
      break;
    case "DELETED":
      newStatus = "disconnected";
      break;
    default:
      newStatus = "error";
      lastError = `Unknown status: ${message}`;
  }

  const updateData: Record<string, unknown> = {
    status: newStatus,
    updated_at: new Date().toISOString(),
  };

  if (lastError !== null) {
    updateData.last_error = lastError;
  } else {
    updateData.last_error = null;
  }

  const { error: updateError } = await supabase
    .from("social_accounts")
    .update(updateData)
    .eq("unipile_account_id", account_id);

  if (updateError) {
    console.error(
      "[unipile-account-webhook] Status update failed:",
      updateError
    );
  }

  return new Response(
    JSON.stringify({ success: true, action: "status_updated", newStatus }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

function resolveAccountType(
  provider: string,
  details: Record<string, unknown>
): string {
  const detailType = (details.account_type as string) || "";

  switch (provider) {
    case "facebook":
      return detailType === "group" ? "page" : "page";
    case "instagram":
      return "business";
    case "linkedin":
      return detailType === "company" ? "page" : "profile";
    case "google_business":
      return "location";
    case "youtube":
      return "channel";
    case "tiktok":
      return "profile";
    default:
      return "profile";
  }
}
