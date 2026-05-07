import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const QBO_TOKEN_ENDPOINT = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
const QBO_REVOKE_ENDPOINT = "https://developer.api.intuit.com/v2/oauth2/tokens/revoke";
const QBO_COMPANY_ENDPOINT = "https://quickbooks.api.intuit.com/v3/company";

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

interface CompanyInfo {
  CompanyName: string;
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 200, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const qboClientId = Deno.env.get("QBO_CLIENT_ID");
    const qboClientSecret = Deno.env.get("QBO_CLIENT_SECRET");

    if (!qboClientId || !qboClientSecret) {
      return new Response(
        JSON.stringify({ error: "QBO credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: userData } = await supabase
      .from("users")
      .select("id, organization_id")
      .eq("id", user.id)
      .single();

    if (!userData) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { action, code, realmId, redirectUri } = body;

    if (action === "disconnect") {
      const { data: connection } = await supabase
        .from("payment_provider_connections")
        .select("refresh_token_encrypted")
        .eq("org_id", userData.organization_id)
        .eq("provider", "quickbooks_online")
        .single();

      if (connection) {
        const basicAuth = btoa(`${qboClientId}:${qboClientSecret}`);
        await fetch(QBO_REVOKE_ENDPOINT, {
          method: "POST",
          headers: {
            "Authorization": `Basic ${basicAuth}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: `token=${connection.refresh_token_encrypted}`,
        });

        await supabase
          .from("payment_provider_connections")
          .delete()
          .eq("org_id", userData.organization_id)
          .eq("provider", "quickbooks_online");
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "refresh") {
      const { data: connection } = await supabase
        .from("payment_provider_connections")
        .select("*")
        .eq("org_id", userData.organization_id)
        .eq("provider", "quickbooks_online")
        .single();

      if (!connection) {
        return new Response(
          JSON.stringify({ error: "No QBO connection found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const basicAuth = btoa(`${qboClientId}:${qboClientSecret}`);
      const tokenResponse = await fetch(QBO_TOKEN_ENDPOINT, {
        method: "POST",
        headers: {
          "Authorization": `Basic ${basicAuth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: `grant_type=refresh_token&refresh_token=${connection.refresh_token_encrypted}`,
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        return new Response(
          JSON.stringify({ error: "Failed to refresh token", details: errorText }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const tokens: TokenResponse = await tokenResponse.json();
      const tokenExpiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

      await supabase
        .from("payment_provider_connections")
        .update({
          access_token_encrypted: tokens.access_token,
          refresh_token_encrypted: tokens.refresh_token,
          token_expiry: tokenExpiry,
          updated_at: new Date().toISOString(),
        })
        .eq("id", connection.id);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!code || !realmId || !redirectUri) {
      return new Response(
        JSON.stringify({ error: "Missing required parameters: code, realmId, redirectUri" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const basicAuth = btoa(`${qboClientId}:${qboClientSecret}`);
    const tokenResponse = await fetch(QBO_TOKEN_ENDPOINT, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${basicAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `grant_type=authorization_code&code=${code}&redirect_uri=${encodeURIComponent(redirectUri)}`,
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      return new Response(
        JSON.stringify({ error: "Failed to exchange authorization code", details: errorText }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tokens: TokenResponse = await tokenResponse.json();

    const companyResponse = await fetch(
      `${QBO_COMPANY_ENDPOINT}/${realmId}/companyinfo/${realmId}?minorversion=65`,
      {
        headers: {
          "Authorization": `Bearer ${tokens.access_token}`,
          "Accept": "application/json",
        },
      }
    );

    let companyName = "QuickBooks Company";
    if (companyResponse.ok) {
      const companyData = await companyResponse.json();
      companyName = companyData.CompanyInfo?.CompanyName || companyName;
    }

    const tokenExpiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    const { data: existingConnection } = await supabase
      .from("payment_provider_connections")
      .select("id")
      .eq("org_id", userData.organization_id)
      .eq("provider", "quickbooks_online")
      .maybeSingle();

    let connection;
    if (existingConnection) {
      const { data, error } = await supabase
        .from("payment_provider_connections")
        .update({
          provider: "quickbooks_online",
          realm_id: realmId,
          company_name: companyName,
          access_token_encrypted: tokens.access_token,
          refresh_token_encrypted: tokens.refresh_token,
          token_expiry: tokenExpiry,
          connected_by: userData.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingConnection.id)
        .select()
        .single();

      if (error) throw error;
      connection = data;
    } else {
      const { data, error } = await supabase
        .from("payment_provider_connections")
        .insert({
          org_id: userData.organization_id,
          provider: "quickbooks_online",
          realm_id: realmId,
          company_name: companyName,
          access_token_encrypted: tokens.access_token,
          refresh_token_encrypted: tokens.refresh_token,
          token_expiry: tokenExpiry,
          connected_by: userData.id,
        })
        .select()
        .single();

      if (error) throw error;
      connection = data;
    }

    return new Response(
      JSON.stringify({ success: true, connection }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("QBO OAuth error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});