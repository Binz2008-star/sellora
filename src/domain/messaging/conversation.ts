import type { AuditStamp, EntityId } from "../shared/types.js";

export type ConversationChannel = "whatsapp" | "instagram" | "web_chat" | "email" | "phone";
export type ConversationStatus = "open" | "pending" | "resolved" | "archived";

export interface ConversationThread extends AuditStamp {
  id: EntityId;
  sellerId: EntityId;
  customerId?: EntityId;
  channel: ConversationChannel;
  status: ConversationStatus;
  externalThreadId?: string;
  locale: string;
  lastMessageAt?: string;
}

export interface ConversationMessage {
  id: EntityId;
  threadId: EntityId;
  senderType: "customer" | "agent" | "system";
  body: string;
  sentAt: string;
}
