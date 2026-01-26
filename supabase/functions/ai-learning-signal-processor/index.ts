import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type AIOutcomeType =
  | "reply_received"
  | "booking_made"
  | "deal_won"
  | "invoice_paid"
  | "positive_sentiment"
  | "negative_sentiment"
  | "unsubscribe"
  | "complaint"
  | "no_response";

type EventType =
  | "message_received"
  | "appointment_booked"
  | "opportunity_updated"
  | "invoice_paid"
  | "contact_unsubscribed";

interface RequestPayload {
  event_type: EventType;
  org_id: string;
  contact_id: string;
  conversation_id?: string;
  appointment_id?: string;
  opportunity_id?: string;
  invoice_id?: string;
  event_data?: Record<string, unknown>;
  occurred_at: string;
}

interface SignalResult {
  created: boolean;
  signal_id?: string;
  linked_ai_run_id?: string;
  outcome_type?: AIOutcomeType;
}

const TIME_WINDOWS = {
  reply: 24 * 60 * 60 * 1000,
  booking: 48 * 60 * 60 * 1000,
  deal: 30 * 24 * 60 * 60 * 1000,
  invoice: 7 * 24 * 60 * 60 * 1000,
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: RequestPayload = await req.json();
    const {
      event_type,
      org_id,
      contact_id,
      conversation_id,
      appointment_id,
      opportunity_id,
      event_data,
      occurred_at,
    } = payload;

    let result: SignalResult = { created: false };

    switch (event_type) {
      case "message_received":
        result = await handleMessageReceived(
          supabase,
          org_id,
          contact_id,
          conversation_id || null,
          occurred_at
        );
        break;

      case "appointment_booked":
        result = await handleAppointmentBooked(
          supabase,
          org_id,
          contact_id,
          appointment_id || null,
          occurred_at
        );
        break;

      case "opportunity_updated":
        result = await handleOpportunityUpdated(
          supabase,
          org_id,
          contact_id,
          opportunity_id || null,
          event_data || {},
          occurred_at
        );
        break;

      case "invoice_paid":
        result = await handleInvoicePaid(
          supabase,
          org_id,
          contact_id,
          occurred_at
        );
        break;

      case "contact_unsubscribed":
        result = await handleUnsubscribe(
          supabase,
          org_id,
          contact_id,
          occurred_at
        );
        break;
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Learning signal processor error:", error);

    return new Response(
      JSON.stringify({
        created: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function findRecentAIRun(
  supabase: ReturnType<typeof createClient>,
  contactId: string,
  actionTypes: string[],
  windowMs: number
): Promise<{
  id: string;
  workflow_id: string;
  node_id: string;
  agent_id: string | null;
  ai_action_type: string;
  created_at: string;
  org_id: string;
} | null> {
  const cutoffTime = new Date(Date.now() - windowMs).toISOString();

  const { data, error } = await supabase
    .from("workflow_ai_runs")
    .select("id, workflow_id, node_id, agent_id, ai_action_type, created_at, org_id")
    .eq("contact_id", contactId)
    .in("ai_action_type", actionTypes)
    .eq("status", "success")
    .gte("created_at", cutoffTime)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Error finding recent AI run:", error);
    return null;
  }

  return data;
}

async function createSignal(
  supabase: ReturnType<typeof createClient>,
  input: {
    org_id: string;
    workflow_id: string;
    node_id: string;
    agent_id: string | null;
    workflow_ai_run_id: string;
    contact_id: string | null;
    conversation_id: string | null;
    channel: string | null;
    ai_action_type: string;
    outcome_type: AIOutcomeType;
    outcome_value: number | null;
    sentiment_score: number | null;
    time_to_outcome_ms: number | null;
    metadata: Record<string, unknown>;
  }
): Promise<string | null> {
  const { data, error } = await supabase
    .from("ai_workflow_learning_signals")
    .insert({
      org_id: input.org_id,
      workflow_id: input.workflow_id,
      node_id: input.node_id,
      agent_id: input.agent_id,
      workflow_ai_run_id: input.workflow_ai_run_id,
      contact_id: input.contact_id,
      conversation_id: input.conversation_id,
      channel: input.channel,
      ai_action_type: input.ai_action_type,
      outcome_type: input.outcome_type,
      outcome_value: input.outcome_value,
      sentiment_score: input.sentiment_score,
      time_to_outcome_ms: input.time_to_outcome_ms,
      metadata: input.metadata,
      captured_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    console.error("Error creating signal:", error);
    return null;
  }

  return data?.id || null;
}

async function handleMessageReceived(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  contactId: string,
  conversationId: string | null,
  occurredAt: string
): Promise<SignalResult> {
  const recentRun = await findRecentAIRun(
    supabase,
    contactId,
    ["ai_conversation_reply", "ai_email_draft", "ai_follow_up_message"],
    TIME_WINDOWS.reply
  );

  if (!recentRun) {
    return { created: false };
  }

  const timeToOutcome = new Date(occurredAt).getTime() - new Date(recentRun.created_at).getTime();

  const signalId = await createSignal(supabase, {
    org_id: recentRun.org_id,
    workflow_id: recentRun.workflow_id,
    node_id: recentRun.node_id,
    agent_id: recentRun.agent_id,
    workflow_ai_run_id: recentRun.id,
    contact_id: contactId,
    conversation_id: conversationId,
    channel: null,
    ai_action_type: recentRun.ai_action_type,
    outcome_type: "reply_received",
    outcome_value: 1,
    sentiment_score: null,
    time_to_outcome_ms: timeToOutcome,
    metadata: {},
  });

  return {
    created: !!signalId,
    signal_id: signalId || undefined,
    linked_ai_run_id: recentRun.id,
    outcome_type: "reply_received",
  };
}

async function handleAppointmentBooked(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  contactId: string,
  appointmentId: string | null,
  occurredAt: string
): Promise<SignalResult> {
  const recentRun = await findRecentAIRun(
    supabase,
    contactId,
    ["ai_booking_assist", "ai_conversation_reply", "ai_follow_up_message"],
    TIME_WINDOWS.booking
  );

  if (!recentRun) {
    return { created: false };
  }

  const timeToOutcome = new Date(occurredAt).getTime() - new Date(recentRun.created_at).getTime();

  const signalId = await createSignal(supabase, {
    org_id: recentRun.org_id,
    workflow_id: recentRun.workflow_id,
    node_id: recentRun.node_id,
    agent_id: recentRun.agent_id,
    workflow_ai_run_id: recentRun.id,
    contact_id: contactId,
    conversation_id: null,
    channel: null,
    ai_action_type: recentRun.ai_action_type,
    outcome_type: "booking_made",
    outcome_value: 1,
    sentiment_score: null,
    time_to_outcome_ms: timeToOutcome,
    metadata: { appointment_id: appointmentId },
  });

  return {
    created: !!signalId,
    signal_id: signalId || undefined,
    linked_ai_run_id: recentRun.id,
    outcome_type: "booking_made",
  };
}

async function handleOpportunityUpdated(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  contactId: string,
  opportunityId: string | null,
  eventData: Record<string, unknown>,
  occurredAt: string
): Promise<SignalResult> {
  const newStatus = eventData.new_status as string;
  if (newStatus !== "won" && newStatus !== "lost") {
    return { created: false };
  }

  const recentRun = await findRecentAIRun(
    supabase,
    contactId,
    ["ai_lead_qualification"],
    TIME_WINDOWS.deal
  );

  if (!recentRun) {
    return { created: false };
  }

  const timeToOutcome = new Date(occurredAt).getTime() - new Date(recentRun.created_at).getTime();
  const outcomeType: AIOutcomeType = newStatus === "won" ? "deal_won" : "no_response";

  const signalId = await createSignal(supabase, {
    org_id: recentRun.org_id,
    workflow_id: recentRun.workflow_id,
    node_id: recentRun.node_id,
    agent_id: recentRun.agent_id,
    workflow_ai_run_id: recentRun.id,
    contact_id: contactId,
    conversation_id: null,
    channel: null,
    ai_action_type: recentRun.ai_action_type,
    outcome_type: outcomeType,
    outcome_value: newStatus === "won" ? (eventData.deal_value as number) || 1 : 0,
    sentiment_score: null,
    time_to_outcome_ms: timeToOutcome,
    metadata: { opportunity_id: opportunityId, status: newStatus },
  });

  return {
    created: !!signalId,
    signal_id: signalId || undefined,
    linked_ai_run_id: recentRun.id,
    outcome_type: outcomeType,
  };
}

async function handleInvoicePaid(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  contactId: string,
  occurredAt: string
): Promise<SignalResult> {
  const recentRun = await findRecentAIRun(
    supabase,
    contactId,
    ["ai_follow_up_message", "ai_conversation_reply"],
    TIME_WINDOWS.invoice
  );

  if (!recentRun) {
    return { created: false };
  }

  const timeToOutcome = new Date(occurredAt).getTime() - new Date(recentRun.created_at).getTime();

  const signalId = await createSignal(supabase, {
    org_id: recentRun.org_id,
    workflow_id: recentRun.workflow_id,
    node_id: recentRun.node_id,
    agent_id: recentRun.agent_id,
    workflow_ai_run_id: recentRun.id,
    contact_id: contactId,
    conversation_id: null,
    channel: null,
    ai_action_type: recentRun.ai_action_type,
    outcome_type: "invoice_paid",
    outcome_value: 1,
    sentiment_score: null,
    time_to_outcome_ms: timeToOutcome,
    metadata: {},
  });

  return {
    created: !!signalId,
    signal_id: signalId || undefined,
    linked_ai_run_id: recentRun.id,
    outcome_type: "invoice_paid",
  };
}

async function handleUnsubscribe(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  contactId: string,
  occurredAt: string
): Promise<SignalResult> {
  const recentRun = await findRecentAIRun(
    supabase,
    contactId,
    ["ai_conversation_reply", "ai_email_draft", "ai_follow_up_message"],
    TIME_WINDOWS.reply
  );

  if (!recentRun) {
    return { created: false };
  }

  const timeToOutcome = new Date(occurredAt).getTime() - new Date(recentRun.created_at).getTime();

  const signalId = await createSignal(supabase, {
    org_id: recentRun.org_id,
    workflow_id: recentRun.workflow_id,
    node_id: recentRun.node_id,
    agent_id: recentRun.agent_id,
    workflow_ai_run_id: recentRun.id,
    contact_id: contactId,
    conversation_id: null,
    channel: null,
    ai_action_type: recentRun.ai_action_type,
    outcome_type: "unsubscribe",
    outcome_value: -1,
    sentiment_score: -1,
    time_to_outcome_ms: timeToOutcome,
    metadata: {},
  });

  return {
    created: !!signalId,
    signal_id: signalId || undefined,
    linked_ai_run_id: recentRun.id,
    outcome_type: "unsubscribe",
  };
}
