import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  aggregateVolume,
  computeMRR,
  createStripeInvoice,
  findOrCreateStripeCustomer,
  getDecryptedStripeCreds,
  getStripeBalance,
  listStripeBalanceTransactions,
  listStripeCustomers,
  listStripePayouts,
  listStripePaymentIntents,
  listStripeSubscriptions,
  sendStripeInvoice,
  stripeApi,
  voidStripeInvoice,
  type StripeLineItemInput,
} from "../_shared/stripe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type ActionPayload = { action: string; org_id: string; [k: string]: unknown };

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const payload = (await req.json()) as ActionPayload;
    if (!payload.org_id) return jsonResponse({ error: "Missing org_id" }, 400);

    const creds = await getDecryptedStripeCreds(payload.org_id, supabase, supabaseUrl, serviceRoleKey);
    if (!creds) {
      return jsonResponse({ error: "Stripe not connected for this organization" }, 404);
    }

    // ---- Write actions (existing) ----

    if (payload.action === "createInvoice") {
      const customerResult = await findOrCreateStripeCustomer(creds.secretKey, payload.contact as never);
      if (!customerResult.ok || !customerResult.customer) {
        return jsonResponse({ error: customerResult.error || "Failed to find/create Stripe customer" }, 500);
      }
      const invoiceResult = await createStripeInvoice(
        creds.secretKey,
        customerResult.customer.id,
        payload.line_items as StripeLineItemInput[],
        {
          dueDays: payload.due_days as number | undefined,
          memo: payload.memo as string | undefined,
          autoSend: payload.auto_send as boolean | undefined,
        },
      );
      if (!invoiceResult.ok || !invoiceResult.invoice) {
        return jsonResponse({ error: invoiceResult.error || "Failed to create Stripe invoice" }, 500);
      }
      return jsonResponse({ success: true, invoice: invoiceResult.invoice, customer: customerResult.customer });
    }

    if (payload.action === "sendInvoice") {
      const r = await sendStripeInvoice(creds.secretKey, payload.invoice_id as string);
      if (!r.ok) return jsonResponse({ error: r.error }, 500);
      return jsonResponse({ success: true, invoice: r.invoice });
    }

    if (payload.action === "voidInvoice") {
      const r = await voidStripeInvoice(creds.secretKey, payload.invoice_id as string);
      if (!r.ok) return jsonResponse({ error: r.error }, 500);
      return jsonResponse({ success: true });
    }

    // ---- Read actions (Phase B — Payments dashboard tiles) ----

    if (payload.action === "getBalance") {
      const r = await getStripeBalance(creds.secretKey);
      if (!r.ok) return jsonResponse({ error: r.error }, 500);
      return jsonResponse({ success: true, balance: r.balance });
    }

    if (payload.action === "listPayouts") {
      const r = await listStripePayouts(creds.secretKey, (payload.limit as number) ?? 10);
      if (!r.ok) return jsonResponse({ error: r.error }, 500);
      return jsonResponse({ success: true, payouts: r.payouts });
    }

    if (payload.action === "listPayments") {
      const r = await listStripePaymentIntents(creds.secretKey, {
        limit: (payload.limit as number) ?? 20,
        customer: payload.customer as string | undefined,
        created_gte: payload.created_gte as number | undefined,
        created_lte: payload.created_lte as number | undefined,
      });
      if (!r.ok) return jsonResponse({ error: r.error }, 500);
      return jsonResponse({ success: true, payments: r.payments });
    }

    if (payload.action === "listCustomers") {
      const r = await listStripeCustomers(creds.secretKey, {
        limit: (payload.limit as number) ?? 50,
        email: payload.email as string | undefined,
        created_gte: payload.created_gte as number | undefined,
        created_lte: payload.created_lte as number | undefined,
        starting_after: payload.starting_after as string | undefined,
      });
      if (!r.ok) return jsonResponse({ error: r.error }, 500);
      return jsonResponse({ success: true, customers: r.customers, has_more: r.has_more });
    }

    if (payload.action === "listSubscriptions") {
      const r = await listStripeSubscriptions(creds.secretKey, {
        status: (payload.status as string) ?? "active",
        limit: (payload.limit as number) ?? 100,
      });
      if (!r.ok) return jsonResponse({ error: r.error }, 500);
      return jsonResponse({ success: true, subscriptions: r.subscriptions, has_more: r.has_more });
    }

    if (payload.action === "getMRR") {
      const all: Array<Awaited<ReturnType<typeof listStripeSubscriptions>>["subscriptions"][number]> = [] as never;
      let starting_after: string | undefined;
      let safety = 0;
      while (safety++ < 20) {
        const r = await listStripeSubscriptions(creds.secretKey, { status: "active", limit: 100, starting_after });
        if (!r.ok || !r.subscriptions) return jsonResponse({ error: r.error }, 500);
        all.push(...r.subscriptions);
        if (!r.has_more || r.subscriptions.length === 0) break;
        starting_after = r.subscriptions[r.subscriptions.length - 1].id;
      }
      const mrr = computeMRR(all);
      return jsonResponse({ success: true, mrr, active_subscriptions: all.length });
    }

    if (payload.action === "getVolumeMetrics") {
      const created_gte = payload.created_gte as number | undefined;
      const created_lte = payload.created_lte as number | undefined;
      // paginate
      const all: Array<Awaited<ReturnType<typeof listStripeBalanceTransactions>>["txns"][number]> = [] as never;
      let starting_after: string | undefined;
      let safety = 0;
      while (safety++ < 20) {
        const r = await listStripeBalanceTransactions(creds.secretKey, {
          limit: 100,
          created_gte,
          created_lte,
          starting_after,
        });
        if (!r.ok || !r.txns) return jsonResponse({ error: r.error }, 500);
        all.push(...r.txns);
        if (!r.has_more || r.txns.length === 0) break;
        starting_after = r.txns[r.txns.length - 1].id;
      }
      const agg = aggregateVolume(all);
      return jsonResponse({ success: true, volume: agg, txn_count: all.length });
    }

    if (payload.action === "countNewCustomers") {
      const created_gte = payload.created_gte as number | undefined;
      const created_lte = payload.created_lte as number | undefined;
      let count = 0;
      let starting_after: string | undefined;
      let safety = 0;
      while (safety++ < 20) {
        const r = await listStripeCustomers(creds.secretKey, {
          limit: 100,
          created_gte,
          created_lte,
          starting_after,
        });
        if (!r.ok || !r.customers) return jsonResponse({ error: r.error }, 500);
        count += r.customers.length;
        if (!r.has_more || r.customers.length === 0) break;
        starting_after = r.customers[r.customers.length - 1].id;
      }
      return jsonResponse({ success: true, count });
    }

    // ---- Write actions (Phase C — customer + payment ops) ----

    if (payload.action === "findOrCreateCustomerByContact") {
      const contactId = payload.contact_id as string;
      if (!contactId) return jsonResponse({ error: "Missing contact_id" }, 400);
      const { data: contact } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, email, phone, company, stripe_customer_id, organization_id")
        .eq("id", contactId)
        .eq("organization_id", payload.org_id)
        .maybeSingle();
      if (!contact) return jsonResponse({ error: "Contact not found" }, 404);
      if (contact.stripe_customer_id) {
        // Verify it still exists in Stripe; if not, recreate.
        const verify = await stripeApi(creds.secretKey, `/customers/${contact.stripe_customer_id}`);
        if (verify.ok) {
          return jsonResponse({ success: true, customer: verify.data, existing: true });
        }
      }
      const r = await findOrCreateStripeCustomer(creds.secretKey, contact);
      if (!r.ok || !r.customer) return jsonResponse({ error: r.error }, 500);
      await supabase
        .from("contacts")
        .update({ stripe_customer_id: r.customer.id })
        .eq("id", contact.id);
      return jsonResponse({ success: true, customer: r.customer, existing: false });
    }

    if (payload.action === "updateCustomer") {
      const stripeCustomerId = payload.stripe_customer_id as string;
      if (!stripeCustomerId) return jsonResponse({ error: "Missing stripe_customer_id" }, 400);
      const updates = (payload.updates as Record<string, unknown>) ?? {};
      const r = await stripeApi(creds.secretKey, `/customers/${stripeCustomerId}`, { body: updates });
      if (!r.ok) return jsonResponse({ error: r.error }, 500);
      return jsonResponse({ success: true, customer: r.data });
    }

    if (payload.action === "refundCharge") {
      const chargeId = payload.charge_id as string;
      const amount = payload.amount as number | undefined; // cents; omitted = full refund
      if (!chargeId) return jsonResponse({ error: "Missing charge_id" }, 400);
      const body: Record<string, unknown> = { charge: chargeId };
      if (typeof amount === "number") body.amount = amount;
      const r = await stripeApi(creds.secretKey, "/refunds", { body });
      if (!r.ok) return jsonResponse({ error: r.error }, 500);
      return jsonResponse({ success: true, refund: r.data });
    }

    if (payload.action === "createPaymentIntent") {
      const contactId = payload.contact_id as string | undefined;
      const amount = payload.amount as number; // cents
      const currency = (payload.currency as string) ?? "usd";
      const description = payload.description as string | undefined;
      if (!amount) return jsonResponse({ error: "Missing amount" }, 400);

      let stripeCustomerId: string | undefined;
      if (contactId) {
        const { data: contact } = await supabase
          .from("contacts")
          .select("stripe_customer_id, first_name, last_name, email, phone, company")
          .eq("id", contactId)
          .eq("organization_id", payload.org_id)
          .maybeSingle();
        if (contact) {
          if (contact.stripe_customer_id) {
            stripeCustomerId = contact.stripe_customer_id;
          } else {
            const cust = await findOrCreateStripeCustomer(creds.secretKey, contact);
            if (cust.ok && cust.customer) {
              stripeCustomerId = cust.customer.id;
              await supabase
                .from("contacts")
                .update({ stripe_customer_id: cust.customer.id })
                .eq("id", contactId);
            }
          }
        }
      }

      const body: Record<string, unknown> = { amount, currency };
      if (stripeCustomerId) body.customer = stripeCustomerId;
      if (description) body.description = description;
      const r = await stripeApi(creds.secretKey, "/payment_intents", { body });
      if (!r.ok) return jsonResponse({ error: r.error }, 500);
      return jsonResponse({ success: true, payment_intent: r.data });
    }

    return jsonResponse({ error: `Unknown action: ${payload.action}` }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse({ error: message }, 500);
  }
});

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
