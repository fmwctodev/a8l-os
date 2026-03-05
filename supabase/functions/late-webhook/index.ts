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
    console.log("[late-webhook] Received event, body length:", rawBody.length);

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid JSON" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const eventType =
      (payload.event as string) ||
      (payload.type as string) ||
      (payload.eventType as string) ||
      "";

    const data = (payload.data as Record<string, unknown>) || {};

    console.log(`[late-webhook] Event type: ${eventType}`);

    if (
      eventType === "post.published" ||
      eventType === "post.success" ||
      eventType === "post_published"
    ) {
      const latePostId =
        (payload.postId as string) ||
        (payload.post_id as string) ||
        (data.postId as string) ||
        (data.id as string);

      if (!latePostId) {
        return new Response(
          JSON.stringify({ success: true, action: "ignored", reason: "no postId" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error: updateError } = await supabase
        .from("social_posts")
        .update({
          status: "posted",
          late_status: "published",
          posted_at: (data.publishedAt as string) || new Date().toISOString(),
          published_at: (data.publishedAt as string) || new Date().toISOString(),
          late_response: payload,
        })
        .eq("late_post_id", latePostId);

      if (updateError) {
        console.error("[late-webhook] Post update failed:", updateError);
      } else {
        console.log("[late-webhook] Marked post published:", latePostId);
      }

      return new Response(
        JSON.stringify({ success: true, action: "post_published" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (
      eventType === "post.failed" ||
      eventType === "post.error" ||
      eventType === "post_failed"
    ) {
      const latePostId =
        (payload.postId as string) ||
        (payload.post_id as string) ||
        (data.postId as string) ||
        (data.id as string);

      const errorMsg =
        (payload.error as string) ||
        (data.error as string) ||
        (data.message as string) ||
        "Post publishing failed";

      if (latePostId) {
        const { error: updateError } = await supabase
          .from("social_posts")
          .update({
            status: "failed",
            late_status: "failed",
            last_error: typeof errorMsg === "string" ? errorMsg : JSON.stringify(errorMsg),
            late_response: payload,
          })
          .eq("late_post_id", latePostId);

        if (updateError) {
          console.error("[late-webhook] Post failure update failed:", updateError);
        } else {
          console.log("[late-webhook] Marked post failed:", latePostId);
        }
      }

      return new Response(
        JSON.stringify({ success: true, action: "post_failed" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (
      eventType === "post.updated" ||
      eventType === "post_updated"
    ) {
      const latePostId =
        (payload.postId as string) ||
        (data.postId as string) ||
        (data.id as string);

      const newStatus = (data.status as string) || (payload.status as string);

      if (latePostId && newStatus) {
        const lateStatusMap: Record<string, { status: string; late_status: string }> = {
          published: { status: "posted", late_status: "published" },
          failed: { status: "failed", late_status: "failed" },
          scheduled: { status: "scheduled", late_status: "scheduled" },
          draft: { status: "draft", late_status: "draft" },
          publishing: { status: "posting", late_status: "publishing" },
        };

        const mapped = lateStatusMap[newStatus.toLowerCase()];
        if (mapped) {
          await supabase
            .from("social_posts")
            .update({ ...mapped, late_response: payload })
            .eq("late_post_id", latePostId);
        }
      }

      return new Response(
        JSON.stringify({ success: true, action: "post_updated" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
        (data.accountId as string) ||
        (data.id as string);

      if (lateAccountId) {
        await supabase
          .from("late_connections")
          .update({ status: "expired", updated_at: new Date().toISOString() })
          .eq("late_account_id", lateAccountId);

        const { data: lateConn } = await supabase
          .from("late_connections")
          .select("org_id, platform")
          .eq("late_account_id", lateAccountId)
          .maybeSingle();

        if (lateConn) {
          await supabase
            .from("social_accounts")
            .update({
              status: "error",
              last_error: "Account disconnected via Late.dev",
              updated_at: new Date().toISOString(),
            })
            .eq("organization_id", lateConn.org_id)
            .eq("provider", lateConn.platform)
            .contains("token_meta", { late_account_id: lateAccountId });
        }

        console.log("[late-webhook] Marked account disconnected:", lateAccountId);
      }

      return new Response(
        JSON.stringify({ success: true, action: "account_disconnected" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (
      eventType === "message.received" ||
      eventType === "message_received" ||
      eventType === "dm.received"
    ) {
      const lateAccountId =
        (payload.accountId as string) ||
        (data.accountId as string) ||
        (data.account_id as string) ||
        "";

      const orgId = (() => {
        const search = async () => {
          if (!lateAccountId) return null;
          const { data: conn } = await supabase
            .from("late_connections")
            .select("org_id")
            .eq("late_account_id", lateAccountId)
            .maybeSingle();
          return conn?.org_id || null;
        };
        return search();
      })();

      const resolvedOrgId = await orgId;

      if (resolvedOrgId) {
        const syncUrl = `${supabaseUrl}/functions/v1/late-inbox-messages-sync`;
        fetch(syncUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({ org_id: resolvedOrgId, account_id: lateAccountId }),
        }).catch((err) => console.error("[late-webhook] DM sync trigger error:", err));
        console.log("[late-webhook] Triggered DM sync for org:", resolvedOrgId);
      }

      return new Response(
        JSON.stringify({ success: true, action: "dm_sync_triggered" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (
      eventType === "comment.received" ||
      eventType === "comment_received" ||
      eventType === "post.comment"
    ) {
      const lateAccountId =
        (payload.accountId as string) ||
        (data.accountId as string) ||
        (data.account_id as string) ||
        "";

      const orgId = (() => {
        const search = async () => {
          if (!lateAccountId) return null;
          const { data: conn } = await supabase
            .from("late_connections")
            .select("org_id")
            .eq("late_account_id", lateAccountId)
            .maybeSingle();
          return conn?.org_id || null;
        };
        return search();
      })();

      const resolvedOrgId = await orgId;

      if (resolvedOrgId) {
        const syncUrl = `${supabaseUrl}/functions/v1/late-inbox-comments-sync`;
        fetch(syncUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({ org_id: resolvedOrgId, account_id: lateAccountId }),
        }).catch((err) => console.error("[late-webhook] Comments sync trigger error:", err));
        console.log("[late-webhook] Triggered comments sync for org:", resolvedOrgId);
      }

      return new Response(
        JSON.stringify({ success: true, action: "comments_sync_triggered" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[late-webhook] Unhandled event: ${eventType}`);
    return new Response(
      JSON.stringify({ success: true, action: "ignored", event: eventType }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[late-webhook] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
