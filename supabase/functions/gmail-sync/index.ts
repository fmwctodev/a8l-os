import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_API_URL = "https://gmail.googleapis.com/gmail/v1";

function extractEmailAddress(emailString: string): string {
  const match = emailString.match(/<([^>]+)>/);
  if (match) {
    return match[1].toLowerCase();
  }
  return emailString.trim().toLowerCase();
}

function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
  try {
    return decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
  } catch {
    return atob(base64);
  }
}

function extractEmailBody(payload: {
  body?: { data?: string };
  parts?: Array<{ mimeType: string; body?: { data?: string }; parts?: unknown[] }>;
}): string {
  if (payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }

  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return decodeBase64Url(part.body.data);
      }
    }
    for (const part of payload.parts) {
      if (part.mimeType === 'text/html' && part.body?.data) {
        return decodeBase64Url(part.body.data);
      }
    }
  }

  return '';
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing environment variables");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { org_id: orgId, user_id: userId } = await req.json();

    if (!orgId || !userId) {
      return new Response(
        JSON.stringify({ error: "Missing org_id or user_id" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: tokenData } = await supabase
      .from("gmail_oauth_tokens")
      .select("*")
      .eq("organization_id", orgId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!tokenData) {
      return new Response(
        JSON.stringify({ error: "Gmail not connected" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let accessToken = tokenData.access_token;
    const tokenExpiry = new Date(tokenData.token_expiry);

    if (tokenExpiry < new Date(Date.now() + 5 * 60 * 1000)) {
      const { data: gmailConfig } = await supabase
        .from("channel_configurations")
        .select("config")
        .eq("organization_id", orgId)
        .eq("channel_type", "gmail")
        .maybeSingle();

      if (!gmailConfig?.config) {
        throw new Error("Gmail not configured");
      }

      const config = gmailConfig.config as {
        client_id: string;
        client_secret: string;
      };

      const refreshResponse = await fetch(GOOGLE_TOKEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          refresh_token: tokenData.refresh_token,
          client_id: config.client_id,
          client_secret: config.client_secret,
          grant_type: "refresh_token",
        }),
      });

      if (!refreshResponse.ok) {
        throw new Error("Failed to refresh token");
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

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const query = `after:${Math.floor(oneDayAgo.getTime() / 1000)} in:inbox`;

    const listResponse = await fetch(
      `${GMAIL_API_URL}/users/me/messages?q=${encodeURIComponent(query)}&maxResults=50`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!listResponse.ok) {
      throw new Error("Failed to fetch messages list");
    }

    const listData = await listResponse.json();
    const messageRefs = listData.messages || [];

    let processedCount = 0;
    let skippedCount = 0;

    for (const ref of messageRefs) {
      const { data: existingMessage } = await supabase
        .from("messages")
        .select("id")
        .eq("external_id", ref.id)
        .maybeSingle();

      if (existingMessage) {
        skippedCount++;
        continue;
      }

      const msgResponse = await fetch(
        `${GMAIL_API_URL}/users/me/messages/${ref.id}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!msgResponse.ok) {
        continue;
      }

      const msgData = await msgResponse.json();
      const headers = msgData.payload?.headers || [];

      const getHeader = (name: string) =>
        headers.find((h: { name: string }) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

      const from = getHeader('From');
      const to = getHeader('To');
      const subject = getHeader('Subject');
      const date = getHeader('Date');

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

      if (!contact) {
        continue;
      }

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

      const body = extractEmailBody(msgData.payload);
      const sentAt = date ? new Date(date).toISOString() : new Date(parseInt(msgData.internalDate)).toISOString();

      await supabase.from("messages").insert({
        organization_id: orgId,
        conversation_id: conversation.id,
        contact_id: contact.id,
        channel: "email",
        direction: isInbound ? "inbound" : "outbound",
        body: body.substring(0, 50000),
        subject,
        metadata: {
          from_email: fromEmail,
          to_email: toEmail,
          thread_id: msgData.threadId,
          gmail_message_id: ref.id,
        },
        status: "delivered",
        external_id: ref.id,
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

    return new Response(
      JSON.stringify({
        success: true,
        processed: processedCount,
        skipped: skippedCount,
        total: messageRefs.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Gmail sync error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
