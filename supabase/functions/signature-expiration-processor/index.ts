import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date().toISOString();

    const { data: expiredRequests, error: fetchError } = await supabase
      .from("proposal_signature_requests")
      .select("id, org_id, proposal_id, signer_name, signer_email, expires_at")
      .in("status", ["pending", "viewed"])
      .lt("expires_at", now)
      .limit(100);

    if (fetchError) {
      throw new Error(`Failed to fetch expired requests: ${fetchError.message}`);
    }

    if (!expiredRequests || expiredRequests.length === 0) {
      return new Response(
        JSON.stringify({ message: "No expired requests", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let processedCount = 0;

    for (const req of expiredRequests) {
      await supabase
        .from("proposal_signature_requests")
        .update({ status: "expired" })
        .eq("id", req.id);

      await supabase
        .from("proposals")
        .update({ signature_status: "expired" })
        .eq("id", req.proposal_id)
        .in("signature_status", ["pending_signature", "viewed"]);

      await supabase.from("proposal_audit_events").insert({
        org_id: req.org_id,
        proposal_id: req.proposal_id,
        event_type: "expired",
        actor_type: "system",
        metadata: {
          request_id: req.id,
          expired_at: now,
          signer_name: req.signer_name,
          signer_email: req.signer_email,
        },
      });

      processedCount++;
    }

    return new Response(
      JSON.stringify({
        processed: processedCount,
        message: `Expired ${processedCount} signature requests`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Signature expiration processor error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
