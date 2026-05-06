/**
 * approval-magic-link
 *
 * Handles signed approve/reject links from approval-notification emails.
 * URL pattern (typed-magic-link / typed-link pattern, no auth required):
 *
 *   GET  https://<project>.functions.supabase.co/approval-magic-link?token=<token>
 *        → returns an HTML page with Approve / Reject buttons (server-rendered).
 *
 *   POST https://<project>.functions.supabase.co/approval-magic-link
 *        body: { token, decision: 'approve'|'reject', comment?: string }
 *        → records the decision via resolve_approval_decision RPC.
 *
 * Token format: <approval_id>.<random_64hex>.<hmac_sha256_signature>
 * The hmac is produced server-side using APPROVAL_MAGIC_LINK_SECRET; the
 * approval row stores SHA256(<random_64hex>) in magic_link_token_hash so
 * we can look it up deterministically without storing the raw secret.
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, handleCors } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SECRET = Deno.env.get("APPROVAL_MAGIC_LINK_SECRET") ?? "dev-secret-change-me";

function getSupabase() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

interface ParsedToken {
  approvalId: string;
  randomPart: string;
  signature: string;
}

function parseToken(token: string): ParsedToken | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [approvalId, randomPart, signature] = parts;
  if (!approvalId || !randomPart || !signature) return null;
  return { approvalId, randomPart, signature };
}

async function verifyToken(token: string): Promise<{ valid: boolean; approvalId?: string; tokenHash?: string }> {
  const parsed = parseToken(token);
  if (!parsed) return { valid: false };

  const expectedSig = await hmacSha256Hex(SECRET, `${parsed.approvalId}.${parsed.randomPart}`);
  if (expectedSig !== parsed.signature) return { valid: false };

  const tokenHash = await sha256Hex(parsed.randomPart);
  return { valid: true, approvalId: parsed.approvalId, tokenHash };
}

function renderHtmlShell(title: string, body: string, status: number = 200): Response {
  const html = `<!DOCTYPE html><html><head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, system-ui, sans-serif; max-width: 540px; margin: 6vh auto; padding: 24px; color: #111827; }
    h1 { font-size: 22px; margin: 0 0 8px; }
    p { color: #4b5563; line-height: 1.55; }
    .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
    .btn { display: inline-block; padding: 10px 20px; border-radius: 8px; font-weight: 600; text-decoration: none; font-size: 14px; margin-right: 8px; cursor: pointer; border: none; }
    .btn-approve { background: #16a34a; color: white; }
    .btn-reject { background: #dc2626; color: white; }
    textarea { width: 100%; border: 1px solid #d1d5db; border-radius: 8px; padding: 8px; font-family: inherit; font-size: 14px; box-sizing: border-box; }
    .ok { color: #16a34a; }
    .err { color: #dc2626; }
  </style></head><body><div class="card">${body}</div></body></html>`;
  return new Response(html, {
    status,
    headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
  });
}

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const url = new URL(req.url);
  const token = url.searchParams.get("token") || "";
  const supabase = getSupabase();

  // ─── GET: render the decision page ─────────────────────────────────────
  if (req.method === "GET") {
    const v = await verifyToken(token);
    if (!v.valid) {
      return renderHtmlShell("Invalid Link", `<h1 class="err">Invalid or tampered link</h1><p>Please check that you used the most recent email — old links won't work.</p>`, 400);
    }

    const { data: approval } = await supabase
      .from("workflow_approval_queue")
      .select("id, status, title, description, magic_link_expires_at, draft_content, contact_id, magic_link_token_hash")
      .eq("id", v.approvalId)
      .maybeSingle();

    if (!approval) {
      return renderHtmlShell("Not Found", `<h1 class="err">Approval not found</h1><p>This approval may have been deleted.</p>`, 404);
    }
    if (approval.magic_link_token_hash !== v.tokenHash) {
      return renderHtmlShell("Invalid Link", `<h1 class="err">This link is no longer valid</h1><p>Magic-link rotation has invalidated this URL.</p>`, 400);
    }
    if (approval.status !== "pending_approval") {
      return renderHtmlShell("Already Resolved", `<h1>Already ${approval.status}</h1><p>This approval has already been ${approval.status} — no further action needed.</p>`);
    }
    if (approval.magic_link_expires_at && new Date(approval.magic_link_expires_at) < new Date()) {
      return renderHtmlShell("Expired", `<h1 class="err">This link has expired</h1><p>Please log in to the dashboard to make this decision.</p>`, 410);
    }

    const title = approval.title || "Workflow approval needed";
    const desc = approval.description || "Review the draft content and decide whether to approve.";
    const draft = JSON.stringify(approval.draft_content ?? {}, null, 2);

    return renderHtmlShell(title, `
      <h1>${title}</h1>
      <p>${desc}</p>
      <pre style="background:#f9fafb;border:1px solid #e5e7eb;padding:12px;border-radius:8px;font-size:12px;overflow:auto;max-height:200px;">${draft}</pre>
      <form method="POST" action="${url.origin}${url.pathname}">
        <input type="hidden" name="token" value="${token}">
        <label for="comment" style="display:block;font-size:13px;margin:12px 0 4px;color:#374151;">Comment (optional)</label>
        <textarea name="comment" rows="3"></textarea>
        <div style="margin-top:16px;">
          <button class="btn btn-approve" name="decision" value="approve" type="submit">Approve</button>
          <button class="btn btn-reject" name="decision" value="reject" type="submit">Reject</button>
        </div>
      </form>
    `);
  }

  // ─── POST: record decision ──────────────────────────────────────────────
  if (req.method === "POST") {
    let bodyToken = token;
    let decision = "";
    let comment = "";

    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const body = await req.json();
      bodyToken = body.token || bodyToken;
      decision = body.decision || "";
      comment = body.comment || "";
    } else {
      const form = await req.formData();
      bodyToken = (form.get("token") as string) || bodyToken;
      decision = (form.get("decision") as string) || "";
      comment = (form.get("comment") as string) || "";
    }

    if (!["approve", "reject"].includes(decision)) {
      return renderHtmlShell("Invalid Decision", `<h1 class="err">Invalid decision</h1>`, 400);
    }

    const v = await verifyToken(bodyToken);
    if (!v.valid) {
      return renderHtmlShell("Invalid Link", `<h1 class="err">Invalid or tampered link</h1>`, 400);
    }

    // Lookup decided_by_email from the approval row's stored approver list.
    const { data: approval } = await supabase
      .from("workflow_approval_queue")
      .select("magic_link_token_hash, status")
      .eq("id", v.approvalId)
      .maybeSingle();

    if (!approval) {
      return renderHtmlShell("Not Found", `<h1 class="err">Approval not found</h1>`, 404);
    }
    if (approval.magic_link_token_hash !== v.tokenHash) {
      return renderHtmlShell("Invalid Link", `<h1 class="err">This link is no longer valid</h1>`, 400);
    }

    const { data: result, error } = await supabase.rpc("resolve_approval_decision", {
      p_approval_id: v.approvalId,
      p_decision: decision,
      p_user_id: null,
      p_email: null, // best-effort; could be populated if email is in the magic-link payload
      p_comment: comment || null,
      p_via_magic_link: true,
      p_ip: req.headers.get("x-forwarded-for") || null,
      p_ua: req.headers.get("user-agent") || null,
    });

    if (error) {
      console.error("[approval-magic-link] resolve_approval_decision error:", error);
      return renderHtmlShell("Error", `<h1 class="err">Could not record decision</h1><p>${error.message}</p>`, 500);
    }

    return renderHtmlShell(
      "Decision recorded",
      `<h1 class="ok">Thank you — recorded as ${decision}</h1><p>You can close this window.</p>`
    );
  }

  return new Response("Method not allowed", { status: 405, headers: corsHeaders });
});
