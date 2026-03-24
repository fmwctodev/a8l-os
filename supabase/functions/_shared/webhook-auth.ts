/**
 * Webhook authentication utilities.
 * Verifies that incoming webhook requests are from trusted sources
 * using a shared secret passed in headers.
 */

/**
 * Constant-time string comparison to prevent timing attacks.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const encoder = new TextEncoder();
  const bufA = encoder.encode(a);
  const bufB = encoder.encode(b);
  let result = 0;
  for (let i = 0; i < bufA.length; i++) {
    result |= bufA[i] ^ bufB[i];
  }
  return result === 0;
}

/**
 * Verify a webhook request by checking the X-Webhook-Secret header
 * against the configured WEBHOOK_SECRET environment variable.
 * Returns true if the secret matches or if no secret is configured (backward compat).
 */
export function verifyWebhookSecret(req: Request): boolean {
  const configuredSecret = Deno.env.get("WEBHOOK_SECRET");

  // If no secret is configured, allow requests (backward compatibility)
  // TODO: Make this required once all webhook senders are updated
  if (!configuredSecret) {
    console.warn("[Webhook Auth] No WEBHOOK_SECRET configured - skipping verification");
    return true;
  }

  const providedSecret = req.headers.get("X-Webhook-Secret") || "";

  if (!providedSecret) {
    console.error("[Webhook Auth] No X-Webhook-Secret header provided");
    return false;
  }

  const isValid = timingSafeEqual(configuredSecret, providedSecret);
  if (!isValid) {
    console.error("[Webhook Auth] Invalid webhook secret");
  }
  return isValid;
}
