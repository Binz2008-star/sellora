export function createIdempotencyKey(parts: string[]): string {
  return parts.map((part) => part.trim()).join(":");
}
