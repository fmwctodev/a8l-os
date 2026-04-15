import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  getAccessToken,
  graphRequest,
  buildGraphEmailPayload,
  getOutlookSignature,
  GRAPH_BASE,
} from "../_shared/microsoft-graph-helpers.ts";
import { getSupabaseClient, extractUserContext } from "../_shared/auth.ts";

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

/**
 * Append the Outlook signature to the email body with a separator.
 */
function appendSignature(htmlBody: string, signature: string): string {
  if (!signature) return htmlBody;
  return `${htmlBody}<br><br><div class="outlook_signature_separator">--</div><div class="outlook_signature">${signature}</div>`;
}

/**
 * Parse recipient strings into Microsoft Graph recipient format.
 */
function parseRecipients(
  recipientStr?: string
): Array<{ emailAddress: { address: string } }> {
  if (!recipientStr) return [];
  return recipientStr
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean)
    .map((email) => ({ emailAddress: { address: email } }));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = getSupabaseClient();

    const userContext = await extractUserContext(req, supabase);
    if (!userContext) {
      return errorResponse("Unauthorized", 401);
    }

    // Get Microsoft access token for the authenticated user
    let tokenData: { accessToken: string; email: string };
    try {
      tokenData = await getAccessToken(supabase, userContext.id);
    } catch (err) {
      console.error("[outlook-api] Failed to get access token:", err);
      return errorResponse("Outlook not connected", 400);
    }

    const { accessToken } = tokenData;

    const body = await req.json();
    const { action } = body;

    switch (action) {
      // ---------------------------------------------------------------
      // GET PROFILE
      // ---------------------------------------------------------------
      case "get-profile": {
        const { status, data } = await graphRequest(
          accessToken,
          "/me",
          "GET"
        );
        if (status !== 200) {
          return errorResponse("Failed to get Outlook profile", status);
        }
        return jsonResponse(data);
      }

      // ---------------------------------------------------------------
      // LIST MESSAGES
      // ---------------------------------------------------------------
      case "list-messages": {
        const { limit = 20, filter, pageToken } = body;

        const params = new URLSearchParams({
          $top: String(limit),
          $orderby: "receivedDateTime desc",
          $select:
            "id,subject,bodyPreview,from,toRecipients,ccRecipients,receivedDateTime,conversationId,isRead,hasAttachments,isDraft",
        });

        if (filter) {
          params.set("$filter", filter);
        }

        let path = `/me/messages?${params.toString()}`;
        if (pageToken) {
          // Microsoft uses @odata.nextLink as full URL for pagination
          path = pageToken;
        }

        const { status, data } = await graphRequest(
          accessToken,
          path,
          "GET"
        );
        if (status !== 200) {
          return errorResponse("Failed to list messages", status);
        }

        // Normalize pagination: extract nextLink for the client
        const graphData = data as Record<string, unknown>;
        return jsonResponse({
          value: graphData.value,
          nextLink: graphData["@odata.nextLink"] || null,
        });
      }

      // ---------------------------------------------------------------
      // GET MESSAGE
      // ---------------------------------------------------------------
      case "get-message": {
        const { messageId } = body;
        if (!messageId) return errorResponse("messageId required");

        const { status, data } = await graphRequest(
          accessToken,
          `/me/messages/${messageId}`,
          "GET"
        );
        if (status !== 200) {
          return errorResponse("Failed to get message", status);
        }
        return jsonResponse(data);
      }

      // ---------------------------------------------------------------
      // SEND
      // ---------------------------------------------------------------
      case "send": {
        const { to, cc, bcc, subject, htmlBody } = body;
        if (!to || !subject || !htmlBody) {
          return errorResponse("to, subject, htmlBody required");
        }

        // Fetch signature and append
        const signature = await getOutlookSignature(accessToken);
        const bodyWithSignature = appendSignature(htmlBody, signature);

        const payload = buildGraphEmailPayload({
          to,
          cc,
          bcc,
          subject,
          htmlBody: bodyWithSignature,
        });

        const { status, data } = await graphRequest(
          accessToken,
          "/me/sendMail",
          "POST",
          payload
        );

        if (status !== 200 && status !== 202) {
          const errData = data as Record<string, unknown>;
          const errMsg =
            (errData?.error as Record<string, string>)?.message ||
            "Failed to send email";
          return errorResponse(errMsg, status);
        }

        // After sendMail, Graph returns 202 with no body.
        // Fetch the latest sent message to get its ID and conversationId.
        let sentMsg: Record<string, unknown> = {};
        try {
          const { status: sentStatus, data: sentData } = await graphRequest(
            accessToken,
            "/me/mailFolders/SentItems/messages?$top=1&$orderby=sentDateTime desc&$select=id,conversationId,sentDateTime",
            "GET"
          );
          if (sentStatus === 200) {
            const sentList = sentData as { value?: Array<Record<string, unknown>> };
            if (sentList.value && sentList.value.length > 0) {
              sentMsg = sentList.value[0];
            }
          }
        } catch (err) {
          console.warn("[outlook-api] Could not fetch sent message:", err);
        }

        // Insert into messages table (mirror gmail-api pattern)
        if (body.conversationId && body.contactId) {
          await supabase.from("messages").insert({
            organization_id: userContext.orgId,
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
              thread_id: sentMsg.conversationId || null,
              outlook_message_id: sentMsg.id || null,
              sent_via: "outlook",
            },
            status: "delivered",
            external_id: (sentMsg.id as string) || null,
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

        return jsonResponse({
          success: true,
          id: sentMsg.id || null,
          conversationId: sentMsg.conversationId || null,
        });
      }

      // ---------------------------------------------------------------
      // REPLY
      // ---------------------------------------------------------------
      case "reply": {
        const { messageId, htmlBody, to, cc, bcc } = body;
        if (!messageId || !htmlBody) {
          return errorResponse("messageId, htmlBody required");
        }

        // Fetch signature and append
        const replySignature = await getOutlookSignature(accessToken);
        const replyBodyWithSignature = appendSignature(
          htmlBody,
          replySignature
        );

        // Build the reply payload
        const replyPayload: Record<string, unknown> = {
          comment: replyBodyWithSignature,
        };

        // If custom recipients are specified, use the full message override
        if (to || cc || bcc) {
          replyPayload.message = {
            toRecipients: parseRecipients(to),
            ccRecipients: parseRecipients(cc),
            bccRecipients: parseRecipients(bcc),
          };
        }

        const { status, data } = await graphRequest(
          accessToken,
          `/me/messages/${messageId}/reply`,
          "POST",
          replyPayload
        );

        if (status !== 200 && status !== 202) {
          const errData = data as Record<string, unknown>;
          const errMsg =
            (errData?.error as Record<string, string>)?.message ||
            "Failed to send reply";
          return errorResponse(errMsg, status);
        }

        // Fetch the latest sent message for the reply details
        let sentReply: Record<string, unknown> = {};
        try {
          const { status: sentStatus, data: sentData } = await graphRequest(
            accessToken,
            "/me/mailFolders/SentItems/messages?$top=1&$orderby=sentDateTime desc&$select=id,conversationId,subject,sentDateTime",
            "GET"
          );
          if (sentStatus === 200) {
            const sentList = sentData as { value?: Array<Record<string, unknown>> };
            if (sentList.value && sentList.value.length > 0) {
              sentReply = sentList.value[0];
            }
          }
        } catch (err) {
          console.warn("[outlook-api] Could not fetch sent reply:", err);
        }

        // Insert into messages table
        if (body.conversationId && body.contactId) {
          const replySubject = (sentReply.subject as string) || body.subject || "";

          await supabase.from("messages").insert({
            organization_id: userContext.orgId,
            conversation_id: body.conversationId,
            contact_id: body.contactId,
            channel: "email",
            direction: "outbound",
            body: htmlBody.substring(0, 256000),
            subject: replySubject,
            metadata: {
              from_email: tokenData.email,
              to_emails: to
                ? to.split(",").map((s: string) => s.trim())
                : [],
              cc_emails: cc
                ? cc.split(",").map((s: string) => s.trim())
                : [],
              bcc_emails: bcc
                ? bcc.split(",").map((s: string) => s.trim())
                : [],
              thread_id: sentReply.conversationId || null,
              outlook_message_id: sentReply.id || null,
              in_reply_to: messageId,
              sent_via: "outlook",
            },
            status: "delivered",
            external_id: (sentReply.id as string) || null,
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

        return jsonResponse({
          success: true,
          id: sentReply.id || null,
          conversationId: sentReply.conversationId || null,
        });
      }

      // ---------------------------------------------------------------
      // CREATE DRAFT
      // ---------------------------------------------------------------
      case "create-draft": {
        const { to, cc, bcc, subject, htmlBody } = body;

        const draftMessage: Record<string, unknown> = {
          subject: subject || "",
          body: {
            contentType: "HTML",
            content: htmlBody || "",
          },
          toRecipients: parseRecipients(to),
          ccRecipients: parseRecipients(cc),
          bccRecipients: parseRecipients(bcc),
        };

        const { status, data } = await graphRequest(
          accessToken,
          "/me/messages",
          "POST",
          draftMessage
        );

        if (status !== 201 && status !== 200) {
          return errorResponse("Failed to create draft", status);
        }
        return jsonResponse(data);
      }

      // ---------------------------------------------------------------
      // GET ATTACHMENT
      // ---------------------------------------------------------------
      case "get-attachment": {
        const { messageId, attachmentId } = body;
        if (!messageId || !attachmentId) {
          return errorResponse("messageId and attachmentId required");
        }

        const { status, data } = await graphRequest(
          accessToken,
          `/me/messages/${messageId}/attachments/${attachmentId}`,
          "GET"
        );

        if (status !== 200) {
          return errorResponse("Failed to fetch attachment", status);
        }

        const attData = data as Record<string, unknown>;

        // Graph returns base64 content in contentBytes for file attachments
        if (attData.contentBytes) {
          const binaryString = atob(attData.contentBytes as string);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }

          const mimeType =
            (attData.contentType as string) || "application/octet-stream";
          const filename = (attData.name as string) || "attachment";

          return new Response(bytes, {
            status: 200,
            headers: {
              ...corsHeaders,
              "Content-Type": mimeType,
              "Content-Disposition": `attachment; filename="${filename}"`,
            },
          });
        }

        // For non-file attachments (itemAttachment, referenceAttachment), return JSON
        return jsonResponse(attData);
      }

      // ---------------------------------------------------------------
      // LIST ATTACHMENTS
      // ---------------------------------------------------------------
      case "list-attachments": {
        const { messageId } = body;
        if (!messageId) return errorResponse("messageId required");

        const { status, data } = await graphRequest(
          accessToken,
          `/me/messages/${messageId}/attachments`,
          "GET"
        );

        if (status !== 200) {
          return errorResponse("Failed to list attachments", status);
        }

        const graphData = data as { value?: unknown[] };
        return jsonResponse(graphData.value || []);
      }

      // ---------------------------------------------------------------
      // ARCHIVE
      // ---------------------------------------------------------------
      case "archive": {
        const { messageId } = body;
        if (!messageId) return errorResponse("messageId required");

        const { status, data } = await graphRequest(
          accessToken,
          `/me/messages/${messageId}/move`,
          "POST",
          { destinationId: "archive" }
        );

        if (status !== 200 && status !== 201) {
          return errorResponse("Failed to archive message", status);
        }
        return jsonResponse(data);
      }

      // ---------------------------------------------------------------
      // GET SIGNATURE
      // ---------------------------------------------------------------
      case "get-signature": {
        const { status, data } = await graphRequest(
          accessToken,
          "/me/mailboxSettings",
          "GET"
        );

        if (status !== 200) {
          return errorResponse("Failed to get mailbox settings", status);
        }

        const settings = data as Record<string, unknown>;
        return jsonResponse({
          signatureHtml: settings.signatureHtml || "",
          automaticRepliesSetting: settings.automaticRepliesSetting || null,
        });
      }

      default:
        return errorResponse(`Unknown action: ${action}`);
    }
  } catch (err) {
    console.error("[outlook-api] error:", err);
    return errorResponse(
      (err as Error).message || "An error occurred",
      500
    );
  }
});
