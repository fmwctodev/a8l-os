import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RequestPayload {
  action: "test-connection";
  org_id: string;
  provider_id: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "") || "";
    const isServiceRole = token === serviceRoleKey;

    if (!isServiceRole) {
      if (!authHeader) {
        return new Response(
          JSON.stringify({ success: false, error: "Missing authorization" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { error: authError } = await anonClient.auth.getUser(token);
      if (authError) {
        return new Response(
          JSON.stringify({ success: false, error: "Invalid or expired token" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const payload: RequestPayload = await req.json();
    const { action, org_id, provider_id } = payload;

    if (!action || !org_id || !provider_id) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: provider, error: providerError } = await supabaseAdmin
      .from("llm_providers")
      .select("*")
      .eq("id", provider_id)
      .eq("org_id", org_id)
      .single();

    if (providerError || !provider) {
      return new Response(
        JSON.stringify({ success: false, error: "Provider not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "test-connection") {
      const result = await testProviderConnection(provider);
      return new Response(
        JSON.stringify(result),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "Unknown action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in ai-settings-providers:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

interface Provider {
  provider: string;
  api_key_encrypted: string;
  base_url: string | null;
}

async function testProviderConnection(provider: Provider): Promise<{ success: boolean; error?: string }> {
  const { provider: providerType, api_key_encrypted: apiKey, base_url: baseUrl } = provider;

  try {
    switch (providerType) {
      case "openai":
        return await testOpenAI(apiKey, baseUrl);
      case "google":
        return await testGoogle(apiKey);
      default:
        return { success: false, error: `Unknown provider type: ${providerType}` };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Connection test failed",
    };
  }
}

async function testOpenAI(apiKey: string, baseUrl: string | null): Promise<{ success: boolean; error?: string }> {
  const url = baseUrl ? `${baseUrl}/v1/models` : "https://api.openai.com/v1/models";

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    return {
      success: false,
      error: errorData.error?.message || `API returned status ${response.status}`,
    };
  }

  return { success: true };
}

async function testGoogle(apiKey: string): Promise<{ success: boolean; error?: string }> {
  const url = `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    return {
      success: false,
      error: errorData.error?.message || `API returned status ${response.status}`,
    };
  }

  return { success: true };
}
