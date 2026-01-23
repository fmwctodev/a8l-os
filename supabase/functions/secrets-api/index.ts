import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type Action =
  | "list"
  | "get"
  | "create"
  | "update"
  | "delete"
  | "reveal"
  | "list-categories"
  | "create-category"
  | "update-category"
  | "delete-category"
  | "get-dynamic-ref"
  | "set-dynamic-ref"
  | "delete-dynamic-ref"
  | "get-usage-logs"
  | "test-secret";

interface RequestPayload {
  action: Action;
  org_id: string;
  secret_id?: string;
  category_id?: string;
  data?: Record<string, unknown>;
  filters?: {
    category_id?: string;
    search?: string;
    value_type?: string;
    include_expired?: boolean;
  };
  pagination?: {
    page?: number;
    limit?: number;
  };
}

interface SecretData {
  name: string;
  key: string;
  value?: string;
  category_id?: string;
  value_type?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  expires_at?: string;
}

interface CategoryData {
  name: string;
  description?: string;
  icon?: string;
  sort_order?: number;
}

interface DynamicRefData {
  ref_path: string;
  source_table: string;
  source_filter?: Record<string, unknown>;
  transform?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return errorResponse("Missing authorization header", 401);
    }

    const payload: RequestPayload = await req.json();
    const { action, org_id } = payload;

    if (!action || !org_id) {
      return errorResponse("Missing required fields: action, org_id", 400);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: { headers: { Authorization: authHeader } },
      }
    );

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return errorResponse("Unauthorized", 401);
    }

    const { data: userData, error: userDataError } = await supabaseAdmin
      .from("users")
      .select("id, organization_id, role_id, roles(name)")
      .eq("id", user.id)
      .single();

    if (userDataError || !userData) {
      return errorResponse("User not found", 404);
    }

    if (userData.organization_id !== org_id) {
      return errorResponse("Access denied to this organization", 403);
    }

    const roleName = (userData.roles as { name: string } | null)?.name;
    const isAdmin = roleName === "SuperAdmin" || roleName === "Admin";
    const isSuperAdmin = roleName === "SuperAdmin";

    switch (action) {
      case "list":
        return await listSecrets(supabaseAdmin, org_id, payload.filters, payload.pagination);

      case "get":
        if (!payload.secret_id) return errorResponse("Missing secret_id", 400);
        return await getSecret(supabaseAdmin, org_id, payload.secret_id);

      case "create":
        if (!isAdmin) return errorResponse("Admin access required", 403);
        if (!payload.data) return errorResponse("Missing data", 400);
        return await createSecret(supabaseAdmin, org_id, user.id, payload.data as SecretData);

      case "update":
        if (!isAdmin) return errorResponse("Admin access required", 403);
        if (!payload.secret_id || !payload.data) return errorResponse("Missing secret_id or data", 400);
        return await updateSecret(supabaseAdmin, org_id, user.id, payload.secret_id, payload.data as Partial<SecretData>);

      case "delete":
        if (!isAdmin) return errorResponse("Admin access required", 403);
        if (!payload.secret_id) return errorResponse("Missing secret_id", 400);
        return await deleteSecret(supabaseAdmin, org_id, user.id, payload.secret_id);

      case "reveal":
        if (!isAdmin) return errorResponse("Admin access required to reveal secrets", 403);
        if (!payload.secret_id) return errorResponse("Missing secret_id", 400);
        return await revealSecret(supabaseAdmin, org_id, user.id, payload.secret_id);

      case "list-categories":
        return await listCategories(supabaseAdmin, org_id);

      case "create-category":
        if (!isAdmin) return errorResponse("Admin access required", 403);
        if (!payload.data) return errorResponse("Missing data", 400);
        return await createCategory(supabaseAdmin, org_id, payload.data as CategoryData);

      case "update-category":
        if (!isAdmin) return errorResponse("Admin access required", 403);
        if (!payload.category_id || !payload.data) return errorResponse("Missing category_id or data", 400);
        return await updateCategory(supabaseAdmin, org_id, payload.category_id, payload.data as Partial<CategoryData>);

      case "delete-category":
        if (!isAdmin) return errorResponse("Admin access required", 403);
        if (!payload.category_id) return errorResponse("Missing category_id", 400);
        return await deleteCategory(supabaseAdmin, org_id, payload.category_id);

      case "get-dynamic-ref":
        if (!payload.secret_id) return errorResponse("Missing secret_id", 400);
        return await getDynamicRef(supabaseAdmin, org_id, payload.secret_id);

      case "set-dynamic-ref":
        if (!isAdmin) return errorResponse("Admin access required", 403);
        if (!payload.secret_id || !payload.data) return errorResponse("Missing secret_id or data", 400);
        return await setDynamicRef(supabaseAdmin, org_id, payload.secret_id, payload.data as DynamicRefData);

      case "delete-dynamic-ref":
        if (!isAdmin) return errorResponse("Admin access required", 403);
        if (!payload.secret_id) return errorResponse("Missing secret_id", 400);
        return await deleteDynamicRef(supabaseAdmin, org_id, payload.secret_id);

      case "get-usage-logs":
        if (!isAdmin) return errorResponse("Admin access required", 403);
        return await getUsageLogs(supabaseAdmin, org_id, payload.secret_id, payload.pagination);

      case "test-secret":
        if (!isAdmin) return errorResponse("Admin access required", 403);
        if (!payload.secret_id) return errorResponse("Missing secret_id", 400);
        return await testSecret(supabaseAdmin, org_id, user.id, payload.secret_id);

      default:
        return errorResponse(`Unknown action: ${action}`, 400);
    }
  } catch (error) {
    console.error("Error in secrets-api:", error);
    return errorResponse(
      error instanceof Error ? error.message : "Unknown error",
      500
    );
  }
});

function errorResponse(message: string, status: number) {
  return new Response(
    JSON.stringify({ success: false, error: message }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

function successResponse(data: unknown) {
  return new Response(
    JSON.stringify({ success: true, data }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function listSecrets(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  filters?: RequestPayload["filters"],
  pagination?: RequestPayload["pagination"]
) {
  const page = pagination?.page ?? 1;
  const limit = pagination?.limit ?? 50;
  const offset = (page - 1) * limit;

  let query = supabase
    .from("org_secrets")
    .select("id, org_id, category_id, name, key, value_type, description, metadata, is_system, last_used_at, expires_at, created_by, updated_by, created_at, updated_at, secret_categories(id, name, icon)", { count: "exact" })
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (filters?.category_id) {
    query = query.eq("category_id", filters.category_id);
  }

  if (filters?.value_type) {
    query = query.eq("value_type", filters.value_type);
  }

  if (filters?.search) {
    query = query.or(`name.ilike.%${filters.search}%,key.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
  }

  if (!filters?.include_expired) {
    query = query.or("expires_at.is.null,expires_at.gt.now()");
  }

  const { data, error, count } = await query;

  if (error) {
    console.error("List secrets error:", error);
    return errorResponse(error.message, 500);
  }

  return successResponse({
    secrets: data,
    pagination: {
      page,
      limit,
      total: count ?? 0,
      total_pages: Math.ceil((count ?? 0) / limit),
    },
  });
}

async function getSecret(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  secretId: string
) {
  const { data, error } = await supabase
    .from("org_secrets")
    .select("id, org_id, category_id, name, key, value_type, description, metadata, is_system, last_used_at, expires_at, created_by, updated_by, created_at, updated_at, secret_categories(id, name, icon), secret_dynamic_refs(*)")
    .eq("id", secretId)
    .eq("org_id", orgId)
    .single();

  if (error) {
    return errorResponse(error.message, error.code === "PGRST116" ? 404 : 500);
  }

  return successResponse(data);
}

async function createSecret(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  userId: string,
  data: SecretData
) {
  const { name, key, value, category_id, value_type, description, metadata, expires_at } = data;

  if (!name || !key) {
    return errorResponse("Missing required fields: name, key", 400);
  }

  let encryptedValue = null;
  if (value) {
    const { data: encrypted, error: encryptError } = await supabase.rpc("encrypt_secret_value", {
      plain_value: value,
    });

    if (encryptError) {
      console.error("Encryption error:", encryptError);
      return errorResponse("Failed to encrypt secret value", 500);
    }
    encryptedValue = encrypted;
  }

  const { data: secret, error } = await supabase
    .from("org_secrets")
    .insert({
      org_id: orgId,
      category_id: category_id || null,
      name,
      key: key.toUpperCase().replace(/[^A-Z0-9_]/g, "_"),
      encrypted_value: encryptedValue,
      value_type: value_type || "static",
      description: description || null,
      metadata: metadata || {},
      expires_at: expires_at || null,
      created_by: userId,
      updated_by: userId,
    })
    .select("id, name, key, value_type, description, created_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      return errorResponse("A secret with this key already exists", 409);
    }
    console.error("Create secret error:", error);
    return errorResponse(error.message, 500);
  }

  await logUsage(supabase, orgId, secret.id, secret.key, "create", "user", userId);

  return successResponse(secret);
}

async function updateSecret(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  userId: string,
  secretId: string,
  data: Partial<SecretData>
) {
  const { data: existing, error: existingError } = await supabase
    .from("org_secrets")
    .select("id, key, is_system")
    .eq("id", secretId)
    .eq("org_id", orgId)
    .single();

  if (existingError || !existing) {
    return errorResponse("Secret not found", 404);
  }

  const updateData: Record<string, unknown> = {
    updated_by: userId,
  };

  if (data.name !== undefined) updateData.name = data.name;
  if (data.category_id !== undefined) updateData.category_id = data.category_id || null;
  if (data.value_type !== undefined) updateData.value_type = data.value_type;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.metadata !== undefined) updateData.metadata = data.metadata;
  if (data.expires_at !== undefined) updateData.expires_at = data.expires_at || null;

  if (data.key !== undefined && data.key !== existing.key) {
    updateData.key = data.key.toUpperCase().replace(/[^A-Z0-9_]/g, "_");
  }

  if (data.value !== undefined) {
    const { data: encrypted, error: encryptError } = await supabase.rpc("encrypt_secret_value", {
      plain_value: data.value,
    });

    if (encryptError) {
      console.error("Encryption error:", encryptError);
      return errorResponse("Failed to encrypt secret value", 500);
    }
    updateData.encrypted_value = encrypted;
  }

  const { data: updated, error } = await supabase
    .from("org_secrets")
    .update(updateData)
    .eq("id", secretId)
    .eq("org_id", orgId)
    .select("id, name, key, value_type, description, updated_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      return errorResponse("A secret with this key already exists", 409);
    }
    console.error("Update secret error:", error);
    return errorResponse(error.message, 500);
  }

  await logUsage(supabase, orgId, secretId, existing.key, "write", "user", userId);

  return successResponse(updated);
}

async function deleteSecret(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  userId: string,
  secretId: string
) {
  const { data: existing, error: existingError } = await supabase
    .from("org_secrets")
    .select("id, key, is_system")
    .eq("id", secretId)
    .eq("org_id", orgId)
    .single();

  if (existingError || !existing) {
    return errorResponse("Secret not found", 404);
  }

  if (existing.is_system) {
    return errorResponse("Cannot delete system-managed secrets", 403);
  }

  await logUsage(supabase, orgId, secretId, existing.key, "delete", "user", userId);

  const { error } = await supabase
    .from("org_secrets")
    .delete()
    .eq("id", secretId)
    .eq("org_id", orgId);

  if (error) {
    console.error("Delete secret error:", error);
    return errorResponse(error.message, 500);
  }

  return successResponse({ deleted: true });
}

async function revealSecret(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  userId: string,
  secretId: string
) {
  const { data: secret, error: secretError } = await supabase
    .from("org_secrets")
    .select("id, key, encrypted_value, value_type")
    .eq("id", secretId)
    .eq("org_id", orgId)
    .single();

  if (secretError || !secret) {
    return errorResponse("Secret not found", 404);
  }

  if (!secret.encrypted_value) {
    return successResponse({ value: null });
  }

  if (secret.value_type === "dynamic") {
    const { data: dynamicRef } = await supabase
      .from("secret_dynamic_refs")
      .select("*")
      .eq("secret_id", secretId)
      .single();

    if (dynamicRef) {
      const resolvedValue = await resolveDynamicRef(supabase, orgId, dynamicRef);
      await logUsage(supabase, orgId, secretId, secret.key, "read", "user", userId);
      await supabase.from("org_secrets").update({ last_used_at: new Date().toISOString() }).eq("id", secretId);
      return successResponse({ value: resolvedValue, is_dynamic: true });
    }
  }

  const { data: decrypted, error: decryptError } = await supabase.rpc("decrypt_secret_value", {
    encrypted_value: secret.encrypted_value,
  });

  if (decryptError) {
    console.error("Decryption error:", decryptError);
    return errorResponse("Failed to decrypt secret value", 500);
  }

  await logUsage(supabase, orgId, secretId, secret.key, "read", "user", userId);
  await supabase.from("org_secrets").update({ last_used_at: new Date().toISOString() }).eq("id", secretId);

  return successResponse({ value: decrypted });
}

async function resolveDynamicRef(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  dynamicRef: { source_table: string; source_filter: Record<string, unknown>; ref_path: string; transform?: string }
): Promise<string | null> {
  try {
    let query = supabase.from(dynamicRef.source_table).select("*");

    if (dynamicRef.source_filter && typeof dynamicRef.source_filter === "object") {
      for (const [key, value] of Object.entries(dynamicRef.source_filter)) {
        if (key === "org_id" || key === "organization_id") {
          query = query.eq(key, orgId);
        } else {
          query = query.eq(key, value);
        }
      }
    }

    const { data, error } = await query.limit(1).single();

    if (error || !data) {
      return null;
    }

    const pathParts = dynamicRef.ref_path.split(".");
    let value: unknown = data;
    for (const part of pathParts) {
      if (value && typeof value === "object" && part in value) {
        value = (value as Record<string, unknown>)[part];
      } else {
        return null;
      }
    }

    if (dynamicRef.transform) {
      value = applyTransform(String(value), dynamicRef.transform);
    }

    return value !== null && value !== undefined ? String(value) : null;
  } catch {
    return null;
  }
}

function applyTransform(value: string, transform: string): string {
  switch (transform) {
    case "uppercase":
      return value.toUpperCase();
    case "lowercase":
      return value.toLowerCase();
    case "trim":
      return value.trim();
    case "base64_encode":
      return btoa(value);
    case "base64_decode":
      return atob(value);
    default:
      return value;
  }
}

async function listCategories(
  supabase: ReturnType<typeof createClient>,
  orgId: string
) {
  const { data, error } = await supabase
    .from("secret_categories")
    .select("*")
    .eq("org_id", orgId)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("List categories error:", error);
    return errorResponse(error.message, 500);
  }

  return successResponse(data);
}

async function createCategory(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  data: CategoryData
) {
  const { name, description, icon, sort_order } = data;

  if (!name) {
    return errorResponse("Missing required field: name", 400);
  }

  const { data: category, error } = await supabase
    .from("secret_categories")
    .insert({
      org_id: orgId,
      name,
      description: description || null,
      icon: icon || "key",
      sort_order: sort_order ?? 0,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return errorResponse("A category with this name already exists", 409);
    }
    console.error("Create category error:", error);
    return errorResponse(error.message, 500);
  }

  return successResponse(category);
}

async function updateCategory(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  categoryId: string,
  data: Partial<CategoryData>
) {
  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.icon !== undefined) updateData.icon = data.icon;
  if (data.sort_order !== undefined) updateData.sort_order = data.sort_order;

  const { data: category, error } = await supabase
    .from("secret_categories")
    .update(updateData)
    .eq("id", categoryId)
    .eq("org_id", orgId)
    .select()
    .single();

  if (error) {
    console.error("Update category error:", error);
    return errorResponse(error.message, error.code === "PGRST116" ? 404 : 500);
  }

  return successResponse(category);
}

async function deleteCategory(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  categoryId: string
) {
  const { error } = await supabase
    .from("secret_categories")
    .delete()
    .eq("id", categoryId)
    .eq("org_id", orgId);

  if (error) {
    console.error("Delete category error:", error);
    return errorResponse(error.message, 500);
  }

  return successResponse({ deleted: true });
}

async function getDynamicRef(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  secretId: string
) {
  const { data: secret } = await supabase
    .from("org_secrets")
    .select("id")
    .eq("id", secretId)
    .eq("org_id", orgId)
    .single();

  if (!secret) {
    return errorResponse("Secret not found", 404);
  }

  const { data, error } = await supabase
    .from("secret_dynamic_refs")
    .select("*")
    .eq("secret_id", secretId)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("Get dynamic ref error:", error);
    return errorResponse(error.message, 500);
  }

  return successResponse(data);
}

async function setDynamicRef(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  secretId: string,
  data: DynamicRefData
) {
  const { data: secret } = await supabase
    .from("org_secrets")
    .select("id")
    .eq("id", secretId)
    .eq("org_id", orgId)
    .single();

  if (!secret) {
    return errorResponse("Secret not found", 404);
  }

  const { ref_path, source_table, source_filter, transform } = data;

  if (!ref_path || !source_table) {
    return errorResponse("Missing required fields: ref_path, source_table", 400);
  }

  const { data: existing } = await supabase
    .from("secret_dynamic_refs")
    .select("id")
    .eq("secret_id", secretId)
    .single();

  let result;
  if (existing) {
    result = await supabase
      .from("secret_dynamic_refs")
      .update({
        ref_path,
        source_table,
        source_filter: source_filter || {},
        transform: transform || null,
      })
      .eq("secret_id", secretId)
      .select()
      .single();
  } else {
    result = await supabase
      .from("secret_dynamic_refs")
      .insert({
        secret_id: secretId,
        ref_path,
        source_table,
        source_filter: source_filter || {},
        transform: transform || null,
      })
      .select()
      .single();
  }

  if (result.error) {
    console.error("Set dynamic ref error:", result.error);
    return errorResponse(result.error.message, 500);
  }

  await supabase
    .from("org_secrets")
    .update({ value_type: "dynamic" })
    .eq("id", secretId);

  return successResponse(result.data);
}

async function deleteDynamicRef(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  secretId: string
) {
  const { data: secret } = await supabase
    .from("org_secrets")
    .select("id")
    .eq("id", secretId)
    .eq("org_id", orgId)
    .single();

  if (!secret) {
    return errorResponse("Secret not found", 404);
  }

  const { error } = await supabase
    .from("secret_dynamic_refs")
    .delete()
    .eq("secret_id", secretId);

  if (error) {
    console.error("Delete dynamic ref error:", error);
    return errorResponse(error.message, 500);
  }

  await supabase
    .from("org_secrets")
    .update({ value_type: "static" })
    .eq("id", secretId);

  return successResponse({ deleted: true });
}

async function getUsageLogs(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  secretId?: string,
  pagination?: RequestPayload["pagination"]
) {
  const page = pagination?.page ?? 1;
  const limit = pagination?.limit ?? 50;
  const offset = (page - 1) * limit;

  let query = supabase
    .from("secret_usage_log")
    .select("*", { count: "exact" })
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (secretId) {
    query = query.eq("secret_id", secretId);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error("Get usage logs error:", error);
    return errorResponse(error.message, 500);
  }

  return successResponse({
    logs: data,
    pagination: {
      page,
      limit,
      total: count ?? 0,
      total_pages: Math.ceil((count ?? 0) / limit),
    },
  });
}

async function testSecret(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  userId: string,
  secretId: string
) {
  const revealResult = await revealSecret(supabase, orgId, userId, secretId);
  const revealData = await revealResult.json();

  if (!revealData.success || !revealData.data?.value) {
    return successResponse({
      valid: false,
      message: "Secret has no value or could not be decrypted",
    });
  }

  return successResponse({
    valid: true,
    message: "Secret value exists and can be decrypted",
    length: revealData.data.value.length,
    preview: revealData.data.value.substring(0, 4) + "..." + revealData.data.value.substring(revealData.data.value.length - 4),
  });
}

async function logUsage(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  secretId: string,
  secretKey: string,
  action: string,
  actorType: string,
  actorId?: string
) {
  try {
    let actorName: string | null = null;
    if (actorId && actorType === "user") {
      const { data: user } = await supabase
        .from("users")
        .select("name, email")
        .eq("id", actorId)
        .single();
      actorName = user?.name || user?.email || null;
    }

    await supabase.from("secret_usage_log").insert({
      org_id: orgId,
      secret_id: secretId,
      secret_key: secretKey,
      action,
      actor_type: actorType,
      actor_id: actorId || null,
      actor_name: actorName,
    });
  } catch (error) {
    console.error("Failed to log usage:", error);
  }
}
