import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ScanResult {
  org_id: string;
  org_name: string;
  expiring_soon: SecretAlert[];
  expired: SecretAlert[];
  unused: SecretAlert[];
  no_value: SecretAlert[];
  scan_timestamp: string;
}

interface SecretAlert {
  id: string;
  key: string;
  name: string;
  category?: string;
  expires_at?: string;
  last_used_at?: string;
  days_until_expiry?: number;
  days_since_last_use?: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    let targetOrgId: string | null = null;
    let notifyAdmins = true;

    try {
      const body = await req.json();
      targetOrgId = body.org_id || null;
      notifyAdmins = body.notify_admins !== false;
    } catch {
      // No body or invalid JSON, scan all orgs
    }

    const results: ScanResult[] = [];
    const now = new Date();
    const expiryWarningDays = 14;
    const unusedThresholdDays = 90;

    let orgsQuery = supabaseAdmin.from("organizations").select("id, name");
    if (targetOrgId) {
      orgsQuery = orgsQuery.eq("id", targetOrgId);
    }

    const { data: organizations, error: orgsError } = await orgsQuery;

    if (orgsError) {
      console.error("Failed to fetch organizations:", orgsError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to fetch organizations" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    for (const org of organizations || []) {
      const { data: secrets, error: secretsError } = await supabaseAdmin
        .from("org_secrets")
        .select("id, key, name, encrypted_value, expires_at, last_used_at, category_id, secret_categories(name)")
        .eq("org_id", org.id);

      if (secretsError) {
        console.error(`Failed to fetch secrets for org ${org.id}:`, secretsError);
        continue;
      }

      const orgResult: ScanResult = {
        org_id: org.id,
        org_name: org.name,
        expiring_soon: [],
        expired: [],
        unused: [],
        no_value: [],
        scan_timestamp: now.toISOString(),
      };

      for (const secret of secrets || []) {
        const categoryName = (secret.secret_categories as { name: string } | null)?.name;

        if (secret.expires_at) {
          const expiresAt = new Date(secret.expires_at);
          const daysUntilExpiry = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

          if (daysUntilExpiry < 0) {
            orgResult.expired.push({
              id: secret.id,
              key: secret.key,
              name: secret.name,
              category: categoryName,
              expires_at: secret.expires_at,
              days_until_expiry: daysUntilExpiry,
            });
          } else if (daysUntilExpiry <= expiryWarningDays) {
            orgResult.expiring_soon.push({
              id: secret.id,
              key: secret.key,
              name: secret.name,
              category: categoryName,
              expires_at: secret.expires_at,
              days_until_expiry: daysUntilExpiry,
            });
          }
        }

        if (secret.last_used_at) {
          const lastUsedAt = new Date(secret.last_used_at);
          const daysSinceLastUse = Math.floor((now.getTime() - lastUsedAt.getTime()) / (1000 * 60 * 60 * 24));

          if (daysSinceLastUse >= unusedThresholdDays) {
            orgResult.unused.push({
              id: secret.id,
              key: secret.key,
              name: secret.name,
              category: categoryName,
              last_used_at: secret.last_used_at,
              days_since_last_use: daysSinceLastUse,
            });
          }
        } else if (!secret.last_used_at && secret.encrypted_value) {
          const createdAt = new Date(secret.last_used_at || now);
          const daysSinceCreation = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

          if (daysSinceCreation >= unusedThresholdDays) {
            orgResult.unused.push({
              id: secret.id,
              key: secret.key,
              name: secret.name,
              category: categoryName,
              days_since_last_use: daysSinceCreation,
            });
          }
        }

        if (!secret.encrypted_value) {
          orgResult.no_value.push({
            id: secret.id,
            key: secret.key,
            name: secret.name,
            category: categoryName,
          });
        }
      }

      const hasAlerts =
        orgResult.expiring_soon.length > 0 ||
        orgResult.expired.length > 0 ||
        orgResult.unused.length > 0 ||
        orgResult.no_value.length > 0;

      if (hasAlerts) {
        results.push(orgResult);

        await supabaseAdmin.from("secret_usage_log").insert({
          org_id: org.id,
          action: "scan",
          actor_type: "system",
          actor_name: "Secrets Scanner",
          context: {
            expiring_soon_count: orgResult.expiring_soon.length,
            expired_count: orgResult.expired.length,
            unused_count: orgResult.unused.length,
            no_value_count: orgResult.no_value.length,
          },
        });

        if (notifyAdmins && (orgResult.expired.length > 0 || orgResult.expiring_soon.length > 0)) {
          await notifyOrgAdmins(supabaseAdmin, org.id, orgResult);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          scanned_at: now.toISOString(),
          organizations_scanned: organizations?.length ?? 0,
          organizations_with_alerts: results.length,
          results,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in secrets-scanner:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function notifyOrgAdmins(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  scanResult: ScanResult
) {
  try {
    const { data: admins } = await supabase
      .from("users")
      .select("id, email, name")
      .eq("organization_id", orgId)
      .in("role_id", (
        await supabase
          .from("roles")
          .select("id")
          .in("name", ["SuperAdmin", "Admin"])
      ).data?.map(r => r.id) ?? []);

    if (!admins || admins.length === 0) {
      return;
    }

    const alertSummary = [];
    if (scanResult.expired.length > 0) {
      alertSummary.push(`${scanResult.expired.length} expired secret(s)`);
    }
    if (scanResult.expiring_soon.length > 0) {
      alertSummary.push(`${scanResult.expiring_soon.length} secret(s) expiring soon`);
    }

    for (const admin of admins) {
      await supabase.from("inbox_events").insert({
        user_id: admin.id,
        org_id: orgId,
        event_type: "secrets_alert",
        title: "Secrets Management Alert",
        message: `Security scan found: ${alertSummary.join(", ")}`,
        metadata: {
          scan_result: scanResult,
        },
        is_read: false,
      }).catch(() => {
        // inbox_events table may not exist, ignore
      });
    }

    console.log(`Notified ${admins.length} admin(s) in org ${orgId} about secrets alerts`);
  } catch (error) {
    console.error("Failed to notify admins:", error);
  }
}
