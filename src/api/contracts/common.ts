export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  field?: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export interface SortParams {
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface DateRangeParams {
  startDate?: string;
  endDate?: string;
}

export interface SearchParams {
  search?: string;
  searchFields?: string[];
}

export interface FilterParams {
  filters?: Record<string, unknown>;
}

export interface ListQueryParams extends PaginationParams, SortParams, SearchParams, FilterParams {}

export interface BulkOperationResult {
  success: boolean;
  totalRequested: number;
  totalProcessed: number;
  totalFailed: number;
  errors?: Array<{
    id: string;
    error: string;
  }>;
}

export interface EntityRef {
  id: string;
  name?: string;
  type?: string;
}

export interface AuditInfo {
  createdAt: string;
  createdBy?: EntityRef;
  updatedAt?: string;
  updatedBy?: EntityRef;
}

export const ErrorCodes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  BAD_REQUEST: 'BAD_REQUEST',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

export function createSuccessResponse<T>(data: T): ApiResponse<T> {
  return {
    success: true,
    data,
  };
}

export function createErrorResponse(
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>,
  field?: string
): ApiResponse<never> {
  return {
    success: false,
    error: {
      code,
      message,
      details,
      field,
    },
  };
}

export function createPaginatedResponse<T>(
  items: T[],
  total: number,
  page: number,
  limit: number
): PaginatedResponse<T> {
  const totalPages = Math.ceil(total / limit);
  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasMore: page < totalPages,
    },
  };
}
