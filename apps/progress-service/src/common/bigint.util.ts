export function serializeBigInt<T = any>(value: T): any {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (value instanceof Date) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(serializeBigInt);
  }
  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      result[k] = serializeBigInt(v);
    }
    return result as any;
  }
  return value;
}
