import { supabase } from '../lib/supabase';

export interface Secret {
  id: string;
  org_id: string;
  category_id: string | null;
  name: string;
  key: string;
  value_type: 'static' | 'dynamic' | 'rotating';
  description: string | null;
  metadata: Record<string, unknown>;
  is_system: boolean;
  last_used_at: string | null;
  expires_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  secret_categories?: SecretCategory | null;
  secret_dynamic_refs?: DynamicRef[];
}

export interface SecretCategory {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  icon: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface DynamicRef {
  id: string;
  secret_id: string;
  ref_path: string;
  source_table: string;
  source_filter: Record<string, unknown>;
  transform: string | null;
  created_at: string;
  updated_at: string;
}

export interface SecretUsageLog {
  id: string;
  org_id: string;
  secret_id: string | null;
  secret_key: string | null;
  action: 'read' | 'write' | 'rotate' | 'delete' | 'create' | 'scan';
  actor_type: 'user' | 'system' | 'edge_function' | 'workflow';
  actor_id: string | null;
  actor_name: string | null;
  ip_address: string | null;
  user_agent: string | null;
  context: Record<string, unknown>;
  created_at: string;
}

export interface SecretFilters {
  category_id?: string;
  search?: string;
  value_type?: string;
  include_expired?: boolean;
}

export interface CreateSecretInput {
  name: string;
  key: string;
  value?: string;
  category_id?: string;
  value_type?: 'static' | 'dynamic' | 'rotating';
  description?: string;
  metadata?: Record<string, unknown>;
  expires_at?: string;
}

export interface UpdateSecretInput {
  name?: string;
  key?: string;
  value?: string;
  category_id?: string | null;
  value_type?: 'static' | 'dynamic' | 'rotating';
  description?: string | null;
  metadata?: Record<string, unknown>;
  expires_at?: string | null;
}

export interface CreateCategoryInput {
  name: string;
  description?: string;
  icon?: string;
  sort_order?: number;
}

export interface UpdateCategoryInput {
  name?: string;
  description?: string | null;
  icon?: string;
  sort_order?: number;
}

export interface DynamicRefInput {
  ref_path: string;
  source_table: string;
  source_filter?: Record<string, unknown>;
  transform?: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

async function callSecretsApi<T>(
  action: string,
  orgId: string,
  params: Record<string, unknown> = {}
): Promise<T> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;

  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/secrets-api`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action,
        org_id: orgId,
        ...params,
      }),
    }
  );

  const result: ApiResponse<T> = await response.json();

  if (!result.success) {
    throw new Error(result.error || 'Unknown error');
  }

  return result.data as T;
}

export async function getSecrets(
  orgId: string,
  filters?: SecretFilters,
  pagination?: PaginationParams
): Promise<PaginatedResponse<Secret>> {
  const result = await callSecretsApi<{ secrets: Secret[]; pagination: PaginatedResponse<Secret>['pagination'] }>(
    'list',
    orgId,
    { filters, pagination }
  );

  return {
    data: result.secrets,
    pagination: result.pagination,
  };
}

export async function getSecretById(
  orgId: string,
  secretId: string
): Promise<Secret> {
  return callSecretsApi<Secret>('get', orgId, { secret_id: secretId });
}

export async function createSecret(
  orgId: string,
  input: CreateSecretInput
): Promise<Secret> {
  return callSecretsApi<Secret>('create', orgId, { data: input });
}

export async function updateSecret(
  orgId: string,
  secretId: string,
  input: UpdateSecretInput
): Promise<Secret> {
  return callSecretsApi<Secret>('update', orgId, {
    secret_id: secretId,
    data: input,
  });
}

export async function deleteSecret(orgId: string, secretId: string): Promise<void> {
  await callSecretsApi<{ deleted: boolean }>('delete', orgId, { secret_id: secretId });
}

export async function revealSecretValue(
  orgId: string,
  secretId: string
): Promise<{ value: string | null; is_dynamic?: boolean }> {
  return callSecretsApi<{ value: string | null; is_dynamic?: boolean }>('reveal', orgId, {
    secret_id: secretId,
  });
}

export async function testSecret(
  orgId: string,
  secretId: string
): Promise<{ valid: boolean; message: string; length?: number; preview?: string }> {
  return callSecretsApi<{ valid: boolean; message: string; length?: number; preview?: string }>(
    'test-secret',
    orgId,
    { secret_id: secretId }
  );
}

export async function getCategories(orgId: string): Promise<SecretCategory[]> {
  return callSecretsApi<SecretCategory[]>('list-categories', orgId);
}

export async function createCategory(
  orgId: string,
  input: CreateCategoryInput
): Promise<SecretCategory> {
  return callSecretsApi<SecretCategory>('create-category', orgId, { data: input });
}

export async function updateCategory(
  orgId: string,
  categoryId: string,
  input: UpdateCategoryInput
): Promise<SecretCategory> {
  return callSecretsApi<SecretCategory>('update-category', orgId, {
    category_id: categoryId,
    data: input,
  });
}

export async function deleteCategory(orgId: string, categoryId: string): Promise<void> {
  await callSecretsApi<{ deleted: boolean }>('delete-category', orgId, {
    category_id: categoryId,
  });
}

export async function getDynamicRef(
  orgId: string,
  secretId: string
): Promise<DynamicRef | null> {
  return callSecretsApi<DynamicRef | null>('get-dynamic-ref', orgId, {
    secret_id: secretId,
  });
}

export async function setDynamicRef(
  orgId: string,
  secretId: string,
  input: DynamicRefInput
): Promise<DynamicRef> {
  return callSecretsApi<DynamicRef>('set-dynamic-ref', orgId, {
    secret_id: secretId,
    data: input,
  });
}

export async function deleteDynamicRef(orgId: string, secretId: string): Promise<void> {
  await callSecretsApi<{ deleted: boolean }>('delete-dynamic-ref', orgId, {
    secret_id: secretId,
  });
}

export async function getUsageLogs(
  orgId: string,
  secretId?: string,
  pagination?: PaginationParams
): Promise<PaginatedResponse<SecretUsageLog>> {
  const result = await callSecretsApi<{ logs: SecretUsageLog[]; pagination: PaginatedResponse<SecretUsageLog>['pagination'] }>(
    'get-usage-logs',
    orgId,
    { secret_id: secretId, pagination }
  );

  return {
    data: result.logs,
    pagination: result.pagination,
  };
}

export async function runSecretsScan(
  orgId?: string,
  notifyAdmins: boolean = false
): Promise<{
  scanned_at: string;
  organizations_scanned: number;
  organizations_with_alerts: number;
  results: Array<{
    org_id: string;
    org_name: string;
    expiring_soon: Array<{ id: string; key: string; name: string; days_until_expiry: number }>;
    expired: Array<{ id: string; key: string; name: string }>;
    unused: Array<{ id: string; key: string; name: string; days_since_last_use: number }>;
    no_value: Array<{ id: string; key: string; name: string }>;
  }>;
}> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/secrets-scanner`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        org_id: orgId,
        notify_admins: notifyAdmins,
      }),
    }
  );

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error || 'Scan failed');
  }

  return result.data;
}

export function formatSecretKey(key: string): string {
  return key.toUpperCase().replace(/[^A-Z0-9_]/g, '_');
}

export function maskSecretValue(value: string, showChars: number = 4): string {
  if (value.length <= showChars * 2) {
    return '*'.repeat(value.length);
  }
  return value.substring(0, showChars) + '*'.repeat(Math.max(value.length - showChars * 2, 4)) + value.substring(value.length - showChars);
}

export function isSecretExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt) < new Date();
}

export function isSecretExpiringSoon(expiresAt: string | null, days: number = 14): boolean {
  if (!expiresAt) return false;
  const expiryDate = new Date(expiresAt);
  const warningDate = new Date();
  warningDate.setDate(warningDate.getDate() + days);
  return expiryDate <= warningDate && expiryDate > new Date();
}

export function getDaysUntilExpiry(expiresAt: string | null): number | null {
  if (!expiresAt) return null;
  const now = new Date();
  const expiry = new Date(expiresAt);
  return Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}
