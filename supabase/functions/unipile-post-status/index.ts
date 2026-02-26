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
    const unipileDsn = Deno.env.get("UNIPILE_DSN");
    const unipileApiKey = Deno.env.get("UNIPILE_API_KEY");

    if (!unipileDsn || !unipileApiKey) {
      return new Response(
        JSON.stringify({ error: "Unipile not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    let postId: string | null = null;
    if (req.method === "POST") {
      try {
        const body = await req.json();
        postId = body.post_id || null;
      } catch {
        // no body
      }
    }

    let query = supabase
      .from("social_posts")
      .select("id, provider_post_ids, unipile_response, status, targets")
      .in("status", ["posting", "posted"])
      .not("provider_post_ids", "is", null);

    if (postId) {
      query = supabase
        .from("social_posts")
        .select("id, provider_post_ids, unipile_response, status, targets")
        .eq("id", postId);
    }

    const { data: posts, error: fetchError } = await query;

    if (fetchError) {
      console.error("[unipile-post-status] Fetch error:", fetchError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch posts" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!posts || posts.length === 0) {
      return new Response(
        JSON.stringify({ message: "No posts to check", checked: 0 }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const accountIds = new Set<string>();
    for (const post of posts) {
      if (post.targets) {
        for (const t of post.targets as string[]) {
          accountIds.add(t);
        }
      }
    }

    const { data: accounts } = await supabase
      .from("social_accounts")
      .select("id, unipile_account_id, provider, status")
      .in("id", Array.from(accountIds));

    const accountMap = new Map<string, { unipile_account_id: string; provider: string; status: string }>();
    for (const acc of accounts || []) {
      if (acc.unipile_account_id) {
        accountMap.set(acc.id, {
          unipile_account_id: acc.unipile_account_id,
          provider: acc.provider,
          status: acc.status,
        });
      }
    }

    let checkedCount = 0;
    let updatedCount = 0;

    for (const post of posts) {
      const providerPostIds = post.provider_post_ids as Record<string, string> || {};
      let hasDisconnected = false;

      for (const [accountId, externalPostId] of Object.entries(providerPostIds)) {
        const account = accountMap.get(accountId);
        if (!account || !account.unipile_account_id) continue;

        if (account.status !== "connected") {
          hasDisconnected = true;
          continue;
        }

        try {
          const statusResponse = await fetch(
            `${unipileDsn}/api/v1/posts/${externalPostId}?account_id=${account.unipile_account_id}`,
            {
              headers: {
                "X-API-KEY": unipileApiKey,
                Accept: "application/json",
              },
            }
          );

          if (statusResponse.ok) {
            const statusData = await statusResponse.json();
            const existingResponse =
              (post.unipile_response as Record<string, unknown>) || {};
            existingResponse[accountId] = {
              ...((existingResponse[accountId] as Record<string, unknown>) || {}),
              last_status_check: new Date().toISOString(),
              status_data: statusData,
            };

            await supabase
              .from("social_posts")
              .update({ unipile_response: existingResponse })
              .eq("id", post.id);

            updatedCount++;
          }
        } catch (e) {
          console.warn(
            `[unipile-post-status] Failed to check post ${externalPostId}:`,
            e
          );
        }

        checkedCount++;
      }

      if (hasDisconnected && post.status === "posted") {
        await supabase.from("social_post_logs").insert({
          post_id: post.id,
          account_id: null,
          action: "failure",
          details: { error: "One or more target accounts disconnected" },
        });
      }
    }

    return new Response(
      JSON.stringify({
        message: "Status check complete",
        checked: checkedCount,
        updated: updatedCount,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[unipile-post-status] Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
