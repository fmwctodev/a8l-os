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
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "decrypt",
      encrypted: conn.credentials_encrypted,
      iv: conn.credentials_iv,
    }),
  });

  if (!response.ok) return null;

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
  const response = await fetch(`${supabaseUrl}/functions/v1/email-crypto`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action: "encrypt", plaintext: payload }),
  });
  if (!response.ok) {
    throw new Error("Failed to encrypt Stripe credentials");
  }
  return await response.json();
}
