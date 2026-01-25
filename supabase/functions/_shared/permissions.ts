import { SupabaseClient } from "npm:@supabase/supabase-js@2";
import type { UserContext, PermissionCheck, EntityOwnershipCheck } from "./types.ts";

export class PermissionError extends Error {
  code: string;
  requiredPermissions: string[];

  constructor(message: string, requiredPermissions: string[] = []) {
    super(message);
    this.code = "PERMISSION_DENIED";
    this.requiredPermissions = requiredPermissions;
    this.name = "PermissionError";
  }
}

export function hasPermission(user: UserContext, permission: string): boolean {
  if (user.isSuperAdmin) {
    return true;
  }
  return user.permissions.includes(permission);
}

export function hasAnyPermission(user: UserContext, permissions: string[]): boolean {
  if (user.isSuperAdmin) {
    return true;
  }
  return permissions.some(p => user.permissions.includes(p));
}

export function hasAllPermissions(user: UserContext, permissions: string[]): boolean {
  if (user.isSuperAdmin) {
    return true;
  }
  return permissions.every(p => user.permissions.includes(p));
}

export function requirePermission(user: UserContext, permission: string): void {
  if (!hasPermission(user, permission)) {
    throw new PermissionError(
      `Permission denied: ${permission} required`,
      [permission]
    );
  }
}

export function requireAnyPermission(user: UserContext, permissions: string[]): void {
  if (!hasAnyPermission(user, permissions)) {
    throw new PermissionError(
      `Permission denied: one of [${permissions.join(", ")}] required`,
      permissions
    );
  }
}

export function requireAllPermissions(user: UserContext, permissions: string[]): void {
  if (!hasAllPermissions(user, permissions)) {
    const missing = permissions.filter(p => !user.permissions.includes(p));
    throw new PermissionError(
      `Permission denied: missing [${missing.join(", ")}]`,
      missing
    );
  }
}

export function checkPermission(user: UserContext, check: PermissionCheck): boolean {
  switch (check.type) {
    case 'single':
      return hasPermission(user, check.permission);
    case 'any':
      return hasAnyPermission(user, check.permissions);
    case 'all':
      return hasAllPermissions(user, check.permissions);
  }
}

export function requirePermissionCheck(user: UserContext, check: PermissionCheck): void {
  switch (check.type) {
    case 'single':
      requirePermission(user, check.permission);
      break;
    case 'any':
      requireAnyPermission(user, check.permissions);
      break;
    case 'all':
      requireAllPermissions(user, check.permissions);
      break;
  }
}

export async function checkEntityOwnership(
  supabase: SupabaseClient,
  user: UserContext,
  check: EntityOwnershipCheck
): Promise<boolean> {
  if (user.isSuperAdmin) {
    return true;
  }

  const ownerField = check.ownerField || "owner_id";
  const tableMap: Record<string, string> = {
    contact: "contacts",
    opportunity: "opportunities",
    appointment: "appointments",
    conversation: "conversations",
    invoice: "invoices",
    proposal: "proposals",
    workflow: "workflows",
    form: "forms",
    survey: "surveys",
  };

  const tableName = tableMap[check.entityType.toLowerCase()];
  if (!tableName) {
    return false;
  }

  const { data, error } = await supabase
    .from(tableName)
    .select(`id, org_id, ${ownerField}`)
    .eq("id", check.entityId)
    .eq("org_id", user.orgId)
    .maybeSingle();

  if (error || !data) {
    return false;
  }

  return data[ownerField] === user.id;
}

export async function requireEntityOwnership(
  supabase: SupabaseClient,
  user: UserContext,
  check: EntityOwnershipCheck
): Promise<void> {
  const isOwner = await checkEntityOwnership(supabase, user, check);
  if (!isOwner) {
    throw new PermissionError(
      `You do not have access to this ${check.entityType}`,
      []
    );
  }
}

export async function checkDepartmentAccess(
  supabase: SupabaseClient,
  user: UserContext,
  entityType: string,
  entityId: string
): Promise<boolean> {
  if (user.isSuperAdmin) {
    return true;
  }

  if (!user.departmentId) {
    return false;
  }

  const tableMap: Record<string, { table: string; deptField: string }> = {
    contact: { table: "contacts", deptField: "department_id" },
    user: { table: "users", deptField: "department_id" },
    opportunity: { table: "opportunities", deptField: "department_id" },
  };

  const mapping = tableMap[entityType.toLowerCase()];
  if (!mapping) {
    return true;
  }

  const { data, error } = await supabase
    .from(mapping.table)
    .select(`id, org_id, ${mapping.deptField}`)
    .eq("id", entityId)
    .eq("org_id", user.orgId)
    .maybeSingle();

  if (error || !data) {
    return false;
  }

  if (!data[mapping.deptField]) {
    return true;
  }

  return data[mapping.deptField] === user.departmentId;
}

export function canAccessResource(
  user: UserContext,
  viewAllPermission: string,
  viewOwnPermission: string,
  isOwner: boolean
): boolean {
  if (user.isSuperAdmin) {
    return true;
  }

  if (hasPermission(user, viewAllPermission)) {
    return true;
  }

  if (hasPermission(user, viewOwnPermission) && isOwner) {
    return true;
  }

  return false;
}
