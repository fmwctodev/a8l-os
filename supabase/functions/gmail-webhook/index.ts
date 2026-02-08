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

function extractEmailAddress(emailString: string): string {
  const match = emailString.match(/<([^>]+)>/);
  if (match) return match[1].toLowerCase();
  return emailString.trim().toLowerCase();
}

function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  try {
    return decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
  } catch {
    return atob(base64);
  }
}

function extractEmailBody(payload: {
  body?: { data?: string };
  parts?: Array<{ mimeType: string; body?: { data?: string }; parts?: unknown[] }>;
}): string {
  if (payload.body?.data) return decodeBase64Url(payload.body.data);
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body?.data) return decodeBase64Url(part.body.data);
    }
    for (const part of payload.parts) {
      if (part.mimeType === "text/html" && part.body?.data) return decodeBase64Url(part.body.data);
    }
  }
  return "";
}

async function refreshToken(
  refreshTokenValue: string,
  clientId: string,
  clientSecret: string
): Promise<string> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshTokenValue,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error("Failed to refresh token");
  const data = await res.json();
  return data.access_token;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const clientId = Deno.env.get("GOOGLE_CLIENT_ID")!;
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response("Missing config", { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await req.json();
    const messageData = body?.message?.data;
    if (!messageData) {
      return new Response("OK", { status: 200 });
    }

    let notification: { emailAddress: string; historyId: string };
    try {
      notification = JSON.parse(atob(messageData));
    } catch {
      console.error("Failed to decode Pub/Sub message data");
      return new Response("OK", { status: 200 });
    }

    const { emailAddress, historyId: newHistoryId } = notification;
    if (!emailAddress || !newHistoryId) {
      return new Response("OK", { status: 200 });
    }

    const { data: tokenData } = await supabase
      .from("gmail_oauth_tokens")
      .select("*")
      .ilike("email", emailAddress)
      .maybeSingle();

    if (!tokenData) {
      console.log(`No token found for ${emailAddress}`);
      return new Response("OK", { status: 200 });
    }

    const orgId = tokenData.organization_id;
    const userId = tokenData.user_id;

    const { data: syncState } = await supabase
      .from("gmail_sync_state")
      .select("*")
      .eq("organization_id", orgId)
      .eq("user_id", userId)
      .maybeSingle();

    const storedHistoryId = syncState?.history_id;
    if (!storedHistoryId) {
      await supabase
        .from("gmail_sync_state")
        .upsert(
          {
            organization_id: orgId,
            user_id: userId,
            history_id: newHistoryId,
            sync_status: "idle",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "organization_id,user_id" }
        );
      return new Response("OK", { status: 200 });
    }

    await supabase
      .from("gmail_sync_state")
      .update({ sync_status: "syncing", updated_at: new Date().toISOString() })
      .eq("organization_id", orgId)
      .eq("user_id", userId);

    let accessToken = tokenData.access_token;
    const tokenExpiry = new Date(tokenData.token_expiry);
    if (tokenExpiry < new Date(Date.now() + 5 * 60 * 1000)) {
      accessToken = await refreshToken(tokenData.refresh_token, clientId, clientSecret);
      await supabase
        .from("gmail_oauth_tokens")
        .update({
          access_token: accessToken,
          token_expiry: new Date(Date.now() + 3600 * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", tokenData.id);
    }

    let historyUrl = `${GMAIL_API_URL}/users/me/history?startHistoryId=${storedHistoryId}&historyTypes=messageAdded&historyTypes=messageDeleted&historyTypes=labelAdded&historyTypes=labelRemoved&maxResults=500`;

    const historyRes = await fetch(historyUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (historyRes.status === 404) {
      await supabase
        .from("gmail_sync_state")
        .update({
          history_id: newHistoryId,
          sync_status: "idle",
          error_message: "History expired, need full resync",
          updated_at: new Date().toISOString(),
        })
        .eq("organization_id", orgId)
        .eq("user_id", userId);
      return new Response("OK", { status: 200 });
    }

    if (!historyRes.ok) {
      console.error("History list failed:", historyRes.status);
      await supabase
        .from("gmail_sync_state")
        .update({
          sync_status: "error",
          error_message: `History fetch failed: ${historyRes.status}`,
          updated_at: new Date().toISOString(),
        })
        .eq("organization_id", orgId)
        .eq("user_id", userId);
      return new Response("OK", { status: 200 });
    }

    const historyData = await historyRes.json();
    const historyRecords = historyData.history || [];

    const processedMessageIds = new Set<string>();
    let processedCount = 0;

    for (const record of historyRecords) {
      if (record.messagesAdded) {
        for (const added of record.messagesAdded) {
          const gmailMsgId = added.message?.id;
          if (!gmailMsgId || processedMessageIds.has(gmailMsgId)) continue;
          processedMessageIds.add(gmailMsgId);

          const { data: existing } = await supabase
            .from("messages")
            .select("id")
            .eq("external_id", gmailMsgId)
            .maybeSingle();

          if (existing) continue;

          const msgRes = await fetch(`${GMAIL_API_URL}/users/me/messages/${gmailMsgId}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });

          if (!msgRes.ok) continue;

          const msgData = await msgRes.json();
          const headers = msgData.payload?.headers || [];
          const getHeader = (name: string) =>
            headers.find((h: { name: string }) => h.name.toLowerCase() === name.toLowerCase())?.value || "";

          const from = getHeader("From");
          const to = getHeader("To");
          const subject = getHeader("Subject");
          const date = getHeader("Date");

          const fromEmail = extractEmailAddress(from);
          const toEmail = extractEmailAddress(to);
          const isInbound = toEmail.toLowerCase() === tokenData.email.toLowerCase();
          const contactEmail = isInbound ? fromEmail : toEmail;

          const { data: contact } = await supabase
            .from("contacts")
            .select("id, department_id, first_name, last_name")
            .eq("organization_id", orgId)
            .ilike("email", contactEmail)
            .eq("status", "active")
            .maybeSingle();

          if (!contact) continue;

          let conversation = null;
          const { data: existingConv } = await supabase
            .from("conversations")
            .select("id")
            .eq("organization_id", orgId)
            .eq("contact_id", contact.id)
            .neq("status", "closed")
            .order("last_message_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (existingConv) {
            conversation = existingConv;
          } else {
            const { data: newConv } = await supabase
              .from("conversations")
              .insert({
                organization_id: orgId,
                contact_id: contact.id,
                department_id: contact.department_id,
                status: "open",
                unread_count: 0,
              })
              .select()
              .single();

            conversation = newConv;

            await supabase.from("inbox_events").insert({
              organization_id: orgId,
              conversation_id: conversation.id,
              event_type: "conversation_created",
              payload: { channel: "email", contact_name: `${contact.first_name} ${contact.last_name}` },
            });
          }

          const emailBody = extractEmailBody(msgData.payload);
          const sentAt = date
            ? new Date(date).toISOString()
            : new Date(parseInt(msgData.internalDate)).toISOString();

          await supabase.from("messages").insert({
            organization_id: orgId,
            conversation_id: conversation.id,
            contact_id: contact.id,
            channel: "email",
            direction: isInbound ? "inbound" : "outbound",
            body: emailBody.substring(0, 50000),
            subject,
            metadata: {
              from_email: fromEmail,
              to_email: toEmail,
              thread_id: msgData.threadId,
              gmail_message_id: gmailMsgId,
              synced_via: "push",
            },
            status: "delivered",
            external_id: gmailMsgId,
            sent_at: sentAt,
          });

          if (isInbound) {
            const { data: convData } = await supabase
              .from("conversations")
              .select("unread_count")
              .eq("id", conversation.id)
              .single();

            await supabase
              .from("conversations")
              .update({
                unread_count: (convData?.unread_count || 0) + 1,
                last_message_at: sentAt,
                updated_at: new Date().toISOString(),
              })
              .eq("id", conversation.id);
          } else {
            await supabase
              .from("conversations")
              .update({
                last_message_at: sentAt,
                updated_at: new Date().toISOString(),
              })
              .eq("id", conversation.id);
          }

          processedCount++;
        }
      }

      if (record.messagesDeleted) {
        for (const deleted of record.messagesDeleted) {
          const gmailMsgId = deleted.message?.id;
          if (!gmailMsgId) continue;

          await supabase
            .from("messages")
            .update({
              hidden_at: new Date().toISOString(),
              metadata: supabase.rpc ? undefined : undefined,
            })
            .eq("external_id", gmailMsgId);
        }
      }
    }

    await supabase
      .from("gmail_sync_state")
      .update({
        history_id: historyData.historyId || newHistoryId,
        last_incremental_sync_at: new Date().toISOString(),
        sync_status: "idle",
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", orgId)
      .eq("user_id", userId);

    console.log(`Processed ${processedCount} messages for ${emailAddress}`);
    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("gmail-webhook error:", err);
    return new Response("OK", { status: 200 });
  }
});
