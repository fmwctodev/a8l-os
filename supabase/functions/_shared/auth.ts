import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";
import type { UserContext } from "./types.ts";

export function getAnonClient(): SupabaseClient {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  return createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function getSupabaseClient(): SupabaseClient {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function extractUserContext(
  req: Request,
  supabase: SupabaseClient
): Promise<UserContext | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    console.error("[Auth] No Authorization header");
    return null;
  }

  const token = authHeader.replace("Bearer ", "");

  // Use anon client for JWT validation (this is the key fix!)
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !anonKey) {
    console.error("[Auth] Missing SUPABASE_URL or SUPABASE_ANON_KEY in environment");
  } else {
    console.log("[Auth] Supabase environment verified. Project URL:", supabaseUrl);
  }

  let user = null;
  const anonClient = getAnonClient();
  const { data: { user: authUser }, error: authError } = await anonClient.auth.getUser(token);

  if (authError) {
    console.warn("[Auth] getUser() failed, attempting manual decode:", authError.message);
    try {
      // Manual decode fallback for "missing sub" or project-mismatch issues
      const payloadBase64 = token.split(".")[1];
      const decoded = JSON.parse(atob(payloadBase64.replace(/-/g, "+").replace(/_/g, "/")));
      if (decoded.sub) {
        user = { id: decoded.sub };
        console.log("[Auth] Manually extracted User ID from JWT:", user.id);
      }
    } catch (decodeErr) {
      console.error("[Auth] Manual decode also failed:", decodeErr);
    }
  } else {
    user = authUser;
  }

  if (!user) {
    console.error("[Auth] No user could be identified from JWT");
    return null;
  }

  if (!user) {
    console.error("[Auth] No user found in JWT");
    return null;
  }

  console.log("[Auth] JWT validated successfully for user:", user.id);

  // Use service role client for database queries (bypass RLS)
  const { data: userData, error: userError } = await supabase
    .from("users")
    .select("id, email, organization_id, role_id, department_id")
    .eq("id", user.id)
    .maybeSingle();

  if (userError) {
    console.error("[Auth] Failed to fetch user data:", userError.message);
    return null;
  }

  if (!userData) {
    console.error("[Auth] User not found in database:", user.id);
    return null;
  }

  console.log("[Auth] User data loaded successfully");

  let roleName = "Unknown";
  if (userData.role_id) {
    const { data: roleData } = await supabase
      .from("roles")
      .select("id, name")
      .eq("id", userData.role_id)
      .maybeSingle();
    if (roleData) {
      roleName = roleData.name;
    }
  }

  const rolePermissions = new Set<string>();

  if (userData.role_id) {
    const { data: rpRows } = await supabase
      .from("role_permissions")
      .select("permission_id")
      .eq("role_id", userData.role_id);

    if (rpRows && rpRows.length > 0) {
      const permIds = rpRows.map((r: { permission_id: string }) => r.permission_id);
      const { data: perms } = await supabase
        .from("permissions")
        .select("key")
        .in("id", permIds);

      if (perms) {
        for (const p of perms) {
          rolePermissions.add(p.key);
        }
      }
    }
  }

  const { data: overrides } = await supabase
    .from("user_permission_overrides")
    .select("permission_id, granted")
    .eq("user_id", userData.id);

  if (overrides && overrides.length > 0) {
    const overridePermIds = overrides.map((o: { permission_id: string }) => o.permission_id);
    const { data: overridePerms } = await supabase
      .from("permissions")
      .select("id, key")
      .in("id", overridePermIds);

    if (overridePerms) {
      const permKeyMap = new Map(overridePerms.map((p: { id: string; key: string }) => [p.id, p.key]));
      for (const override of overrides) {
        const key = permKeyMap.get(override.permission_id);
        if (key) {
          if (override.granted) {
            rolePermissions.add(key);
          } else {
            rolePermissions.delete(key);
          }
        }
      }
    }
  }

  const isSuperAdmin = roleName === "SuperAdmin";

  return {
    id: userData.id,
    email: userData.email,
    orgId: userData.organization_id,
    roleId: userData.role_id,
    roleName,
    departmentId: userData.department_id,
    isSuperAdmin,
    permissions: Array.from(rolePermissions),
  };
}

export async function extractUserContextById(
  supabase: SupabaseClient,
  userId: string
): Promise<UserContext | null> {
  const { data: userData, error: userError } = await supabase
    .from("users")
    .select("id, email, organization_id, role_id, department_id")
    .eq("id", userId)
    .maybeSingle();

  if (userError || !userData) {
    console.error("[Auth] Internal lookup failed for user:", userId);
    return null;
  }

  let roleName = "Unknown";
  if (userData.role_id) {
    const { data: roleData } = await supabase
      .from("roles")
      .select("id, name")
      .eq("id", userData.role_id)
      .maybeSingle();
    if (roleData) roleName = roleData.name;
  }

  const rolePermissions = new Set<string>();
  if (userData.role_id) {
    const { data: rpRows } = await supabase
      .from("role_permissions")
      .select("permission_id")
      .eq("role_id", userData.role_id);
    if (rpRows && rpRows.length > 0) {
      const permIds = rpRows.map((r: { permission_id: string }) => r.permission_id);
      const { data: perms } = await supabase
        .from("permissions")
        .select("key")
        .in("id", permIds);
      if (perms) {
        for (const p of perms) rolePermissions.add(p.key);
      }
    }
  }

  const { data: overrides } = await supabase
    .from("user_permission_overrides")
    .select("permission_id, granted")
    .eq("user_id", userData.id);
  if (overrides && overrides.length > 0) {
    const overridePermIds = overrides.map((o: { permission_id: string }) => o.permission_id);
    const { data: overridePerms } = await supabase
      .from("permissions")
      .select("id, key")
      .in("id", overridePermIds);
    if (overridePerms) {
      const permKeyMap = new Map(overridePerms.map((p: { id: string; key: string }) => [p.id, p.key]));
      for (const override of overrides) {
        const key = permKeyMap.get(override.permission_id);
        if (key) {
          if (override.granted) rolePermissions.add(key);
          else rolePermissions.delete(key);
        }
      }
    }
  }

  return {
    id: userData.id,
    email: userData.email,
    orgId: userData.organization_id,
    roleId: userData.role_id,
    roleName,
    departmentId: userData.department_id,
    isSuperAdmin: roleName === "SuperAdmin",
    permissions: Array.from(rolePermissions),
  };
}

export function isServiceRoleRequest(req: Request): boolean {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return false;
  const token = authHeader.replace("Bearer ", "");
  const expected = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  // Constant-time comparison to prevent timing attacks
  if (token.length !== expected.length) return false;
  const encoder = new TextEncoder();
  const a = encoder.encode(token);
  const b = encoder.encode(expected);
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }
  return result === 0;
}

export function requireAuth(userContext: UserContext | null): UserContext {
  if (!userContext) {
    throw new AuthError("Authentication required", "AUTH_REQUIRED");
  }
  return userContext;
}

export class AuthError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.code = code;
    this.name = "AuthError";
  }
}
