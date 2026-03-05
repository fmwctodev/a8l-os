import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lateApiKey = Deno.env.get("LATE_API_KEY");

    if (!lateApiKey) {
      return new Response(
        JSON.stringify({ error: "LATE_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const isServiceRole = token === serviceRoleKey;

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    let orgId: string;
    let userId: string;

    if (isServiceRole) {
      const body = await req.json();
      orgId = body.org_id;
      userId = body.user_id;
      if (!orgId || !userId) {
        return new Response(
          JSON.stringify({ error: "org_id and user_id required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      const anonClient = createClient(
        supabaseUrl,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { auth: { autoRefreshToken: false, persistSession: false } }
      );
      const { data: authData, error: authError } = await anonClient.auth.getUser(token);
      if (authError || !authData.user) {
        return new Response(
          JSON.stringify({ error: "Invalid or expired token" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      userId = authData.user.id;
      const { data: userData } = await supabase
        .from("users")
        .select("organization_id")
        .eq("id", userId)
        .maybeSingle();
      orgId = userData?.organization_id || "";
    }

    const body = isServiceRole ? {} : await req.json();
    const { account_id, recipient_id, message_text } = body as {
      account_id?: string;
      recipient_id?: string;
      message_text?: string;
    };

    if (!account_id || !recipient_id || !message_text) {
      return new Response(
        JSON.stringify({ error: "account_id, recipient_id, and message_text are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LATE_API_BASE = "https://getlate.dev/api";
    const res = await fetch(`${LATE_API_BASE}/v1/messages/send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lateApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        accountId: account_id,
        recipientId: recipient_id,
        text: message_text,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return new Response(
        JSON.stringify({ error: `Failed to send DM: ${errText}` }),
        { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await res.json();

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[social-dm-reply] Error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
