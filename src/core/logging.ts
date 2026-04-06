export type LogLevel = "info" | "error";

export function logOperationalEvent(
  level: LogLevel,
  event: string,
  metadata: Record<string, unknown>
): void {
  const payload = {
    level,
    event,
    ...metadata,
    timestamp: new Date().toISOString()
  };

  const serialized = JSON.stringify(payload);

  if (level === "error") {
    console.error(serialized);
    return;
  }

  console.info(serialized);
}
