import type { EventEnvelope } from "../domain/events/event-envelope.js";

export interface EventBus {
  publish(event: EventEnvelope): Promise<void>;
}
