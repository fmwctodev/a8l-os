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
    } else if (event.type === "charge.succeeded") {
      await handleChargeSucceeded(supabase, orgId, event.data.object);
    } else if (event.type === "charge.refunded") {
      await handleChargeRefunded(supabase, orgId, event.data.object);
    } else if (event.type === "charge.dispute.created") {
      await handleDisputeCreated(supabase, orgId, event.data.object);
    } else if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated"
    ) {
      await handleSubscriptionUpsert(supabase, orgId, event.data.object);
    } else if (event.type === "customer.subscription.deleted") {
      await handleSubscriptionDeleted(supabase, orgId, event.data.object);
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

// =============================================================
// Phase C: charge / subscription / dispute handlers
// =============================================================

/**
 * Resolve the local contact for a Stripe charge. Tries:
 * 1. charge.customer → contacts.stripe_customer_id
 * 2. charge.invoice → invoices.contact_id (if the charge has an invoice link)
 *
 * Returns null if no match. Standalone PaymentIntent charges with no
 * customer get NULL — caller decides whether to insert the payment row anyway.
 */
async function resolveContactForCharge(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  orgId: string,
  charge: Record<string, unknown>,
): Promise<{ contact_id: string | null; invoice_id: string | null }> {
  const customerId = charge.customer as string | null;
  const stripeInvoiceId = charge.invoice as string | null;

  let invoice_id: string | null = null;
  if (stripeInvoiceId) {
    const { data: inv } = await supabase
      .from("invoices")
      .select("id, contact_id")
      .eq("org_id", orgId)
      .eq("provider", "stripe")
      .eq("provider_invoice_id", stripeInvoiceId)
      .maybeSingle();
    if (inv) return { contact_id: inv.contact_id as string, invoice_id: inv.id as string };
  }

  if (customerId) {
    const { data: contact } = await supabase
      .from("contacts")
      .select("id")
      .eq("organization_id", orgId)
      .eq("stripe_customer_id", customerId)
      .maybeSingle();
    if (contact) return { contact_id: contact.id as string, invoice_id };
  }

  return { contact_id: null, invoice_id };
}

async function handleChargeSucceeded(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  orgId: string,
  charge: Record<string, unknown>,
) {
  const chargeId = charge.id as string;
  const amount = ((charge.amount as number) || 0) / 100;
  const currency = ((charge.currency as string) || "usd").toUpperCase();

  // Idempotency: skip if we already recorded this charge as a payment row.
  const { data: existing } = await supabase
    .from("payments")
    .select("id")
    .eq("org_id", orgId)
    .eq("provider", "stripe")
    .eq("provider_payment_id", chargeId)
    .maybeSingle();
  if (existing) return;

  const { contact_id, invoice_id } = await resolveContactForCharge(supabase, orgId, charge);
  if (!contact_id) {
    console.log(`[stripe-webhook] charge.succeeded ${chargeId}: no local contact match — skipping payment row insert`);
    return;
  }

  await supabase.from("payments").insert({
    org_id: orgId,
    contact_id,
    invoice_id,
    provider: "stripe",
    provider_payment_id: chargeId,
    amount,
    currency,
    payment_method: "credit_card",
    received_at: new Date(((charge.created as number) ?? Date.now() / 1000) * 1000).toISOString(),
    reference_number: (charge.receipt_number as string) ?? null,
  });
}

async function handleChargeRefunded(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  orgId: string,
  charge: Record<string, unknown>,
) {
  const chargeId = charge.id as string;
  const refunded = (charge.amount_refunded as number) ?? 0;
  if (!refunded) return;

  // Find the original payment row to link the refund to
  const { data: original } = await supabase
    .from("payments")
    .select("id, contact_id, invoice_id, currency")
    .eq("org_id", orgId)
    .eq("provider", "stripe")
    .eq("provider_payment_id", chargeId)
    .maybeSingle();
  if (!original) {
    console.log(`[stripe-webhook] charge.refunded ${chargeId}: no original payment row`);
    return;
  }

  const refundId = `${chargeId}_refund_${refunded}`;

  // Idempotency
  const { data: existingRefund } = await supabase
    .from("payments")
    .select("id")
    .eq("org_id", orgId)
    .eq("provider", "stripe")
    .eq("provider_payment_id", refundId)
    .maybeSingle();
  if (existingRefund) return;

  await supabase.from("payments").insert({
    org_id: orgId,
    contact_id: original.contact_id,
    invoice_id: original.invoice_id,
    provider: "stripe",
    provider_payment_id: refundId,
    amount: -(refunded / 100),
    currency: original.currency,
    payment_method: "credit_card",
    reference_number: `Refund of ${chargeId}`,
    received_at: new Date().toISOString(),
  });
}

async function handleDisputeCreated(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  orgId: string,
  dispute: Record<string, unknown>,
) {
  const disputeId = dispute.id as string;
  const chargeId = dispute.charge as string;

  await supabase.from("audit_logs").insert({
    org_id: orgId,
    user_id: null,
    action: "stripe.dispute.created",
    entity_type: "stripe_dispute",
    entity_id: disputeId,
    details: {
      dispute_id: disputeId,
      charge_id: chargeId,
      reason: dispute.reason,
      amount: dispute.amount,
      currency: dispute.currency,
      status: dispute.status,
    },
  });

  // Flag the related invoice as overdue so it surfaces in dashboards
  if (chargeId) {
    const { data: payment } = await supabase
      .from("payments")
      .select("invoice_id")
      .eq("org_id", orgId)
      .eq("provider", "stripe")
      .eq("provider_payment_id", chargeId)
      .maybeSingle();
    if (payment?.invoice_id) {
      await supabase
        .from("invoices")
        .update({ status: "overdue", internal_notes: `Stripe dispute opened (${disputeId})` })
        .eq("id", payment.invoice_id);
    }
  }
}

async function handleSubscriptionUpsert(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  orgId: string,
  sub: Record<string, unknown>,
) {
  const subId = sub.id as string;
  const customerId = sub.customer as string;
  const status = sub.status as string;

  // Resolve the local contact
  const { data: contact } = await supabase
    .from("contacts")
    .select("id")
    .eq("organization_id", orgId)
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  if (!contact) {
    console.log(`[stripe-webhook] subscription ${subId}: no local contact for customer ${customerId}`);
    return;
  }

  const items = (sub.items as { data?: Array<Record<string, unknown>> })?.data ?? [];
  const firstItem = items[0];
  const price = firstItem?.price as Record<string, unknown> | undefined;
  const recurring = price?.recurring as { interval?: string; interval_count?: number } | undefined;
  const interval = recurring?.interval ?? "month";
  // Map Stripe interval to our recurring_profiles enum
  let frequency: "weekly" | "monthly" | "quarterly" | "annually" = "monthly";
  if (interval === "week") frequency = "weekly";
  else if (interval === "year") frequency = "annually";
  else if (interval === "month" && recurring?.interval_count === 3) frequency = "quarterly";

  // upsert by (org_id, provider, provider_recurring_template_id)
  const { data: existing } = await supabase
    .from("recurring_profiles")
    .select("id")
    .eq("org_id", orgId)
    .eq("provider", "stripe")
    .eq("provider_recurring_template_id", subId)
    .maybeSingle();

  const profileData = {
    org_id: orgId,
    contact_id: contact.id,
    provider: "stripe",
    provider_recurring_template_id: subId,
    name: (sub.description as string) || `Stripe Subscription ${subId}`,
    frequency,
    status: status === "active" || status === "trialing" ? "active" : status === "canceled" ? "cancelled" : "paused",
    next_invoice_date: sub.current_period_end
      ? new Date(((sub.current_period_end as number) ?? 0) * 1000).toISOString().slice(0, 10)
      : null,
    auto_send: true,
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    await supabase.from("recurring_profiles").update(profileData).eq("id", existing.id);
  } else {
    await supabase.from("recurring_profiles").insert({ ...profileData, created_at: new Date().toISOString() });
  }
}

async function handleSubscriptionDeleted(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  orgId: string,
  sub: Record<string, unknown>,
) {
  const subId = sub.id as string;
  await supabase
    .from("recurring_profiles")
    .update({
      status: "cancelled",
      updated_at: new Date().toISOString(),
      next_invoice_date: null,
    })
    .eq("org_id", orgId)
    .eq("provider", "stripe")
    .eq("provider_recurring_template_id", subId);
}
