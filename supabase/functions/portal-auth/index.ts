import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

async function sha256(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function generateSecureToken(): { raw: string; hashPromise: Promise<string> } {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const raw = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  return { raw, hashPromise: sha256(raw) };
}

function generateOtpCode(): string {
  const min = 100000;
  const max = 999999;
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return String(min + (arr[0] % (max - min + 1)));
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***@***.***";
  const masked = local.length <= 2
    ? local[0] + "***"
    : local[0] + "***" + local[local.length - 1];
  return `${masked}@${domain}`;
}

function deriveDeviceLabel(userAgent: string): string {
  if (/iPhone|iPad/.test(userAgent)) return "iOS Device";
  if (/Android/.test(userAgent)) return "Android Device";
  if (/Windows/.test(userAgent)) return "Windows Browser";
  if (/Mac/.test(userAgent)) return "Mac Browser";
  if (/Linux/.test(userAgent)) return "Linux Browser";
  return "Browser";
}

async function getDecryptedApiKey(
  orgId: string,
  supabase: ReturnType<typeof createClient>,
  supabaseUrl: string,
  serviceRoleKey: string
): Promise<string | null> {
  const envKey = Deno.env.get("SENDGRID_API_KEY");
  if (envKey) return envKey;

  const { data: conn } = await supabase
    .from("integration_connections")
    .select("credentials_encrypted, credentials_iv, status, integrations!inner(key)")
    .eq("org_id", orgId)
    .eq("integrations.key", "sendgrid")
    .maybeSingle();

  if (!conn || conn.status !== "connected" || !conn.credentials_encrypted || !conn.credentials_iv) {
    return null;
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/email-crypto`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "decrypt",
      encrypted: conn.credentials_encrypted,
      iv: conn.credentials_iv,
    }),
  });

  if (!response.ok) return null;
  const data = await response.json();
  return data.plaintext;
}

function buildOtpEmailHtml(params: {
  clientName: string;
  projectName: string;
  orgName: string;
  code: string;
  expirationMinutes: number;
  supportEmail: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Verification Code</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
          <tr>
            <td style="background:#ffffff;border-radius:12px;padding:48px 40px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
              <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#2563eb;letter-spacing:0.05em;text-transform:uppercase;">${params.orgName}</p>
              <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#0f172a;line-height:1.3;">Verify Your Access</h1>
              <p style="margin:0 0 32px;font-size:15px;color:#64748b;line-height:1.6;">
                Hi ${params.clientName}, use the code below to access the client portal for <strong style="color:#0f172a;">${params.projectName}</strong>.
              </p>
              <div style="background:#f1f5f9;border-radius:10px;padding:28px;text-align:center;margin-bottom:32px;">
                <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:#94a3b8;letter-spacing:0.08em;text-transform:uppercase;">Verification Code</p>
                <p style="margin:0;font-size:42px;font-weight:700;color:#0f172a;letter-spacing:0.2em;font-family:'Courier New',monospace;">${params.code}</p>
              </div>
              <p style="margin:0 0 24px;font-size:13px;color:#94a3b8;text-align:center;">
                This code expires in <strong style="color:#64748b;">${params.expirationMinutes} minutes</strong>. Do not share it with anyone.
              </p>
              <hr style="border:none;border-top:1px solid #e2e8f0;margin:0 0 24px;">
              <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;">
                If you did not request this code, you can safely ignore this email. Your portal access remains protected.<br><br>
                Need help? Contact us at <a href="mailto:${params.supportEmail}" style="color:#2563eb;text-decoration:none;">${params.supportEmail}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 0;text-align:center;">
              <p style="margin:0;font-size:12px;color:#94a3b8;">This is a transactional email sent on behalf of ${params.orgName}.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const noCache = {
    ...corsHeaders,
    "Cache-Control": "no-store, no-cache, must-revalidate",
    "X-Robots-Tag": "noindex, nofollow",
    "Content-Type": "application/json",
  };

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await req.json();
    const action: string = body.action;
    const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") || null;
    const userAgent = req.headers.get("user-agent") || null;

    // ──────────────────────────────────────────────
    // validate-token
    // Checks portal token validity. Returns masked email.
    // ──────────────────────────────────────────────
    if (action === "validate-token") {
      const { portalToken } = body;
      if (!portalToken) {
        return new Response(JSON.stringify({ error: "Missing portal token" }), { status: 400, headers: noCache });
      }

      const tokenHash = await sha256(portalToken);
      const { data: portal } = await supabase
        .from("project_client_portals")
        .select(`
          id, status, expires_at, contact_id, org_id, project_id,
          contact:contacts(id, first_name, last_name, email),
          project:projects(id, name),
          organization:organizations(id, name, email)
        `)
        .eq("portal_token_hash", tokenHash)
        .maybeSingle();

      if (!portal) {
        await supabase.from("project_client_portal_events").insert({
          portal_id: "00000000-0000-0000-0000-000000000000",
          project_id: "00000000-0000-0000-0000-000000000000",
          event_type: "portal_token_invalid",
          metadata: {},
          ip_address: ipAddress,
          user_agent: userAgent,
        }).catch(() => {});
        return new Response(JSON.stringify({ valid: false, reason: "invalid" }), { status: 200, headers: noCache });
      }

      if (portal.status === "revoked") {
        await supabase.from("project_client_portal_events").insert({
          portal_id: portal.id,
          project_id: portal.project_id,
          contact_id: portal.contact_id,
          event_type: "portal_token_revoked",
          metadata: {},
          ip_address: ipAddress,
          user_agent: userAgent,
        });
        return new Response(JSON.stringify({ valid: false, reason: "revoked" }), { status: 200, headers: noCache });
      }

      if (portal.expires_at && new Date(portal.expires_at) < new Date()) {
        await supabase
          .from("project_client_portals")
          .update({ status: "expired", updated_at: new Date().toISOString() })
          .eq("id", portal.id);
        await supabase.from("project_client_portal_events").insert({
          portal_id: portal.id,
          project_id: portal.project_id,
          contact_id: portal.contact_id,
          event_type: "portal_token_expired",
          metadata: {},
          ip_address: ipAddress,
          user_agent: userAgent,
        });
        return new Response(JSON.stringify({ valid: false, reason: "expired" }), { status: 200, headers: noCache });
      }

      if (portal.status !== "active") {
        return new Response(JSON.stringify({ valid: false, reason: "invalid" }), { status: 200, headers: noCache });
      }

      const contact = portal.contact as { id: string; first_name: string | null; last_name: string | null; email: string | null } | null;
      const contactEmail = contact?.email || null;
      const maskedEmail = contactEmail ? maskEmail(contactEmail) : null;
      const contactName = [contact?.first_name, contact?.last_name].filter(Boolean).join(" ") || "Client";
      const project = portal.project as { id: string; name: string } | null;
      const org = portal.organization as { id: string; name: string; email: string | null } | null;

      await supabase.from("project_client_portal_events").insert({
        portal_id: portal.id,
        project_id: portal.project_id,
        contact_id: portal.contact_id,
        event_type: "portal_token_validated",
        metadata: {},
        ip_address: ipAddress,
        user_agent: userAgent,
      });

      return new Response(JSON.stringify({
        valid: true,
        portalId: portal.id,
        contactId: portal.contact_id,
        maskedEmail,
        contactName,
        projectName: project?.name || "Your Project",
        orgName: org?.name || "Your Team",
        supportEmail: org?.email || null,
        hasEmail: !!contactEmail,
      }), { status: 200, headers: noCache });
    }

    // ──────────────────────────────────────────────
    // send-code
    // Rate-limited OTP code send.
    // ──────────────────────────────────────────────
    if (action === "send-code") {
      const { portalId, contactId, orgId } = body;
      if (!portalId) {
        return new Response(JSON.stringify({ error: "Missing portalId" }), { status: 400, headers: noCache });
      }

      // Rate limit: max 3 sends per 15 minutes per portal
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const { count: recentSends } = await supabase
        .from("project_client_portal_auth_codes")
        .select("id", { count: "exact", head: true })
        .eq("portal_id", portalId)
        .gte("created_at", fifteenMinutesAgo);

      if ((recentSends || 0) >= 3) {
        return new Response(JSON.stringify({
          error: "Too many verification requests. Please wait a few minutes and try again.",
          rateLimited: true,
        }), { status: 429, headers: noCache });
      }

      // Invalidate any existing unconsumed codes for this portal
      await supabase
        .from("project_client_portal_auth_codes")
        .update({ invalidated_at: new Date().toISOString() })
        .eq("portal_id", portalId)
        .is("consumed_at", null)
        .is("invalidated_at", null);

      // Fetch portal + contact + org info
      const { data: portal } = await supabase
        .from("project_client_portals")
        .select(`
          id, org_id, project_id, contact_id,
          contact:contacts(id, first_name, last_name, email),
          project:projects(id, name),
          organization:organizations(id, name, email)
        `)
        .eq("id", portalId)
        .eq("status", "active")
        .maybeSingle();

      if (!portal) {
        return new Response(JSON.stringify({ error: "Portal not found or inactive" }), { status: 404, headers: noCache });
      }

      const contact = portal.contact as { id: string; first_name: string | null; last_name: string | null; email: string | null } | null;
      const contactEmail = contact?.email;
      if (!contactEmail) {
        return new Response(JSON.stringify({ error: "No email address on file for this contact" }), { status: 400, headers: noCache });
      }

      // Generate and hash code
      const rawCode = generateOtpCode();
      const codeHash = await sha256(rawCode);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      await supabase.from("project_client_portal_auth_codes").insert({
        portal_id: portalId,
        contact_id: portal.contact_id,
        code_hash: codeHash,
        expires_at: expiresAt,
        ip_address: ipAddress,
        user_agent: userAgent,
      });

      // Send email via SendGrid
      const apiKey = await getDecryptedApiKey(portal.org_id, supabase, supabaseUrl, serviceRoleKey);

      if (apiKey) {
        const project = portal.project as { id: string; name: string } | null;
        const org = portal.organization as { id: string; name: string; email: string | null } | null;
        const contactName = [contact.first_name, contact.last_name].filter(Boolean).join(" ") || "Client";

        // Get default from address
        const { data: defaults } = await supabase
          .from("email_defaults")
          .select("default_from_address_id")
          .eq("org_id", portal.org_id)
          .maybeSingle();

        let fromEmail = org?.email || "noreply@example.com";
        let fromName = org?.name || "Client Portal";

        if (defaults?.default_from_address_id) {
          const { data: fromAddr } = await supabase
            .from("email_from_addresses")
            .select("email, display_name")
            .eq("id", defaults.default_from_address_id)
            .eq("active", true)
            .maybeSingle();
          if (fromAddr) {
            fromEmail = fromAddr.email;
            fromName = fromAddr.display_name || fromName;
          }
        }

        const htmlBody = buildOtpEmailHtml({
          clientName: contactName,
          projectName: project?.name || "Your Project",
          orgName: org?.name || "Your Team",
          code: rawCode,
          expirationMinutes: 10,
          supportEmail: org?.email || fromEmail,
        });

        await fetch("https://api.sendgrid.com/v3/mail/send", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            personalizations: [{ to: [{ email: contactEmail, name: contactName }] }],
            from: { email: fromEmail, name: fromName },
            subject: `Your verification code — ${project?.name || "Client Portal"}`,
            content: [{ type: "text/html", value: htmlBody }],
            tracking_settings: {
              open_tracking: { enable: false },
              click_tracking: { enable: false },
            },
          }),
        });
      }

      await supabase.from("project_client_portal_events").insert({
        portal_id: portalId,
        project_id: portal.project_id,
        contact_id: portal.contact_id,
        event_type: "auth_code_sent",
        metadata: { masked_email: maskEmail(contactEmail) },
        ip_address: ipAddress,
        user_agent: userAgent,
      });

      return new Response(JSON.stringify({
        success: true,
        maskedEmail: maskEmail(contactEmail),
        expiresAt,
      }), { status: 200, headers: noCache });
    }

    // ──────────────────────────────────────────────
    // verify-code
    // Validate OTP, create session on success.
    // ──────────────────────────────────────────────
    if (action === "verify-code") {
      const { portalId, code, rememberDevice } = body;
      if (!portalId || !code) {
        return new Response(JSON.stringify({ error: "Missing portalId or code" }), { status: 400, headers: noCache });
      }

      const codeHash = await sha256(String(code).trim());
      const now = new Date().toISOString();

      // Find the most recent unconsumed, non-invalidated, non-expired code for this portal
      const { data: authCode } = await supabase
        .from("project_client_portal_auth_codes")
        .select("id, code_hash, expires_at, attempts, max_attempts, contact_id")
        .eq("portal_id", portalId)
        .is("consumed_at", null)
        .is("invalidated_at", null)
        .gte("expires_at", now)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const { data: portal } = await supabase
        .from("project_client_portals")
        .select("id, project_id, contact_id, org_id")
        .eq("id", portalId)
        .eq("status", "active")
        .maybeSingle();

      if (!authCode || !portal) {
        await supabase.from("project_client_portal_events").insert({
          portal_id: portalId,
          project_id: portal?.project_id || "00000000-0000-0000-0000-000000000000",
          contact_id: portal?.contact_id || null,
          event_type: "auth_code_failed",
          metadata: { reason: "no_valid_code" },
          ip_address: ipAddress,
          user_agent: userAgent,
        }).catch(() => {});
        return new Response(JSON.stringify({
          success: false,
          error: "Verification code expired or not found. Please request a new code.",
          expired: true,
        }), { status: 200, headers: noCache });
      }

      // Check attempts
      if (authCode.attempts >= authCode.max_attempts) {
        await supabase.from("project_client_portal_events").insert({
          portal_id: portalId,
          project_id: portal.project_id,
          contact_id: portal.contact_id,
          event_type: "auth_code_failed",
          metadata: { reason: "max_attempts_exceeded" },
          ip_address: ipAddress,
          user_agent: userAgent,
        });
        return new Response(JSON.stringify({
          success: false,
          error: "Too many incorrect attempts. Please request a new code.",
          maxAttemptsExceeded: true,
        }), { status: 200, headers: noCache });
      }

      // Verify hash
      if (authCode.code_hash !== codeHash) {
        const newAttempts = authCode.attempts + 1;
        const exceeded = newAttempts >= authCode.max_attempts;

        await supabase
          .from("project_client_portal_auth_codes")
          .update({ attempts: newAttempts, ...(exceeded ? { invalidated_at: now } : {}) })
          .eq("id", authCode.id);

        await supabase.from("project_client_portal_events").insert({
          portal_id: portalId,
          project_id: portal.project_id,
          contact_id: portal.contact_id,
          event_type: "auth_code_failed",
          metadata: { attempts: newAttempts, max_attempts: authCode.max_attempts },
          ip_address: ipAddress,
          user_agent: userAgent,
        });

        return new Response(JSON.stringify({
          success: false,
          error: "Incorrect verification code. Please try again.",
          attemptsRemaining: authCode.max_attempts - newAttempts,
          maxAttemptsExceeded: exceeded,
        }), { status: 200, headers: noCache });
      }

      // Code is valid — mark consumed
      await supabase
        .from("project_client_portal_auth_codes")
        .update({ consumed_at: now })
        .eq("id", authCode.id);

      // Create session
      const sessionDuration = rememberDevice ? 30 * 24 * 60 * 60 * 1000 : 12 * 60 * 60 * 1000;
      const sessionExpiry = new Date(Date.now() + sessionDuration).toISOString();
      const sessionToken = generateSecureToken();
      const sessionTokenHash = await sessionToken.hashPromise;
      const deviceLabel = userAgent ? deriveDeviceLabel(userAgent) : "Browser";

      const { data: newSession, error: sessionError } = await supabase
        .from("project_client_portal_sessions")
        .insert({
          portal_id: portalId,
          contact_id: portal.contact_id,
          session_token_hash: sessionTokenHash,
          device_label: deviceLabel,
          ip_address: ipAddress,
          user_agent: userAgent,
          remember_device: !!rememberDevice,
          expires_at: sessionExpiry,
          last_accessed_at: now,
          last_otp_verified_at: now,
        })
        .select()
        .single();

      if (sessionError || !newSession) {
        return new Response(JSON.stringify({ error: "Failed to create session" }), { status: 500, headers: noCache });
      }

      await supabase.from("project_client_portal_events").insert({
        portal_id: portalId,
        project_id: portal.project_id,
        contact_id: portal.contact_id,
        event_type: "auth_code_verified",
        metadata: { session_id: newSession.id, remember_device: !!rememberDevice },
        ip_address: ipAddress,
        user_agent: userAgent,
      });

      await supabase.from("project_client_portal_events").insert({
        portal_id: portalId,
        project_id: portal.project_id,
        contact_id: portal.contact_id,
        event_type: "session_created",
        metadata: { session_id: newSession.id, remember_device: !!rememberDevice },
        ip_address: ipAddress,
        user_agent: userAgent,
      });

      await supabase.from("project_client_portal_events").insert({
        portal_id: portalId,
        project_id: portal.project_id,
        contact_id: portal.contact_id,
        event_type: "login_success",
        metadata: {},
        ip_address: ipAddress,
        user_agent: userAgent,
      });

      return new Response(JSON.stringify({
        success: true,
        sessionToken: sessionToken.raw,
        sessionId: newSession.id,
        expiresAt: sessionExpiry,
        rememberDevice: !!rememberDevice,
      }), { status: 200, headers: noCache });
    }

    // ──────────────────────────────────────────────
    // validate-session
    // Called on every portal page load.
    // ──────────────────────────────────────────────
    if (action === "validate-session") {
      const { portalId, sessionToken } = body;
      if (!portalId || !sessionToken) {
        return new Response(JSON.stringify({ valid: false, reason: "missing_params" }), { status: 200, headers: noCache });
      }

      const tokenHash = await sha256(sessionToken);
      const now = new Date().toISOString();

      const { data: session } = await supabase
        .from("project_client_portal_sessions")
        .select("id, portal_id, contact_id, expires_at, revoked_at, last_otp_verified_at, remember_device")
        .eq("session_token_hash", tokenHash)
        .eq("portal_id", portalId)
        .is("revoked_at", null)
        .maybeSingle();

      if (!session) {
        return new Response(JSON.stringify({ valid: false, reason: "not_found" }), { status: 200, headers: noCache });
      }

      if (new Date(session.expires_at) < new Date()) {
        return new Response(JSON.stringify({ valid: false, reason: "expired" }), { status: 200, headers: noCache });
      }

      // Update last_accessed_at
      await supabase
        .from("project_client_portal_sessions")
        .update({ last_accessed_at: now })
        .eq("id", session.id);

      return new Response(JSON.stringify({
        valid: true,
        sessionId: session.id,
        contactId: session.contact_id,
        lastOtpVerifiedAt: session.last_otp_verified_at,
        expiresAt: session.expires_at,
      }), { status: 200, headers: noCache });
    }

    // ──────────────────────────────────────────────
    // logout
    // Revokes current session.
    // ──────────────────────────────────────────────
    if (action === "logout") {
      const { portalId, sessionToken } = body;
      if (!portalId || !sessionToken) {
        return new Response(JSON.stringify({ success: false }), { status: 400, headers: noCache });
      }

      const tokenHash = await sha256(sessionToken);
      const now = new Date().toISOString();

      const { data: session } = await supabase
        .from("project_client_portal_sessions")
        .select("id, contact_id")
        .eq("session_token_hash", tokenHash)
        .eq("portal_id", portalId)
        .is("revoked_at", null)
        .maybeSingle();

      if (session) {
        await supabase
          .from("project_client_portal_sessions")
          .update({ revoked_at: now })
          .eq("id", session.id);

        const { data: portal } = await supabase
          .from("project_client_portals")
          .select("project_id")
          .eq("id", portalId)
          .maybeSingle();

        await supabase.from("project_client_portal_events").insert({
          portal_id: portalId,
          project_id: portal?.project_id || "00000000-0000-0000-0000-000000000000",
          contact_id: session.contact_id,
          event_type: "logout",
          metadata: { session_id: session.id },
          ip_address: ipAddress,
          user_agent: userAgent,
        }).catch(() => {});
      }

      return new Response(JSON.stringify({ success: true }), { status: 200, headers: noCache });
    }

    // ──────────────────────────────────────────────
    // revoke-session (internal admin)
    // ──────────────────────────────────────────────
    if (action === "revoke-session") {
      const { sessionId, portalId } = body;
      if (!sessionId) {
        return new Response(JSON.stringify({ error: "Missing sessionId" }), { status: 400, headers: noCache });
      }

      const now = new Date().toISOString();
      const { data: session } = await supabase
        .from("project_client_portal_sessions")
        .select("id, portal_id, contact_id")
        .eq("id", sessionId)
        .maybeSingle();

      if (!session) {
        return new Response(JSON.stringify({ error: "Session not found" }), { status: 404, headers: noCache });
      }

      await supabase
        .from("project_client_portal_sessions")
        .update({ revoked_at: now })
        .eq("id", sessionId);

      const { data: portal } = await supabase
        .from("project_client_portals")
        .select("project_id")
        .eq("id", session.portal_id)
        .maybeSingle();

      await supabase.from("project_client_portal_events").insert({
        portal_id: session.portal_id,
        project_id: portal?.project_id || "00000000-0000-0000-0000-000000000000",
        contact_id: session.contact_id,
        event_type: "session_revoked",
        metadata: { session_id: sessionId, revoked_by: "admin" },
        ip_address: ipAddress,
        user_agent: userAgent,
      }).catch(() => {});

      return new Response(JSON.stringify({ success: true }), { status: 200, headers: noCache });
    }

    // ──────────────────────────────────────────────
    // revoke-all-sessions (internal admin)
    // ──────────────────────────────────────────────
    if (action === "revoke-all-sessions") {
      const { portalId } = body;
      if (!portalId) {
        return new Response(JSON.stringify({ error: "Missing portalId" }), { status: 400, headers: noCache });
      }

      const now = new Date().toISOString();
      const { count } = await supabase
        .from("project_client_portal_sessions")
        .update({ revoked_at: now })
        .eq("portal_id", portalId)
        .is("revoked_at", null)
        .select("id", { count: "exact", head: true });

      const { data: portal } = await supabase
        .from("project_client_portals")
        .select("project_id, contact_id")
        .eq("id", portalId)
        .maybeSingle();

      await supabase.from("project_client_portal_events").insert({
        portal_id: portalId,
        project_id: portal?.project_id || "00000000-0000-0000-0000-000000000000",
        contact_id: portal?.contact_id || null,
        event_type: "session_revoked",
        metadata: { revoked_by: "admin", count, scope: "all" },
        ip_address: ipAddress,
        user_agent: userAgent,
      }).catch(() => {});

      return new Response(JSON.stringify({ success: true, revokedCount: count }), { status: 200, headers: noCache });
    }

    // ──────────────────────────────────────────────
    // list-sessions (internal admin)
    // ──────────────────────────────────────────────
    if (action === "list-sessions") {
      const { portalId } = body;
      if (!portalId) {
        return new Response(JSON.stringify({ error: "Missing portalId" }), { status: 400, headers: noCache });
      }

      const { data: sessions } = await supabase
        .from("project_client_portal_sessions")
        .select("id, device_label, ip_address, remember_device, expires_at, revoked_at, last_accessed_at, created_at")
        .eq("portal_id", portalId)
        .order("created_at", { ascending: false })
        .limit(50);

      return new Response(JSON.stringify({ sessions: sessions || [] }), { status: 200, headers: noCache });
    }

    // ──────────────────────────────────────────────
    // step-up: update last_otp_verified_at on a session
    // ──────────────────────────────────────────────
    if (action === "step-up-verified") {
      const { portalId, sessionToken } = body;
      if (!portalId || !sessionToken) {
        return new Response(JSON.stringify({ error: "Missing params" }), { status: 400, headers: noCache });
      }

      const tokenHash = await sha256(sessionToken);
      const now = new Date().toISOString();

      await supabase
        .from("project_client_portal_sessions")
        .update({ last_otp_verified_at: now })
        .eq("session_token_hash", tokenHash)
        .eq("portal_id", portalId)
        .is("revoked_at", null);

      return new Response(JSON.stringify({ success: true }), { status: 200, headers: noCache });
    }

    // ──────────────────────────────────────────────
    // get-portal-data
    // Returns full portal + project + contact + org data
    // after verifying the session token is valid.
    // Uses service role to bypass RLS on joined tables.
    // ──────────────────────────────────────────────
    if (action === "get-portal-data") {
      const { portalToken, sessionToken } = body;
      if (!portalToken || !sessionToken) {
        return new Response(JSON.stringify({ error: "Missing portalToken or sessionToken" }), { status: 400, headers: noCache });
      }

      const portalTokenHash = await sha256(portalToken);
      const sessionTokenHash = await sha256(sessionToken);
      const now = new Date().toISOString();

      const { data: portal } = await supabase
        .from("project_client_portals")
        .select("id, org_id, project_id, contact_id, status, expires_at")
        .eq("portal_token_hash", portalTokenHash)
        .eq("status", "active")
        .maybeSingle();

      if (!portal) {
        return new Response(JSON.stringify({ data: null, error: "Portal not found or inactive" }), { status: 200, headers: noCache });
      }

      const { data: session } = await supabase
        .from("project_client_portal_sessions")
        .select("id, expires_at, revoked_at")
        .eq("session_token_hash", sessionTokenHash)
        .eq("portal_id", portal.id)
        .is("revoked_at", null)
        .maybeSingle();

      if (!session || new Date(session.expires_at) < new Date()) {
        return new Response(JSON.stringify({ data: null, error: "Invalid or expired session" }), { status: 200, headers: noCache });
      }

      const { data: fullPortal } = await supabase
        .from("project_client_portals")
        .select(`
          *,
          project:projects(id, name, status, description, start_date, estimated_end_date, updated_at, org_id, contact_id),
          contact:contacts(id, first_name, last_name, email, phone),
          organization:organizations(id, name, email, phone, website),
          created_by_user:users!project_client_portals_created_by_user_id_fkey(id, name, email)
        `)
        .eq("id", portal.id)
        .maybeSingle();

      await supabase
        .from("project_client_portals")
        .update({ last_accessed_at: now, updated_at: now })
        .eq("id", portal.id);

      return new Response(JSON.stringify({ data: fullPortal }), { status: 200, headers: noCache });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400, headers: noCache });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: corsHeaders });
  }
});
