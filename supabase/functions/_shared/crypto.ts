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
