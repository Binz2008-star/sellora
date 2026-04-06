import { createHmac, timingSafeEqual } from "node:crypto";
import type { KeyValueRecord } from "../../domain/shared/types.js";
import { createIdempotencyKey } from "../../modules/events/idempotency.js";

export interface KarrioWebhookIngressInput {
  headers: Record<string, string | undefined>;
  rawBody: string;
  secret?: string;
}

export interface NormalizedShippingWebhook {
  provider: "karrio";
  eventType: string;
  idempotencyKey: string;
  providerReference?: string;
  trackingNumber?: string;
  normalizedStatus: string;
  rawPayload: KeyValueRecord;
  receivedAt: string;
}

type KarrioWebhookPayload = {
  id?: string;
  type?: string;
  event?: string;
  created_at?: string;
  data?: {
    id?: string;
    tracking_number?: string;
    status?: string;
    updated_at?: string;
  };
};

function normalizeHeaders(headers: Record<string, string | undefined>) {
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value])
  );
}

function parsePayload(rawBody: string): KeyValueRecord {
  const parsed = JSON.parse(rawBody);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Invalid Karrio webhook payload");
  }

  return parsed as KeyValueRecord;
}

function verifySignature(rawBody: string, signature: string, secret: string) {
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const provided = signature.replace(/^sha256=/i, "");

  if (expected.length !== provided.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(provided, "utf8"));
}

export function normalizeKarrioWebhook(
  input: KarrioWebhookIngressInput
): NormalizedShippingWebhook {
  const headers = normalizeHeaders(input.headers);
  const signature = headers["x-karrio-signature"];

  if (input.secret) {
    if (!signature || !verifySignature(input.rawBody, signature, input.secret)) {
      throw new Error("Invalid Karrio webhook signature");
    }
  }

  const rawPayload = parsePayload(input.rawBody);
  const payload = rawPayload as KarrioWebhookPayload;
  const eventType = payload.type ?? payload.event ?? "karrio.webhook";
  const providerReference = payload.data?.id ?? payload.id;
  const trackingNumber = payload.data?.tracking_number;
  const normalizedStatus = (payload.data?.status ?? "unknown").toLowerCase();
  const occurredAt = payload.data?.updated_at ?? payload.created_at ?? new Date().toISOString();

  return {
    provider: "karrio",
    eventType,
    idempotencyKey: createIdempotencyKey([
      "karrio",
      eventType,
      providerReference ?? "unknown-reference",
      trackingNumber ?? "unknown-tracking",
      normalizedStatus,
      occurredAt
    ]),
    providerReference,
    trackingNumber,
    normalizedStatus,
    rawPayload,
    receivedAt: occurredAt
  };
}
