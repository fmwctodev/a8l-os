const GMAIL_ENCRYPTION_KEY_ENV = "GMAIL_ENCRYPTION_KEY";

async function getKey(): Promise<CryptoKey> {
  const keyHex = Deno.env.get(GMAIL_ENCRYPTION_KEY_ENV);
  if (!keyHex) {
    throw new Error(`${GMAIL_ENCRYPTION_KEY_ENV} not configured`);
  }

  const keyBytes = new Uint8Array(
    keyHex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
  );

  return await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptToken(plaintext: string): Promise<string> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded
  );

  const ivHex = Array.from(iv)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const ctHex = Array.from(new Uint8Array(ciphertext))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return `${ivHex}:${ctHex}`;
}

export async function decryptToken(encrypted: string): Promise<string> {
  const key = await getKey();
  const [ivHex, ctHex] = encrypted.split(":");
  if (!ivHex || !ctHex) {
    throw new Error("Invalid encrypted token format");
  }

  const iv = new Uint8Array(
    ivHex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
  );
  const ciphertext = new Uint8Array(
    ctHex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
  );

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );

  return new TextDecoder().decode(decrypted);
}

export function isEncryptedToken(value: string): boolean {
  return value.includes(":");
}

async function getHmacKey(): Promise<CryptoKey> {
  const keyHex = Deno.env.get(GMAIL_ENCRYPTION_KEY_ENV);
  if (!keyHex) {
    throw new Error(`${GMAIL_ENCRYPTION_KEY_ENV} not configured`);
  }
  const keyBytes = new Uint8Array(
    keyHex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
  );
  return await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function signState(payload: string): Promise<string> {
  const key = await getHmacKey();
  const encoded = new TextEncoder().encode(payload);
  const sig = await crypto.subtle.sign("HMAC", key, encoded);
  const sigHex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${btoa(payload)}.${sigHex}`;
}

export async function verifyState(signed: string): Promise<string | null> {
  const dotIdx = signed.lastIndexOf(".");
  if (dotIdx === -1) return null;
  const b64Payload = signed.substring(0, dotIdx);
  const sigHex = signed.substring(dotIdx + 1);
  let payload: string;
  try {
    payload = atob(b64Payload);
  } catch {
    return null;
  }
  const key = await getHmacKey();
  const encoded = new TextEncoder().encode(payload);
  const sigBytes = new Uint8Array(
    sigHex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
  );
  const valid = await crypto.subtle.verify("HMAC", key, sigBytes, encoded);
  return valid ? payload : null;
}
