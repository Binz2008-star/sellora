import type { HandleShippingWebhookResult } from "./handle-shipping-webhook.service.js";
import type { HandleShippingWebhookService } from "./handle-shipping-webhook.service.js";
import {
  normalizeKarrioWebhook,
  type KarrioWebhookIngressInput
} from "../../adapters/karrio/karrio-webhook-ingress.js";

export async function handleKarrioWebhookRequest(
  service: Pick<HandleShippingWebhookService, "execute">,
  input: KarrioWebhookIngressInput
): Promise<HandleShippingWebhookResult> {
  const webhook = normalizeKarrioWebhook(input);
  return service.execute(webhook);
}
