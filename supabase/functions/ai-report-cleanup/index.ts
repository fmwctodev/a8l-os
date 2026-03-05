import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getSupabaseClient } from "../_shared/auth.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";

Deno.serve(async (req: Request) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  try {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase.rpc("cleanup_expired_ai_reports");

    if (error) {
      return errorResponse("CLEANUP_ERROR", `Cleanup failed: ${error.message}`);
    }

    return jsonResponse({
      success: true,
      deleted_count: data || 0,
      run_at: new Date().toISOString(),
    });

  } catch (error) {
    console.error("Report cleanup error:", error);
    return errorResponse(
      "INTERNAL_ERROR",
      error instanceof Error ? error.message : "Internal server error",
      500
    );
  }
});
