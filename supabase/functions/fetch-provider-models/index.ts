import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RequestPayload {
  action: "fetch-models" | "sync-catalog";
  org_id: string;
  provider: "openai" | "google";
}

interface ProviderModel {
  model_key: string;
  display_name: string;
  context_window: number | null;
  capabilities: Record<string, boolean>;
  is_deprecated: boolean;
}

interface CatalogModel {
  id?: string;
  org_id: string;
  provider: string;
  model_key: string;
  display_name: string;
  context_window: number | null;
  capabilities: Record<string, boolean>;
  is_deprecated: boolean;
  is_enabled: boolean;
  is_default: boolean;
  last_synced_at: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .select(`
        id,
        organization_id,
        role:roles!role_id(name)
      `)
      .eq("id", user.id)
      .maybeSingle();

    if (userError || !userData) {
      return new Response(
        JSON.stringify({ success: false, error: "User not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isSuperAdmin = userData.role?.name === "SuperAdmin";
    if (!isSuperAdmin) {
      return new Response(
        JSON.stringify({ success: false, error: "Super admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload: RequestPayload = await req.json();
    const { action, org_id, provider } = payload;

    if (org_id !== userData.organization_id) {
      return new Response(
        JSON.stringify({ success: false, error: "Organization mismatch" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: providerConfig, error: providerError } = await supabaseAdmin
      .from("llm_providers")
      .select("*")
      .eq("org_id", org_id)
      .eq("provider", provider)
      .maybeSingle();

    if (providerError) {
      return new Response(
        JSON.stringify({ success: false, error: "Failed to fetch provider config" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!providerConfig || !providerConfig.api_key_encrypted) {
      return new Response(
        JSON.stringify({ success: false, error: "Provider not configured or API key missing" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "fetch-models") {
      const models = await fetchModelsFromProvider(
        provider,
        providerConfig.api_key_encrypted,
        providerConfig.base_url
      );

      const { data: existingModels } = await supabaseAdmin
        .from("llm_model_catalog")
        .select("model_key, is_enabled, is_default")
        .eq("org_id", org_id)
        .eq("provider", provider);

      const existingMap = new Map(
        (existingModels || []).map((m) => [m.model_key, m])
      );

      const enrichedModels = models.map((model) => {
        const existing = existingMap.get(model.model_key);
        return {
          ...model,
          is_enabled: existing?.is_enabled ?? false,
          is_default: existing?.is_default ?? false,
        };
      });

      return new Response(
        JSON.stringify({ success: true, data: { models: enrichedModels } }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "sync-catalog") {
      const models = await fetchModelsFromProvider(
        provider,
        providerConfig.api_key_encrypted,
        providerConfig.base_url
      );

      const now = new Date().toISOString();

      const { data: existingModels } = await supabaseAdmin
        .from("llm_model_catalog")
        .select("id, model_key, is_enabled, is_default")
        .eq("org_id", org_id)
        .eq("provider", provider);

      const existingMap = new Map(
        (existingModels || []).map((m) => [m.model_key, m])
      );

      const upsertData: CatalogModel[] = models.map((model) => {
        const existing = existingMap.get(model.model_key);
        return {
          ...(existing?.id ? { id: existing.id } : {}),
          org_id,
          provider,
          model_key: model.model_key,
          display_name: model.display_name,
          context_window: model.context_window,
          capabilities: model.capabilities,
          is_deprecated: model.is_deprecated,
          is_enabled: existing?.is_enabled ?? false,
          is_default: existing?.is_default ?? false,
          last_synced_at: now,
        };
      });

      const { error: upsertError } = await supabaseAdmin
        .from("llm_model_catalog")
        .upsert(upsertData, { onConflict: "org_id,provider,model_key" });

      if (upsertError) {
        console.error("Upsert error:", upsertError);
        return new Response(
          JSON.stringify({ success: false, error: "Failed to sync catalog" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, data: { synced_count: models.length } }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "Unknown action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in fetch-provider-models:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function fetchModelsFromProvider(
  provider: string,
  apiKey: string,
  baseUrl: string | null
): Promise<ProviderModel[]> {
  switch (provider) {
    case "openai":
      return await fetchOpenAIModels(apiKey, baseUrl);
    case "google":
      return await fetchGoogleModels(apiKey);
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

async function fetchOpenAIModels(
  apiKey: string,
  baseUrl: string | null
): Promise<ProviderModel[]> {
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
    throw new Error(errorData.error?.message || `OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  const models: ProviderModel[] = [];

  const chatModels = (data.data || []).filter((m: { id: string }) => {
    const id = m.id.toLowerCase();
    return (
      id.startsWith("gpt-") ||
      id.startsWith("o1") ||
      id.startsWith("o3") ||
      id.startsWith("o4") ||
      id.includes("chatgpt")
    ) && !id.includes("instruct") && !id.includes("audio") && !id.includes("realtime");
  });

  for (const model of chatModels) {
    const contextWindow = getOpenAIContextWindow(model.id);
    const capabilities = getOpenAICapabilities(model.id);

    models.push({
      model_key: model.id,
      display_name: formatOpenAIModelName(model.id),
      context_window: contextWindow,
      capabilities,
      is_deprecated: model.id.includes("0301") || model.id.includes("0314"),
    });
  }

  models.sort((a, b) => {
    const aScore = getModelSortScore(a.model_key, "openai");
    const bScore = getModelSortScore(b.model_key, "openai");
    return bScore - aScore;
  });

  return models;
}

async function fetchGoogleModels(apiKey: string): Promise<ProviderModel[]> {
  const url = `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`;

  const response = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Google API error: ${response.status}`);
  }

  const data = await response.json();
  const models: ProviderModel[] = [];

  const chatModels = (data.models || []).filter((m: { name: string; supportedGenerationMethods?: string[] }) => {
    return m.supportedGenerationMethods?.includes("generateContent");
  });

  for (const model of chatModels) {
    const modelId = model.name.replace("models/", "");

    if (!modelId.includes("gemini")) continue;

    models.push({
      model_key: modelId,
      display_name: model.displayName || formatGoogleModelName(modelId),
      context_window: model.inputTokenLimit || null,
      capabilities: {
        vision: model.supportedGenerationMethods?.includes("generateContent") ?? false,
        function_calling: modelId.includes("pro") || modelId.includes("flash"),
        streaming: true,
      },
      is_deprecated: modelId.includes("001") && !modelId.includes("1.5"),
    });
  }

  models.sort((a, b) => {
    const aScore = getModelSortScore(a.model_key, "google");
    const bScore = getModelSortScore(b.model_key, "google");
    return bScore - aScore;
  });

  return models;
}

function getOpenAIContextWindow(modelId: string): number {
  if (modelId.startsWith("gpt-5.1")) return 1047576;
  if (modelId.startsWith("gpt-4.1")) return 1047576;
  if (modelId.startsWith("o4-mini")) return 200000;
  if (modelId.startsWith("o3")) return 200000;
  if (modelId.startsWith("o1")) return 200000;
  if (modelId.includes("gpt-4o") || modelId.includes("gpt-4-turbo")) return 128000;
  if (modelId.includes("gpt-4-32k")) return 32768;
  if (modelId.includes("gpt-4")) return 8192;
  if (modelId.includes("gpt-3.5-turbo-16k")) return 16384;
  if (modelId.includes("gpt-3.5")) return 4096;
  return 8192;
}

function getOpenAICapabilities(modelId: string): Record<string, boolean> {
  const capabilities: Record<string, boolean> = {
    streaming: true,
    function_calling: true,
  };

  if (
    modelId.startsWith("gpt-5.1") ||
    modelId.startsWith("gpt-4.1") ||
    modelId.includes("gpt-4o") ||
    modelId.includes("gpt-4-vision")
  ) {
    capabilities.vision = true;
  }

  if (
    modelId.startsWith("o1") ||
    modelId.startsWith("o3") ||
    modelId.startsWith("o4")
  ) {
    capabilities.reasoning = true;
  }

  return capabilities;
}

function formatOpenAIModelName(modelId: string): string {
  const mappings: Record<string, string> = {
    "gpt-5.1": "GPT-5.1",
    "gpt-5.1-mini": "GPT-5.1 Mini",
    "gpt-5.1-nano": "GPT-5.1 Nano",
    "gpt-4.1-nano": "GPT-4.1 Nano",
    "gpt-4.1-mini": "GPT-4.1 Mini",
    "gpt-4.1": "GPT-4.1",
    "o4-mini": "o4 Mini",
    "o3-pro": "o3 Pro",
    "o3-mini": "o3 Mini",
    "o3": "o3",
    "gpt-4o-mini": "GPT-4o Mini",
    "gpt-4o": "GPT-4o",
    "gpt-4-turbo-preview": "GPT-4 Turbo Preview",
    "gpt-4-turbo": "GPT-4 Turbo",
    "gpt-4": "GPT-4",
    "gpt-3.5-turbo": "GPT-3.5 Turbo",
    "o1-mini": "o1 Mini",
    "o1-preview": "o1 Preview",
    "o1": "o1",
  };

  for (const [key, value] of Object.entries(mappings)) {
    if (modelId.startsWith(key)) {
      if (modelId === key) return value;
      const suffix = modelId.replace(key, "").replace(/^-/, "");
      if (suffix && !suffix.match(/^\d{4}/)) {
        return `${value} (${suffix})`;
      }
      return value;
    }
  }

  return modelId;
}

function formatGoogleModelName(modelId: string): string {
  return modelId
    .replace("gemini-", "Gemini ")
    .replace("-pro", " Pro")
    .replace("-flash", " Flash")
    .replace("-", " ")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function getModelSortScore(modelId: string, provider: string): number {
  if (provider === "openai") {
    if (modelId.startsWith("gpt-5.1") && !modelId.includes("mini") && !modelId.includes("nano")) return 110;
    if (modelId === "gpt-5.1-mini" || modelId.startsWith("gpt-5.1-mini-")) return 108;
    if (modelId === "gpt-5.1-nano" || modelId.startsWith("gpt-5.1-nano-")) return 106;
    if (modelId.startsWith("gpt-4.1") && !modelId.includes("mini") && !modelId.includes("nano")) return 100;
    if (modelId === "gpt-4.1-mini" || modelId.startsWith("gpt-4.1-mini-")) return 95;
    if (modelId === "gpt-4.1-nano" || modelId.startsWith("gpt-4.1-nano-")) return 93;
    if (modelId.startsWith("o4-mini")) return 90;
    if (modelId === "o3-pro" || modelId.startsWith("o3-pro-")) return 88;
    if (modelId === "o3" || (modelId.startsWith("o3-") && !modelId.includes("mini") && !modelId.includes("pro"))) return 85;
    if (modelId.startsWith("o3-mini")) return 83;
    if (modelId.includes("gpt-4o") && !modelId.includes("mini")) return 70;
    if (modelId.includes("gpt-4o-mini")) return 65;
    if (modelId.startsWith("o1") && !modelId.includes("mini")) return 60;
    if (modelId.startsWith("o1-mini")) return 55;
    if (modelId.includes("gpt-4-turbo")) return 50;
    if (modelId.includes("gpt-4")) return 40;
    if (modelId.includes("gpt-3.5")) return 20;
    return 0;
  }

  if (provider === "google") {
    if (modelId.includes("2.5-pro")) return 100;
    if (modelId.includes("2.5-flash")) return 95;
    if (modelId.includes("2.0")) return 90;
    if (modelId.includes("1.5-pro")) return 70;
    if (modelId.includes("1.5-flash")) return 65;
    if (modelId.includes("1.0-pro")) return 40;
    return 0;
  }

  return 0;
}
