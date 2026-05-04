/**
 * Shared Plivo helpers used across the plivo-* edge functions.
 *
 * Covers:
 *   - Auth header building (Basic auth: auth_id : auth_token)
 *   - Plivo REST request helper
 *   - V3 webhook signature verification (HMAC-SHA256 over URL+nonce+sorted-form-fields)
 *   - Plivo XML response builders (the equivalent of TwiML)
 */

const PLIVO_BASE = "https://api.plivo.com/v1";

export function buildPlivoAuthHeader(authId: string, authToken: string): string {
  return `Basic ${btoa(`${authId}:${authToken}`)}`;
}

export interface PlivoRestResponse<T = unknown> {
  status: number;
  data: T;
  ok: boolean;
}

export async function plivoRequest<T = unknown>(
  authId: string,
  authToken: string,
  path: string,
  init: { method?: string; body?: Record<string, unknown> } = {}
): Promise<PlivoRestResponse<T>> {
  const method = init.method || "GET";
  const url = `${PLIVO_BASE}/Account/${authId}${path}`;

  const headers: Record<string, string> = {
    Authorization: buildPlivoAuthHeader(authId, authToken),
    Accept: "application/json",
  };
  let body: string | undefined;
  if (init.body && method !== "GET") {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(init.body);
  }

  const res = await fetch(url, { method, headers, body });
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // 204 No Content etc.
  }

  return {
    status: res.status,
    ok: res.ok,
    data: data as T,
  };
}

/**
 * Plivo V3 signature verification.
 *
 * Plivo signs requests by HMAC-SHA256 over: url + nonce + sorted form params concatenated.
 * The signature is sent in `X-Plivo-Signature-V3`, the nonce in `X-Plivo-Signature-V3-Nonce`.
 *
 * https://www.plivo.com/docs/sms/concepts/signature-validation
 */
export async function verifyPlivoSignatureV3(
  signature: string,
  nonce: string,
  url: string,
  formParams: Record<string, string>,
  authToken: string
): Promise<boolean> {
  // Sort params alphabetically by key, then concat key+value
  const keys = Object.keys(formParams).sort();
  const concatenated = keys.map((k) => `${k}${formParams[k]}`).join("");
  const dataToSign = `${url}${nonce}${concatenated}`;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(authToken),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(dataToSign));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)));

  return sigB64 === signature;
}

/**
 * Parse a Plivo webhook body. Plivo POSTs application/x-www-form-urlencoded.
 */
export async function parsePlivoForm(req: Request): Promise<Record<string, string>> {
  const form = await req.formData();
  const out: Record<string, string> = {};
  for (const [k, v] of form.entries()) {
    out[k] = v.toString();
  }
  return out;
}

/**
 * Plivo XML helpers (their equivalent of TwiML).
 * Verbs we use: Speak, Dial+User (SIP), Hangup, Record, GetInput, Wait.
 */

export function plivoXmlResponse(body: string): Response {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<Response>${body}</Response>`, {
    status: 200,
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "no-store",
    },
  });
}

export function plivoEmpty(): Response {
  return plivoXmlResponse("");
}

export function plivoSpeak(text: string, lang = "en-US"): string {
  return `<Speak language="${lang}" voice="Polly.Joanna">${escapeXml(text)}</Speak>`;
}

export function plivoDialSip(sipUri: string, opts: { callerId?: string; timeout?: number } = {}): string {
  const callerIdAttr = opts.callerId ? ` callerId="${escapeXml(opts.callerId)}"` : "";
  const timeoutAttr = opts.timeout ? ` timeout="${opts.timeout}"` : "";
  return `<Dial${callerIdAttr}${timeoutAttr}><User>${escapeXml(sipUri)}</User></Dial>`;
}

export function plivoHangup(): string {
  return `<Hangup/>`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Build the SIP URI Plivo should dial when forwarding an inbound call to a
 * Vapi assistant. Vapi accepts inbound SIP at sip.vapi.ai with the assistant
 * ID as the user portion when configured as a BYO SIP destination.
 */
export function buildVapiSipUri(vapiAssistantId: string): string {
  return `sip:${vapiAssistantId}@sip.vapi.ai`;
}

/**
 * Look up the Plivo connection row for an org and decrypt the auth token.
 * Returns null if no connected row exists.
 */
export async function getPlivoCredentials(
  supabase: { from: (t: string) => any },
  orgId: string,
  decrypt: (s: string) => Promise<string>
): Promise<{ authId: string; authToken: string; connectionId: string } | null> {
  const { data } = await supabase
    .from("plivo_connection")
    .select("id, auth_id, auth_token_encrypted, status")
    .eq("org_id", orgId)
    .maybeSingle();
  if (!data || data.status !== "connected") return null;
  const authToken = await decrypt(data.auth_token_encrypted);
  return { authId: data.auth_id, authToken, connectionId: data.id };
}
