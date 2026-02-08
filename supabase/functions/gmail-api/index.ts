import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_API_URL = "https://gmail.googleapis.com/gmail/v1";

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(message: string, status = 400) {
  return jsonResponse({ error: message }, status);
}

function encodeBase64Url(str: string): string {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  let base64 = "";
  const bytes = new Uint8Array(data);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    base64 += String.fromCharCode(bytes[i]);
  }
  return btoa(base64).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function buildRawEmail(params: {
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body: string;
  inReplyTo?: string;
  references?: string;
  fromEmail?: string;
}): string {
  const lines: string[] = [];
  if (params.fromEmail) lines.push(`From: ${params.fromEmail}`);
  lines.push(`To: ${params.to}`);
  if (params.cc) lines.push(`Cc: ${params.cc}`);
  if (params.bcc) lines.push(`Bcc: ${params.bcc}`);
  lines.push(`Subject: ${params.subject}`);
  if (params.inReplyTo) lines.push(`In-Reply-To: ${params.inReplyTo}`);
  if (params.references) lines.push(`References: ${params.references}`);
  lines.push("Content-Type: text/html; charset=utf-8");
  lines.push("MIME-Version: 1.0");
  lines.push("");
  lines.push(params.body);
  return encodeBase64Url(lines.join("\r\n"));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const googleClientId = Deno.env.get("GOOGLE_CLIENT_ID")!;
    const googleClientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

    if (!supabaseUrl || !serviceRoleKey || !googleClientId || !googleClientSecret) {
      return errorResponse("Missing server configuration", 500);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return errorResponse("Unauthorized", 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return errorResponse("Unauthorized", 401);
    }

    const { data: userData } = await supabase
      .from("users")
      .select("id, organization_id")
      .eq("id", user.id)
      .maybeSingle();

    if (!userData) {
      return errorResponse("User not found", 404);
    }

    const { data: tokenData } = await supabase
      .from("gmail_oauth_tokens")
      .select("*")
      .eq("organization_id", userData.organization_id)
      .eq("user_id", userData.id)
      .maybeSingle();

    if (!tokenData) {
      return errorResponse("Gmail not connected", 400);
    }

    let accessToken = tokenData.access_token;
    const tokenExpiry = new Date(tokenData.token_expiry);

    if (tokenExpiry < new Date(Date.now() + 5 * 60 * 1000)) {
      const refreshResponse = await fetch(GOOGLE_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          refresh_token: tokenData.refresh_token,
          client_id: googleClientId,
          client_secret: googleClientSecret,
          grant_type: "refresh_token",
        }),
      });

      if (!refreshResponse.ok) {
        return errorResponse("Failed to refresh Gmail token. Please reconnect.", 401);
      }

      const refreshData = await refreshResponse.json();
      accessToken = refreshData.access_token;

      await supabase
        .from("gmail_oauth_tokens")
        .update({
          access_token: accessToken,
          token_expiry: new Date(Date.now() + refreshData.expires_in * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", tokenData.id);
    }

    const body = await req.json();
    const { action } = body;

    switch (action) {
      case "get-profile": {
        const res = await fetch(`${GMAIL_API_URL}/users/me/profile`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) return errorResponse("Failed to get Gmail profile", res.status);
        return jsonResponse(await res.json());
      }

      case "list-messages": {
        const { query = "", maxResults = 20, pageToken } = body;
        const params = new URLSearchParams({ q: query, maxResults: String(maxResults) });
        if (pageToken) params.set("pageToken", pageToken);

        const res = await fetch(`${GMAIL_API_URL}/users/me/messages?${params}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) return errorResponse("Failed to list messages", res.status);
        return jsonResponse(await res.json());
      }

      case "get-message": {
        const { messageId, format = "full" } = body;
        if (!messageId) return errorResponse("messageId required");

        const res = await fetch(
          `${GMAIL_API_URL}/users/me/messages/${messageId}?format=${format}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (!res.ok) return errorResponse("Failed to get message", res.status);
        return jsonResponse(await res.json());
      }

      case "get-thread": {
        const { threadId } = body;
        if (!threadId) return errorResponse("threadId required");

        const res = await fetch(
          `${GMAIL_API_URL}/users/me/threads/${threadId}?format=full`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (!res.ok) return errorResponse("Failed to get thread", res.status);
        return jsonResponse(await res.json());
      }

      case "send": {
        const { to, cc, bcc, subject, htmlBody, threadId, inReplyTo, references } = body;
        if (!to || !subject || !htmlBody) return errorResponse("to, subject, htmlBody required");

        const raw = buildRawEmail({
          to, cc, bcc, subject, body: htmlBody,
          inReplyTo, references, fromEmail: tokenData.email,
        });

        const sendBody: Record<string, string> = { raw };
        if (threadId) sendBody.threadId = threadId;

        const res = await fetch(`${GMAIL_API_URL}/users/me/messages/send`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(sendBody),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          return errorResponse(err.error?.message || "Failed to send email", res.status);
        }

        const sentMsg = await res.json();

        if (body.conversationId && body.contactId) {
          await supabase.from("messages").insert({
            organization_id: userData.organization_id,
            conversation_id: body.conversationId,
            contact_id: body.contactId,
            channel: "email",
            direction: "outbound",
            body: htmlBody.substring(0, 50000),
            subject,
            metadata: {
              from_email: tokenData.email,
              to_email: to,
              cc,
              bcc,
              thread_id: sentMsg.threadId,
              gmail_message_id: sentMsg.id,
              sent_via: "gmail",
            },
            status: "delivered",
            external_id: sentMsg.id,
            sent_at: new Date().toISOString(),
          });

          await supabase
            .from("conversations")
            .update({
              last_message_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", body.conversationId);
        }

        return jsonResponse(sentMsg);
      }

      case "reply": {
        const { to, cc, bcc, subject, htmlBody, threadId, inReplyTo, references } = body;
        if (!to || !htmlBody || !threadId) return errorResponse("to, htmlBody, threadId required");

        const replySubject = subject || "";
        const raw = buildRawEmail({
          to, cc, bcc, subject: replySubject, body: htmlBody,
          inReplyTo, references, fromEmail: tokenData.email,
        });

        const res = await fetch(`${GMAIL_API_URL}/users/me/messages/send`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ raw, threadId }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          return errorResponse(err.error?.message || "Failed to send reply", res.status);
        }

        const sentMsg = await res.json();

        if (body.conversationId && body.contactId) {
          await supabase.from("messages").insert({
            organization_id: userData.organization_id,
            conversation_id: body.conversationId,
            contact_id: body.contactId,
            channel: "email",
            direction: "outbound",
            body: htmlBody.substring(0, 50000),
            subject: replySubject,
            metadata: {
              from_email: tokenData.email,
              to_email: to,
              cc,
              bcc,
              thread_id: sentMsg.threadId,
              gmail_message_id: sentMsg.id,
              sent_via: "gmail",
            },
            status: "delivered",
            external_id: sentMsg.id,
            sent_at: new Date().toISOString(),
          });

          await supabase
            .from("conversations")
            .update({
              last_message_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", body.conversationId);
        }

        return jsonResponse(sentMsg);
      }

      case "create-draft": {
        const { to, cc, bcc, subject, htmlBody, threadId } = body;
        const raw = buildRawEmail({
          to: to || "", cc, bcc, subject: subject || "", body: htmlBody || "",
          fromEmail: tokenData.email,
        });

        const draftBody: Record<string, unknown> = { message: { raw } };
        if (threadId) (draftBody.message as Record<string, string>).threadId = threadId;

        const res = await fetch(`${GMAIL_API_URL}/users/me/drafts`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(draftBody),
        });

        if (!res.ok) return errorResponse("Failed to create draft", res.status);
        return jsonResponse(await res.json());
      }

      case "update-draft": {
        const { draftId, to, cc, bcc, subject, htmlBody, threadId } = body;
        if (!draftId) return errorResponse("draftId required");

        const raw = buildRawEmail({
          to: to || "", cc, bcc, subject: subject || "", body: htmlBody || "",
          fromEmail: tokenData.email,
        });

        const draftBody: Record<string, unknown> = { message: { raw } };
        if (threadId) (draftBody.message as Record<string, string>).threadId = threadId;

        const res = await fetch(`${GMAIL_API_URL}/users/me/drafts/${draftId}`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(draftBody),
        });

        if (!res.ok) return errorResponse("Failed to update draft", res.status);
        return jsonResponse(await res.json());
      }

      case "delete-draft": {
        const { draftId } = body;
        if (!draftId) return errorResponse("draftId required");

        const res = await fetch(`${GMAIL_API_URL}/users/me/drafts/${draftId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!res.ok && res.status !== 404) return errorResponse("Failed to delete draft", res.status);
        return jsonResponse({ success: true });
      }

      case "list-drafts": {
        const { maxResults = 20, pageToken } = body;
        const params = new URLSearchParams({ maxResults: String(maxResults) });
        if (pageToken) params.set("pageToken", pageToken);

        const res = await fetch(`${GMAIL_API_URL}/users/me/drafts?${params}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) return errorResponse("Failed to list drafts", res.status);
        return jsonResponse(await res.json());
      }

      case "trash": {
        const { messageId } = body;
        if (!messageId) return errorResponse("messageId required");

        const res = await fetch(`${GMAIL_API_URL}/users/me/messages/${messageId}/trash`, {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) return errorResponse("Failed to trash message", res.status);
        return jsonResponse(await res.json());
      }

      case "archive": {
        const { messageId } = body;
        if (!messageId) return errorResponse("messageId required");

        const res = await fetch(`${GMAIL_API_URL}/users/me/messages/${messageId}/modify`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ removeLabelIds: ["INBOX"] }),
        });
        if (!res.ok) return errorResponse("Failed to archive message", res.status);
        return jsonResponse(await res.json());
      }

      case "modify-labels": {
        const { messageId, addLabelIds, removeLabelIds } = body;
        if (!messageId) return errorResponse("messageId required");

        const res = await fetch(`${GMAIL_API_URL}/users/me/messages/${messageId}/modify`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ addLabelIds, removeLabelIds }),
        });
        if (!res.ok) return errorResponse("Failed to modify labels", res.status);
        return jsonResponse(await res.json());
      }

      default:
        return errorResponse(`Unknown action: ${action}`);
    }
  } catch (err) {
    console.error("gmail-api error:", err);
    return errorResponse((err as Error).message || "An error occurred", 500);
  }
});
