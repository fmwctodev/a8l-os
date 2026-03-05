import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const LATE_API_BASE = "https://getlate.dev/api";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lateApiKey = Deno.env.get("LATE_API_KEY");

    if (!lateApiKey) {
      return new Response(
        JSON.stringify({ error: "LATE_API_KEY not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (req.method !== "POST" && req.method !== "DELETE") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        {
          status: 405,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const anonClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    const { data: authData, error: authError } =
      await anonClient.auth.getUser(token);
    if (authError || !authData.user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const userId = authData.user.id;
    const { data: userData } = await supabase
      .from("users")
      .select("organization_id")
      .eq("id", userId)
      .maybeSingle();

    if (!userData?.organization_id) {
      return new Response(
        JSON.stringify({ error: "User organization not found" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const orgId = userData.organization_id;
    const body = await req.json();
    const { review_id } = body;

    if (!review_id) {
      return new Response(
        JSON.stringify({ error: "review_id is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: review, error: reviewError } = await supabase
      .from("reputation_reviews")
      .select("*")
      .eq("id", review_id)
      .eq("org_id", orgId)
      .maybeSingle();

    if (reviewError || !review) {
      return new Response(
        JSON.stringify({ error: "Review not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (review.platform !== "googlebusiness") {
      return new Response(
        JSON.stringify({
          error:
            "Deleting replies is only supported for Google Business reviews.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!review.has_reply) {
      return new Response(
        JSON.stringify({ error: "This review does not have a reply to delete" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const lateReviewId = review.late_review_id;
    const accountId = review.account_id;

    console.log(
      `[reputation-delete-reply] Deleting reply on review ${lateReviewId}`
    );

    const lateResponse = await fetch(
      `${LATE_API_BASE}/v1/inbox/reviews/${encodeURIComponent(lateReviewId)}/reply`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${lateApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ accountId }),
      }
    );

    if (!lateResponse.ok) {
      const errText = await lateResponse.text();
      console.error(
        `[reputation-delete-reply] Late.dev error: ${lateResponse.status}`,
        errText
      );

      if (lateResponse.status === 401 || lateResponse.status === 403) {
        return new Response(
          JSON.stringify({
            error: "Integration disconnected. Please reconnect Late.dev.",
          }),
          {
            status: 502,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({
          error: `Failed to delete reply: ${errText.slice(0, 200)}`,
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    await supabase
      .from("reputation_reviews")
      .update({
        has_reply: false,
        reply_text: null,
        reply_id: null,
        reply_created_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", review_id);

    await supabase
      .from("reputation_review_replies")
      .update({
        status: "deleted",
        last_updated_at: new Date().toISOString(),
      })
      .eq("review_id", review_id)
      .eq("status", "published");

    await supabase.from("reputation_actions_audit").insert({
      org_id: orgId,
      user_id: userId,
      action: "delete_reply",
      entity_type: "reply",
      entity_id: review_id,
      metadata: {
        review_id,
        late_review_id: lateReviewId,
        account_id: accountId,
        platform: review.platform,
        deleted_reply_text: review.reply_text,
      },
    });

    return new Response(
      JSON.stringify({ success: true, message: "Reply deleted" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[reputation-delete-reply] Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
