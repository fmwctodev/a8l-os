import { SupabaseClient } from "npm:@supabase/supabase-js@2";
import type { UserContext, AuditLogEntry } from "./types.ts";

export async function createAuditLog(
  supabase: SupabaseClient,
  entry: AuditLogEntry
): Promise<void> {
  try {
    await supabase.from("activity_log").insert({
      org_id: entry.orgId,
      user_id: entry.userId,
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId,
      old_data: entry.oldData || null,
      new_data: entry.newData || null,
      metadata: entry.metadata || null,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Failed to create audit log:", error);
  }
}

export async function auditAction(
  supabase: SupabaseClient,
  user: UserContext,
  action: string,
  entityType: string,
  entityId: string,
  options?: {
    oldData?: Record<string, unknown>;
    newData?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  await createAuditLog(supabase, {
    orgId: user.orgId,
    userId: user.id,
    action,
    entityType,
    entityId,
    oldData: options?.oldData,
    newData: options?.newData,
    metadata: options?.metadata,
  });
}

export function withAudit<T extends (...args: unknown[]) => Promise<unknown>>(
  supabase: SupabaseClient,
  user: UserContext,
  action: string,
  entityType: string,
  getEntityId: (result: unknown) => string,
  fn: T
): T {
  return (async (...args: Parameters<T>) => {
    const result = await fn(...args);
    const entityId = getEntityId(result);

    await auditAction(supabase, user, action, entityType, entityId, {
      metadata: { args: args.length > 0 ? args[0] : undefined },
    });

    return result;
  }) as T;
}

export const AuditActions = {
  CREATE: "create",
  UPDATE: "update",
  DELETE: "delete",
  VIEW: "view",
  EXPORT: "export",
  IMPORT: "import",
  LOGIN: "login",
  LOGOUT: "logout",
  PASSWORD_CHANGE: "password_change",
  PERMISSION_CHANGE: "permission_change",
  SETTINGS_CHANGE: "settings_change",
  INTEGRATION_CONNECT: "integration_connect",
  INTEGRATION_DISCONNECT: "integration_disconnect",
  API_KEY_CREATE: "api_key_create",
  API_KEY_REVOKE: "api_key_revoke",
  WORKFLOW_TRIGGER: "workflow_trigger",
  EMAIL_SEND: "email_send",
  SMS_SEND: "sms_send",
  CALL_INITIATED: "call_initiated",
} as const;
