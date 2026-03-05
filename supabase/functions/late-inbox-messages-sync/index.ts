import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const LATE_API_BASE = "https://getlate.dev/api/v1";
const DM_PLATFORMS = ["facebook", "instagram", "linkedin"];

interface LateConversation {
  id?: string;
  conversationId?: string;
  participantId?: string;
  participantName?: string;
  participantUsername?: string;
  participantAvatarUrl?: string;
  platform?: string;
  accountId?: string;
  lastMessageAt?: string;
  lastMessagePreview?: string;
  unreadCount?: number;
}

interface LateMessage {
  id?: string;
  messageId?: string;
  conversationId?: string;
  senderId?: string;
  senderName?: string;
  senderIsMe?: boolean;
  text?: string;
  body?: string;
  mediaUrls?: string[];
  createdAt?: string;
  sentAt?: string;
}

async function fetchConversations(
  lateApiKey: string,
  accountId: string,
  maxPages = 5
): Promise<LateConversation[]> {
  const all: LateConversation[] = [];
  let cursor: string | undefined;
  let page = 0;

  while (page < maxPages) {
    const params = new URLSearchParams({ accountId });
    if (cursor) params.set("cursor", cursor);

    const url = `${LATE_API_BASE}/messages/list-inbox-conversations?${params}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${lateApiKey}`, Accept: "application/json" },
    });

    if (!res.ok) {
      console.error(`[late-inbox-messages-sync] Conversations fetch failed for ${accountId}: ${res.status}`);
      break;
    }

    const data = await res.json();
    const items: LateConversation[] = data.conversations || data.data || data.items || [];
    all.push(...items);

    cursor = data.nextCursor || data.cursor;
    if (!cursor || items.length === 0) break;
    page++;
  }

  return all;
}

async function fetchMessages(
  lateApiKey: string,
  lateConversationId: string,
  accountId: string,
  maxPages = 3
): Promise<LateMessage[]> {
  const all: LateMessage[] = [];
  let cursor: string | undefined;
  let page = 0;

  while (page < maxPages) {
    const params = new URLSearchParams({ conversationId: lateConversationId, accountId });
    if (cursor) params.set("cursor", cursor);

    const url = `${LATE_API_BASE}/messages/get-inbox-conversation-messages?${params}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${lateApiKey}`, Accept: "application/json" },
    });

    if (!res.ok) {
      console.error(`[late-inbox-messages-sync] Messages fetch failed for convo ${lateConversationId}: ${res.status}`);
      break;
    }

    const data = await res.json();
    const items: LateMessage[] = data.messages || data.data || data.items || [];
    all.push(...items);

    cursor = data.nextCursor || data.cursor;
    if (!cursor || items.length === 0) break;
    page++;
  }

  return all;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lateApiKey = Deno.env.get("LATE_API_KEY");

    if (!lateApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "LATE_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    let orgId: string | null = null;
    let specificAccountId: string | null = null;

    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "") || "";
    const isServiceRole = token === serviceRoleKey;

    if (isServiceRole) {
      const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
      orgId = body.org_id || new URL(req.url).searchParams.get("org_id") || null;
      specificAccountId = body.account_id || new URL(req.url).searchParams.get("account_id") || null;
    } else if (authHeader) {
      const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data: authData, error: authError } = await anonClient.auth.getUser(token);
      if (authError || !authData.user) {
        return new Response(
          JSON.stringify({ success: false, error: "Invalid token" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const { data: userData } = await supabase
        .from("users")
        .select("organization_id")
        .eq("id", authData.user.id)
        .maybeSingle();
      orgId = userData?.organization_id || null;
    }

    if (!orgId) {
      return new Response(
        JSON.stringify({ success: false, error: "org_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const connectionsQuery = supabase
      .from("late_connections")
      .select("id, late_account_id, platform, account_name, account_username")
      .eq("org_id", orgId)
      .eq("status", "connected")
      .in("platform", DM_PLATFORMS);

    if (specificAccountId) {
      connectionsQuery.eq("late_account_id", specificAccountId);
    }

    const { data: connections } = await connectionsQuery;

    if (!connections || connections.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No connected DM accounts found", synced: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let totalConversations = 0;
    let totalMessages = 0;
    const errors: string[] = [];

    for (const conn of connections) {
      try {
        const conversations = await fetchConversations(lateApiKey, conn.late_account_id);
        console.log(`[late-inbox-messages-sync] Account ${conn.account_name}: ${conversations.length} conversations`);

        for (const conv of conversations) {
          const lateConvId = conv.id || conv.conversationId || "";
          if (!lateConvId) continue;

          const participantId = conv.participantId || "";
          const participantName = conv.participantName || conv.participantUsername || "Unknown";
          const platform = conn.platform;

          const externalId = `${platform}_${participantId}`;
          let contactId: string | null = null;

          const { data: existingContact } = await supabase
            .from("contacts")
            .select("id")
            .eq("organization_id", orgId)
            .eq("external_id", externalId)
            .maybeSingle();

          if (existingContact) {
            contactId = existingContact.id;
          } else {
            const nameParts = participantName.trim().split(" ");
            const firstName = nameParts[0] || participantName;
            const lastName = nameParts.slice(1).join(" ") || null;

            const { data: newContact, error: contactError } = await supabase
              .from("contacts")
              .insert({
                organization_id: orgId,
                external_id: externalId,
                first_name: firstName,
                last_name: lastName,
                source: platform,
              })
              .select("id")
              .maybeSingle();

            if (contactError) {
              console.error(`[late-inbox-messages-sync] Contact create error:`, contactError);
              errors.push(`Contact create failed for ${participantName}: ${contactError.message}`);
              continue;
            }
            contactId = newContact?.id || null;
          }

          if (!contactId) continue;

          let conversationId: string | null = null;

          const { data: existingConv } = await supabase
            .from("conversations")
            .select("id")
            .eq("organization_id", orgId)
            .eq("late_conversation_id", lateConvId)
            .maybeSingle();

          if (existingConv) {
            conversationId = existingConv.id;
          } else {
            const { data: newConv, error: convError } = await supabase
              .from("conversations")
              .insert({
                organization_id: orgId,
                contact_id: contactId,
                status: "open",
                late_conversation_id: lateConvId,
                late_dm_platform: platform,
                last_message_at: conv.lastMessageAt || new Date().toISOString(),
                unread_count: conv.unreadCount || 0,
              })
              .select("id")
              .maybeSingle();

            if (convError) {
              console.error(`[late-inbox-messages-sync] Conversation create error:`, convError);
              errors.push(`Conversation create failed: ${convError.message}`);
              continue;
            }
            conversationId = newConv?.id || null;
          }

          if (!conversationId) continue;
          totalConversations++;

          const messages = await fetchMessages(lateApiKey, lateConvId, conn.late_account_id);

          for (const msg of messages) {
            const lateMsgId = msg.id || msg.messageId || "";
            if (!lateMsgId) continue;

            const { data: existingMsg } = await supabase
              .from("messages")
              .select("id")
              .eq("organization_id", orgId)
              .eq("external_id", `late_${lateMsgId}`)
              .maybeSingle();

            if (existingMsg) continue;

            const direction = msg.senderIsMe ? "outbound" : "inbound";
            const body = msg.text || msg.body || "";
            const sentAt = msg.createdAt || msg.sentAt || new Date().toISOString();

            const { error: msgError } = await supabase.from("messages").insert({
              organization_id: orgId,
              conversation_id: conversationId,
              contact_id: contactId,
              channel: "social_dm",
              direction,
              body,
              status: "delivered",
              external_id: `late_${lateMsgId}`,
              sent_at: sentAt,
              media_urls: msg.mediaUrls || null,
              metadata: {
                platform,
                late_conversation_id: lateConvId,
                late_account_id: conn.late_account_id,
                sender_name: msg.senderName || null,
                participant_name: participantName,
                participant_avatar: conv.participantAvatarUrl || null,
              },
            });

            if (msgError) {
              console.error(`[late-inbox-messages-sync] Message insert error:`, msgError);
            } else {
              totalMessages++;
            }
          }

          if (messages.length > 0) {
            const lastMsg = messages[messages.length - 1];
            await supabase
              .from("conversations")
              .update({ last_message_at: lastMsg.createdAt || lastMsg.sentAt || new Date().toISOString() })
              .eq("id", conversationId);
          }
        }

        await supabase
          .from("late_connections")
          .update({ last_messages_synced_at: new Date().toISOString() })
          .eq("id", conn.id);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[late-inbox-messages-sync] Account ${conn.account_name} error:`, msg);
        errors.push(`${conn.account_name}: ${msg}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        conversations_synced: totalConversations,
        messages_synced: totalMessages,
        accounts_processed: connections.length,
        errors,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[late-inbox-messages-sync] Fatal error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
