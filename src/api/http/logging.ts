import { logOperationalEvent } from "../../core/logging.js";

export function logHttpEvent(
  level: "info" | "error",
  event: string,
  metadata: Record<string, unknown>
): void {
  logOperationalEvent(level, event, metadata);
}
