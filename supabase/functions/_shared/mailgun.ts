/**
 * Shared Mailgun helper.
 *
 * Single source of truth for the SendGrid -> Mailgun translation. Used by
 * email-send, every direct caller, and the management functions
 * (email-mailgun-provider/domains/senders/suppressions).
 *
 * Mailgun API reference: https://documentation.mailgun.com/
 */

export type MailgunRegion = "us" | "eu";

export const MAILGUN_BASE_URL_US = "https://api.mailgun.net";
export const MAILGUN_BASE_URL_EU = "https://api.eu.mailgun.net";

export function mailgunBaseUrl(region: MailgunRegion = "us"): string {
  return region === "eu" ? MAILGUN_BASE_URL_EU : MAILGUN_BASE_URL_US;
}

function basicAuth(apiKey: string): string {
  return "Basic " + btoa(`api:${apiKey}`);
}

export interface MailgunCredentials {
  apiKey: string;
  domain: string;
  signingKey: string | null;
  region: MailgunRegion;
}

export interface SendMailgunEmailOptions {
  apiKey: string;
  domain: string;
  region?: MailgunRegion;
  from: string;
  to: string;
  toName?: string;
  cc?: string;
  bcc?: string;
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
  trackOpens?: boolean;
  trackClicks?: boolean;
  tags?: string[];
  variables?: Record<string, string>;
  customHeaders?: Record<string, string>;
  attachments?: Array<{ filename: string; content: string | Uint8Array; contentType?: string }>;
}

export interface SendMailgunEmailResult {
  ok: boolean;
  status: number;
  messageId?: string;
  error?: string;
}

export async function sendMailgunEmail(
  opts: SendMailgunEmailOptions,
): Promise<SendMailgunEmailResult> {
  if (!opts.html && !opts.text) {
    return { ok: false, status: 400, error: "Email body required (html or text)" };
  }
  if (!opts.from) {
    return { ok: false, status: 400, error: "Missing 'from' address" };
  }
  if (!opts.to) {
    return { ok: false, status: 400, error: "Missing 'to' address" };
  }

  const region = opts.region ?? "us";
  const url = `${mailgunBaseUrl(region)}/v3/${encodeURIComponent(opts.domain)}/messages`;

  const hasAttachments = (opts.attachments?.length ?? 0) > 0;
  let body: BodyInit;
  let extraHeaders: Record<string, string> = {};

  const toField = opts.toName ? `${opts.toName} <${opts.to}>` : opts.to;

  if (hasAttachments) {
    const fd = new FormData();
    fd.append("from", opts.from);
    fd.append("to", toField);
    if (opts.cc) fd.append("cc", opts.cc);
    if (opts.bcc) fd.append("bcc", opts.bcc);
    fd.append("subject", opts.subject);
    if (opts.html) fd.append("html", opts.html);
    if (opts.text) fd.append("text", opts.text);
    if (opts.replyTo) fd.append("h:Reply-To", opts.replyTo);
    fd.append("o:tracking", opts.trackOpens || opts.trackClicks ? "yes" : "no");
    if (typeof opts.trackOpens === "boolean") {
      fd.append("o:tracking-opens", opts.trackOpens ? "yes" : "no");
    }
    if (typeof opts.trackClicks === "boolean") {
      fd.append("o:tracking-clicks", opts.trackClicks ? "yes" : "no");
    }
    for (const tag of opts.tags ?? []) fd.append("o:tag", tag);
    if (opts.variables) {
      for (const [k, v] of Object.entries(opts.variables)) {
        fd.append(`v:${k}`, v);
      }
    }
    if (opts.customHeaders) {
      for (const [k, v] of Object.entries(opts.customHeaders)) {
        fd.append(`h:${k}`, v);
      }
    }
    for (const att of opts.attachments ?? []) {
      const blob = typeof att.content === "string"
        ? new Blob([att.content], { type: att.contentType ?? "application/octet-stream" })
        : new Blob([att.content], { type: att.contentType ?? "application/octet-stream" });
      fd.append("attachment", blob, att.filename);
    }
    body = fd;
  } else {
    const params = new URLSearchParams();
    params.append("from", opts.from);
    params.append("to", toField);
    if (opts.cc) params.append("cc", opts.cc);
    if (opts.bcc) params.append("bcc", opts.bcc);
    params.append("subject", opts.subject);
    if (opts.html) params.append("html", opts.html);
    if (opts.text) params.append("text", opts.text);
    if (opts.replyTo) params.append("h:Reply-To", opts.replyTo);
    params.append("o:tracking", opts.trackOpens || opts.trackClicks ? "yes" : "no");
    if (typeof opts.trackOpens === "boolean") {
      params.append("o:tracking-opens", opts.trackOpens ? "yes" : "no");
    }
    if (typeof opts.trackClicks === "boolean") {
      params.append("o:tracking-clicks", opts.trackClicks ? "yes" : "no");
    }
    for (const tag of opts.tags ?? []) params.append("o:tag", tag);
    if (opts.variables) {
      for (const [k, v] of Object.entries(opts.variables)) {
        params.append(`v:${k}`, v);
      }
    }
    if (opts.customHeaders) {
      for (const [k, v] of Object.entries(opts.customHeaders)) {
        params.append(`h:${k}`, v);
      }
    }
    body = params;
    extraHeaders["Content-Type"] = "application/x-www-form-urlencoded";
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: basicAuth(opts.apiKey),
      ...extraHeaders,
    },
    body,
  });

  if (!response.ok) {
    let errorMessage = `Mailgun API error ${response.status}`;
    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorData.Error || errorMessage;
    } catch {
      try {
        errorMessage = await response.text();
      } catch {
        // ignore
      }
    }
    return { ok: false, status: response.status, error: errorMessage };
  }

  let messageId: string | undefined;
  try {
    const data = await response.json();
    if (typeof data?.id === "string") {
      // Mailgun returns "<id@domain>" — strip the angle brackets
      messageId = data.id.replace(/^<|>$/g, "");
    }
  } catch {
    // ignore
  }

  return { ok: true, status: response.status, messageId };
}

export interface ValidateResult {
  valid: boolean;
  error?: string;
  domains?: Array<{
    name: string;
    state: string;
    type?: string;
    created_at?: string;
  }>;
}

export async function validateMailgunCredentials(
  apiKey: string,
  region: MailgunRegion = "us",
): Promise<ValidateResult> {
  try {
    const response = await fetch(`${mailgunBaseUrl(region)}/v3/domains?limit=1`, {
      headers: { Authorization: basicAuth(apiKey) },
    });
    if (response.status === 401) {
      return { valid: false, error: "Invalid API key" };
    }
    if (!response.ok) {
      return { valid: false, error: `Mailgun API error: ${response.status}` };
    }
    const data = await response.json();
    return { valid: true, domains: data.items ?? [] };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to connect to Mailgun";
    return { valid: false, error: message };
  }
}

export async function listMailgunDomains(
  apiKey: string,
  region: MailgunRegion = "us",
): Promise<{ ok: boolean; domains: any[]; error?: string }> {
  try {
    const response = await fetch(`${mailgunBaseUrl(region)}/v3/domains?limit=1000`, {
      headers: { Authorization: basicAuth(apiKey) },
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return { ok: false, domains: [], error: text || `Mailgun API error: ${response.status}` };
    }
    const data = await response.json();
    return { ok: true, domains: data.items ?? [] };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to fetch Mailgun domains";
    return { ok: false, domains: [], error: message };
  }
}

export async function getMailgunDomain(
  apiKey: string,
  domain: string,
  region: MailgunRegion = "us",
): Promise<{ ok: boolean; domain?: any; sendingDnsRecords?: any[]; receivingDnsRecords?: any[]; error?: string }> {
  try {
    const response = await fetch(`${mailgunBaseUrl(region)}/v3/domains/${encodeURIComponent(domain)}`, {
      headers: { Authorization: basicAuth(apiKey) },
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return { ok: false, error: text || `Mailgun API error: ${response.status}` };
    }
    const data = await response.json();
    return {
      ok: true,
      domain: data.domain,
      sendingDnsRecords: data.sending_dns_records ?? [],
      receivingDnsRecords: data.receiving_dns_records ?? [],
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to fetch Mailgun domain";
    return { ok: false, error: message };
  }
}

export async function verifyMailgunDomain(
  apiKey: string,
  domain: string,
  region: MailgunRegion = "us",
): Promise<{ ok: boolean; data?: any; error?: string }> {
  try {
    const response = await fetch(`${mailgunBaseUrl(region)}/v3/domains/${encodeURIComponent(domain)}/verify`, {
      method: "PUT",
      headers: { Authorization: basicAuth(apiKey) },
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return { ok: false, error: text || `Mailgun API error: ${response.status}` };
    }
    const data = await response.json();
    return { ok: true, data };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to verify Mailgun domain";
    return { ok: false, error: message };
  }
}

export async function createMailgunDomain(
  apiKey: string,
  domain: string,
  region: MailgunRegion = "us",
): Promise<{ ok: boolean; data?: any; error?: string }> {
  try {
    const params = new URLSearchParams();
    params.append("name", domain);
    const response = await fetch(`${mailgunBaseUrl(region)}/v3/domains`, {
      method: "POST",
      headers: {
        Authorization: basicAuth(apiKey),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return { ok: false, error: text || `Mailgun API error: ${response.status}` };
    }
    const data = await response.json();
    return { ok: true, data };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create Mailgun domain";
    return { ok: false, error: message };
  }
}

export async function deleteMailgunDomain(
  apiKey: string,
  domain: string,
  region: MailgunRegion = "us",
): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch(`${mailgunBaseUrl(region)}/v3/domains/${encodeURIComponent(domain)}`, {
      method: "DELETE",
      headers: { Authorization: basicAuth(apiKey) },
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return { ok: false, error: text || `Mailgun API error: ${response.status}` };
    }
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to delete Mailgun domain";
    return { ok: false, error: message };
  }
}

export async function getMailgunStats(
  apiKey: string,
  domain: string,
  region: MailgunRegion = "us",
  events: string[] = ["accepted", "delivered", "failed", "opened", "clicked", "complained", "unsubscribed"],
  startDate?: Date,
  endDate?: Date,
): Promise<{ ok: boolean; data?: any; error?: string }> {
  try {
    const params = new URLSearchParams();
    for (const event of events) params.append("event", event);
    if (startDate) params.append("start", startDate.toUTCString());
    if (endDate) params.append("end", endDate.toUTCString());
    params.append("duration", "30d");
    params.append("resolution", "day");
    const response = await fetch(
      `${mailgunBaseUrl(region)}/v3/${encodeURIComponent(domain)}/stats/total?${params.toString()}`,
      { headers: { Authorization: basicAuth(apiKey) } },
    );
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return { ok: false, error: text || `Mailgun API error: ${response.status}` };
    }
    const data = await response.json();
    return { ok: true, data };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to fetch Mailgun stats";
    return { ok: false, error: message };
  }
}

export async function listMailgunSuppressions(
  apiKey: string,
  domain: string,
  kind: "unsubscribes" | "bounces" | "complaints" = "unsubscribes",
  region: MailgunRegion = "us",
): Promise<{ ok: boolean; items: any[]; error?: string }> {
  try {
    const response = await fetch(
      `${mailgunBaseUrl(region)}/v3/${encodeURIComponent(domain)}/${kind}?limit=1000`,
      { headers: { Authorization: basicAuth(apiKey) } },
    );
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return { ok: false, items: [], error: text || `Mailgun API error: ${response.status}` };
    }
    const data = await response.json();
    return { ok: true, items: data.items ?? [] };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to list Mailgun suppressions";
    return { ok: false, items: [], error: message };
  }
}

export async function addMailgunUnsubscribe(
  apiKey: string,
  domain: string,
  address: string,
  tag: string | null = null,
  region: MailgunRegion = "us",
): Promise<{ ok: boolean; error?: string }> {
  try {
    const params = new URLSearchParams();
    params.append("address", address);
    if (tag) params.append("tag", tag);
    const response = await fetch(
      `${mailgunBaseUrl(region)}/v3/${encodeURIComponent(domain)}/unsubscribes`,
      {
        method: "POST",
        headers: {
          Authorization: basicAuth(apiKey),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params,
      },
    );
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return { ok: false, error: text || `Mailgun API error: ${response.status}` };
    }
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to add Mailgun unsubscribe";
    return { ok: false, error: message };
  }
}

export async function removeMailgunUnsubscribe(
  apiKey: string,
  domain: string,
  address: string,
  region: MailgunRegion = "us",
): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch(
      `${mailgunBaseUrl(region)}/v3/${encodeURIComponent(domain)}/unsubscribes/${encodeURIComponent(address)}`,
      {
        method: "DELETE",
        headers: { Authorization: basicAuth(apiKey) },
      },
    );
    if (!response.ok && response.status !== 404) {
      const text = await response.text().catch(() => "");
      return { ok: false, error: text || `Mailgun API error: ${response.status}` };
    }
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to remove Mailgun unsubscribe";
    return { ok: false, error: message };
  }
}

/**
 * Verifies a Mailgun webhook signature. Mailgun signs each event payload by
 * computing HMAC-SHA256 of `timestamp + token` with the webhook signing key.
 *
 * The caller should ALSO check that the timestamp is recent (within ~15 min)
 * to mitigate replay attacks; this function only verifies authenticity.
 */
export async function verifyMailgunWebhookSignature(
  timestamp: string,
  token: string,
  signature: string,
  signingKey: string,
): Promise<boolean> {
  try {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(signingKey),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sigBytes = await crypto.subtle.sign("HMAC", key, enc.encode(timestamp + token));
    const computedHex = Array.from(new Uint8Array(sigBytes))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return constantTimeEqual(computedHex, signature);
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
  from: (table: string) => any;
}

/**
 * Resolves the Mailgun credentials for an organization.
 *
 * Resolution order:
 *  1. If MAILGUN_API_KEY + MAILGUN_DOMAIN env vars are set, use those (with
 *     MAILGUN_REGION/MAILGUN_WEBHOOK_SIGNING_KEY for region and signing key).
 *     Useful for service-role contexts (cron jobs, anonymous flows).
 *  2. Otherwise look up the org's `integration_connections` row where
 *     `integrations.key = 'mailgun'` and decrypt its credentials JSON.
 *
 * Returns null if no credentials are available.
 */
export async function getDecryptedMailgunCreds(
  orgId: string,
  supabase: SupabaseLike,
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<MailgunCredentials | null> {
  const envApiKey = Deno.env.get("MAILGUN_API_KEY");
  const envDomain = Deno.env.get("MAILGUN_DOMAIN");
  if (envApiKey && envDomain) {
    const envRegion = (Deno.env.get("MAILGUN_REGION") || "us").toLowerCase() as MailgunRegion;
    return {
      apiKey: envApiKey,
      domain: envDomain,
      signingKey: Deno.env.get("MAILGUN_WEBHOOK_SIGNING_KEY") ?? null,
      region: envRegion === "eu" ? "eu" : "us",
    };
  }

  const { data: conn } = await supabase
    .from("integration_connections")
    .select("credentials_encrypted, credentials_iv, status, integrations!inner(key)")
    .eq("org_id", orgId)
    .eq("integrations.key", "mailgun")
    .maybeSingle();

  if (
    !conn ||
    conn.status !== "connected" ||
    !conn.credentials_encrypted ||
    !conn.credentials_iv
  ) {
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

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(data.plaintext);
  } catch {
    return null;
  }

  const apiKey = typeof parsed.api_key === "string" ? parsed.api_key : null;
  const domain = typeof parsed.domain === "string" ? parsed.domain : null;
  if (!apiKey || !domain) return null;

  const signingKey = typeof parsed.webhook_signing_key === "string" ? parsed.webhook_signing_key : null;
  const region = (typeof parsed.region === "string" ? parsed.region.toLowerCase() : "us") as MailgunRegion;

  return {
    apiKey,
    domain,
    signingKey,
    region: region === "eu" ? "eu" : "us",
  };
}

/**
 * Encrypts a Mailgun credentials object (api_key/domain/webhook_signing_key/region)
 * via the email-crypto edge function. Returns the ciphertext + IV pair to store
 * in `integration_connections`.
 */
export async function encryptMailgunCreds(
  creds: { api_key: string; domain: string; webhook_signing_key?: string | null; region?: MailgunRegion },
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<{ encrypted: string; iv: string }> {
  const payload = JSON.stringify({
    api_key: creds.api_key,
    domain: creds.domain,
    webhook_signing_key: creds.webhook_signing_key ?? null,
    region: creds.region ?? "us",
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
    throw new Error("Failed to encrypt Mailgun credentials");
  }
  return await response.json();
}
