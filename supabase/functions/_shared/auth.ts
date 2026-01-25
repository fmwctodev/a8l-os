import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";
import type { UserContext } from "./types.ts";

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
    return null;
  }

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return null;
  }

  const { data: userData, error: userError } = await supabase
    .from("users")
    .select(`
      id,
      email,
      org_id,
      role_id,
      department_id,
      role:roles!role_id(
        id,
        name,
        is_system,
        role_permissions(
          permission:permissions(key)
        )
      ),
      user_permission_overrides(
        permission:permissions(key),
        granted
      )
    `)
    .eq("id", user.id)
    .maybeSingle();

  if (userError || !userData) {
    return null;
  }

  const rolePermissions = new Set<string>();

  if (userData.role?.role_permissions) {
    for (const rp of userData.role.role_permissions) {
      if (rp.permission?.key) {
        rolePermissions.add(rp.permission.key);
      }
    }
  }

  if (userData.user_permission_overrides) {
    for (const override of userData.user_permission_overrides) {
      if (override.permission?.key) {
        if (override.granted) {
          rolePermissions.add(override.permission.key);
        } else {
          rolePermissions.delete(override.permission.key);
        }
      }
    }
  }

  const isSuperAdmin = userData.role?.name === "SuperAdmin" || userData.role?.is_system === true;

  return {
    id: userData.id,
    email: userData.email,
    orgId: userData.org_id,
    roleId: userData.role_id,
    roleName: userData.role?.name || "Unknown",
    departmentId: userData.department_id,
    isSuperAdmin,
    permissions: Array.from(rolePermissions),
  };
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
