import type { EntityId, ISODateString, KeyValueRecord } from "../shared/types.js";

export interface EventEnvelope {
  id: EntityId;
  aggregateType: string;
  aggregateId: EntityId;
  eventType: string;
  occurredAt: ISODateString;
  idempotencyKey: string;
  payload: KeyValueRecord;
}
