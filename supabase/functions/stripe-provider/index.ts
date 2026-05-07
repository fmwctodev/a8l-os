import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  encryptStripeCreds,
  getDecryptedStripeCreds,
  validateStripeKey,
} from "../_shared/stripe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ConnectRequest {
  action: "connect";
  secretKey: string;
  publishableKey?: string;
  webhookSigningSecret?: string;
  nickname?: string;
}

interface TestRequest {
  action: "test";
}

interface DisconnectRequest {
  action: "disconnect";
}

interface StatusRequest {
  action: "status";
}

type RequestPayload = ConnectRequest | TestRequest | DisconnectRequest | StatusRequest;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return jsonResponse({ error: "Authorization required" }, 401);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();
    if (userError || !user) return jsonResponse({ error: "Invalid user token" }, 401);

    const { data: userData } = await supabase
      .from("users")
      .select("organization_id, super_admin_active_org_id, role:roles(name)")
      .eq("id", user.id)
      .maybeSingle();
    if (!userData) return jsonResponse({ error: "User not found" }, 404);

    // Honor SuperAdmin org pivot (super_admin_active_org_id) so a
    // SuperAdmin viewing BuilderLync writes the Stripe connection to
    // BL, not their home org. Mirrors get_user_org_id() in SQL and
    // extractUserContext in _shared/auth.ts.
    const role = (userData as { role: { name: string } | { name: string }[] | null }).role;
    const roleName = Array.isArray(role) ? role[0]?.name : role?.name;
    const isSuperAdmin = roleName === "SuperAdmin";
    const orgId =
      (isSuperAdmin && userData.super_admin_active_org_id) ||
      userData.organization_id;

    // Check that the caller can manage payment integrations
    const { data: hasPermission } = await supabase.rpc("user_has_permission", {
      user_id: user.id,
      required_permission: "payments.manage",
    });
    // Fall back to settings.manage if user_has_permission RPC doesn't exist
    if (hasPermission === false) {
      return jsonResponse({ error: "Permission denied" }, 403);
    }

    const payload: RequestPayload = await req.json();

    if (payload.action === "connect") {
      const validation = await validateStripeKey(payload.secretKey);
      if (!validation.valid) {
        return jsonResponse(
          { error: validation.error || "Invalid Stripe credentials" },
          400,
        );
      }

      let encrypted: string;
      let iv: string;
      try {
        const result = await encryptStripeCreds(
          {
            secret_key: payload.secretKey,
            publishable_key: payload.publishableKey ?? null,
            account_id: validation.account?.id ?? null,
            webhook_signing_secret: payload.webhookSigningSecret ?? null,
          },
          supabaseUrl,
          serviceRoleKey,
        );
        encrypted = result.encrypted;
        iv = result.iv;
      } catch (e) {
        const detail = e instanceof Error ? e.message : String(e);
        console.error("[stripe-provider] encrypt failed:", detail);
        return jsonResponse(
          { error: `Failed to encrypt Stripe credentials: ${detail}` },
          500,
        );
      }

      const connectionData = {
        org_id: orgId,
        provider: "stripe",
        credentials_encrypted: encrypted,
        credentials_iv: iv,
        account_info: {
          nickname: payload.nickname || validation.account?.business_name || null,
          stripe_account_id: validation.account?.id ?? null,
          country: validation.account?.country ?? null,
          default_currency: validation.account?.default_currency ?? null,
        },
        last_sync_at: new Date().toISOString(),
        connected_by: user.id,
        updated_at: new Date().toISOString(),
      };

      const { data: existing } = await supabase
        .from("payment_provider_connections")
        .select("id")
        .eq("org_id", orgId)
        .eq("provider", "stripe")
        .maybeSingle();

      const { error: writeError } = existing
        ? await supabase
            .from("payment_provider_connections")
            .update(connectionData)
            .eq("id", existing.id)
        : await supabase
            .from("payment_provider_connections")
            .insert({ ...connectionData, created_at: new Date().toISOString() });

      if (writeError) {
        return jsonResponse(
          { error: `Failed to save Stripe connection: ${writeError.message}` },
          500,
        );
      }

      await supabase.from("audit_logs").insert({
        org_id: orgId,
        user_id: user.id,
        action: "payments.provider.connected",
        entity_type: "payment_provider_connection",
        details: { provider: "stripe", account_id: validation.account?.id },
      });

      return jsonResponse({
        success: true,
        message: "Stripe connected successfully",
        account: validation.account,
      });
    }

    if (payload.action === "status") {
      const { data: conn } = await supabase
        .from("payment_provider_connections")
        .select("provider, account_info, last_sync_at, connected_at, created_at")
        .eq("org_id", orgId)
        .eq("provider", "stripe")
        .maybeSingle();

      return jsonResponse({
        success: true,
        connected: !!conn,
        account_info: conn?.account_info ?? null,
        connected_at: conn?.connected_at ?? conn?.created_at ?? null,
        last_sync_at: conn?.last_sync_at ?? null,
      });
    }

    if (payload.action === "test") {
      const creds = await getDecryptedStripeCreds(orgId, supabase, supabaseUrl, serviceRoleKey);
      if (!creds) return jsonResponse({ error: "No Stripe connection" }, 404);

      const validation = await validateStripeKey(creds.secretKey);
      if (!validation.valid) {
        return jsonResponse({ success: false, error: validation.error }, 400);
      }
      return jsonResponse({ success: true, account: validation.account });
    }

    if (payload.action === "disconnect") {
      await supabase
        .from("payment_provider_connections")
        .delete()
        .eq("org_id", orgId)
        .eq("provider", "stripe");

      await supabase.from("audit_logs").insert({
        org_id: orgId,
        user_id: user.id,
        action: "payments.provider.disconnected",
        entity_type: "payment_provider_connection",
        details: { provider: "stripe" },
      });

      return jsonResponse({ success: true, message: "Stripe disconnected" });
    }

    return jsonResponse({ error: "Invalid action" }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse({ error: message }, 500);
  }
});

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
