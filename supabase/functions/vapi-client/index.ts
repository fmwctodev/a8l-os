import { createClient } from "npm:@supabase/supabase-js@2";
import { handleCors, jsonResponse, errorResponse, successResponse } from "../_shared/cors.ts";
import { getSupabaseClient, extractUserContext, requireAuth } from "../_shared/auth.ts";

const VAPI_BASE = "https://api.vapi.ai";

interface VapiRequestPayload {
  action: string;
  org_id?: string;
  [key: string]: unknown;
}

async function getVapiApiKey(supabase: ReturnType<typeof createClient>, orgId: string): Promise<string | null> {
  const { data } = await supabase
    .from("integration_connections")
    .select("credentials_encrypted")
    .eq("org_id", orgId)
    .eq("status", "connected")
    .maybeSingle();

  if (!data?.credentials_encrypted) {
    const { data: integ } = await supabase
      .from("integrations")
      .select("id")
      .eq("org_id", orgId)
      .eq("key", "vapi")
      .maybeSingle();

    if (integ) {
      const { data: conn } = await supabase
        .from("integration_connections")
        .select("credentials_encrypted")
        .eq("integration_id", integ.id)
        .eq("status", "connected")
        .maybeSingle();
      if (conn?.credentials_encrypted) {
        try {
          const creds = JSON.parse(conn.credentials_encrypted);
          return creds.api_key || null;
        } catch {
          return conn.credentials_encrypted;
        }
      }
    }
    return null;
  }

  try {
    const creds = JSON.parse(data.credentials_encrypted);
    return creds.api_key || null;
  } catch {
    return data.credentials_encrypted;
  }
}

async function vapiRequest(
  apiKey: string,
  path: string,
  method: string = "GET",
  body?: Record<string, unknown>
): Promise<{ status: number; data: unknown }> {
  const headers: Record<string, string> = {
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  const init: RequestInit = { method, headers };
  if (body && method !== "GET") {
    init.body = JSON.stringify(body);
  }

  const response = await fetch(`${VAPI_BASE}${path}`, init);
  const responseData = await response.json().catch(() => ({}));
  return { status: response.status, data: responseData };
}

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabase = getSupabaseClient();
    const userContext = await extractUserContext(req, supabase);
    const user = requireAuth(userContext);

    const payload: VapiRequestPayload = await req.json();
    const { action } = payload;

    if (!action) {
      return errorResponse("MISSING_ACTION", "Action is required");
    }

    const orgId = user.orgId;
    const apiKey = await getVapiApiKey(supabase, orgId);

    if (action === "test_connection") {
      if (!payload.api_key && !apiKey) {
        return errorResponse("NO_API_KEY", "No API key provided or configured");
      }
      const testKey = (payload.api_key as string) || apiKey!;
      const result = await vapiRequest(testKey, "/assistant", "GET");
      if (result.status === 200 || result.status === 201) {
        return successResponse({ connected: true });
      }
      return errorResponse("CONNECTION_FAILED", "Failed to connect to Vapi", 400, { status: result.status });
    }

    if (!apiKey) {
      return errorResponse("VAPI_NOT_CONFIGURED", "Vapi integration is not connected. Configure it in Settings > Integrations.", 400);
    }

    switch (action) {
      case "create_assistant": {
        const config = payload.config as Record<string, unknown>;
        const result = await vapiRequest(apiKey, "/assistant", "POST", config);
        if (result.status >= 200 && result.status < 300) {
          return successResponse(result.data);
        }
        return errorResponse("VAPI_ERROR", "Failed to create assistant", result.status, result.data as Record<string, unknown>);
      }

      case "update_assistant": {
        const assistantId = payload.vapi_assistant_id as string;
        const config = payload.config as Record<string, unknown>;
        const result = await vapiRequest(apiKey, `/assistant/${assistantId}`, "PATCH", config);
        if (result.status >= 200 && result.status < 300) {
          return successResponse(result.data);
        }
        return errorResponse("VAPI_ERROR", "Failed to update assistant", result.status, result.data as Record<string, unknown>);
      }

      case "get_assistant": {
        const assistantId = payload.vapi_assistant_id as string;
        const result = await vapiRequest(apiKey, `/assistant/${assistantId}`, "GET");
        if (result.status >= 200 && result.status < 300) {
          return successResponse(result.data);
        }
        return errorResponse("VAPI_ERROR", "Failed to get assistant", result.status, result.data as Record<string, unknown>);
      }

      case "list_assistants": {
        const result = await vapiRequest(apiKey, "/assistant", "GET");
        if (result.status >= 200 && result.status < 300) {
          return successResponse(result.data);
        }
        return errorResponse("VAPI_ERROR", "Failed to list assistants", result.status, result.data as Record<string, unknown>);
      }

      case "delete_assistant": {
        const assistantId = payload.vapi_assistant_id as string;
        const result = await vapiRequest(apiKey, `/assistant/${assistantId}`, "DELETE");
        if (result.status >= 200 && result.status < 300) {
          return successResponse({ deleted: true });
        }
        return errorResponse("VAPI_ERROR", "Failed to delete assistant", result.status, result.data as Record<string, unknown>);
      }

      case "list_phone_numbers": {
        const result = await vapiRequest(apiKey, "/phone-number", "GET");
        if (result.status >= 200 && result.status < 300) {
          return successResponse(result.data);
        }
        return errorResponse("VAPI_ERROR", "Failed to list phone numbers", result.status, result.data as Record<string, unknown>);
      }

      case "create_phone_number": {
        const config = payload.config as Record<string, unknown>;
        const result = await vapiRequest(apiKey, "/phone-number", "POST", config);
        if (result.status >= 200 && result.status < 300) {
          return successResponse(result.data);
        }
        return errorResponse("VAPI_ERROR", "Failed to create phone number", result.status, result.data as Record<string, unknown>);
      }

      case "import_twilio_number": {
        const config = payload.config as Record<string, unknown>;
        const result = await vapiRequest(apiKey, "/phone-number", "POST", {
          provider: "twilio",
          ...config,
        });
        if (result.status >= 200 && result.status < 300) {
          return successResponse(result.data);
        }
        return errorResponse("VAPI_ERROR", "Failed to import Twilio number", result.status, result.data as Record<string, unknown>);
      }

      case "update_phone_number": {
        const phoneId = payload.phone_id as string;
        const config = payload.config as Record<string, unknown>;
        const result = await vapiRequest(apiKey, `/phone-number/${phoneId}`, "PATCH", config);
        if (result.status >= 200 && result.status < 300) {
          return successResponse(result.data);
        }
        return errorResponse("VAPI_ERROR", "Failed to update phone number", result.status, result.data as Record<string, unknown>);
      }

      case "delete_phone_number": {
        const phoneId = payload.phone_id as string;
        const result = await vapiRequest(apiKey, `/phone-number/${phoneId}`, "DELETE");
        if (result.status >= 200 && result.status < 300) {
          return successResponse({ deleted: true });
        }
        return errorResponse("VAPI_ERROR", "Failed to delete phone number", result.status, result.data as Record<string, unknown>);
      }

      case "create_outbound_call": {
        const config = payload.config as Record<string, unknown>;
        const result = await vapiRequest(apiKey, "/call", "POST", config);
        if (result.status >= 200 && result.status < 300) {
          return successResponse(result.data);
        }
        return errorResponse("VAPI_ERROR", "Failed to create outbound call", result.status, result.data as Record<string, unknown>);
      }

      case "get_call": {
        const callId = payload.vapi_call_id as string;
        const result = await vapiRequest(apiKey, `/call/${callId}`, "GET");
        if (result.status >= 200 && result.status < 300) {
          return successResponse(result.data);
        }
        return errorResponse("VAPI_ERROR", "Failed to get call", result.status, result.data as Record<string, unknown>);
      }

      case "list_calls": {
        const result = await vapiRequest(apiKey, "/call", "GET");
        if (result.status >= 200 && result.status < 300) {
          return successResponse(result.data);
        }
        return errorResponse("VAPI_ERROR", "Failed to list calls", result.status, result.data as Record<string, unknown>);
      }

      case "list_voices": {
        const result = await vapiRequest(apiKey, "/voice", "GET");
        if (result.status >= 200 && result.status < 300) {
          return successResponse(result.data);
        }
        return successResponse([]);
      }

      case "create_tool": {
        const config = payload.config as Record<string, unknown>;
        const result = await vapiRequest(apiKey, "/tool", "POST", config);
        if (result.status >= 200 && result.status < 300) {
          return successResponse(result.data);
        }
        return errorResponse("VAPI_ERROR", "Failed to create tool", result.status, result.data as Record<string, unknown>);
      }

      case "update_tool": {
        const toolId = payload.vapi_tool_id as string;
        const config = payload.config as Record<string, unknown>;
        const result = await vapiRequest(apiKey, `/tool/${toolId}`, "PATCH", config);
        if (result.status >= 200 && result.status < 300) {
          return successResponse(result.data);
        }
        return errorResponse("VAPI_ERROR", "Failed to update tool", result.status, result.data as Record<string, unknown>);
      }

      case "delete_tool": {
        const toolId = payload.vapi_tool_id as string;
        const result = await vapiRequest(apiKey, `/tool/${toolId}`, "DELETE");
        if (result.status >= 200 && result.status < 300) {
          return successResponse({ deleted: true });
        }
        return errorResponse("VAPI_ERROR", "Failed to delete tool", result.status, result.data as Record<string, unknown>);
      }

      default:
        return errorResponse("UNKNOWN_ACTION", `Unknown action: ${action}`, 400);
    }
  } catch (error) {
    console.error("[vapi-client] Error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return errorResponse("INTERNAL_ERROR", message, 500);
  }
});
