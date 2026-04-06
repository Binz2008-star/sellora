export function logHttpEvent(
  level: "info" | "error",
  event: string,
  metadata: Record<string, unknown>
): void {
  const payload = {
    level,
    event,
    ...metadata,
    timestamp: new Date().toISOString()
  };

  if (level === "error") {
    console.error(JSON.stringify(payload));
    return;
  }

  console.info(JSON.stringify(payload));
}
