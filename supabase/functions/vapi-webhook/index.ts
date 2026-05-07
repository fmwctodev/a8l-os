import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, handleCors, errorResponse } from "../_shared/cors.ts";
import { verifyWebhookSecret } from "../_shared/webhook-auth.ts";
import { getDecryptedMailgunCreds, sendMailgunEmail } from "../_shared/mailgun.ts";

async function sendInboundCallEmail(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  params: {
    vapiCallId: string;
    callerPhone: string | null;
    assistantName: string | null;
    startedAt: string | null;
    durationSeconds: number | null;
    summary: string | null;
    recordingUrl: string | null;
  },
): Promise<void> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const mgCreds = await getDecryptedMailgunCreds(orgId, supabase, supabaseUrl, serviceRoleKey);
  if (!mgCreds) return;

  const { vapiCallId, callerPhone, assistantName, startedAt, durationSeconds, summary, recordingUrl } = params;

  const callDate = startedAt
    ? new Date(startedAt).toLocaleString("en-US", { timeZone: "America/New_York" })
    : "Unknown";
  const durationText = durationSeconds != null
    ? (durationSeconds >= 60 ? `${Math.floor(durationSeconds / 60)}m ${durationSeconds % 60}s` : `${durationSeconds}s`)
    : "Unknown";

  const recordingLine = recordingUrl
    ? `<tr><td style="padding:8px 0;color:#6b7280;font-weight:500;">Recording</td><td style="padding:8px 0;"><a href="${recordingUrl}" style="color:#0ea5e9;">Listen to Recording</a></td></tr>`
    : "";

  const summarySection = summary
    ? `<div style="margin-top:20px;padding:16px;background:#f0f9ff;border-left:4px solid #0ea5e9;border-radius:4px;"><p style="margin:0 0 8px;font-weight:600;color:#0c4a6e;">Call Summary</p><p style="margin:0;color:#374151;line-height:1.6;">${summary}</p></div>`
    : "";

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
      <div style="background:#0f172a;padding:20px 24px;border-radius:8px 8px 0 0;">
        <p style="margin:0;color:#94a3b8;font-size:13px;text-transform:uppercase;letter-spacing:0.05em;">Autom8ion Voice AI</p>
        <h1 style="margin:4px 0 0;color:#f1f5f9;font-size:20px;">Inbound Call Completed</h1>
      </div>
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-top:none;padding:24px;border-radius:0 0 8px 8px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:8px 0;color:#6b7280;font-weight:500;">Caller</td><td style="padding:8px 0;color:#111827;font-weight:600;">${callerPhone || "Unknown"}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280;font-weight:500;">Handled by</td><td style="padding:8px 0;color:#111827;">${assistantName || "AI Assistant"}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280;font-weight:500;">Date &amp; Time</td><td style="padding:8px 0;color:#111827;">${callDate}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280;font-weight:500;">Duration</td><td style="padding:8px 0;color:#111827;">${durationText}</td></tr>
          ${recordingLine}
        </table>
        ${summarySection}
        <div style="margin-top:24px;">
          <a href="https://dashboard.vapi.ai/calls/${vapiCallId}" style="display:inline-block;padding:10px 20px;background:#0ea5e9;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:500;font-size:14px;">View Full Call in VAPI</a>
        </div>
      </div>
    </div>`;

  await sendMailgunEmail({
    apiKey: mgCreds.apiKey,
    domain: mgCreds.domain,
    region: mgCreds.region,
    from: "Autom8ion Voice AI <info@mail.autom8ionlab.com>",
    to: "admin@autom8ionlab.com",
    subject: `Inbound Call: ${callerPhone || "Unknown"} \u2014 ${durationText}`,
    html,
    trackOpens: true,
    trackClicks: false,
  });
}

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function getSupabase() {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

interface VapiWebhookPayload {
  message: {
    type: string;
    call?: {
      id: string;
      assistantId?: string;
      phoneNumberId?: string;
      customer?: { number?: string; name?: string };
      status?: string;
      startedAt?: string;
      endedAt?: string;
      type?: string;
    };
    transcript?: string;
    summary?: string;
    recordingUrl?: string;
    artifact?: {
      transcript?: string;
      messages?: Array<{ role: string; content: string; time?: number }>;
      recordingUrl?: string;
    };
    endedReason?: string;
    [key: string]: unknown;
  };
}

interface OrgSettings {
  auto_create_contacts: boolean;
  store_call_recordings: boolean;
  store_call_summaries: boolean;
  show_tool_events: boolean;
}

const DEFAULT_SETTINGS: OrgSettings = {
  auto_create_contacts: true,
  store_call_recordings: true,
  store_call_summaries: true,
  show_tool_events: false,
};

async function getOrgSettings(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
): Promise<OrgSettings> {
  const { data } = await supabase
    .from("org_vapi_conversation_settings")
    .select("*")
    .eq("org_id", orgId)
    .maybeSingle();
  if (!data) return DEFAULT_SETTINGS;
  return {
    auto_create_contacts: data.auto_create_contacts ?? true,
    store_call_recordings: data.store_call_recordings ?? true,
    store_call_summaries: data.store_call_summaries ?? true,
    show_tool_events: data.show_tool_events ?? false,
  };
}

async function findOrCreateContact(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  phoneNumber: string | null,
  customerName: string | null,
): Promise<string | null> {
  if (!phoneNumber) return null;

  const { data: existing } = await supabase
    .from("contacts")
    .select("id")
    .eq("organization_id", orgId)
    .eq("phone", phoneNumber)
    .limit(1)
    .maybeSingle();

  if (existing) return existing.id;

  const nameParts = (customerName || "").trim().split(" ");
  const firstName = nameParts[0] || phoneNumber;
  const lastName = nameParts.slice(1).join(" ") || "";

  const { data: newContact, error } = await supabase
    .from("contacts")
    .insert({
      organization_id: orgId,
      first_name: firstName,
      last_name: lastName,
      phone: phoneNumber,
      source: "vapi",
      status: "active",
    })
    .select("id")
    .single();

  if (error) {
    console.error("[vapi-webhook] Failed to create contact:", error);
    return null;
  }
  return newContact.id;
}

async function findOrCreateConversation(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  contactId: string | null,
  vapiCallId: string,
  assistantId: string | null,
  assistantName: string | null,
  channel: string,
): Promise<string> {
  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .eq("organization_id", orgId)
    .eq("external_call_id", vapiCallId)
    .maybeSingle();

  if (existing) return existing.id;

  const { data: conv, error } = await supabase
    .from("conversations")
    .insert({
      organization_id: orgId,
      contact_id: contactId,
      status: "open",
      unread_count: 1,
      provider: "vapi",
      external_call_id: vapiCallId,
      external_assistant_id: assistantId,
      conversation_metadata: {
        assistant_name: assistantName,
        channel_type: channel,
      },
    })
    .select("id")
    .single();

  if (error) {
    console.error("[vapi-webhook] Failed to create conversation:", error);
    throw error;
  }
  return conv.id;
}

async function insertMessage(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  conversationId: string,
  contactId: string | null,
  channel: string,
  direction: string,
  body: string,
  messageType: string,
  senderName?: string | null,
  senderIdentifier?: string | null,
): Promise<void> {
  await supabase.from("messages").insert({
    organization_id: orgId,
    conversation_id: conversationId,
    contact_id: contactId,
    channel,
    direction,
    body,
    message_type: messageType,
    sender_name: senderName || null,
    sender_identifier: senderIdentifier || null,
    status: "delivered",
    sent_at: new Date().toISOString(),
  });
}

async function getAssistantInfo(
  supabase: ReturnType<typeof createClient>,
  vapiAssistantId: string,
): Promise<{ id: string; org_id: string; name: string | null } | null> {
  const { data } = await supabase
    .from("vapi_assistants")
    .select("id, org_id, name")
    .eq("vapi_assistant_id", vapiAssistantId)
    .maybeSingle();
  return data;
}

async function normalizeCallEnd(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  message: VapiWebhookPayload["message"],
  internalAssistantId: string | null,
  assistantName: string | null,
): Promise<void> {
  try {
    const settings = await getOrgSettings(supabase, orgId);
    const vapiCallId = message.call!.id;
    const customerPhone = message.call?.customer?.number || null;
    const customerName = message.call?.customer?.name || null;

    let contactId: string | null = null;
    if (settings.auto_create_contacts) {
      contactId = await findOrCreateContact(supabase, orgId, customerPhone, customerName);
    }

    const callType = message.call?.type || "voice";
    const channel = callType === "web" ? "vapi_webchat" : "vapi_voice";

    const conversationId = await findOrCreateConversation(
      supabase,
      orgId,
      contactId,
      vapiCallId,
      internalAssistantId,
      assistantName,
      channel,
    );

    const startedAt = message.call?.startedAt;
    const endedAt = message.call?.endedAt || new Date().toISOString();
    let durationSeconds: number | null = null;
    if (startedAt && endedAt) {
      durationSeconds = Math.round(
        (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000,
      );
    }

    const recordingUrl = message.artifact?.recordingUrl || message.recordingUrl || null;

    await supabase
      .from("conversations")
      .update({
        status: "closed",
        last_message_at: new Date().toISOString(),
        conversation_metadata: {
          assistant_name: assistantName,
          channel_type: channel,
          duration_seconds: durationSeconds,
          recording_url: settings.store_call_recordings ? recordingUrl : null,
          ended_reason: message.endedReason || null,
          vapi_call_id: vapiCallId,
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", conversationId);

    await insertMessage(
      supabase, orgId, conversationId, contactId,
      channel, "system", "Call started", "call_event",
      null, null,
    );

    const artifactMessages = message.artifact?.messages || [];
    for (const msg of artifactMessages) {
      if (msg.role === "tool-call" || msg.role === "tool-result") {
        if (!settings.show_tool_events) continue;
      }

      const direction = msg.role === "user" ? "inbound" : "outbound";
      const senderName = msg.role === "assistant" ? (assistantName || "AI Assistant") : null;

      await insertMessage(
        supabase, orgId, conversationId, contactId,
        channel, direction, msg.content || "", "text",
        senderName, msg.role === "user" ? customerPhone : null,
      );
    }

    const summary = message.summary || null;
    if (summary && settings.store_call_summaries) {
      await insertMessage(
        supabase, orgId, conversationId, contactId,
        channel, "system", summary, "summary",
        null, null,
      );
    }

    if (durationSeconds != null) {
      const durationText = durationSeconds >= 60
        ? `${Math.floor(durationSeconds / 60)}m ${durationSeconds % 60}s`
        : `${durationSeconds}s`;
      await insertMessage(
        supabase, orgId, conversationId, contactId,
        channel, "system", `Call ended - Duration: ${durationText}`, "call_event",
        null, null,
      );
    } else {
      await insertMessage(
        supabase, orgId, conversationId, contactId,
        channel, "system", "Call ended", "call_event",
        null, null,
      );
    }

    if (contactId) {
      await supabase.from("conversation_participants").upsert(
        {
          conversation_id: conversationId,
          role: "customer",
          name: customerName || customerPhone || "Customer",
          identifier: customerPhone,
        },
        { onConflict: "conversation_id,role,identifier" }
      ).then(() => {});
    }

    if (assistantName || internalAssistantId) {
      await supabase.from("conversation_participants").upsert(
        {
          conversation_id: conversationId,
          role: "assistant",
          name: assistantName || "AI Assistant",
          identifier: internalAssistantId,
        },
        { onConflict: "conversation_id,role,identifier" }
      ).then(() => {});
    }
  } catch (err) {
    console.error("[vapi-webhook] Normalization error:", err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// P6 — Workflow event emission helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Maps a Vapi `endedReason` string to the canonical workflow outcome enum used
 * by the AICallCompletedConfig trigger filter.
 */
function mapEndedReasonToOutcome(endedReason: string): string {
  const r = (endedReason || "").toLowerCase();
  if (!r) return "completed";
  if (r.includes("voicemail") || r.includes("answer-machine")) return "voicemail_left";
  if (r.includes("transfer")) return "transferred";
  if (r.includes("no-answer") || r.includes("noanswer")) return "no_answer";
  if (r.includes("busy")) return "no_answer";
  if (r.includes("hung-up") || r.includes("customer-ended")) return "hung_up";
  if (r.includes("failed") || r.includes("error")) return "no_answer";
  return "completed";
}

/**
 * Pulls a small set of high-signal keywords from a transcript so the
 * AIVoicemailReceivedConfig keyword filter can match against them
 * without scanning the whole transcript.
 */
function extractKeywordsFromTranscript(transcript: string | null): string[] {
  if (!transcript) return [];
  const lower = transcript.toLowerCase();
  const matches: string[] = [];
  const candidates = [
    "interested", "callback", "call back", "urgent", "asap", "schedule",
    "appointment", "pricing", "quote", "demo", "cancel", "refund", "angry",
    "frustrated", "qualified", "decision maker", "budget", "timeline",
  ];
  for (const w of candidates) {
    if (lower.includes(w)) matches.push(w);
  }
  return matches;
}

/**
 * Writes a workflow trigger event to event_outbox so workflow-processor
 * picks it up and dispatches matching enrollments. We use the same event_outbox
 * pattern as plivo-sms-inbound, form-submit, etc.
 */
async function emitWorkflowEvent(
  supabase: ReturnType<typeof getSupabase>,
  orgId: string,
  eventType: string,
  payload: Record<string, unknown>
): Promise<void> {
  try {
    await supabase.from("event_outbox").insert({
      org_id: orgId,
      event_type: eventType,
      aggregate_type: "vapi_call",
      aggregate_id: (payload.vapi_call_id as string) || null,
      payload,
      status: "pending",
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error(`[vapi-webhook] Failed to emit ${eventType}:`, err);
  }
}

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (!verifyWebhookSecret(req)) {
    return errorResponse("UNAUTHORIZED", "Invalid webhook secret", 401);
  }

  try {
    const payload: VapiWebhookPayload = await req.json();
    const { message } = payload;
    const eventType = message.type;

    const supabase = getSupabase();

    const vapiAssistantId = message.call?.assistantId;
    let orgId: string | null = null;
    let internalAssistantId: string | null = null;
    let assistantName: string | null = null;

    if (vapiAssistantId) {
      const assistant = await getAssistantInfo(supabase, vapiAssistantId);
      if (assistant) {
        orgId = assistant.org_id;
        internalAssistantId = assistant.id;
        assistantName = assistant.name;
      }
    }

    await supabase.from("vapi_webhook_logs").insert({
      org_id: orgId,
      event_type: eventType,
      vapi_call_id: message.call?.id || null,
      payload: message,
      processed: false,
    });

    const vapiCallId = message.call?.id;

    switch (eventType) {
      case "call.started":
      case "call-started": {
        if (!vapiCallId || !orgId) break;

        const { data: existing } = await supabase
          .from("vapi_calls")
          .select("id")
          .eq("vapi_call_id", vapiCallId)
          .maybeSingle();

        if (!existing) {
          await supabase.from("vapi_calls").insert({
            org_id: orgId,
            assistant_id: internalAssistantId,
            vapi_call_id: vapiCallId,
            direction: "inbound",
            status: "in-progress",
            from_number: message.call?.customer?.number || null,
            to_number: null,
            started_at: message.call?.startedAt || new Date().toISOString(),
            metadata: { source: "webhook" },
          });
        } else {
          await supabase
            .from("vapi_calls")
            .update({
              status: "in-progress",
              started_at: message.call?.startedAt || new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("vapi_call_id", vapiCallId);
        }

        // P6 — emit ai_call_started workflow trigger event.
        await emitWorkflowEvent(supabase, orgId, "ai_call_started", {
          vapi_call_id: vapiCallId,
          vapi_assistant_id: vapiAssistantId,
          assistant_id: internalAssistantId,
          assistant_name: assistantName,
          assistantIds: internalAssistantId ? [internalAssistantId] : [],
          phone: message.call?.customer?.number || null,
          direction: message.call?.type === "outboundPhoneCall" ? "outbound" : "inbound",
          started_at: message.call?.startedAt || new Date().toISOString(),
          metadata: message.call?.metadata || null,
        });
        break;
      }

      case "call.ended":
      case "end-of-call-report": {
        if (!vapiCallId) break;

        const transcript = message.artifact?.transcript || message.transcript || null;
        const summary = message.summary || null;
        const endedAt = message.call?.endedAt || new Date().toISOString();
        const startedAt = message.call?.startedAt;

        let durationSeconds: number | null = null;
        if (startedAt && endedAt) {
          durationSeconds = Math.round(
            (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000
          );
        }

        await supabase
          .from("vapi_calls")
          .update({
            status: "completed",
            ended_at: endedAt,
            duration_seconds: durationSeconds,
            transcript,
            summary,
            metadata: {
              ended_reason: message.endedReason || null,
              recording_url: message.artifact?.recordingUrl || message.recordingUrl || null,
            },
            updated_at: new Date().toISOString(),
          })
          .eq("vapi_call_id", vapiCallId);

        await supabase
          .from("vapi_webhook_logs")
          .update({ processed: true })
          .eq("vapi_call_id", vapiCallId)
          .eq("event_type", eventType);

        if (orgId) {
          await normalizeCallEnd(supabase, orgId, message, internalAssistantId, assistantName);

          const isInbound = message.call?.type !== "outboundPhoneCall";
          if (isInbound) {
            EdgeRuntime.waitUntil(
              sendInboundCallEmail(supabase, orgId, {
                vapiCallId,
                callerPhone: message.call?.customer?.number || null,
                assistantName,
                startedAt: message.call?.startedAt || null,
                durationSeconds,
                summary: message.summary || null,
                recordingUrl: message.artifact?.recordingUrl || message.recordingUrl || null,
              }).catch((err) => console.error("[vapi-webhook] Email notification error:", err))
            );
          }

          // ─────────────────────────────────────────────────────────────
          // P6 — emit AI voice trigger events to event_outbox so workflows
          // can branch on call outcome, voicemails, and handoff requests.
          // ─────────────────────────────────────────────────────────────
          const endedReason = (message.endedReason || "").toString().toLowerCase();
          const structuredOutput = (message.analysis?.structuredData as Record<string, unknown>) || {};
          const outcome = (structuredOutput.outcome as string) || mapEndedReasonToOutcome(endedReason);
          const wentToVoicemail = endedReason.includes("voicemail")
            || endedReason.includes("answer-machine")
            || outcome === "voicemail_left";
          const handoffRequested = endedReason.includes("transfer")
            || (structuredOutput.handoff_requested as boolean) === true;

          const baseDetail = {
            vapi_call_id: vapiCallId,
            vapi_assistant_id: vapiAssistantId,
            assistant_id: internalAssistantId,
            assistant_name: assistantName,
            assistantIds: internalAssistantId ? [internalAssistantId] : [],
            phone: message.call?.customer?.number || null,
            direction: isInbound ? "inbound" : "outbound",
            channel: "voice",
            duration_seconds: durationSeconds,
            minDurationSeconds: durationSeconds,
            outcome,
            outcomes: [outcome],
            ended_reason: endedReason,
            transcript,
            summary,
            qualified: !!structuredOutput.qualified,
            requireQualified: !!structuredOutput.qualified,
            sentiment: (structuredOutput.sentiment as string) || "neutral",
            keywords: extractKeywordsFromTranscript(transcript),
            recording_url: message.artifact?.recordingUrl || message.recordingUrl || null,
            structured_output: structuredOutput,
          };

          await emitWorkflowEvent(supabase, orgId, "ai_call_completed", baseDetail);

          if (wentToVoicemail) {
            await emitWorkflowEvent(supabase, orgId, "ai_voicemail_received", baseDetail);
          }
          if (handoffRequested) {
            await emitWorkflowEvent(supabase, orgId, "ai_agent_handoff_requested", {
              ...baseDetail,
              reason: (structuredOutput.handoff_reason as string) || "transferred",
              reasons: [(structuredOutput.handoff_reason as string) || "transferred"],
            });
          }
        }

        break;
      }

      case "status-update": {
        if (!vapiCallId) break;
        const newStatus = message.call?.status;
        if (newStatus) {
          await supabase
            .from("vapi_calls")
            .update({
              status: newStatus,
              updated_at: new Date().toISOString(),
            })
            .eq("vapi_call_id", vapiCallId);
        }
        break;
      }

      case "transcript": {
        break;
      }

      case "speech-update": {
        break;
      }

      case "hang": {
        if (vapiCallId) {
          await supabase
            .from("vapi_calls")
            .update({
              status: "completed",
              ended_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("vapi_call_id", vapiCallId);
        }
        break;
      }

      default: {
        console.log(`[vapi-webhook] Unhandled event type: ${eventType}`);
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[vapi-webhook] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
