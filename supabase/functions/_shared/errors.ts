import { corsHeaders, errorResponse } from "./cors.ts";
import { AuthError } from "./auth.ts";
import { PermissionError } from "./permissions.ts";

export class ValidationError extends Error {
  code: string;
  field?: string;

  constructor(message: string, field?: string) {
    super(message);
    this.code = "VALIDATION_ERROR";
    this.field = field;
    this.name = "ValidationError";
  }
}

export class NotFoundError extends Error {
  code: string;
  entityType: string;
  entityId?: string;

  constructor(entityType: string, entityId?: string) {
    super(`${entityType} not found${entityId ? `: ${entityId}` : ""}`);
    this.code = "NOT_FOUND";
    this.entityType = entityType;
    this.entityId = entityId;
    this.name = "NotFoundError";
  }
}

export class ConflictError extends Error {
  code: string;

  constructor(message: string) {
    super(message);
    this.code = "CONFLICT";
    this.name = "ConflictError";
  }
}

export class RateLimitError extends Error {
  code: string;
  retryAfter: number;

  constructor(retryAfter: number) {
    super(`Rate limit exceeded. Retry after ${retryAfter} seconds.`);
    this.code = "RATE_LIMIT_EXCEEDED";
    this.retryAfter = retryAfter;
    this.name = "RateLimitError";
  }
}

export function handleError(error: unknown): Response {
  console.error("Edge Function error:", error);

  if (error instanceof AuthError) {
    return errorResponse(error.code, error.message, 401);
  }

  if (error instanceof PermissionError) {
    return errorResponse(
      error.code,
      error.message,
      403,
      { requiredPermissions: error.requiredPermissions }
    );
  }

  if (error instanceof ValidationError) {
    return errorResponse(
      error.code,
      error.message,
      400,
      error.field ? { field: error.field } : undefined
    );
  }

  if (error instanceof NotFoundError) {
    return errorResponse(
      error.code,
      error.message,
      404,
      { entityType: error.entityType, entityId: error.entityId }
    );
  }

  if (error instanceof ConflictError) {
    return errorResponse(error.code, error.message, 409);
  }

  if (error instanceof RateLimitError) {
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: error.code, message: error.message },
      }),
      {
        status: 429,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Retry-After": String(error.retryAfter),
        },
      }
    );
  }

  const message = error instanceof Error ? error.message : "An unexpected error occurred";
  return errorResponse("INTERNAL_ERROR", message, 500);
}
