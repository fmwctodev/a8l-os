import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { verifyWebhookSecret } from "../_shared/webhook-auth.ts";

interface GoogleChatEvent {
  type: string;
  eventTime: string;
  message?: {
    name: string;
    sender: {
      name: string;
      displayName: string;
      email?: string;
      avatarUri?: string;
      type: string;
    };
    createTime: string;
    text?: string;
    formattedText?: string;
    thread?: {
      name: string;
    };
    space: {
      name: string;
      type: string;
      displayName?: string;
    };
    attachment?: unknown[];
  };
  space?: {
    name: string;
    type: string;
    displayName?: string;
  };
  user?: {
    name: string;
    displayName: string;
    email?: string;
  };
  configCompleteRedirectUrl?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (!verifyWebhookSecret(req)) {
    return new Response(
      JSON.stringify({ error: "Invalid webhook secret" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const event: GoogleChatEvent = await req.json();
    console.log("Received Google Chat event:", event.type);

    switch (event.type) {
      case "ADDED_TO_SPACE":
        return handleAddedToSpace(supabase, event);

      case "REMOVED_FROM_SPACE":
        return handleRemovedFromSpace(supabase, event);

      case "MESSAGE":
        return handleMessage(supabase, event);

      case "CARD_CLICKED":
        return jsonResponse({ text: "Action received" });

      default:
        console.log("Unhandled event type:", event.type);
        return jsonResponse({ text: "Event received" });
    }
  } catch (err) {
    console.error("Webhook error:", err);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});

async function handleAddedToSpace(
  supabase: ReturnType<typeof createClient>,
  event: GoogleChatEvent
): Promise<Response> {
  const space = event.space;
  if (!space) {
    return jsonResponse({ text: "Welcome!" });
  }

  console.log("Bot added to space:", space.name);
  return jsonResponse({
    text: `Thanks for adding me to ${space.displayName || "this space"}! I'll help sync messages with your CRM.`,
  });
}

async function handleRemovedFromSpace(
  supabase: ReturnType<typeof createClient>,
  event: GoogleChatEvent
): Promise<Response> {
  const space = event.space;
  if (!space) {
    return jsonResponse({});
  }

  console.log("Bot removed from space:", space.name);

  await supabase
    .from("google_chat_spaces_cache")
    .delete()
    .eq("space_id", space.name);

  return jsonResponse({});
}

async function handleMessage(
  supabase: ReturnType<typeof createClient>,
  event: GoogleChatEvent
): Promise<Response> {
  const message = event.message;
  if (!message) {
    return jsonResponse({});
  }

  const spaceId = message.space.name;

  const { data: spaceCaches } = await supabase
    .from("google_chat_spaces_cache")
    .select("id, user_id, org_id")
    .eq("space_id", spaceId);

  if (!spaceCaches || spaceCaches.length === 0) {
    console.log("No cached spaces found for:", spaceId);
    return jsonResponse({});
  }

  for (const spaceCache of spaceCaches) {
    const { error } = await supabase.from("google_chat_messages_cache").upsert({
      user_id: spaceCache.user_id,
      org_id: spaceCache.org_id,
      space_cache_id: spaceCache.id,
      message_id: message.name,
      thread_id: message.thread?.name || null,
      sender_name: message.sender.displayName || "Unknown",
      sender_email: message.sender.email || null,
      sender_avatar_url: message.sender.avatarUri || null,
      sender_type: message.sender.type || "HUMAN",
      content: message.text || "",
      formatted_text: message.formattedText || message.text || "",
      attachment_urls: message.attachment || [],
      sent_at: message.createTime,
      is_read: false,
    }, { onConflict: "user_id,message_id" });

    if (error) {
      console.error("Failed to cache message for user:", spaceCache.user_id, error);
    }
  }

  console.log("Message cached for", spaceCaches.length, "users");
  return jsonResponse({});
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
