import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const rawBody = await req.text();
    console.log("[late-webhook] Received:", rawBody);

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid JSON" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const eventType =
      (payload.event as string) ||
      (payload.type as string) ||
      (payload.eventType as string) ||
      "";

    console.log(`[late-webhook] Event type: ${eventType}`);

    if (
      eventType === "post.published" ||
      eventType === "post.success" ||
      eventType === "post_published"
    ) {
      const postId =
        (payload.postId as string) ||
        (payload.post_id as string) ||
        ((payload.data as Record<string, unknown>)?.postId as string) ||
        ((payload.data as Record<string, unknown>)?.id as string);

      if (!postId) {
        return new Response(
          JSON.stringify({ success: true, action: "ignored", reason: "no postId" }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const { error: updateError } = await supabase
        .from("social_posts")
        .update({
          status: "posted",
          late_status: "published",
          posted_at: new Date().toISOString(),
          late_response: payload,
        })
        .eq("late_post_id", postId);

      if (updateError) {
        console.error("[late-webhook] Post update failed:", updateError);
      }

      await supabase.from("social_post_logs").insert({
        post_id: null,
        account_id: null,
        action: "success",
        details: {
          via: "late_webhook",
          event: eventType,
          late_post_id: postId,
          payload,
        },
      });

      return new Response(
        JSON.stringify({ success: true, action: "post_published" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (
      eventType === "post.failed" ||
      eventType === "post.error" ||
      eventType === "post_failed"
    ) {
      const postId =
        (payload.postId as string) ||
        (payload.post_id as string) ||
        ((payload.data as Record<string, unknown>)?.postId as string) ||
        ((payload.data as Record<string, unknown>)?.id as string);
      const errorMsg =
        (payload.error as string) ||
        ((payload.data as Record<string, unknown>)?.error as string) ||
        "Post publishing failed";

      if (postId) {
        const { error: updateError } = await supabase
          .from("social_posts")
          .update({
            status: "failed",
            late_status: "failed",
            last_error: typeof errorMsg === "string" ? errorMsg : JSON.stringify(errorMsg),
            late_response: payload,
          })
          .eq("late_post_id", postId);

        if (updateError) {
          console.error("[late-webhook] Post failure update failed:", updateError);
        }

        await supabase.from("social_post_logs").insert({
          post_id: null,
          account_id: null,
          action: "failure",
          details: {
            via: "late_webhook",
            event: eventType,
            late_post_id: postId,
            error: errorMsg,
            payload,
          },
        });
      }

      return new Response(
        JSON.stringify({ success: true, action: "post_failed" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (
      eventType === "account.disconnected" ||
      eventType === "account.expired" ||
      eventType === "account_disconnected"
    ) {
      const lateAccountId =
        (payload.accountId as string) ||
        (payload.account_id as string) ||
        ((payload.data as Record<string, unknown>)?.accountId as string);

      if (lateAccountId) {
        const { error: lateUpdateError } = await supabase
          .from("late_connections")
          .update({
            status: "expired",
            updated_at: new Date().toISOString(),
          })
          .eq("late_account_id", lateAccountId);

        if (lateUpdateError) {
          console.error("[late-webhook] Late connection update failed:", lateUpdateError);
        }

        const { data: lateConn } = await supabase
          .from("late_connections")
          .select("org_id, platform")
          .eq("late_account_id", lateAccountId)
          .maybeSingle();

        if (lateConn) {
          await supabase
            .from("social_accounts")
            .update({
              status: "disconnected",
              last_error: "Account disconnected via Late.dev",
              updated_at: new Date().toISOString(),
            })
            .eq("organization_id", lateConn.org_id)
            .eq("provider", lateConn.platform)
            .contains("token_meta", { late_account_id: lateAccountId });
        }
      }

      return new Response(
        JSON.stringify({ success: true, action: "account_disconnected" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`[late-webhook] Unhandled event type: ${eventType}`);
    return new Response(
      JSON.stringify({ success: true, action: "ignored", event: eventType }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[late-webhook] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
