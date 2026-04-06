import { createHmac, timingSafeEqual } from "node:crypto";
import { HttpError } from "./errors.js";

export function requireHmacWebhookSignature(
  rawBody: string,
  signature: string | null,
  secret: string | undefined,
  headerName: string
): void {
  if (!secret) {
    throw new HttpError(503, "webhook_unconfigured", `${headerName} secret is not configured`);
  }

  if (!signature) {
    throw new HttpError(401, "invalid_signature", `Missing ${headerName} header`);
  }

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const provided = signature.replace(/^sha256=/i, "");

  if (expected.length !== provided.length) {
    throw new HttpError(401, "invalid_signature", "Webhook signature mismatch");
  }

  if (!timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(provided, "utf8"))) {
    throw new HttpError(401, "invalid_signature", "Webhook signature mismatch");
  }
}
