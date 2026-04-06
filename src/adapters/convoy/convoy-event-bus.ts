import type { EventEnvelope } from "../../domain/events/event-envelope.js";
import type { EventBus } from "../../ports/event-bus.js";

export interface ConvoyEventBusOptions {
  endpoint: string;
}

export class ConvoyEventBus implements EventBus {
  constructor(private readonly options: ConvoyEventBusOptions) {}

  async publish(event: EventEnvelope): Promise<void> {
    void event;
    void this.options;
    throw new Error("ConvoyEventBus is not wired yet");
  }
}
