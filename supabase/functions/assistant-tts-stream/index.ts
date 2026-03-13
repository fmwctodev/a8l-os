import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { sanitizeForSpeech } from "../_shared/sanitize-speech.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    const { data: { user }, error: authErr } = await anonClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { voice_id, speech_rate, text_chunks } = await req.json() as {
      voice_id: string;
      speech_rate?: number;
      text_chunks: string[];
    };

    if (!voice_id || !text_chunks || text_chunks.length === 0) {
      return new Response(JSON.stringify({ error: "voice_id and text_chunks are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const elevenLabsKey = Deno.env.get("ELEVENLABS_API_KEY");
    if (!elevenLabsKey) {
      return new Response(JSON.stringify({ error: "ElevenLabs not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const readable = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        try {
          for (let i = 0; i < text_chunks.length; i++) {
            const sanitized = sanitizeForSpeech(text_chunks[i]);
            if (!sanitized) continue;

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
              console.error("[assistant-tts-stream] ElevenLabs error:", await ttsRes.text());
              controller.enqueue(encoder.encode(
                `data: ${JSON.stringify({ type: "error", message: `TTS failed: ${ttsRes.status}` })}\n\n`
              ));
              continue;
            }

            const audioBuffer = await ttsRes.arrayBuffer();
            const base64 = btoa(String.fromCharCode(...new Uint8Array(audioBuffer)));

            controller.enqueue(encoder.encode(
              `data: ${JSON.stringify({ type: "audio", chunk: base64, index: i })}\n\n`
            ));
          }

          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({ type: "done" })}\n\n`
          ));
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        } catch (err) {
          console.error("[assistant-tts-stream] Error:", err);
          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({ type: "error", message: err instanceof Error ? err.message : "TTS streaming error" })}\n\n`
          ));
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        }

        controller.close();
      },
    });

    return new Response(readable, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    console.error("[assistant-tts-stream] Error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
