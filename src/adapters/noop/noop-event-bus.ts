import type { EventEnvelope } from "../../domain/events/event-envelope.js";
import type { EventBus } from "../../ports/event-bus.js";

export class NoopEventBus implements EventBus {
  async publish(_event: EventEnvelope): Promise<void> {
    return;
  }
}
