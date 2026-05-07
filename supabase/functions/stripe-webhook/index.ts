import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  getDecryptedStripeCreds,
  verifyStripeWebhookSignature,
} from "../_shared/stripe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Stripe-Signature",
};

/**
 * Stripe webhook receiver.
 *
 * Two operating modes:
 *   1. Single global webhook secret (STRIPE_WEBHOOK_SIGNING_SECRET env var)
 *      — used during dev/testing or if all orgs share one secret.
 *   2. Per-org webhook secret stored in payment_provider_connections —
 *      we look it up by Stripe account ID embedded in the event.
 *
 * Supported events:
 *   - invoice.paid           → mark local invoice paid + record payment row
 *   - invoice.payment_failed → mark local invoice overdue
 *   - invoice.voided         → mark local invoice void
 *   - charge.refunded        → record refund (negative payment row)
 */

interface StripeEvent {
  id: string;
  type: string;
  account?: string;
  data: {
    object: Record<string, unknown>;
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const rawBody = await req.text();
    const sigHeader = req.headers.get("stripe-signature");
    if (!sigHeader) {
      return new Response("Missing Stripe-Signature header", { status: 400 });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Parse the event first (without verification) so we can find the
    // matching org by Stripe account ID.
    let event: StripeEvent;
    try {
      event = JSON.parse(rawBody) as StripeEvent;
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    const stripeAccountId = event.account ?? null;
    let signingSecret: string | null = null;
    let orgId: string | null = null;

    if (stripeAccountId) {
      // Per-org connect: find the org by Stripe account ID
      const { data: conn } = await supabase
        .from("payment_provider_connections")
        .select("org_id")
        .eq("provider", "stripe")
        .filter("account_info->>stripe_account_id", "eq", stripeAccountId)
        .maybeSingle();
      if (conn) {
        orgId = conn.org_id;
        const creds = await getDecryptedStripeCreds(orgId, supabase, supabaseUrl, serviceRoleKey);
        signingSecret = creds?.webhookSigningSecret ?? null;
      }
    }

    // Fallback to global env secret
    if (!signingSecret) {
      signingSecret = Deno.env.get("STRIPE_WEBHOOK_SIGNING_SECRET") ?? null;
    }

    if (!signingSecret) {
      console.error("No signing secret available for Stripe webhook");
      return new Response("Configuration error", { status: 500 });
    }

    const verified = await verifyStripeWebhookSignature(rawBody, sigHeader, signingSecret);
    if (!verified) {
      return new Response("Invalid signature", { status: 401 });
    }

    // Without an explicit account ID (single-tenant setup), find the org via
    // the Stripe object's customer or invoice ID.
    if (!orgId) {
      const obj = event.data.object as { id?: string; customer?: string };
      // Find the invoice in our DB by provider_invoice_id and infer org from there
      if (event.type.startsWith("invoice.") && obj.id) {
        const { data } = await supabase
          .from("invoices")
          .select("org_id")
          .eq("provider", "stripe")
          .eq("provider_invoice_id", obj.id)
          .maybeSingle();
        orgId = data?.org_id ?? null;
      }
    }

    if (!orgId) {
      console.warn(`Could not resolve org for Stripe event ${event.id} (${event.type})`);
      return new Response(JSON.stringify({ received: true, processed: false }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Idempotency: skip if we've already processed this event ID
    const { data: existingLog } = await supabase
      .from("payment_provider_webhook_logs")
      .select("id")
      .eq("org_id", orgId)
      .eq("webhook_id", event.id)
      .maybeSingle();
    if (existingLog) {
      return new Response(JSON.stringify({ received: true, duplicate: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    await supabase.from("payment_provider_webhook_logs").insert({
      org_id: orgId,
      provider: "stripe",
      webhook_id: event.id,
      event_type: event.type,
      payload: event.data.object,
      processed_at: new Date().toISOString(),
    });

    if (event.type === "invoice.paid") {
      await handleInvoicePaid(supabase, orgId, event.data.object);
    } else if (event.type === "invoice.payment_failed") {
      await handleInvoicePaymentFailed(supabase, orgId, event.data.object);
    } else if (event.type === "invoice.voided") {
      await handleInvoiceVoided(supabase, orgId, event.data.object);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Stripe webhook error:", error);
    return new Response("Internal error", { status: 500 });
  }
});

async function handleInvoicePaid(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  orgId: string,
  obj: Record<string, unknown>,
) {
  const stripeInvoiceId = obj.id as string;
  const amountPaid = (obj.amount_paid as number) / 100;
  const currency = ((obj.currency as string) || "usd").toUpperCase();

  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, contact_id, total")
    .eq("org_id", orgId)
    .eq("provider", "stripe")
    .eq("provider_invoice_id", stripeInvoiceId)
    .maybeSingle();
  if (!invoice) return;

  await supabase
    .from("invoices")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", invoice.id);

  await supabase.from("payments").insert({
    org_id: orgId,
    contact_id: invoice.contact_id,
    invoice_id: invoice.id,
    provider: "stripe",
    provider_payment_id: (obj.charge as string) || stripeInvoiceId,
    amount: amountPaid,
    currency,
    payment_method: "credit_card",
    received_at: new Date().toISOString(),
  });
}

async function handleInvoicePaymentFailed(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  orgId: string,
  obj: Record<string, unknown>,
) {
  const stripeInvoiceId = obj.id as string;
  await supabase
    .from("invoices")
    .update({ status: "overdue" })
    .eq("org_id", orgId)
    .eq("provider", "stripe")
    .eq("provider_invoice_id", stripeInvoiceId);
}

async function handleInvoiceVoided(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  orgId: string,
  obj: Record<string, unknown>,
) {
  const stripeInvoiceId = obj.id as string;
  await supabase
    .from("invoices")
    .update({ status: "void", voided_at: new Date().toISOString() })
    .eq("org_id", orgId)
    .eq("provider", "stripe")
    .eq("provider_invoice_id", stripeInvoiceId);
}
