import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { encryptToken, decryptToken, isEncryptedToken } from "../_shared/crypto.ts";

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID") || "";
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET") || "";
const GOOGLE_CHAT_API_BASE = "https://chat.googleapis.com/v1";

interface TokenRecord {
  id: string;
  user_id: string;
  org_id: string;
  access_token: string;
  refresh_token: string | null;
  token_expiry: string;
  google_email: string | null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    const action = pathParts[pathParts.length - 1];

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return jsonResponse({ error: "Invalid token" }, 401);
    }

    const { data: tokenRecord, error: tokenError } = await supabase
      .from("google_chat_tokens")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (tokenError || !tokenRecord) {
      return jsonResponse({ error: "Google Chat not connected", code: "NOT_CONNECTED" }, 404);
    }

    const accessToken = await getValidAccessToken(supabase, tokenRecord);
    if (!accessToken) {
      return jsonResponse({ error: "Failed to refresh token", code: "TOKEN_REFRESH_FAILED" }, 401);
    }

    switch (req.method) {
      case "GET":
        return handleGet(action, url, accessToken, supabase, user.id, tokenRecord.org_id);
      case "POST":
        return handlePost(action, req, accessToken, supabase, user.id, tokenRecord.org_id);
      case "DELETE":
        return handleDelete(action, url, supabase, user.id);
      default:
        return jsonResponse({ error: "Method not allowed" }, 405);
    }
  } catch (err) {
    console.error("Google Chat API error:", err);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});

async function handleGet(
  action: string,
  url: URL,
  accessToken: string,
  supabase: ReturnType<typeof createClient>,
  userId: string,
  orgId: string
): Promise<Response> {
  switch (action) {
    case "status": {
      const { data } = await supabase
        .from("google_chat_tokens")
        .select("google_email, connected_at, scopes")
        .eq("user_id", userId)
        .maybeSingle();

      return jsonResponse({
        connected: !!data,
        email: data?.google_email,
        connectedAt: data?.connected_at,
        scopes: data?.scopes,
      });
    }

    case "spaces": {
      const response = await fetch(`${GOOGLE_CHAT_API_BASE}/spaces`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        const error = await response.text();
        console.error("Failed to fetch spaces:", error);
        return jsonResponse({ error: "Failed to fetch spaces" }, response.status);
      }

      const data = await response.json();
      const spaces = data.spaces || [];

      for (const space of spaces) {
        await supabase.from("google_chat_spaces_cache").upsert({
          user_id: userId,
          org_id: orgId,
          space_id: space.name,
          space_name: space.name,
          space_type: space.spaceType || "SPACE",
          display_name: space.displayName || space.name,
          single_user_bot_dm: space.singleUserBotDm || false,
          threaded: space.threaded || false,
          last_synced_at: new Date().toISOString(),
        }, { onConflict: "user_id,space_id" });
      }

      return jsonResponse({ spaces });
    }

    case "messages": {
      const spaceId = url.searchParams.get("spaceId");
      const pageToken = url.searchParams.get("pageToken");
      const pageSize = url.searchParams.get("pageSize") || "50";

      if (!spaceId) {
        return jsonResponse({ error: "spaceId is required" }, 400);
      }

      const params = new URLSearchParams({ pageSize });
      if (pageToken) params.set("pageToken", pageToken);

      const response = await fetch(
        `${GOOGLE_CHAT_API_BASE}/${spaceId}/messages?${params}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (!response.ok) {
        const error = await response.text();
        console.error("Failed to fetch messages:", error);
        return jsonResponse({ error: "Failed to fetch messages" }, response.status);
      }

      const data = await response.json();
      const messages = data.messages || [];

      const { data: spaceCache } = await supabase
        .from("google_chat_spaces_cache")
        .select("id")
        .eq("user_id", userId)
        .eq("space_id", spaceId)
        .maybeSingle();

      if (spaceCache) {
        for (const msg of messages) {
          await supabase.from("google_chat_messages_cache").upsert({
            user_id: userId,
            org_id: orgId,
            space_cache_id: spaceCache.id,
            message_id: msg.name,
            thread_id: msg.thread?.name || null,
            sender_name: msg.sender?.displayName || "Unknown",
            sender_email: msg.sender?.email || null,
            sender_avatar_url: msg.sender?.avatarUri || null,
            sender_type: msg.sender?.type || "HUMAN",
            content: msg.text || "",
            formatted_text: msg.formattedText || msg.text || "",
            attachment_urls: msg.attachment ? [msg.attachment] : [],
            sent_at: msg.createTime,
          }, { onConflict: "user_id,message_id" });
        }
      }

      return jsonResponse({
        messages,
        nextPageToken: data.nextPageToken,
      });
    }

    case "members": {
      const spaceId = url.searchParams.get("spaceId");
      if (!spaceId) {
        return jsonResponse({ error: "spaceId is required" }, 400);
      }

      const response = await fetch(
        `${GOOGLE_CHAT_API_BASE}/${spaceId}/members`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (!response.ok) {
        const error = await response.text();
        console.error("Failed to fetch members:", error);
        return jsonResponse({ error: "Failed to fetch members" }, response.status);
      }

      const data = await response.json();
      return jsonResponse({ members: data.memberships || [] });
    }

    case "auth-url": {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const redirectUri = `${supabaseUrl}/functions/v1/google-chat-oauth-callback`;

      const { data: userData } = await supabase
        .from("users")
        .select("org_id")
        .eq("id", userId)
        .maybeSingle();

      const state = btoa(JSON.stringify({
        userId,
        orgId: userData?.org_id || orgId,
        redirectUrl: url.searchParams.get("redirectUrl") || "/conversations?tab=team-messaging",
      }));

      const scopes = [
        "https://www.googleapis.com/auth/chat.spaces.readonly",
        "https://www.googleapis.com/auth/chat.messages",
        "https://www.googleapis.com/auth/chat.memberships.readonly",
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/userinfo.profile",
      ];

      const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      authUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID);
      authUrl.searchParams.set("redirect_uri", redirectUri);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("scope", scopes.join(" "));
      authUrl.searchParams.set("access_type", "offline");
      authUrl.searchParams.set("prompt", "consent");
      authUrl.searchParams.set("state", state);

      return jsonResponse({ authUrl: authUrl.toString() });
    }

    default:
      return jsonResponse({ error: "Unknown action" }, 404);
  }
}

async function handlePost(
  action: string,
  req: Request,
  accessToken: string,
  supabase: ReturnType<typeof createClient>,
  userId: string,
  orgId: string
): Promise<Response> {
  switch (action) {
    case "send": {
      const body = await req.json();
      const { spaceId, text, threadId } = body;

      if (!spaceId || !text) {
        return jsonResponse({ error: "spaceId and text are required" }, 400);
      }

      const messageBody: Record<string, unknown> = { text };
      if (threadId) {
        messageBody.thread = { name: threadId };
      }

      const response = await fetch(
        `${GOOGLE_CHAT_API_BASE}/${spaceId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(messageBody),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        console.error("Failed to send message:", error);
        return jsonResponse({ error: "Failed to send message" }, response.status);
      }

      const message = await response.json();

      const { data: spaceCache } = await supabase
        .from("google_chat_spaces_cache")
        .select("id")
        .eq("user_id", userId)
        .eq("space_id", spaceId)
        .maybeSingle();

      if (spaceCache) {
        await supabase.from("google_chat_messages_cache").insert({
          user_id: userId,
          org_id: orgId,
          space_cache_id: spaceCache.id,
          message_id: message.name,
          thread_id: message.thread?.name || null,
          sender_name: message.sender?.displayName || "You",
          sender_email: message.sender?.email || null,
          sender_type: "HUMAN",
          content: text,
          sent_at: message.createTime || new Date().toISOString(),
        });
      }

      return jsonResponse({ message });
    }

    case "mark-read": {
      const body = await req.json();
      const { spaceId, messageIds } = body;

      if (!spaceId) {
        return jsonResponse({ error: "spaceId is required" }, 400);
      }

      const { data: spaceCache } = await supabase
        .from("google_chat_spaces_cache")
        .select("id")
        .eq("user_id", userId)
        .eq("space_id", spaceId)
        .maybeSingle();

      if (spaceCache) {
        let query = supabase
          .from("google_chat_messages_cache")
          .update({ is_read: true })
          .eq("space_cache_id", spaceCache.id);

        if (messageIds?.length) {
          query = query.in("message_id", messageIds);
        }

        await query;
      }

      return jsonResponse({ success: true });
    }

    case "sync-spaces": {
      const response = await fetch(`${GOOGLE_CHAT_API_BASE}/spaces`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        return jsonResponse({ error: "Failed to sync spaces" }, response.status);
      }

      const data = await response.json();
      const spaces = data.spaces || [];

      const { data: existingSpaces } = await supabase
        .from("google_chat_spaces_cache")
        .select("space_id")
        .eq("user_id", userId);

      const existingIds = new Set(existingSpaces?.map(s => s.space_id) || []);
      const currentIds = new Set(spaces.map((s: { name: string }) => s.name));

      const toDelete = [...existingIds].filter(id => !currentIds.has(id));
      if (toDelete.length > 0) {
        await supabase
          .from("google_chat_spaces_cache")
          .delete()
          .eq("user_id", userId)
          .in("space_id", toDelete);
      }

      for (const space of spaces) {
        await supabase.from("google_chat_spaces_cache").upsert({
          user_id: userId,
          org_id: orgId,
          space_id: space.name,
          space_name: space.name,
          space_type: space.spaceType || "SPACE",
          display_name: space.displayName || space.name,
          single_user_bot_dm: space.singleUserBotDm || false,
          threaded: space.threaded || false,
          last_synced_at: new Date().toISOString(),
        }, { onConflict: "user_id,space_id" });
      }

      return jsonResponse({ synced: spaces.length, removed: toDelete.length });
    }

    default:
      return jsonResponse({ error: "Unknown action" }, 404);
  }
}

async function handleDelete(
  action: string,
  url: URL,
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<Response> {
  switch (action) {
    case "disconnect": {
      await supabase.from("google_chat_subscriptions").delete().eq("user_id", userId);
      await supabase.from("google_chat_messages_cache").delete().eq("user_id", userId);
      await supabase.from("google_chat_spaces_cache").delete().eq("user_id", userId);
      await supabase.from("google_chat_tokens").delete().eq("user_id", userId);

      return jsonResponse({ success: true });
    }

    default:
      return jsonResponse({ error: "Unknown action" }, 404);
  }
}

async function getValidAccessToken(
  supabase: ReturnType<typeof createClient>,
  tokenRecord: TokenRecord
): Promise<string | null> {
  const expiry = new Date(tokenRecord.token_expiry);
  const now = new Date();

  if (expiry > new Date(now.getTime() + 5 * 60 * 1000)) {
    let accessToken = tokenRecord.access_token;
    try {
      if (isEncryptedToken(accessToken)) {
        accessToken = await decryptToken(accessToken);
      }
    } catch {
      console.warn("Failed to decrypt chat access token, using raw value");
    }
    return accessToken;
  }

  if (!tokenRecord.refresh_token) {
    return null;
  }

  try {
    let refreshTokenPlain = tokenRecord.refresh_token;
    try {
      if (isEncryptedToken(refreshTokenPlain)) {
        refreshTokenPlain = await decryptToken(refreshTokenPlain);
      }
    } catch {
      console.warn("Failed to decrypt chat refresh token, using raw value");
    }

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: refreshTokenPlain,
        grant_type: "refresh_token",
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      console.error("Token refresh failed:", await response.text());
      return null;
    }

    const data = await response.json();
    const newExpiry = new Date(Date.now() + data.expires_in * 1000);

    let encNewAccess: string;
    try {
      encNewAccess = await encryptToken(data.access_token);
    } catch {
      encNewAccess = data.access_token;
    }

    await supabase
      .from("google_chat_tokens")
      .update({
        access_token: encNewAccess,
        token_expiry: newExpiry.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", tokenRecord.id);

    return data.access_token;
  } catch (err) {
    console.error("Token refresh error:", err);
    return null;
  }
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
