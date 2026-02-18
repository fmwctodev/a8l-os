import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const QBO_AUTH_ENDPOINT = "https://appcenter.intuit.com/connect/oauth2";

Deno.serve(async (req: Request) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 200, headers: corsHeaders });
    }

    const qboClientId = Deno.env.get("QBO_CLIENT_ID");

    if (!qboClientId) {
      return new Response(
        JSON.stringify({ error: "QBO_CLIENT_ID is not configured in Supabase secrets" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { orgId, redirectUri } = body;

    if (!orgId || !redirectUri) {
      return new Response(
        JSON.stringify({ error: "Missing required parameters: orgId, redirectUri" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const state = btoa(JSON.stringify({ orgId, timestamp: Date.now() }));
    const scope = "com.intuit.quickbooks.accounting";

    const params = new URLSearchParams({
      client_id: qboClientId,
      response_type: "code",
      scope,
      redirect_uri: redirectUri,
      state,
    });

    const authUrl = `${QBO_AUTH_ENDPOINT}?${params.toString()}`;

    return new Response(
      JSON.stringify({ authUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("QBO OAuth start error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
