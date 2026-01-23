import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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

    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    const action = pathParts[pathParts.length - 1];

    if (req.method === "POST" && action === "session") {
      return handleCreateSession(req, supabase);
    }

    if (req.method === "POST" && action === "message") {
      return handleSendMessage(req, supabase);
    }

    if (req.method === "GET" && action === "messages") {
      return handleGetMessages(req, supabase);
    }

    if (req.method === "GET" && action === "config") {
      return handleGetConfig(req, supabase);
    }

    return new Response(
      JSON.stringify({ error: "Not found" }),
      {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Webchat API error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

async function handleGetConfig(req: Request, supabase: ReturnType<typeof createClient>) {
  const url = new URL(req.url);
  const orgId = url.searchParams.get("org_id");

  if (!orgId) {
    return new Response(
      JSON.stringify({ error: "Missing org_id" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const { data: config } = await supabase
    .from("channel_configurations")
    .select("config, is_active")
    .eq("organization_id", orgId)
    .eq("channel_type", "webchat")
    .maybeSingle();

  if (!config || !config.is_active) {
    return new Response(
      JSON.stringify({ enabled: false }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const webchatConfig = config.config as {
    enabled: boolean;
    primary_color: string;
    welcome_message: string;
    pre_chat_form: boolean;
    required_fields: string[];
  };

  return new Response(
    JSON.stringify({
      enabled: webchatConfig.enabled,
      primary_color: webchatConfig.primary_color || "#0066cc",
      welcome_message: webchatConfig.welcome_message || "Hi! How can we help you today?",
      pre_chat_form: webchatConfig.pre_chat_form || false,
      required_fields: webchatConfig.required_fields || [],
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

async function handleCreateSession(req: Request, supabase: ReturnType<typeof createClient>) {
  const body = await req.json();
  const { org_id: orgId, visitor_id: visitorId, visitor_name: visitorName, visitor_email: visitorEmail, metadata } = body;

  if (!orgId || !visitorId) {
    return new Response(
      JSON.stringify({ error: "Missing org_id or visitor_id" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const { data: existingSession } = await supabase
    .from("webchat_sessions")
    .select("*, conversation:conversations!conversation_id(*)")
    .eq("organization_id", orgId)
    .eq("visitor_id", visitorId)
    .maybeSingle();

  if (existingSession) {
    await supabase
      .from("webchat_sessions")
      .update({
        last_activity_at: new Date().toISOString(),
        visitor_name: visitorName || existingSession.visitor_name,
        visitor_email: visitorEmail || existingSession.visitor_email,
      })
      .eq("id", existingSession.id);

    return new Response(
      JSON.stringify({
        session_id: existingSession.id,
        conversation_id: existingSession.conversation_id,
        is_new: false,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  let contactId = null;
  let departmentId = null;

  if (visitorEmail) {
    const { data: existingContact } = await supabase
      .from("contacts")
      .select("id, department_id")
      .eq("organization_id", orgId)
      .ilike("email", visitorEmail)
      .eq("status", "active")
      .maybeSingle();

    if (existingContact) {
      contactId = existingContact.id;
      departmentId = existingContact.department_id;
    }
  }

  if (!contactId) {
    const { data: defaultDept } = await supabase
      .from("departments")
      .select("id")
      .eq("organization_id", orgId)
      .limit(1)
      .maybeSingle();

    departmentId = defaultDept?.id;

    const { data: newContact } = await supabase
      .from("contacts")
      .insert({
        organization_id: orgId,
        department_id: departmentId,
        first_name: visitorName || "Web",
        last_name: "Visitor",
        email: visitorEmail,
        source: "webchat",
        status: "active",
      })
      .select("id")
      .single();

    contactId = newContact?.id;
  }

  const { data: conversation } = await supabase
    .from("conversations")
    .insert({
      organization_id: orgId,
      contact_id: contactId,
      department_id: departmentId,
      status: "open",
      unread_count: 0,
    })
    .select()
    .single();

  await supabase.from("inbox_events").insert({
    organization_id: orgId,
    conversation_id: conversation.id,
    event_type: "conversation_created",
    payload: { channel: "webchat", visitor_name: visitorName || "Web Visitor" },
  });

  const { data: session } = await supabase
    .from("webchat_sessions")
    .insert({
      organization_id: orgId,
      conversation_id: conversation.id,
      visitor_id: visitorId,
      visitor_name: visitorName,
      visitor_email: visitorEmail,
      metadata: metadata || {},
    })
    .select()
    .single();

  return new Response(
    JSON.stringify({
      session_id: session.id,
      conversation_id: conversation.id,
      is_new: true,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

async function handleSendMessage(req: Request, supabase: ReturnType<typeof createClient>) {
  const body = await req.json();
  const { session_id: sessionId, message } = body;

  if (!sessionId || !message) {
    return new Response(
      JSON.stringify({ error: "Missing session_id or message" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const { data: session } = await supabase
    .from("webchat_sessions")
    .select("*, conversation:conversations!conversation_id(*)")
    .eq("id", sessionId)
    .maybeSingle();

  if (!session) {
    return new Response(
      JSON.stringify({ error: "Session not found" }),
      {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const { data: newMessage } = await supabase
    .from("messages")
    .insert({
      organization_id: session.organization_id,
      conversation_id: session.conversation_id,
      contact_id: session.conversation.contact_id,
      channel: "webchat",
      direction: "inbound",
      body: message,
      status: "delivered",
      metadata: {
        visitor_id: session.visitor_id,
        visitor_name: session.visitor_name,
      },
    })
    .select()
    .single();

  const { data: convData } = await supabase
    .from("conversations")
    .select("unread_count, status")
    .eq("id", session.conversation_id)
    .single();

  await supabase
    .from("conversations")
    .update({
      unread_count: (convData?.unread_count || 0) + 1,
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: convData?.status === "closed" ? "open" : convData?.status,
    })
    .eq("id", session.conversation_id);

  await supabase
    .from("webchat_sessions")
    .update({ last_activity_at: new Date().toISOString() })
    .eq("id", sessionId);

  return new Response(
    JSON.stringify({
      message_id: newMessage.id,
      sent_at: newMessage.sent_at,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

async function handleGetMessages(req: Request, supabase: ReturnType<typeof createClient>) {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get("session_id");
  const since = url.searchParams.get("since");

  if (!sessionId) {
    return new Response(
      JSON.stringify({ error: "Missing session_id" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const { data: session } = await supabase
    .from("webchat_sessions")
    .select("conversation_id")
    .eq("id", sessionId)
    .maybeSingle();

  if (!session) {
    return new Response(
      JSON.stringify({ error: "Session not found" }),
      {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  let query = supabase
    .from("messages")
    .select("id, body, direction, sent_at, channel")
    .eq("conversation_id", session.conversation_id)
    .order("sent_at", { ascending: true });

  if (since) {
    query = query.gt("sent_at", since);
  }

  const { data: messages } = await query;

  return new Response(
    JSON.stringify({
      messages: messages?.map((m) => ({
        id: m.id,
        body: m.body,
        direction: m.direction,
        sent_at: m.sent_at,
        is_agent: m.direction === "outbound",
      })) || [],
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}
