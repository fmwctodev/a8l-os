/**
 * Shared Stripe helper.
 *
 * Single source of truth for Stripe API calls across stripe-provider,
 * stripe-api, stripe-webhook, and stripe-oauth-callback. Mirrors the
 * shape of `_shared/mailgun.ts` so future provider integrations follow
 * a consistent pattern.
 *
 * Stripe API reference: https://docs.stripe.com/api
 */

const STRIPE_API_BASE = "https://api.stripe.com/v1";

export interface StripeCredentials {
  secretKey: string;
  publishableKey: string | null;
  accountId: string | null; // Connect account ID, null for self-managed keys
  webhookSigningSecret: string | null;
}

export interface StripeAccountInfo {
  id: string;
  email: string | null;
  business_name: string | null;
  country: string | null;
  default_currency: string | null;
  charges_enabled: boolean;
  details_submitted: boolean;
}

function basicAuth(secretKey: string): string {
  return "Basic " + btoa(`${secretKey}:`);
}

interface StripeApiOptions {
  method?: "GET" | "POST" | "DELETE";
  body?: Record<string, unknown>;
  idempotencyKey?: string;
}

/**
 * Generic Stripe API call. Handles form-encoding (Stripe's bodies are
 * application/x-www-form-urlencoded with bracketed nested keys) and
 * idempotency keys.
 */
export async function stripeApi<T = unknown>(
  secretKey: string,
  path: string,
  opts: StripeApiOptions = {},
): Promise<{ ok: boolean; status: number; data?: T; error?: string }> {
  const url = `${STRIPE_API_BASE}${path}`;
  const headers: Record<string, string> = {
    Authorization: basicAuth(secretKey),
  };

  let body: BodyInit | undefined;
  if (opts.body) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    body = encodeStripeForm(opts.body);
  }
  if (opts.idempotencyKey) {
    headers["Idempotency-Key"] = opts.idempotencyKey;
  }

  try {
    const response = await fetch(url, {
      method: opts.method ?? (body ? "POST" : "GET"),
      headers,
      body,
    });

    if (!response.ok) {
      let errorMessage = `Stripe API error ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error?.message || errorMessage;
      } catch {
        try {
          errorMessage = await response.text();
        } catch {
          // ignore
        }
      }
      return { ok: false, status: response.status, error: errorMessage };
    }

    const data = (await response.json()) as T;
    return { ok: true, status: response.status, data };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Stripe API request failed";
    return { ok: false, status: 0, error: message };
  }
}

/**
 * Form-encodes Stripe's nested object syntax:
 *   { foo: 1, bar: { baz: 2 } } -> "foo=1&bar[baz]=2"
 */
function encodeStripeForm(obj: Record<string, unknown>, prefix?: string): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}[${key}]` : key;
    if (value === null || value === undefined) continue;
    if (Array.isArray(value)) {
      value.forEach((item, i) => {
        if (typeof item === "object" && item !== null) {
          for (const [k, v] of encodeStripeForm(item as Record<string, unknown>, `${fullKey}[${i}]`)) {
            params.append(k, v);
          }
        } else {
          params.append(`${fullKey}[${i}]`, String(item));
        }
      });
    } else if (typeof value === "object") {
      for (const [k, v] of encodeStripeForm(value as Record<string, unknown>, fullKey)) {
        params.append(k, v);
      }
    } else {
      params.append(fullKey, String(value));
    }
  }
  return params;
}

export async function validateStripeKey(
  secretKey: string,
): Promise<{ valid: boolean; account?: StripeAccountInfo; error?: string }> {
  const result = await stripeApi<{
    id: string;
    email: string | null;
    business_profile?: { name: string | null };
    country: string | null;
    default_currency: string | null;
    charges_enabled: boolean;
    details_submitted: boolean;
  }>(secretKey, "/account");

  if (!result.ok || !result.data) {
    if (result.status === 401) return { valid: false, error: "Invalid Stripe secret key" };
    return { valid: false, error: result.error || "Failed to verify Stripe credentials" };
  }

  return {
    valid: true,
    account: {
      id: result.data.id,
      email: result.data.email,
      business_name: result.data.business_profile?.name ?? null,
      country: result.data.country,
      default_currency: result.data.default_currency,
      charges_enabled: result.data.charges_enabled,
      details_submitted: result.data.details_submitted,
    },
  };
}

export interface StripeCustomer {
  id: string;
  email: string | null;
  name: string | null;
  phone: string | null;
}

export async function findOrCreateStripeCustomer(
  secretKey: string,
  contact: {
    email: string | null;
    first_name: string;
    last_name: string;
    phone?: string | null;
    company?: string | null;
  },
): Promise<{ ok: boolean; customer?: StripeCustomer; error?: string }> {
  if (contact.email) {
    const search = await stripeApi<{ data: StripeCustomer[] }>(
      secretKey,
      `/customers?email=${encodeURIComponent(contact.email)}&limit=1`,
    );
    if (search.ok && search.data?.data?.length) {
      return { ok: true, customer: search.data.data[0] };
    }
  }

  const create = await stripeApi<StripeCustomer>(secretKey, "/customers", {
    body: {
      name: contact.company || `${contact.first_name} ${contact.last_name}`.trim(),
      email: contact.email ?? undefined,
      phone: contact.phone ?? undefined,
    },
  });

  if (!create.ok || !create.data) {
    return { ok: false, error: create.error };
  }
  return { ok: true, customer: create.data };
}

export interface StripeInvoice {
  id: string;
  number: string | null;
  status: "draft" | "open" | "paid" | "uncollectible" | "void";
  hosted_invoice_url: string | null;
  amount_due: number;
  amount_paid: number;
  total: number;
  currency: string;
}

export interface StripeLineItemInput {
  description: string;
  quantity: number;
  unit_price: number;
  currency: string;
}

/**
 * Creates a Stripe invoice + invoice items. Stripe's flow is:
 *   1. POST /invoiceitems for each line (pending invoice items)
 *   2. POST /invoices to bind them into an invoice
 *   3. POST /invoices/:id/finalize to lock and get hosted URL
 */
export async function createStripeInvoice(
  secretKey: string,
  customerId: string,
  lineItems: StripeLineItemInput[],
  options: { dueDays?: number; memo?: string; autoSend?: boolean } = {},
): Promise<{ ok: boolean; invoice?: StripeInvoice; error?: string }> {
  for (const item of lineItems) {
    const create = await stripeApi(secretKey, "/invoiceitems", {
      body: {
        customer: customerId,
        amount: Math.round(item.unit_price * item.quantity * 100),
        currency: item.currency,
        description: item.description,
      },
    });
    if (!create.ok) return { ok: false, error: create.error };
  }

  const invoiceCreate = await stripeApi<StripeInvoice>(secretKey, "/invoices", {
    body: {
      customer: customerId,
      collection_method: "send_invoice",
      days_until_due: options.dueDays ?? 30,
      description: options.memo,
      auto_advance: options.autoSend ?? false,
    },
  });
  if (!invoiceCreate.ok || !invoiceCreate.data) {
    return { ok: false, error: invoiceCreate.error };
  }

  const finalize = await stripeApi<StripeInvoice>(
    secretKey,
    `/invoices/${invoiceCreate.data.id}/finalize`,
    { body: {} },
  );
  if (!finalize.ok || !finalize.data) {
    return { ok: false, error: finalize.error };
  }

  return { ok: true, invoice: finalize.data };
}

export async function sendStripeInvoice(
  secretKey: string,
  invoiceId: string,
): Promise<{ ok: boolean; invoice?: StripeInvoice; error?: string }> {
  const result = await stripeApi<StripeInvoice>(
    secretKey,
    `/invoices/${invoiceId}/send`,
    { body: {} },
  );
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, invoice: result.data };
}

export async function voidStripeInvoice(
  secretKey: string,
  invoiceId: string,
): Promise<{ ok: boolean; error?: string }> {
  const result = await stripeApi(secretKey, `/invoices/${invoiceId}/void`, { body: {} });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true };
}

// =============================================================
// Read-side helpers (Phase B — Payments dashboard tiles)
// =============================================================

export interface StripeBalance {
  available: Array<{ amount: number; currency: string }>;
  pending: Array<{ amount: number; currency: string }>;
}

export async function getStripeBalance(
  secretKey: string,
): Promise<{ ok: boolean; balance?: StripeBalance; error?: string }> {
  const result = await stripeApi<StripeBalance>(secretKey, "/balance");
  if (!result.ok || !result.data) return { ok: false, error: result.error };
  return { ok: true, balance: result.data };
}

export interface StripePayout {
  id: string;
  amount: number;
  currency: string;
  arrival_date: number;
  status: string;
  type: string;
  created: number;
}

export async function listStripePayouts(
  secretKey: string,
  limit = 10,
): Promise<{ ok: boolean; payouts?: StripePayout[]; error?: string }> {
  const result = await stripeApi<{ data: StripePayout[] }>(
    secretKey,
    `/payouts?limit=${limit}`,
  );
  if (!result.ok || !result.data) return { ok: false, error: result.error };
  return { ok: true, payouts: result.data.data };
}

export interface StripePaymentIntent {
  id: string;
  amount: number;
  amount_received: number;
  currency: string;
  status: string;
  created: number;
  customer: string | null;
  description: string | null;
  receipt_email: string | null;
  metadata: Record<string, string>;
  charges?: { data: Array<{ id: string; receipt_url: string | null }> };
}

export async function listStripePaymentIntents(
  secretKey: string,
  params: { limit?: number; customer?: string; created_gte?: number; created_lte?: number } = {},
): Promise<{ ok: boolean; payments?: StripePaymentIntent[]; error?: string }> {
  const qs = new URLSearchParams();
  qs.set("limit", String(params.limit ?? 20));
  if (params.customer) qs.set("customer", params.customer);
  if (params.created_gte) qs.set("created[gte]", String(params.created_gte));
  if (params.created_lte) qs.set("created[lte]", String(params.created_lte));
  const result = await stripeApi<{ data: StripePaymentIntent[] }>(
    secretKey,
    `/payment_intents?${qs.toString()}`,
  );
  if (!result.ok || !result.data) return { ok: false, error: result.error };
  return { ok: true, payments: result.data.data };
}

export interface StripeCustomerSummary {
  id: string;
  email: string | null;
  name: string | null;
  phone: string | null;
  created: number;
  metadata: Record<string, string>;
}

export async function listStripeCustomers(
  secretKey: string,
  params: { limit?: number; email?: string; created_gte?: number; created_lte?: number; starting_after?: string } = {},
): Promise<{ ok: boolean; customers?: StripeCustomerSummary[]; has_more?: boolean; error?: string }> {
  const qs = new URLSearchParams();
  qs.set("limit", String(params.limit ?? 50));
  if (params.email) qs.set("email", params.email);
  if (params.created_gte) qs.set("created[gte]", String(params.created_gte));
  if (params.created_lte) qs.set("created[lte]", String(params.created_lte));
  if (params.starting_after) qs.set("starting_after", params.starting_after);
  const result = await stripeApi<{ data: StripeCustomerSummary[]; has_more: boolean }>(
    secretKey,
    `/customers?${qs.toString()}`,
  );
  if (!result.ok || !result.data) return { ok: false, error: result.error };
  return { ok: true, customers: result.data.data, has_more: result.data.has_more };
}

export interface StripeSubscription {
  id: string;
  status: string;
  customer: string;
  current_period_start: number;
  current_period_end: number;
  items: {
    data: Array<{
      id: string;
      quantity: number;
      price: {
        id: string;
        unit_amount: number | null;
        currency: string;
        recurring: { interval: "day" | "week" | "month" | "year"; interval_count: number } | null;
      };
    }>;
  };
}

export async function listStripeSubscriptions(
  secretKey: string,
  params: { status?: string; limit?: number; starting_after?: string } = {},
): Promise<{ ok: boolean; subscriptions?: StripeSubscription[]; has_more?: boolean; error?: string }> {
  const qs = new URLSearchParams();
  qs.set("status", params.status ?? "active");
  qs.set("limit", String(params.limit ?? 100));
  if (params.starting_after) qs.set("starting_after", params.starting_after);
  const result = await stripeApi<{ data: StripeSubscription[]; has_more: boolean }>(
    secretKey,
    `/subscriptions?${qs.toString()}`,
  );
  if (!result.ok || !result.data) return { ok: false, error: result.error };
  return { ok: true, subscriptions: result.data.data, has_more: result.data.has_more };
}

export interface StripeBalanceTransaction {
  id: string;
  amount: number;
  net: number;
  fee: number;
  currency: string;
  type: string;
  created: number;
  source: string | null;
}

export async function listStripeBalanceTransactions(
  secretKey: string,
  params: { created_gte?: number; created_lte?: number; limit?: number; starting_after?: string } = {},
): Promise<{ ok: boolean; txns?: StripeBalanceTransaction[]; has_more?: boolean; error?: string }> {
  const qs = new URLSearchParams();
  qs.set("limit", String(params.limit ?? 100));
  if (params.created_gte) qs.set("created[gte]", String(params.created_gte));
  if (params.created_lte) qs.set("created[lte]", String(params.created_lte));
  if (params.starting_after) qs.set("starting_after", params.starting_after);
  const result = await stripeApi<{ data: StripeBalanceTransaction[]; has_more: boolean }>(
    secretKey,
    `/balance_transactions?${qs.toString()}`,
  );
  if (!result.ok || !result.data) return { ok: false, error: result.error };
  return { ok: true, txns: result.data.data, has_more: result.data.has_more };
}

/**
 * Compute Monthly Recurring Revenue from active subscriptions.
 * Normalizes each subscription item to a per-month figure. Currency
 * mismatches are surfaced via the `mixed_currency` flag — caller can
 * decide whether to bucket by currency or single-currency it.
 */
export function computeMRR(
  subscriptions: StripeSubscription[],
): { amount: number; currency: string; mixed_currency: boolean } {
  let totalCents = 0;
  let topCurrency = "usd";
  const byCurrency = new Map<string, number>();

  for (const sub of subscriptions) {
    if (sub.status !== "active" && sub.status !== "trialing") continue;
    for (const item of sub.items.data) {
      const price = item.price;
      if (!price.unit_amount || !price.recurring) continue;
      const intervalCount = price.recurring.interval_count || 1;
      let monthlyMultiplier = 1;
      switch (price.recurring.interval) {
        case "day":
          monthlyMultiplier = 30 / intervalCount;
          break;
        case "week":
          monthlyMultiplier = 4.33 / intervalCount;
          break;
        case "month":
          monthlyMultiplier = 1 / intervalCount;
          break;
        case "year":
          monthlyMultiplier = 1 / (12 * intervalCount);
          break;
      }
      const cents = price.unit_amount * item.quantity * monthlyMultiplier;
      totalCents += cents;
      const currency = price.currency.toLowerCase();
      byCurrency.set(currency, (byCurrency.get(currency) ?? 0) + cents);
    }
  }

  // Find the dominant currency
  let max = 0;
  for (const [c, amt] of byCurrency) {
    if (amt > max) {
      max = amt;
      topCurrency = c;
    }
  }
  return {
    amount: Math.round(totalCents) / 100,
    currency: topCurrency,
    mixed_currency: byCurrency.size > 1,
  };
}

/**
 * Aggregate balance_transactions into Net Volume (charges - refunds, after fees)
 * and Gross Volume (sum of charges, before fees). Excludes payouts and adjustments.
 */
export function aggregateVolume(
  txns: StripeBalanceTransaction[],
): { gross: number; net: number; refunds: number; fees: number; currency: string } {
  let gross = 0;
  let refunds = 0;
  let fees = 0;
  let currency = "usd";

  for (const t of txns) {
    currency = t.currency;
    if (t.type === "charge" || t.type === "payment") {
      gross += t.amount;
      fees += t.fee;
    } else if (t.type === "refund" || t.type === "payment_refund") {
      refunds += Math.abs(t.amount);
      fees += t.fee;
    }
  }

  return {
    gross: gross / 100,
    net: (gross - refunds - fees) / 100,
    refunds: refunds / 100,
    fees: fees / 100,
    currency,
  };
}

/**
 * Verifies a Stripe webhook signature header. Stripe uses HMAC-SHA256
 * with the signing secret over `${timestamp}.${rawBody}`.
 *
 * Spec: https://docs.stripe.com/webhooks#verify-manually
 */
export async function verifyStripeWebhookSignature(
  rawBody: string,
  signatureHeader: string,
  signingSecret: string,
  toleranceSeconds = 300,
): Promise<boolean> {
  try {
    const parts = signatureHeader.split(",").reduce<Record<string, string[]>>((acc, p) => {
      const [k, v] = p.split("=");
      if (!k || !v) return acc;
      (acc[k] ||= []).push(v);
      return acc;
    }, {});
    const timestamp = parts.t?.[0];
    const signatures = parts.v1 ?? [];
    if (!timestamp || signatures.length === 0) return false;

    const ageSeconds = Math.abs(Date.now() / 1000 - Number(timestamp));
    if (ageSeconds > toleranceSeconds) return false;

    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(signingSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sigBytes = await crypto.subtle.sign(
      "HMAC",
      key,
      enc.encode(`${timestamp}.${rawBody}`),
    );
    const expected = Array.from(new Uint8Array(sigBytes))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    return signatures.some((sig) => constantTimeEqual(sig, expected));
  } catch {
    return false;
  }
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

interface SupabaseLike {
  from: (table: string) => unknown;
}

/**
 * Resolves Stripe credentials for an org.
 *
 * Resolution order:
 *   1. STRIPE_SECRET_KEY env var (development / single-tenant). When set,
 *      uses STRIPE_PUBLISHABLE_KEY + STRIPE_WEBHOOK_SIGNING_SECRET.
 *   2. payment_provider_connections row where provider='stripe' and
 *      decrypts credentials_encrypted via the email-crypto edge function
 *      (same pattern Mailgun uses).
 *
 * Returns null if no credentials are available.
 */
export async function getDecryptedStripeCreds(
  orgId: string,
  // deno-lint-ignore no-explicit-any
  supabase: any,
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<StripeCredentials | null> {
  const envKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (envKey) {
    return {
      secretKey: envKey,
      publishableKey: Deno.env.get("STRIPE_PUBLISHABLE_KEY") ?? null,
      accountId: null,
      webhookSigningSecret: Deno.env.get("STRIPE_WEBHOOK_SIGNING_SECRET") ?? null,
    };
  }

  const { data: conn } = await supabase
    .from("payment_provider_connections")
    .select("credentials_encrypted, credentials_iv, account_info")
    .eq("org_id", orgId)
    .eq("provider", "stripe")
    .maybeSingle();

  if (!conn?.credentials_encrypted || !conn.credentials_iv) {
    return null;
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/email-crypto`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "decrypt",
      encrypted: conn.credentials_encrypted,
      iv: conn.credentials_iv,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error(`[stripe getDecryptedStripeCreds] email-crypto ${response.status}: ${body}`);
    return null;
  }

  const { plaintext } = await response.json();
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(plaintext);
  } catch {
    return null;
  }

  const secretKey = typeof parsed.secret_key === "string" ? parsed.secret_key : null;
  if (!secretKey) return null;

  return {
    secretKey,
    publishableKey: typeof parsed.publishable_key === "string" ? parsed.publishable_key : null,
    accountId: typeof parsed.account_id === "string" ? parsed.account_id : null,
    webhookSigningSecret:
      typeof parsed.webhook_signing_secret === "string" ? parsed.webhook_signing_secret : null,
  };
}

export async function encryptStripeCreds(
  creds: {
    secret_key: string;
    publishable_key?: string | null;
    account_id?: string | null;
    webhook_signing_secret?: string | null;
  },
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<{ encrypted: string; iv: string }> {
  const payload = JSON.stringify({
    secret_key: creds.secret_key,
    publishable_key: creds.publishable_key ?? null,
    account_id: creds.account_id ?? null,
    webhook_signing_secret: creds.webhook_signing_secret ?? null,
  });

  // Sanity check before we even fire the request — if the env var is
  // missing in our runtime, no point hitting email-crypto with a
  // garbage Bearer.
  if (!serviceRoleKey || serviceRoleKey.length < 20) {
    throw new Error(
      `encryptStripeCreds: SUPABASE_SERVICE_ROLE_KEY env var is missing/short (len=${serviceRoleKey?.length ?? 0})`,
    );
  }

  // Try the apikey + Authorization combo. The email-crypto function
  // checks `authHeader.includes(serviceRoleKey)`, so passing the key
  // in either header keeps the path resilient to gateway header
  // rewrites between functions.
  const response = await fetch(`${supabaseUrl}/functions/v1/email-crypto`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action: "encrypt", plaintext: payload }),
  });

  if (!response.ok) {
    let body = "";
    try {
      body = await response.text();
    } catch { /* ignore */ }
    console.error(
      `[stripe encryptStripeCreds] email-crypto returned ${response.status}: ${body}`,
    );
    throw new Error(
      `email-crypto ${response.status}: ${body.slice(0, 200) || "(no body)"}`,
    );
  }
  return await response.json();
}
