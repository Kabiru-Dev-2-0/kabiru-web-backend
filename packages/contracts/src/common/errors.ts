export const ERROR_CODES = [
  'VALIDATION_ERROR',
  'UNAUTHENTICATED',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'PAYLOAD_TOO_LARGE',
  'RATE_LIMITED',
  'DEPENDENCY_TIMEOUT',
  'DEPENDENCY_UNAVAILABLE',
  'UPSTREAM_TIMEOUT',
  'INTERNAL_ERROR',
  'AUTH_EMAIL_TAKEN',
  'AUTH_INVALID_CREDENTIALS',
  'AUTH_INVALID_TOKEN',
  'USER_PROFILE_NOT_FOUND',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export type ServiceErrorHttpStatus = 400 | 401 | 403 | 404 | 409 | 413 | 422 | 429 | 500 | 504;

export interface ApiErrorDetail {
  field: string;
  reason: string;
}

export interface ApiErrorResponse {
  error: {
    code: ErrorCode;
    message: string;
    details?: ApiErrorDetail[];
  };
  meta: {
    requestId: string;
  };
}

export interface ServiceErrorPayload {
  code: ErrorCode;
  httpStatus: ServiceErrorHttpStatus;
  message: string;
  details?: ApiErrorDetail[];
}

export function createServiceError(payload: ServiceErrorPayload): ServiceErrorPayload {
  return payload;
}

export function isServiceErrorPayload(value: unknown): value is ServiceErrorPayload {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.code === 'string' &&
    typeof candidate.httpStatus === 'number' &&
    typeof candidate.message === 'string'
  );
}