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

interface QBOPayment {
  Id: string;
  TotalAmt: number;
  CurrencyRef?: { value: string };
  PaymentMethodRef?: { value: string; name?: string };
  PaymentRefNum?: string;
  TxnDate: string;
  Line?: Array<{
    LinkedTxn?: Array<{
      TxnId: string;
      TxnType: string;
    }>;
    Amount: number;
  }>;
  CustomerRef?: { value: string };
}

function mapQBOPaymentMethod(qboMethod?: string): string {
  if (!qboMethod) return 'other';
  const lower = qboMethod.toLowerCase();
  if (lower.includes('credit') || lower.includes('card')) return 'credit_card';
  if (lower.includes('ach') || lower.includes('bank') || lower.includes('transfer')) return 'bank_transfer';
  if (lower.includes('check') || lower.includes('cheque')) return 'check';
  if (lower.includes('cash')) return 'cash';
  return 'other';
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

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    const qboApiResponse = await fetch(`${supabaseUrl}/functions/v1/qbo-api`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        action: 'getPayment',
        org_id: orgId,
        payment_id: entity.id,
      }),
    });

    if (!qboApiResponse.ok) {
      console.error(`Failed to fetch payment ${entity.id} from QBO`);
      return;
    }

    const { payment: qboPayment } = await qboApiResponse.json() as { payment: QBOPayment };

    if (!qboPayment) {
      console.log(`No payment data returned for ${entity.id}`);
      return;
    }

    const invoiceLines = qboPayment.Line?.filter(line =>
      line.LinkedTxn?.some(txn => txn.TxnType === 'Invoice')
    ) || [];

    for (const line of invoiceLines) {
      const invoiceTxn = line.LinkedTxn?.find(txn => txn.TxnType === 'Invoice');
      if (!invoiceTxn) continue;

      const { data: invoice } = await supabase
        .from("invoices")
        .select("id, contact_id, total, status")
        .eq("org_id", orgId)
        .eq("qbo_invoice_id", invoiceTxn.TxnId)
        .maybeSingle();

      if (!invoice) {
        console.log(`No local invoice found for QBO invoice ${invoiceTxn.TxnId}`);
        continue;
      }

      const { data: newPayment, error: paymentError } = await supabase
        .from("payments")
        .insert({
          org_id: orgId,
          contact_id: invoice.contact_id,
          invoice_id: invoice.id,
          qbo_payment_id: qboPayment.Id,
          amount: line.Amount,
          currency: qboPayment.CurrencyRef?.value || 'USD',
          payment_method: mapQBOPaymentMethod(qboPayment.PaymentMethodRef?.name),
          reference_number: qboPayment.PaymentRefNum || null,
          received_at: qboPayment.TxnDate ? new Date(qboPayment.TxnDate).toISOString() : new Date().toISOString(),
        })
        .select()
        .single();

      if (paymentError) {
        console.error(`Failed to create payment record:`, paymentError);
        continue;
      }

      const { data: allPayments } = await supabase
        .from("payments")
        .select("amount")
        .eq("invoice_id", invoice.id);

      const totalPaid = (allPayments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
      const isPaid = totalPaid >= invoice.total;

      if (isPaid && invoice.status !== 'paid') {
        await supabase
          .from("invoices")
          .update({
            status: 'paid',
            paid_at: new Date().toISOString(),
          })
          .eq("id", invoice.id);

        await supabase
          .from("payment_reminders")
          .update({ status: 'cancelled' })
          .eq("invoice_id", invoice.id)
          .eq("status", 'pending');
      }

      await supabase.from("payment_events").insert({
        org_id: orgId,
        invoice_id: invoice.id,
        event_type: isPaid ? 'paid' : 'partial_payment',
        amount: line.Amount,
        metadata: {
          payment_id: newPayment.id,
          qbo_payment_id: qboPayment.Id,
          total_paid: totalPaid,
          invoice_total: invoice.total,
        },
      });

      await supabase.from("event_outbox").insert({
        organization_id: orgId,
        event_type: isPaid ? 'invoice_paid' : 'invoice_partial_payment',
        contact_id: invoice.contact_id,
        entity_type: 'payment',
        entity_id: newPayment.id,
        payload: {
          payment_id: newPayment.id,
          invoice_id: invoice.id,
          amount: line.Amount,
          total_paid: totalPaid,
          invoice_total: invoice.total,
          is_fully_paid: isPaid,
          qbo_payment_id: qboPayment.Id,
        },
      });

      console.log(`Payment ${newPayment.id} created for invoice ${invoice.id}, fully paid: ${isPaid}`);
    }
  } catch (error) {
    console.error(`Error processing payment ${entity.id}:`, error);
  }
}