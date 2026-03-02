import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

function sanitizeForSpeech(raw: string): string {
  let t = raw;
  t = t.replace(/```[\s\S]*?```/g, "");
  t = t.replace(/`([^`]+)`/g, "$1");
  t = t.replace(/^#{1,6}\s+/gm, "");
  t = t.replace(/(\*\*|__)(.*?)\1/g, "$2");
  t = t.replace(/(\*|_)(.*?)\1/g, "$2");
  t = t.replace(/~~(.*?)~~/g, "$1");
  t = t.replace(/^\s*[-*+]\s+/gm, "");
  t = t.replace(/^\s*\d+\.\s+/gm, "");
  t = t.replace(/^\s*>\s?/gm, "");
  t = t.replace(/^-{3,}$/gm, "");
  t = t.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  t = t.replace(/https?:\/\/\S+/g, "");
  t = t.replace(/\{[\s\S]*?\}/g, "");
  t = t.replace(/\[[\s\S]*?\]/g, "");
  t = t.replace(/\n{2,}/g, ". ");
  t = t.replace(/\s{2,}/g, " ");
  return t.trim();
}

async function authenticateUser(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;

  const anonClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const {
    data: { user },
    error,
  } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
  if (error || !user) return null;
  return user;
}

async function handleCancel(req: Request): Promise<Response> {
  const user = await authenticateUser(req);
  if (!user) return jsonErr("Unauthorized", 401);

  const { message_id } = await req.json();

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: userData } = await supabase
    .from("users")
    .select("organization_id")
    .eq("id", user.id)
    .maybeSingle();

  if (userData?.organization_id) {
    await supabase.from("clara_voice_events").insert({
      org_id: userData.organization_id,
      user_id: user.id,
      event_type: "tts_interrupted",
      message_id: message_id || null,
      metadata: { source: "barge_in" },
    });
  }

  return jsonOk({ canceled: true });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    if (url.pathname.endsWith("/cancel")) {
      return await handleCancel(req);
    }

    const user = await authenticateUser(req);
    if (!user) return jsonErr("Unauthorized", 401);

    const { text, voice_id, speech_rate } = await req.json();

    if (!text) return jsonErr("text is required", 400);
    if (!voice_id) return jsonErr("voice_id is required", 400);

    const elevenLabsKey = Deno.env.get("ELEVENLABS_API_KEY");
    if (!elevenLabsKey) return jsonErr("ElevenLabs not configured", 500);

    const sanitized = sanitizeForSpeech(text);
    if (!sanitized) return jsonErr("No speakable content after sanitization", 400);

    const ttsRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voice_id}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": elevenLabsKey,
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text: sanitized.slice(0, 5000),
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            speed: speech_rate || 1.0,
          },
        }),
      }
    );

    if (!ttsRes.ok) {
      const errText = await ttsRes.text();
      console.error("[assistant-tts] ElevenLabs error:", errText);
      return jsonErr(`TTS failed: ${ttsRes.status}`, 500);
    }

    const audioBuffer = await ttsRes.arrayBuffer();

    return new Response(audioBuffer, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "audio/mpeg",
        "Content-Length": String(audioBuffer.byteLength),
      },
    });
  } catch (err) {
    console.error("[assistant-tts] Error:", err);
    return jsonErr(
      err instanceof Error ? err.message : "Internal error",
      500
    );
  }
});

function jsonErr(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function jsonOk(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
