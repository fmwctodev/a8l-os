import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CreateUserRequest {
  email: string;
  password: string;
  name: string;
  roleName?: string;
  organizationId?: string;
}

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

    const body: CreateUserRequest = await req.json();
    const { email, password, name, roleName = "Sales", organizationId = "00000000-0000-0000-0000-000000000001" } = body;

    if (!email || !password || !name) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: email, password, name" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: existingUser } = await supabase
      .from("users")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existingUser) {
      return new Response(
        JSON.stringify({ error: "User with this email already exists" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      throw authError;
    }

    if (!authData.user) {
      throw new Error("Failed to create auth user");
    }

    const { data: role } = await supabase
      .from("roles")
      .select("id")
      .eq("name", roleName)
      .single();

    if (!role) {
      throw new Error(`Role "${roleName}" not found`);
    }

    const { error: userError } = await supabase.from("users").insert({
      id: authData.user.id,
      email,
      name,
      role_id: role.id,
      organization_id: organizationId,
      status: "active",
    });

    if (userError) {
      await supabase.auth.admin.deleteUser(authData.user.id);
      throw userError;
    }

    await supabase.from("audit_logs").insert({
      user_id: authData.user.id,
      action: "create",
      entity_type: "user",
      entity_id: authData.user.id,
      after_state: {
        email,
        name,
        role: roleName,
        note: "User created via API",
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "User created successfully",
        user: {
          id: authData.user.id,
          email,
          name,
        },
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
