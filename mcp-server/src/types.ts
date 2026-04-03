export interface ApiResponse<T = unknown> {
  data: T | null;
  error: ApiError | null;
  count?: number;
}

export interface ApiError {
  code: string;
  message: string;
  details?: string;
  hint?: string;
}

export interface EdgeFunctionResponse<T = unknown> {
  success?: boolean;
  error?: string;
  data?: T;
  [key: string]: unknown;
}

export interface PaginationParams {
  limit?: number;
  offset?: number;
}

export interface RestQueryParams {
  select?: string;
  filters?: Record<string, string>;
  order?: string;
  limit?: number;
  offset?: number;
  prefer?: string;
  accept?: string;
}
