import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface QBOWebhookNotification {
  realmId: string;
  dataChangeEvent?: {
    entities: Array<{
      name: string;
      id: string;
      operation: string;
      lastUpdated: string;
    }>;
  };
}

interface QBOWebhookPayload {
  eventNotifications: QBOWebhookNotification[];
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 200, headers: corsHeaders });
    }

    if (req.method === "GET") {
      const url = new URL(req.url);
      const verifier = url.searchParams.get("intuit_verifier");
      if (verifier) {
        return new Response(verifier, {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "text/plain" },
        });
      }
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: QBOWebhookPayload = await req.json();

    for (const notification of payload.eventNotifications) {
      const realmId = notification.realmId;

      const { data: connection } = await supabase
        .from("qbo_connections")
        .select("id, org_id")
        .eq("realm_id", realmId)
        .maybeSingle();

      if (!connection) {
        console.log(`No connection found for realm ${realmId}`);
        continue;
      }

      const entities = notification.dataChangeEvent?.entities || [];

      for (const entity of entities) {
        const webhookId = `${realmId}-${entity.name}-${entity.id}-${entity.lastUpdated}`;

        const { data: existingLog } = await supabase
          .from("qbo_webhook_logs")
          .select("id")
          .eq("org_id", connection.org_id)
          .eq("webhook_id", webhookId)
          .maybeSingle();

        if (existingLog) {
          console.log(`Webhook ${webhookId} already processed, skipping`);
          continue;
        }

        await supabase.from("qbo_webhook_logs").insert({
          org_id: connection.org_id,
          webhook_id: webhookId,
          event_type: `${entity.name}.${entity.operation}`,
          payload: entity,
          processed_at: new Date().toISOString(),
        });

        if (entity.name === "Invoice") {
          await handleInvoiceEvent(supabase, connection.org_id, entity);
        } else if (entity.name === "Payment") {
          await handlePaymentEvent(supabase, connection.org_id, entity);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("QBO Webhook error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function handleInvoiceEvent(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  entity: { id: string; operation: string }
) {
  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, contact_id, status")
    .eq("org_id", orgId)
    .eq("qbo_invoice_id", entity.id)
    .maybeSingle();

  if (!invoice) {
    console.log(`No local invoice found for QBO invoice ${entity.id}`);
    return;
  }

  if (entity.operation === "Void" || entity.operation === "Delete") {
    await supabase
      .from("invoices")
      .update({
        status: "void",
        voided_at: new Date().toISOString(),
      })
      .eq("id", invoice.id);

    await supabase.from("event_outbox").insert({
      org_id: orgId,
      event_type: "invoice.voided",
      contact_id: invoice.contact_id,
      entity_type: "invoice",
      entity_id: invoice.id,
      payload: { invoice_id: invoice.id, qbo_invoice_id: entity.id },
    });
  }
}

async function handlePaymentEvent(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  entity: { id: string; operation: string }
) {
  if (entity.operation !== "Create" && entity.operation !== "Update") {
    return;
  }

  const { data: existingPayment } = await supabase
    .from("payments")
    .select("id")
    .eq("org_id", orgId)
    .eq("qbo_payment_id", entity.id)
    .maybeSingle();

  if (existingPayment) {
    console.log(`Payment ${entity.id} already exists`);
    return;
  }

  console.log(`New payment ${entity.id} detected - would sync from QBO API`);
}