export function normalizeToUtcDate(date?: Date | string | null): Date {
  const d = date ? new Date(date) : new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function getDaysDifference(dateA: Date, dateB: Date): number {
  const utcA = normalizeToUtcDate(dateA).getTime();
  const utcB = normalizeToUtcDate(dateB).getTime();
  const diffMs = utcB - utcA;
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}
