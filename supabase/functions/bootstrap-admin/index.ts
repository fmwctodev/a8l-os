import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing environment variables");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: existingUsers } = await supabase
      .from("users")
      .select("id")
      .limit(1);

    if (existingUsers && existingUsers.length > 0) {
      return new Response(
        JSON.stringify({ error: "System already bootstrapped" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const adminEmail = "admin@autom8ionlab.com";
    const adminPassword = "bU6b#J^g9xqi";
    const adminName = "System Administrator";

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
    });

    if (authError) {
      throw authError;
    }

    if (!authData.user) {
      throw new Error("Failed to create auth user");
    }

    const { data: superAdminRole } = await supabase
      .from("roles")
      .select("id")
      .eq("name", "SuperAdmin")
      .single();

    if (!superAdminRole) {
      throw new Error("SuperAdmin role not found");
    }

    const { error: userError } = await supabase.from("users").insert({
      id: authData.user.id,
      email: adminEmail,
      name: adminName,
      role_id: superAdminRole.id,
      organization_id: "00000000-0000-0000-0000-000000000001",
      status: "active",
    });

    if (userError) {
      throw userError;
    }

    await supabase.from("audit_logs").insert({
      user_id: authData.user.id,
      action: "create",
      entity_type: "user",
      entity_id: authData.user.id,
      after_state: {
        email: adminEmail,
        name: adminName,
        role: "SuperAdmin",
        note: "System bootstrap",
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "SuperAdmin account created successfully",
        email: adminEmail,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
