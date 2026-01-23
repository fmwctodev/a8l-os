import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface AIDraft {
  id: string;
  organization_id: string;
  conversation_id: string;
  contact_id: string;
  agent_id: string | null;
  draft_content: string;
  draft_channel: string;
  draft_subject: string | null;
  status: string;
  trigger_type: string;
  triggered_by_rule_id: string | null;
  context_message_id: string | null;
  version: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing environment variables");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { message_id, conversation_id } = await req.json();

    if (!conversation_id) {
      throw new Error("conversation_id is required");
    }

    const { data: pendingDrafts } = await supabase
      .from("ai_drafts")
      .select("*")
      .eq("conversation_id", conversation_id)
      .eq("status", "pending");

    if (!pendingDrafts || pendingDrafts.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No pending drafts to update" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let messageDirection = "inbound";
    if (message_id) {
      const { data: message } = await supabase
        .from("messages")
        .select("direction")
        .eq("id", message_id)
        .single();

      if (message) {
        messageDirection = message.direction;
      }
    }

    const results = {
      draftsSuperseded: 0,
      draftsRegenerated: 0,
    };

    for (const draft of pendingDrafts as AIDraft[]) {
      await supabase
        .from("ai_drafts")
        .update({
          status: "superseded",
          updated_at: new Date().toISOString(),
        })
        .eq("id", draft.id);

      results.draftsSuperseded++;

      if (draft.trigger_type === "auto" && messageDirection === "inbound") {
        const { data: recentMessages } = await supabase
          .from("messages")
          .select("id, body, direction, channel")
          .eq("conversation_id", conversation_id)
          .order("created_at", { ascending: false })
          .limit(10);

        const { data: contact } = await supabase
          .from("contacts")
          .select("first_name, last_name, email, phone, company")
          .eq("id", draft.contact_id)
          .single();

        const conversationContext = (recentMessages || [])
          .reverse()
          .map((m) => `${m.direction === "inbound" ? "Contact" : "Agent"}: ${m.body}`)
          .join("\n");

        const newDraftContent = generateDraftResponse(conversationContext, contact);

        const latestMessageId = recentMessages?.[0]?.id || message_id;

        const { error: insertError } = await supabase.from("ai_drafts").insert({
          organization_id: draft.organization_id,
          conversation_id: draft.conversation_id,
          contact_id: draft.contact_id,
          agent_id: draft.agent_id,
          draft_content: newDraftContent,
          draft_channel: draft.draft_channel,
          draft_subject: draft.draft_subject,
          status: "pending",
          trigger_type: "auto",
          triggered_by_rule_id: draft.triggered_by_rule_id,
          context_message_id: latestMessageId,
          version: draft.version + 1,
        });

        if (!insertError) {
          results.draftsRegenerated++;
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function generateDraftResponse(
  conversationContext: string,
  contact: Record<string, unknown> | null
): string {
  const firstName = (contact?.first_name as string) || "there";

  if (!conversationContext || conversationContext.trim() === "") {
    return `Hi ${firstName}! Thanks for reaching out. How can I help you today?`;
  }

  const lastMessage = conversationContext.split("\n").pop() || "";

  if (lastMessage.toLowerCase().includes("thank")) {
    return `You're welcome, ${firstName}! Is there anything else I can help you with?`;
  }

  if (lastMessage.toLowerCase().includes("question") || lastMessage.includes("?")) {
    return `Great question, ${firstName}! Let me help you with that. [AI will generate contextual response based on your knowledge base and conversation history]`;
  }

  if (
    lastMessage.toLowerCase().includes("schedule") ||
    lastMessage.toLowerCase().includes("appointment") ||
    lastMessage.toLowerCase().includes("meeting")
  ) {
    return `I'd be happy to help you schedule something, ${firstName}! What times work best for you?`;
  }

  if (
    lastMessage.toLowerCase().includes("price") ||
    lastMessage.toLowerCase().includes("cost") ||
    lastMessage.toLowerCase().includes("quote")
  ) {
    return `Thanks for your interest, ${firstName}! I can definitely help you with pricing information. [AI will provide relevant pricing details based on your product catalog]`;
  }

  return `Thanks for your message, ${firstName}! I'm reviewing your request and will get back to you with a helpful response shortly. [AI will generate contextual response]`;
}
