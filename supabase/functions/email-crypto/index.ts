import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface EncryptRequest {
  action: "encrypt";
  plaintext: string;
}

interface DecryptRequest {
  action: "decrypt";
  encrypted: string;
  iv: string;
}

type RequestPayload = EncryptRequest | DecryptRequest;

interface EncryptResponse {
  encrypted: string;
  iv: string;
}

interface DecryptResponse {
  plaintext: string;
}

async function getEncryptionKey(): Promise<CryptoKey> {
  const keyHex = Deno.env.get("SENDGRID_ENCRYPTION_KEY");
  if (!keyHex) {
    throw new Error("SENDGRID_ENCRYPTION_KEY not configured");
  }

  const keyBytes = new Uint8Array(keyHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));

  return await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encrypt(plaintext: string): Promise<EncryptResponse> {
  const key = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    data
  );

  const encryptedArray = new Uint8Array(encrypted);
  const encryptedHex = Array.from(encryptedArray)
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
  const ivHex = Array.from(iv)
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");

  return { encrypted: encryptedHex, iv: ivHex };
}

async function decrypt(encryptedHex: string, ivHex: string): Promise<DecryptResponse> {
  const key = await getEncryptionKey();

  const encrypted = new Uint8Array(
    encryptedHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
  );
  const iv = new Uint8Array(
    ivHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
  );

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    encrypted
  );

  const decoder = new TextDecoder();
  return { plaintext: decoder.decode(decrypted) };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const authHeader = req.headers.get("Authorization");

    if (!authHeader || !authHeader.includes(serviceRoleKey || "")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized - service role required" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const payload: RequestPayload = await req.json();

    if (payload.action === "encrypt") {
      const result = await encrypt(payload.plaintext);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (payload.action === "decrypt") {
      const result = await decrypt(payload.encrypted, payload.iv);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
