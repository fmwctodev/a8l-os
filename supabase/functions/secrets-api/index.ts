import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { extractUserContext, requireAuth, AuthError } from "../_shared/auth.ts";

Deno.serve(async (req: Request) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const userCtx = await extractUserContext(req, supabase);
    const user = requireAuth(userCtx);

    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/secrets-api\/?/, "");

    if (req.method === "GET" && (!path || path === "")) {
      const { data, error } = await supabase
        .from("org_secrets")
        .select("id, name, category, description, is_sensitive, created_at, updated_at")
        .eq("org_id", user.orgId)
        .order("name");

      if (error) return errorResponse("DB_ERROR", error.message, 500);
      return jsonResponse(data || []);
    }

    if (req.method === "POST") {
      const body = await req.json();
      const { name, value, category, description, is_sensitive } = body;

      if (!name || !value) {
        return errorResponse("VALIDATION", "name and value are required", 400);
      }

      const { data, error } = await supabase
        .from("org_secrets")
        .insert({
          org_id: user.orgId,
          name,
          encrypted_value: value,
          category: category || "general",
          description: description || null,
          is_sensitive: is_sensitive ?? true,
          created_by: user.id,
        })
        .select("id, name, category, description, is_sensitive, created_at")
        .single();

      if (error) return errorResponse("DB_ERROR", error.message, 500);
      return jsonResponse(data, 201);
    }

    return errorResponse("NOT_FOUND", "Endpoint not found", 404);
  } catch (err) {
    if (err instanceof AuthError) {
      return errorResponse("AUTH_REQUIRED", "Authentication required", 401);
    }
    console.error("[secrets-api] Error:", err);
    return errorResponse("INTERNAL_ERROR", (err as Error).message, 500);
  }
});
