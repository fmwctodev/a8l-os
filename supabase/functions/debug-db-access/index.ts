import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  
  const { data, error, count } = await supabase
    .from("users")
    .select("*", { count: "exact" });
    
  return new Response(
    JSON.stringify({ 
      success: !error,
      error: error?.message,
      userCount: count,
      firstUser: data?.[0]?.email,
      env: {
        url: supabaseUrl.substring(0, 20),
        hasKey: !!serviceRoleKey,
        keyLen: serviceRoleKey?.length
      }
    }),
    { headers: { "Content-Type": "application/json" } }
  );
});
