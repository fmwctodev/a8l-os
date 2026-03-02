import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const STALE_DAYS = 90;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - STALE_DAYS);
    const cutoff = cutoffDate.toISOString();

    const { data: staleMemories, error: fetchError } = await supabase
      .from("clara_memories")
      .select("id, memory_type, importance_score")
      .or(
        `and(last_accessed_at.lt.${cutoff}),and(last_accessed_at.is.null,created_at.lt.${cutoff})`
      )
      .gt("importance_score", 0);

    if (fetchError) {
      console.error("[clara-memory-decay] Fetch error:", fetchError.message);
      return new Response(
        JSON.stringify({ error: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!staleMemories || staleMemories.length === 0) {
      return new Response(
        JSON.stringify({ decayed: 0, deleted: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const toDecay: string[] = [];
    const toDelete: string[] = [];

    for (const mem of staleMemories) {
      const newScore = mem.importance_score - 1;
      if (newScore <= 0 && mem.memory_type !== "strategic_context") {
        toDelete.push(mem.id);
      } else {
        toDecay.push(mem.id);
      }
    }

    let decayedCount = 0;
    let deletedCount = 0;

    if (toDecay.length > 0) {
      for (const id of toDecay) {
        const { error } = await supabase.rpc("decrement_clara_memory_score", {
          p_memory_id: id,
        });
        if (!error) decayedCount++;
      }
    }

    if (toDelete.length > 0) {
      const { error } = await supabase
        .from("clara_memories")
        .delete()
        .in("id", toDelete);
      if (!error) deletedCount = toDelete.length;
    }

    console.log(
      `[clara-memory-decay] Decayed: ${decayedCount}, Deleted: ${deletedCount}`
    );

    return new Response(
      JSON.stringify({ decayed: decayedCount, deleted: deletedCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[clara-memory-decay] Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
