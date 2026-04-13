// Client Portal Auth — contact-scoped portal authentication and invite dispatch.
//
// Replaces the per-project `portal-auth` function. Actions:
//   - send-invite             (service-role or authed admin) → email invite link
//   - send-code               (anon) → send 6-digit OTP to contact email
//   - verify-code             (anon) → validate OTP, return session token
//   - validate-session        (anon) → check session token, return contact info
//   - fetch-projects          (session) → all projects for the authed contact
//   - fetch-project           (session) → one project detail
//   - mark-step-up-verified   (session) → update last_otp_verified_at
//   - list-sessions           (session) → active sessions for device mgmt
//   - logout                  (session) → revoke current session + pending codes

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

// -----------------------------------------------------------------
// Helpers (lifted from portal-auth/index.ts)
// -----------------------------------------------------------------

async function sha256(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const buffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generateSecureToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function generateOtpCode(): string {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return String(100000 + (arr[0] % 900000));
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

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function getServiceClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function isServiceRoleRequest(req: Request): boolean {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return false;
  const token = authHeader.replace("Bearer ", "");
  const expected = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (token.length !== expected.length) return false;
  const a = new TextEncoder().encode(token);
  const b = new TextEncoder().encode(expected);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function getAuthedUserOrgId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;
  const token = authHeader.replace("Bearer ", "");
  try {
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    const { data: { user }, error } = await anonClient.auth.getUser(token);
    if (error || !user) return null;
    const service = getServiceClient();
    const { data: userRow } = await service
      .from("users")
      .select("organization_id")
      .eq("id", user.id)
      .maybeSingle();
    return userRow?.organization_id ?? null;
  } catch {
    return null;
  }
}

// -----------------------------------------------------------------
// HMAC-signed invite token
// -----------------------------------------------------------------

async function signInvitePayload(payload: object): Promise<string | null> {
  const secret = Deno.env.get("CLIENT_PORTAL_INVITE_HMAC_SECRET");
  if (!secret) {
    // HMAC secret not configured — return null so the invite link
    // goes to /client-portal without a signed token. The client will
    // just need to type their email manually on the login page.
    console.warn("[client-portal-auth] CLIENT_PORTAL_INVITE_HMAC_SECRET not set — invite links will not include a signed token");
    return null;
  }
  const body = btoa(JSON.stringify(payload))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  const sig = Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${body}.${sig}`;
}

async function verifyInvitePayload(
  token: string
): Promise<{ org_id: string; contact_id: string; iat: number } | null> {
  try {
    const [body, sig] = token.split(".");
    if (!body || !sig) return null;
    const secret = Deno.env.get("CLIENT_PORTAL_INVITE_HMAC_SECRET") || "";
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const expectedBuf = await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(body)
    );
    const expected = Array.from(new Uint8Array(expectedBuf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    if (expected !== sig) return null;
    const padded = body.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = atob(padded + "=".repeat((4 - padded.length % 4) % 4));
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

// -----------------------------------------------------------------
// Email templates
// -----------------------------------------------------------------

function buildInvitationEmailHtml(params: {
  clientName: string;
  projectName: string;
  orgName: string;
  portalUrl: string;
  supportEmail: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Welcome to your Client Portal</title></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
        <tr><td style="background:#ffffff;border-radius:12px;padding:48px 40px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#2563eb;letter-spacing:0.05em;text-transform:uppercase;">${params.orgName}</p>
          <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#0f172a;line-height:1.3;">Your Client Portal is ready</h1>
          <p style="margin:0 0 12px;font-size:15px;color:#64748b;line-height:1.6;">Hi ${params.clientName},</p>
          <p style="margin:0 0 24px;font-size:15px;color:#64748b;line-height:1.6;">
            You now have access to the client portal for your project <strong style="color:#0f172a;">${params.projectName}</strong>. From there you can track progress, submit change requests, open support tickets, and view shared documents.
          </p>
          <p style="margin:0 0 24px;font-size:15px;color:#64748b;line-height:1.6;">
            If you have more than one project with us, they will all appear in the same portal after you sign in.
          </p>
          <div style="text-align:center;margin:32px 0;">
            <a href="${params.portalUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">Open Client Portal</a>
          </div>
          <p style="margin:0 0 24px;font-size:13px;color:#94a3b8;text-align:center;">
            When you open the portal you will be asked for a 6-digit verification code, which we will email to you.
          </p>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:0 0 24px;">
          <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;">
            Need help? Contact us at <a href="mailto:${params.supportEmail}" style="color:#2563eb;text-decoration:none;">${params.supportEmail}</a>
          </p>
        </td></tr>
        <tr><td style="padding:20px 0;text-align:center;">
          <p style="margin:0;font-size:12px;color:#94a3b8;">This is a transactional email sent on behalf of ${params.orgName}.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function buildOtpEmailHtml(params: {
  clientName: string;
  orgName: string;
  code: string;
  expirationMinutes: number;
  supportEmail: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Your Verification Code</title></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
        <tr><td style="background:#ffffff;border-radius:12px;padding:48px 40px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#2563eb;letter-spacing:0.05em;text-transform:uppercase;">${params.orgName}</p>
          <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#0f172a;line-height:1.3;">Verify Your Access</h1>
          <p style="margin:0 0 32px;font-size:15px;color:#64748b;line-height:1.6;">
            Hi ${params.clientName}, use the code below to sign in to the client portal.
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
            If you did not request this code, you can safely ignore this email.<br><br>
            Need help? Contact us at <a href="mailto:${params.supportEmail}" style="color:#2563eb;text-decoration:none;">${params.supportEmail}</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

// -----------------------------------------------------------------
// Internal: send email via SendGrid directly (same pattern as the
// original portal-auth edge function). This is more reliable than
// routing through the email-send function because it avoids auth
// context issues with internal edge-function-to-edge-function calls.
// -----------------------------------------------------------------

async function sendTransactionalEmail(
  supabase: SupabaseClient,
  orgId: string,
  params: {
    toEmail: string;
    toName?: string;
    subject: string;
    htmlBody: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get SendGrid API key (env var or org-level encrypted credential)
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    // Try env var first, then org-level credential
    let apiKey = Deno.env.get("SENDGRID_API_KEY") ?? null;
    if (!apiKey) {
      const { data: conn } = await supabase
        .from("integration_connections")
        .select("credentials_encrypted, credentials_iv, status, integrations!inner(key)")
        .eq("org_id", orgId)
        .eq("integrations.key", "sendgrid")
        .maybeSingle();
      if (conn?.status === "connected" && conn.credentials_encrypted && conn.credentials_iv) {
        const res = await fetch(`${supabaseUrl}/functions/v1/email-crypto`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${serviceRoleKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ action: "decrypt", encrypted: conn.credentials_encrypted, iv: conn.credentials_iv }),
        });
        if (res.ok) {
          const data = await res.json();
          apiKey = data.plaintext;
        }
      }
    }

    if (!apiKey) {
      return { success: false, error: "SendGrid API key not configured" };
    }

    // Resolve org from-address
    const { data: org } = await supabase
      .from("organizations")
      .select("name, contact_email")
      .eq("id", orgId)
      .maybeSingle();

    let fromEmail = org?.contact_email || "noreply@example.com";
    let fromName = org?.name || "Client Portal";

    const { data: defaults } = await supabase
      .from("email_defaults")
      .select("default_from_address_id")
      .eq("org_id", orgId)
      .maybeSingle();

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

    // Send via SendGrid
    const sgRes = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: params.toEmail, name: params.toName }] }],
        from: { email: fromEmail, name: fromName },
        subject: params.subject,
        content: [{ type: "text/html", value: params.htmlBody }],
        tracking_settings: {
          open_tracking: { enable: false },
          click_tracking: { enable: false },
        },
      }),
    });

    if (!sgRes.ok) {
      const errBody = await sgRes.text().catch(() => "");
      console.error(`[client-portal-auth] SendGrid ${sgRes.status}: ${errBody}`);
      return { success: false, error: `SendGrid error ${sgRes.status}` };
    }

    return { success: true };
  } catch (err) {
    console.error("[client-portal-auth] sendTransactionalEmail error:", err);
    return { success: false, error: String(err) };
  }
}

// -----------------------------------------------------------------
// Org resolution (shared by send-code / verify-code / send-invite)
// -----------------------------------------------------------------

async function getOrgInfo(
  supabase: SupabaseClient,
  orgId: string
): Promise<{ name: string; supportEmail: string }> {
  const { data: org } = await supabase
    .from("organizations")
    .select("name, contact_email")
    .eq("id", orgId)
    .maybeSingle();
  return {
    name: org?.name ?? "Our Company",
    supportEmail: org?.contact_email ?? "support@example.com",
  };
}

async function resolveContactByEmail(
  supabase: SupabaseClient,
  email: string,
  orgId: string | null
): Promise<{ id: string; org_id: string; first_name: string | null; last_name: string | null; email: string } | null> {
  let query = supabase
    .from("contacts")
    .select("id, org_id, first_name, last_name, email")
    .ilike("email", email)
    .order("updated_at", { ascending: false })
    .limit(1);
  if (orgId) query = query.eq("org_id", orgId);
  const { data } = await query.maybeSingle();
  return data as any;
}

async function resolveSessionContact(
  supabase: SupabaseClient,
  sessionToken: string
): Promise<{
  session_id: string;
  contact_id: string;
  org_id: string;
  last_otp_verified_at: string | null;
  expires_at: string;
} | null> {
  if (!sessionToken) return null;
  const tokenHash = await sha256(sessionToken);
  const { data: session } = await supabase
    .from("client_portal_sessions")
    .select("id, contact_id, org_id, last_otp_verified_at, expires_at, revoked_at")
    .eq("session_token_hash", tokenHash)
    .maybeSingle();
  if (!session) return null;
  if (session.revoked_at) return null;
  if (new Date(session.expires_at).getTime() < Date.now()) return null;
  return {
    session_id: session.id,
    contact_id: session.contact_id,
    org_id: session.org_id,
    last_otp_verified_at: session.last_otp_verified_at,
    expires_at: session.expires_at,
  };
}

// -----------------------------------------------------------------
// Action: send-invite
// -----------------------------------------------------------------

async function handleSendInvite(
  supabase: SupabaseClient,
  req: Request,
  payload: { projectId?: string }
): Promise<Response> {
  if (!payload.projectId) return json({ error: "Missing projectId" }, 400);

  const authedOrgId = await getAuthedUserOrgId(req);
  const isServiceRole = isServiceRoleRequest(req);
  const isAuthedAdmin = authedOrgId !== null;

  if (!isServiceRole && !isAuthedAdmin) {
    return json({ error: "Unauthorized" }, 401);
  }

  // Load project with contact info
  const { data: project } = await supabase
    .from("projects")
    .select("id, org_id, name, contact_id, contact:contacts(id, first_name, last_name, email)")
    .eq("id", payload.projectId)
    .maybeSingle();

  if (!project) return json({ error: "Project not found" }, 404);

  if (isAuthedAdmin && authedOrgId !== project.org_id) {
    return json({ error: "Forbidden" }, 403);
  }

  const contact = (project.contact as unknown) as {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  } | null;

  if (!contact || !contact.email) {
    console.warn(`[client-portal-auth] send-invite skipped for project ${project.id}: no contact email`);
    return json({ success: true, skipped: true, skippedReason: "no_contact_email" });
  }

  // Upsert the portal account
  const { data: existingAccount } = await supabase
    .from("client_portal_accounts")
    .select("id, invite_sent_at, invite_count")
    .eq("org_id", project.org_id)
    .eq("contact_id", contact.id)
    .maybeSingle();

  // Throttle: auto-invites (service role) are capped at 1 per 24 hours per (org, contact).
  if (isServiceRole && !isAuthedAdmin && existingAccount?.invite_sent_at) {
    const last = new Date(existingAccount.invite_sent_at).getTime();
    if (Date.now() - last < 24 * 60 * 60 * 1000) {
      return json({ success: true, skipped: true, skippedReason: "throttled" });
    }
  }

  let accountId: string;
  if (existingAccount) {
    accountId = existingAccount.id;
    await supabase
      .from("client_portal_accounts")
      .update({
        status: "active",
        invite_sent_at: new Date().toISOString(),
        invite_count: (existingAccount.invite_count ?? 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", accountId);
  } else {
    const { data: created, error: insertError } = await supabase
      .from("client_portal_accounts")
      .insert({
        org_id: project.org_id,
        contact_id: contact.id,
        status: "active",
        invite_sent_at: new Date().toISOString(),
        invite_count: 1,
      })
      .select("id")
      .single();
    if (insertError || !created) {
      return json({ error: "Failed to create portal account", details: insertError?.message }, 500);
    }
    accountId = created.id;
  }

  // Build invite link (with signed token if HMAC secret is configured)
  const inviteToken = await signInvitePayload({
    org_id: project.org_id,
    contact_id: contact.id,
    iat: Math.floor(Date.now() / 1000),
  });
  const appBase = Deno.env.get("APP_BASE_URL") ?? "https://os.autom8ionlab.com";
  const portalUrl = inviteToken
    ? `${appBase}/client-portal?invite=${encodeURIComponent(inviteToken)}`
    : `${appBase}/client-portal`;

  const orgInfo = await getOrgInfo(supabase, project.org_id);
  const clientName = `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() || "there";

  const htmlBody = buildInvitationEmailHtml({
    clientName,
    projectName: project.name,
    orgName: orgInfo.name,
    portalUrl,
    supportEmail: orgInfo.supportEmail,
  });

  const emailResult = await sendTransactionalEmail(supabase, project.org_id, {
    toEmail: contact.email,
    toName: clientName,
    subject: `Your client portal for ${project.name}`,
    htmlBody,
  });

  if (!emailResult.success) {
    console.error(`[client-portal-auth] send-invite failed for project ${project.id}: ${emailResult.error}`);
    return json({ success: false, error: emailResult.error }, 500);
  }

  await supabase.from("client_portal_events").insert({
    org_id: project.org_id,
    account_id: accountId,
    contact_id: contact.id,
    project_id: project.id,
    event_type: "invite_sent",
    metadata: { project_name: project.name, throttle_bypassed: isAuthedAdmin },
  });

  return json({ success: true });
}

// -----------------------------------------------------------------
// Action: send-code
// -----------------------------------------------------------------

async function handleSendCode(
  supabase: SupabaseClient,
  req: Request,
  payload: { email?: string; inviteToken?: string }
): Promise<Response> {
  // Default masked response — we always return this on success or invalid email.
  const maskedResponse = (email: string) =>
    json({
      success: true,
      maskedEmail: maskEmail(email),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });

  let contactId: string | null = null;
  let orgId: string | null = null;
  let email: string | null = null;

  // Invite-token takes precedence
  if (payload.inviteToken) {
    const decoded = await verifyInvitePayload(payload.inviteToken);
    if (decoded) {
      const { data: contact } = await supabase
        .from("contacts")
        .select("id, org_id, email")
        .eq("id", decoded.contact_id)
        .eq("org_id", decoded.org_id)
        .maybeSingle();
      if (contact?.email) {
        contactId = contact.id;
        orgId = contact.org_id;
        email = contact.email;
      }
    }
  }

  // Fallback: email lookup
  if (!contactId && payload.email) {
    const contact = await resolveContactByEmail(supabase, payload.email, null);
    if (contact) {
      contactId = contact.id;
      orgId = contact.org_id;
      email = contact.email;
    }
  }

  if (!contactId || !orgId || !email) {
    // Return masked success regardless to prevent enumeration.
    return maskedResponse(payload.email ?? "unknown@example.com");
  }

  // Ensure a portal account exists. If the contact exists in the DB but
  // was never formally invited (no client_portal_accounts row), auto-create
  // one so the OTP flow works. This lets any contact who knows their email
  // sign in without waiting for an admin-triggered invite.
  let portalAccountId: string;
  const { data: existingAccount } = await supabase
    .from("client_portal_accounts")
    .select("id")
    .eq("org_id", orgId)
    .eq("contact_id", contactId)
    .maybeSingle();

  if (existingAccount) {
    portalAccountId = existingAccount.id;
  } else {
    const { data: newAccount, error: createErr } = await supabase
      .from("client_portal_accounts")
      .insert({ org_id: orgId, contact_id: contactId, status: "active" })
      .select("id")
      .single();
    if (createErr || !newAccount) {
      console.error("[client-portal-auth] Failed to auto-create portal account:", createErr?.message);
      return maskedResponse(email);
    }
    portalAccountId = newAccount.id;
  }

  // 60-second rate limit per (org, contact)
  const { data: recentCode } = await supabase
    .from("client_portal_auth_codes")
    .select("created_at")
    .eq("org_id", orgId)
    .eq("contact_id", contactId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recentCode && Date.now() - new Date(recentCode.created_at).getTime() < 60_000) {
    return json({ success: false, rateLimited: true, maskedEmail: maskEmail(email) }, 200);
  }

  // Invalidate any prior pending codes for this contact
  await supabase
    .from("client_portal_auth_codes")
    .update({ invalidated_at: new Date().toISOString() })
    .eq("org_id", orgId)
    .eq("contact_id", contactId)
    .is("consumed_at", null)
    .is("invalidated_at", null);

  // Generate + store
  const code = generateOtpCode();
  const codeHash = await sha256(code);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const { error: insertErr } = await supabase
    .from("client_portal_auth_codes")
    .insert({
      org_id: orgId,
      contact_id: contactId,
      code_hash: codeHash,
      expires_at: expiresAt,
    });

  if (insertErr) {
    return json({ error: "Failed to create auth code" }, 500);
  }

  // Send OTP email
  const { data: contactRow } = await supabase
    .from("contacts")
    .select("first_name, last_name")
    .eq("id", contactId)
    .maybeSingle();

  const orgInfo = await getOrgInfo(supabase, orgId);
  const clientName = `${contactRow?.first_name ?? ""} ${contactRow?.last_name ?? ""}`.trim() || "there";

  const htmlBody = buildOtpEmailHtml({
    clientName,
    orgName: orgInfo.name,
    code,
    expirationMinutes: 10,
    supportEmail: orgInfo.supportEmail,
  });

  await sendTransactionalEmail(supabase, orgId, {
    toEmail: email,
    toName: clientName,
    subject: `Your ${orgInfo.name} portal verification code`,
    htmlBody,
  });

  await supabase.from("client_portal_events").insert({
    org_id: orgId,
    account_id: portalAccountId,
    contact_id: contactId,
    event_type: "otp_sent",
    metadata: {},
  });

  return maskedResponse(email);
}

// -----------------------------------------------------------------
// Action: verify-code
// -----------------------------------------------------------------

async function handleVerifyCode(
  supabase: SupabaseClient,
  req: Request,
  payload: { email?: string; code?: string; rememberDevice?: boolean; inviteToken?: string }
): Promise<Response> {
  if (!payload.code || payload.code.length !== 6) {
    return json({ success: false, error: "Invalid code format" }, 400);
  }

  // Resolve contact the same way as send-code
  let contactId: string | null = null;
  let orgId: string | null = null;

  if (payload.inviteToken) {
    const decoded = await verifyInvitePayload(payload.inviteToken);
    if (decoded) {
      contactId = decoded.contact_id;
      orgId = decoded.org_id;
    }
  }
  if (!contactId && payload.email) {
    const contact = await resolveContactByEmail(supabase, payload.email, null);
    if (contact) {
      contactId = contact.id;
      orgId = contact.org_id;
    }
  }

  if (!contactId || !orgId) {
    return json({ success: false, error: "Invalid credentials" }, 401);
  }

  // Find the most recent non-consumed, non-invalidated, non-expired code
  const { data: authCode } = await supabase
    .from("client_portal_auth_codes")
    .select("id, code_hash, expires_at, attempts, max_attempts")
    .eq("org_id", orgId)
    .eq("contact_id", contactId)
    .is("consumed_at", null)
    .is("invalidated_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!authCode) {
    return json({ success: false, error: "No active code. Request a new one." }, 401);
  }

  if (authCode.attempts >= authCode.max_attempts) {
    await supabase
      .from("client_portal_auth_codes")
      .update({ invalidated_at: new Date().toISOString() })
      .eq("id", authCode.id);
    return json({ success: false, maxAttemptsExceeded: true, error: "Too many attempts" }, 401);
  }

  const expectedHash = await sha256(payload.code);
  if (expectedHash !== authCode.code_hash) {
    await supabase
      .from("client_portal_auth_codes")
      .update({ attempts: authCode.attempts + 1 })
      .eq("id", authCode.id);
    const remaining = Math.max(0, authCode.max_attempts - (authCode.attempts + 1));
    return json({ success: false, attemptsRemaining: remaining, error: "Incorrect code" }, 401);
  }

  // Consume the code
  await supabase
    .from("client_portal_auth_codes")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", authCode.id);

  // Create a session
  const sessionToken = generateSecureToken();
  const sessionHash = await sha256(sessionToken);
  const ttlMs = payload.rememberDevice ? 30 * 24 * 60 * 60 * 1000 : 12 * 60 * 60 * 1000;
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();

  const userAgent = req.headers.get("user-agent") ?? "";
  const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  const { data: sessionRow, error: sessionErr } = await supabase
    .from("client_portal_sessions")
    .insert({
      org_id: orgId,
      contact_id: contactId,
      session_token_hash: sessionHash,
      remember_device: !!payload.rememberDevice,
      expires_at: expiresAt,
      last_otp_verified_at: new Date().toISOString(),
      ip_address: ipAddress,
      user_agent: userAgent,
    })
    .select("id")
    .single();

  if (sessionErr || !sessionRow) {
    return json({ success: false, error: "Failed to create session" }, 500);
  }

  // Update account last_login_at
  const { data: account } = await supabase
    .from("client_portal_accounts")
    .update({ last_login_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("org_id", orgId)
    .eq("contact_id", contactId)
    .select("id")
    .maybeSingle();

  if (account) {
    await supabase.from("client_portal_events").insert({
      org_id: orgId,
      account_id: account.id,
      contact_id: contactId,
      event_type: "session_created",
      metadata: { remember_device: !!payload.rememberDevice, device_label: deriveDeviceLabel(userAgent) },
      ip_address: ipAddress,
      user_agent: userAgent,
    });
  }

  return json({
    success: true,
    sessionToken,
    sessionId: sessionRow.id,
    expiresAt,
  });
}

// -----------------------------------------------------------------
// Action: validate-session
// -----------------------------------------------------------------

async function handleValidateSession(
  supabase: SupabaseClient,
  payload: { sessionToken?: string }
): Promise<Response> {
  if (!payload.sessionToken) return json({ valid: false }, 200);
  const session = await resolveSessionContact(supabase, payload.sessionToken);
  if (!session) return json({ valid: false }, 200);

  const { data: contact } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, email")
    .eq("id", session.contact_id)
    .maybeSingle();

  const orgInfo = await getOrgInfo(supabase, session.org_id);

  return json({
    valid: true,
    sessionId: session.session_id,
    contactId: session.contact_id,
    contactName: `${contact?.first_name ?? ""} ${contact?.last_name ?? ""}`.trim(),
    contactEmail: contact?.email ?? null,
    orgId: session.org_id,
    orgName: orgInfo.name,
    supportEmail: orgInfo.supportEmail,
    lastOtpVerifiedAt: session.last_otp_verified_at,
    expiresAt: session.expires_at,
  });
}

// -----------------------------------------------------------------
// Action: fetch-projects
// -----------------------------------------------------------------

async function handleFetchProjects(
  supabase: SupabaseClient,
  payload: { sessionToken?: string }
): Promise<Response> {
  const session = await resolveSessionContact(supabase, payload.sessionToken ?? "");
  if (!session) return json({ error: "Unauthorized" }, 401);

  const { data: projects } = await supabase
    .from("projects")
    .select(
      "id, org_id, name, description, status, priority, start_date, target_end_date, progress_percent, budget_amount, currency, stage_id, pipeline_id, contact_id, created_at, stage:project_stages(id, name, sort_order, color)"
    )
    .eq("org_id", session.org_id)
    .eq("contact_id", session.contact_id)
    .neq("status", "archived")
    .order("created_at", { ascending: false });

  return json({ success: true, projects: projects ?? [] });
}

// -----------------------------------------------------------------
// Action: fetch-project
// -----------------------------------------------------------------

async function handleFetchProject(
  supabase: SupabaseClient,
  payload: { sessionToken?: string; projectId?: string }
): Promise<Response> {
  if (!payload.projectId) return json({ error: "Missing projectId" }, 400);
  const session = await resolveSessionContact(supabase, payload.sessionToken ?? "");
  if (!session) return json({ error: "Unauthorized" }, 401);

  const { data: project } = await supabase
    .from("projects")
    .select(
      "*, stage:project_stages(id, name, sort_order, color), pipeline:project_pipelines(id, name), contact:contacts(id, first_name, last_name, email)"
    )
    .eq("id", payload.projectId)
    .eq("org_id", session.org_id)
    .eq("contact_id", session.contact_id)
    .maybeSingle();

  if (!project) return json({ error: "Project not found" }, 404);

  const orgInfo = await getOrgInfo(supabase, session.org_id);
  return json({
    success: true,
    project,
    orgName: orgInfo.name,
    supportEmail: orgInfo.supportEmail,
  });
}

// -----------------------------------------------------------------
// Action: mark-step-up-verified
// -----------------------------------------------------------------

async function handleMarkStepUpVerified(
  supabase: SupabaseClient,
  payload: { sessionToken?: string }
): Promise<Response> {
  const session = await resolveSessionContact(supabase, payload.sessionToken ?? "");
  if (!session) return json({ error: "Unauthorized" }, 401);

  await supabase
    .from("client_portal_sessions")
    .update({ last_otp_verified_at: new Date().toISOString() })
    .eq("id", session.session_id);

  return json({ success: true });
}

// -----------------------------------------------------------------
// Action: list-sessions
// -----------------------------------------------------------------

async function handleListSessions(
  supabase: SupabaseClient,
  payload: { sessionToken?: string }
): Promise<Response> {
  const session = await resolveSessionContact(supabase, payload.sessionToken ?? "");
  if (!session) return json({ error: "Unauthorized" }, 401);

  const { data: sessions } = await supabase
    .from("client_portal_sessions")
    .select("id, created_at, expires_at, remember_device, user_agent, ip_address")
    .eq("org_id", session.org_id)
    .eq("contact_id", session.contact_id)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });

  return json({
    success: true,
    currentSessionId: session.session_id,
    sessions: (sessions ?? []).map((s) => ({
      id: s.id,
      createdAt: s.created_at,
      expiresAt: s.expires_at,
      rememberDevice: s.remember_device,
      deviceLabel: deriveDeviceLabel(s.user_agent ?? ""),
      isCurrent: s.id === session.session_id,
    })),
  });
}

// -----------------------------------------------------------------
// Action: logout
// -----------------------------------------------------------------

async function handleLogout(
  supabase: SupabaseClient,
  payload: { sessionToken?: string }
): Promise<Response> {
  const session = await resolveSessionContact(supabase, payload.sessionToken ?? "");
  if (!session) return json({ success: true });

  await supabase
    .from("client_portal_sessions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", session.session_id);

  // Invalidate any outstanding auth codes so a replayed code from email can't re-auth
  await supabase
    .from("client_portal_auth_codes")
    .update({ invalidated_at: new Date().toISOString() })
    .eq("contact_id", session.contact_id)
    .is("consumed_at", null)
    .is("invalidated_at", null);

  const { data: account } = await supabase
    .from("client_portal_accounts")
    .select("id")
    .eq("org_id", session.org_id)
    .eq("contact_id", session.contact_id)
    .maybeSingle();

  if (account) {
    await supabase.from("client_portal_events").insert({
      org_id: session.org_id,
      account_id: account.id,
      contact_id: session.contact_id,
      event_type: "logout",
    });
  }

  return json({ success: true });
}

// -----------------------------------------------------------------
// Entry point
// -----------------------------------------------------------------

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const supabase = getServiceClient();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const action = String(body.action ?? "");

  try {
    switch (action) {
      case "send-invite":
        return await handleSendInvite(supabase, req, body as { projectId?: string });
      case "send-code":
        return await handleSendCode(supabase, req, body as { email?: string; inviteToken?: string });
      case "verify-code":
        return await handleVerifyCode(
          supabase,
          req,
          body as { email?: string; code?: string; rememberDevice?: boolean; inviteToken?: string }
        );
      case "validate-session":
        return await handleValidateSession(supabase, body as { sessionToken?: string });
      case "fetch-projects":
        return await handleFetchProjects(supabase, body as { sessionToken?: string });
      case "fetch-project":
        return await handleFetchProject(
          supabase,
          body as { sessionToken?: string; projectId?: string }
        );
      case "mark-step-up-verified":
        return await handleMarkStepUpVerified(supabase, body as { sessionToken?: string });
      case "list-sessions":
        return await handleListSessions(supabase, body as { sessionToken?: string });
      case "logout":
        return await handleLogout(supabase, body as { sessionToken?: string });
      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (err) {
    console.error(`[client-portal-auth] action=${action} failed:`, err);
    return json({ error: "Internal server error", details: String(err) }, 500);
  }
});
