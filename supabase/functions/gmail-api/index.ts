import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  getAccessToken,
  buildRawEmail,
  GMAIL_API_URL,
  type GmailTokenRecord,
} from "../_shared/gmail-helpers.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(message: string, status = 400) {
  return jsonResponse({ error: message }, status);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!supabaseUrl || !serviceRoleKey) {
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

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);
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

    const accessToken = await getAccessToken(
      supabase,
      tokenData as GmailTokenRecord
    );

    const body = await req.json();
    const { action } = body;

    switch (action) {
      case "get-profile": {
        const res = await fetch(`${GMAIL_API_URL}/users/me/profile`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok)
          return errorResponse("Failed to get Gmail profile", res.status);
        return jsonResponse(await res.json());
      }

      case "list-messages": {
        const { query = "", maxResults = 20, pageToken } = body;
        const params = new URLSearchParams({
          q: query,
          maxResults: String(maxResults),
        });
        if (pageToken) params.set("pageToken", pageToken);

        const res = await fetch(
          `${GMAIL_API_URL}/users/me/messages?${params}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (!res.ok)
          return errorResponse("Failed to list messages", res.status);
        return jsonResponse(await res.json());
      }

      case "get-message": {
        const { messageId, format = "full" } = body;
        if (!messageId) return errorResponse("messageId required");

        const res = await fetch(
          `${GMAIL_API_URL}/users/me/messages/${messageId}?format=${format}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (!res.ok)
          return errorResponse("Failed to get message", res.status);
        return jsonResponse(await res.json());
      }

      case "get-thread": {
        const { threadId } = body;
        if (!threadId) return errorResponse("threadId required");

        const res = await fetch(
          `${GMAIL_API_URL}/users/me/threads/${threadId}?format=full`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (!res.ok)
          return errorResponse("Failed to get thread", res.status);
        return jsonResponse(await res.json());
      }

      case "send": {
        const {
          to,
          cc,
          bcc,
          subject,
          htmlBody,
          threadId,
          inReplyTo,
          references,
        } = body;
        if (!to || !subject || !htmlBody)
          return errorResponse("to, subject, htmlBody required");

        const raw = buildRawEmail({
          to,
          cc,
          bcc,
          subject,
          body: htmlBody,
          inReplyTo,
          references,
          fromEmail: tokenData.email,
        });

        const sendBody: Record<string, string> = { raw };
        if (threadId) sendBody.threadId = threadId;

        const res = await fetch(
          `${GMAIL_API_URL}/users/me/messages/send`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(sendBody),
          }
        );

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          return errorResponse(
            err.error?.message || "Failed to send email",
            res.status
          );
        }

        const sentMsg = await res.json();

        if (body.conversationId && body.contactId) {
          await supabase.from("messages").insert({
            organization_id: userData.organization_id,
            conversation_id: body.conversationId,
            contact_id: body.contactId,
            channel: "email",
            direction: "outbound",
            body: htmlBody.substring(0, 256000),
            subject,
            metadata: {
              from_email: tokenData.email,
              to_emails: to.split(",").map((s: string) => s.trim()),
              cc_emails: cc
                ? cc.split(",").map((s: string) => s.trim())
                : [],
              bcc_emails: bcc
                ? bcc.split(",").map((s: string) => s.trim())
                : [],
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
        const {
          to,
          cc,
          bcc,
          subject,
          htmlBody,
          threadId,
          inReplyTo,
          references,
        } = body;
        if (!to || !htmlBody || !threadId)
          return errorResponse("to, htmlBody, threadId required");

        const replySubject = subject || "";
        const raw = buildRawEmail({
          to,
          cc,
          bcc,
          subject: replySubject,
          body: htmlBody,
          inReplyTo,
          references,
          fromEmail: tokenData.email,
        });

        const res = await fetch(
          `${GMAIL_API_URL}/users/me/messages/send`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ raw, threadId }),
          }
        );

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          return errorResponse(
            err.error?.message || "Failed to send reply",
            res.status
          );
        }

        const sentMsg = await res.json();

        if (body.conversationId && body.contactId) {
          await supabase.from("messages").insert({
            organization_id: userData.organization_id,
            conversation_id: body.conversationId,
            contact_id: body.contactId,
            channel: "email",
            direction: "outbound",
            body: htmlBody.substring(0, 256000),
            subject: replySubject,
            metadata: {
              from_email: tokenData.email,
              to_emails: to.split(",").map((s: string) => s.trim()),
              cc_emails: cc
                ? cc.split(",").map((s: string) => s.trim())
                : [],
              bcc_emails: bcc
                ? bcc.split(",").map((s: string) => s.trim())
                : [],
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
          to: to || "",
          cc,
          bcc,
          subject: subject || "",
          body: htmlBody || "",
          fromEmail: tokenData.email,
        });

        const draftBody: Record<string, unknown> = { message: { raw } };
        if (threadId)
          (draftBody.message as Record<string, string>).threadId = threadId;

        const res = await fetch(`${GMAIL_API_URL}/users/me/drafts`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(draftBody),
        });

        if (!res.ok)
          return errorResponse("Failed to create draft", res.status);
        return jsonResponse(await res.json());
      }

      case "update-draft": {
        const { draftId, to, cc, bcc, subject, htmlBody, threadId } = body;
        if (!draftId) return errorResponse("draftId required");

        const raw = buildRawEmail({
          to: to || "",
          cc,
          bcc,
          subject: subject || "",
          body: htmlBody || "",
          fromEmail: tokenData.email,
        });

        const draftBody: Record<string, unknown> = { message: { raw } };
        if (threadId)
          (draftBody.message as Record<string, string>).threadId = threadId;

        const res = await fetch(
          `${GMAIL_API_URL}/users/me/drafts/${draftId}`,
          {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(draftBody),
          }
        );

        if (!res.ok)
          return errorResponse("Failed to update draft", res.status);
        return jsonResponse(await res.json());
      }

      case "delete-draft": {
        const { draftId } = body;
        if (!draftId) return errorResponse("draftId required");

        const res = await fetch(
          `${GMAIL_API_URL}/users/me/drafts/${draftId}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );

        if (!res.ok && res.status !== 404)
          return errorResponse("Failed to delete draft", res.status);
        return jsonResponse({ success: true });
      }

      case "list-drafts": {
        const { maxResults = 20, pageToken } = body;
        const params = new URLSearchParams({
          maxResults: String(maxResults),
        });
        if (pageToken) params.set("pageToken", pageToken);

        const res = await fetch(
          `${GMAIL_API_URL}/users/me/drafts?${params}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (!res.ok)
          return errorResponse("Failed to list drafts", res.status);
        return jsonResponse(await res.json());
      }

      case "trash": {
        const { messageId } = body;
        if (!messageId) return errorResponse("messageId required");

        const res = await fetch(
          `${GMAIL_API_URL}/users/me/messages/${messageId}/trash`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );
        if (!res.ok)
          return errorResponse("Failed to trash message", res.status);
        return jsonResponse(await res.json());
      }

      case "archive": {
        const { messageId } = body;
        if (!messageId) return errorResponse("messageId required");

        const res = await fetch(
          `${GMAIL_API_URL}/users/me/messages/${messageId}/modify`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ removeLabelIds: ["INBOX"] }),
          }
        );
        if (!res.ok)
          return errorResponse("Failed to archive message", res.status);
        return jsonResponse(await res.json());
      }

      case "modify-labels": {
        const { messageId, addLabelIds, removeLabelIds } = body;
        if (!messageId) return errorResponse("messageId required");

        const res = await fetch(
          `${GMAIL_API_URL}/users/me/messages/${messageId}/modify`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ addLabelIds, removeLabelIds }),
          }
        );
        if (!res.ok)
          return errorResponse("Failed to modify labels", res.status);
        return jsonResponse(await res.json());
      }

      case "get-attachment": {
        const { messageId, attachmentId } = body;
        if (!messageId || !attachmentId)
          return errorResponse("messageId and attachmentId required");

        const res = await fetch(
          `${GMAIL_API_URL}/users/me/messages/${messageId}/attachments/${attachmentId}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        if (!res.ok)
          return errorResponse("Failed to fetch attachment", res.status);

        const attData = await res.json();

        const { data: attMeta } = await supabase
          .from("gmail_attachments")
          .select("filename, mime_type")
          .eq("gmail_message_id", messageId)
          .eq("attachment_id", attachmentId)
          .maybeSingle();

        const base64Data = (attData.data as string)
          .replace(/-/g, "+")
          .replace(/_/g, "/");
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        const mimeType = attMeta?.mime_type || "application/octet-stream";
        const filename = attMeta?.filename || "attachment";

        return new Response(bytes, {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": mimeType,
            "Content-Disposition": `attachment; filename="${filename}"`,
          },
        });
      }

      case "list-attachments": {
        const { messageId } = body;
        if (!messageId) return errorResponse("messageId required");

        const { data: attachments, error: attErr } = await supabase
          .from("gmail_attachments")
          .select("*")
          .eq("gmail_message_id", messageId)
          .eq("user_id", userData.id);

        if (attErr)
          return errorResponse("Failed to list attachments", 500);

        return jsonResponse(attachments || []);
      }

      default:
        return errorResponse(`Unknown action: ${action}`);
    }
  } catch (err) {
    console.error("gmail-api error:", err);
    return errorResponse(
      (err as Error).message || "An error occurred",
      500
    );
  }
});
