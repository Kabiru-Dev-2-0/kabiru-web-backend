import type { ZodError } from 'zod';
import type { ApiErrorDetail } from './errors';

export function getJsonByteLength(value: unknown): number {
  const serialized = JSON.stringify(value);
  if (!serialized) return 0;
  return encodeURIComponent(serialized).replace(/%[A-F\d]{2}/g, 'U').length;
}

export function isWithinJsonByteLimit(value: unknown, maxBytes: number): boolean {
  return getJsonByteLength(value) <= maxBytes;
}

export function formatZodError(error: ZodError): ApiErrorDetail[] {
  return error.issues.map((issue) => ({
    field: issue.path.length > 0 ? issue.path.join('.') : 'body',
    reason: issue.message,
  }));
}