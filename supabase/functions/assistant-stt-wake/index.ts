import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MAX_FILE_SIZE = 512_000;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonRes({ error: "Unauthorized" }, 401);

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    const {
      data: { user },
      error: authErr,
    } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authErr || !user) return jsonRes({ error: "Unauthorized" }, 401);

    const formData = await req.formData();
    const audioFile = formData.get("audio") as File | null;

    if (!audioFile) return jsonRes({ error: "No audio file provided" }, 400);
    if (audioFile.size > MAX_FILE_SIZE) {
      return jsonRes({ error: "Audio segment too large (max 500KB)" }, 400);
    }

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      return jsonRes({ error: "OpenAI not configured" }, 500);
    }

    const whisperForm = new FormData();
    whisperForm.append("file", audioFile, "wake-segment.webm");
    whisperForm.append("model", "gpt-4o-mini-transcribe");
    whisperForm.append("response_format", "json");

    const whisperRes = await fetch(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${openaiKey}` },
        body: whisperForm,
      }
    );

    if (!whisperRes.ok) {
      const errText = await whisperRes.text();
      console.error("[assistant-stt-wake] Transcription error:", errText);
      return jsonRes({ text: "" });
    }

    const data = await whisperRes.json();
    return jsonRes({ text: data.text || "" });
  } catch (err) {
    console.error("[assistant-stt-wake] Error:", err);
    return jsonRes(
      { error: err instanceof Error ? err.message : "Internal error" },
      500
    );
  }
});

function jsonRes(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
