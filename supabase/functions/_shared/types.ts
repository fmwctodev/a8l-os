export interface UserContext {
  id: string;
  email: string;
  /** Active org — honors SuperAdmin's super_admin_active_org_id pivot. */
  orgId: string;
  /** User's home org. Equals orgId for non-pivoted users. */
  homeOrgId?: string;
  roleId: string;
  roleName: string;
  departmentId: string | null;
  isSuperAdmin: boolean;
  permissions: string[];
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ErrorResponse;
}

export interface ErrorResponse {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface AuditLogEntry {
  orgId: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  oldData?: Record<string, unknown>;
  newData?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export type PermissionCheck =
  | { type: 'single'; permission: string }
  | { type: 'any'; permissions: string[] }
  | { type: 'all'; permissions: string[] };

export interface EntityOwnershipCheck {
  entityType: string;
  entityId: string;
  ownerField?: string;
}
