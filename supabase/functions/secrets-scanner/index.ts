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

    const { data: secrets, error } = await supabase
      .from("org_secrets")
      .select("id, name, category, is_sensitive, updated_at")
      .eq("org_id", user.orgId);

    if (error) return errorResponse("DB_ERROR", error.message, 500);

    const results = (secrets || []).map((s: { id: string; name: string; category: string; is_sensitive: boolean; updated_at: string }) => ({
      id: s.id,
      name: s.name,
      category: s.category,
      is_sensitive: s.is_sensitive,
      last_rotated: s.updated_at,
      status: "ok",
    }));

    return jsonResponse({ scanned: results.length, results });
  } catch (err) {
    if (err instanceof AuthError) {
      return errorResponse("AUTH_REQUIRED", "Authentication required", 401);
    }
    console.error("[secrets-scanner] Error:", err);
    return errorResponse("INTERNAL_ERROR", (err as Error).message, 500);
  }
});
