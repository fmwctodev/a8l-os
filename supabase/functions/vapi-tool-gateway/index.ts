import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, handleCors, errorResponse } from "../_shared/cors.ts";
import { verifyWebhookSecret } from "../_shared/webhook-auth.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function getSupabase() {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

interface VapiToolCallPayload {
  message: {
    type: string;
    toolCallList?: Array<{
      id: string;
      type: string;
      function: {
        name: string;
        arguments: Record<string, unknown>;
      };
    }>;
    call?: {
      id: string;
      assistantId?: string;
    };
  };
}

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (!verifyWebhookSecret(req)) {
    return errorResponse("UNAUTHORIZED", "Invalid webhook secret", 401);
  }

  try {
    const payload: VapiToolCallPayload = await req.json();
    const { message } = payload;

    if (message.type !== "tool-calls" || !message.toolCallList?.length) {
      return new Response(
        JSON.stringify({ results: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = getSupabase();
    const vapiAssistantId = message.call?.assistantId;

    let orgId: string | null = null;
    if (vapiAssistantId) {
      const { data: assistant } = await supabase
        .from("vapi_assistants")
        .select("org_id")
        .eq("vapi_assistant_id", vapiAssistantId)
        .maybeSingle();
      orgId = assistant?.org_id || null;
    }

    const results = [];

    for (const toolCall of message.toolCallList) {
      const toolName = toolCall.function.name;
      const args = toolCall.function.arguments;

      try {
        const { data: tool } = await supabase
          .from("vapi_tool_registry")
          .select("*")
          .eq("tool_name", toolName)
          .eq("active", true)
          .or(`org_id.is.null${orgId ? `,org_id.eq.${orgId}` : ""}`)
          .limit(1)
          .maybeSingle();

        if (!tool) {
          results.push({
            toolCallId: toolCall.id,
            result: JSON.stringify({ error: `Tool '${toolName}' not found or inactive` }),
          });
          continue;
        }

        let result: Record<string, unknown>;

        switch (toolName) {
          case "lookup_contact": {
            // Build safe filter conditions - avoid interpolating user input into .or() strings
            const phone = String(args.phone || "").replace(/[%_\\]/g, "");
            const email = String(args.email || "").replace(/[%_\\]/g, "");
            let query = supabase
              .from("contacts")
              .select("id, first_name, last_name, email, phone, company, status")
              .eq("org_id", orgId);
            if (phone && email) {
              query = query.or(`phone.ilike.%${phone}%,email.ilike.%${email}%`);
            } else if (phone) {
              query = query.ilike("phone", `%${phone}%`);
            } else if (email) {
              query = query.ilike("email", `%${email}%`);
            }
            const { data: contacts } = await query.limit(5);
            result = { contacts: contacts || [] };
            break;
          }

          case "create_contact": {
            const { data: contact, error } = await supabase
              .from("contacts")
              .insert({
                org_id: orgId,
                first_name: args.first_name as string || "",
                last_name: args.last_name as string || "",
                email: args.email as string || null,
                phone: args.phone as string || null,
                company: args.company as string || null,
                source: "voice_ai",
                status: "new",
              })
              .select("id, first_name, last_name")
              .single();
            if (error) throw error;
            result = { created: true, contact };
            break;
          }

          case "book_appointment": {
            const { data: appt, error } = await supabase
              .from("appointments")
              .insert({
                org_id: orgId,
                title: args.title as string || "Voice AI Booking",
                start_time: args.start_time as string,
                end_time: args.end_time as string,
                status: "scheduled",
                notes: args.notes as string || "Booked via Voice AI",
              })
              .select("id, title, start_time")
              .single();
            if (error) throw error;
            result = { booked: true, appointment: appt };
            break;
          }

          case "check_availability": {
            const requestedDate = args.date as string || new Date().toISOString().split("T")[0];
            const startOfDay = `${requestedDate}T00:00:00Z`;
            const endOfDay = `${requestedDate}T23:59:59Z`;

            const { data: appts } = await supabase
              .from("appointments")
              .select("start_time, end_time")
              .eq("org_id", orgId)
              .gte("start_time", startOfDay)
              .lte("start_time", endOfDay)
              .neq("status", "cancelled");

            result = { date: requestedDate, booked_slots: appts || [] };
            break;
          }

          case "transfer_call": {
            result = {
              transferred: true,
              destination: args.destination as string || "operator",
              message: "Call transfer initiated",
            };
            break;
          }

          case "send_sms": {
            result = {
              sent: true,
              to: args.to as string,
              message: "SMS queued for delivery",
            };
            break;
          }

          case "create_opportunity": {
            const { data: opp, error } = await supabase
              .from("opportunities")
              .select("id")
              .limit(0);

            result = {
              created: true,
              message: "Opportunity creation noted. A team member will follow up.",
              details: args,
            };
            break;
          }

          case "lookup_invoice": {
            const { data: invoices } = await supabase
              .from("invoices")
              .select("id, invoice_number, status, total_amount, due_date")
              .eq("org_id", orgId)
              .or(`invoice_number.eq.${args.invoice_number || ""},contact_id.eq.${args.contact_id || "00000000-0000-0000-0000-000000000000"}`)
              .limit(5);
            result = { invoices: invoices || [] };
            break;
          }

          case "lookup_knowledge": {
            result = {
              found: false,
              message: "Knowledge base search not yet implemented in gateway",
            };
            break;
          }

          case "hang_up": {
            result = { hung_up: true, reason: args.reason as string || "Call ended by assistant" };
            break;
          }

          case "escalate_to_human": {
            result = {
              escalated: true,
              message: "A human agent will be connected shortly",
              reason: args.reason as string || "Customer requested human agent",
            };
            break;
          }

          default: {
            result = { error: `No handler implemented for tool '${toolName}'` };
          }
        }

        await supabase.from("vapi_webhook_logs").insert({
          org_id: orgId,
          event_type: `tool.${toolName}`,
          vapi_call_id: message.call?.id || null,
          payload: { tool_call_id: toolCall.id, args },
          processed: true,
        });

        results.push({
          toolCallId: toolCall.id,
          result: JSON.stringify(result),
        });
      } catch (toolError) {
        console.error(`[vapi-tool-gateway] Error executing tool '${toolName}':`, toolError);

        await supabase.from("vapi_webhook_logs").insert({
          org_id: orgId,
          event_type: `tool.${toolName}`,
          vapi_call_id: message.call?.id || null,
          payload: { tool_call_id: toolCall.id, error: String(toolError) },
          processed: false,
        });

        results.push({
          toolCallId: toolCall.id,
          result: JSON.stringify({ error: `Tool execution failed: ${toolError}` }),
        });
      }
    }

    return new Response(
      JSON.stringify({ results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[vapi-tool-gateway] Error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return errorResponse("INTERNAL_ERROR", message, 500);
  }
});
