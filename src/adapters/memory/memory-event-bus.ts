import type { EventEnvelope } from "../../domain/events/event-envelope.js";
import type { EventBus } from "../../ports/event-bus.js";

export class MemoryEventBus implements EventBus {
  readonly events: EventEnvelope[] = [];

  async publish(event: EventEnvelope): Promise<void> {
    this.events.push(event);
  }
}
