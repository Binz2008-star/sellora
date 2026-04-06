import { HttpError } from "./errors.js";
import type { HttpAccessRepository } from "../../ports/http-access-repository.js";

export interface OperatorAuthContext {
  sellerId: string;
}

export function requireOperatorAuth(
  request: Request,
  operatorApiToken?: string
): OperatorAuthContext {
  if (!operatorApiToken) {
    throw new HttpError(503, "operator_auth_unconfigured", "Operator API token is not configured");
  }

  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    throw new HttpError(401, "unauthorized", "Missing bearer token");
  }

  const token = authorization.slice("Bearer ".length).trim();
  if (token !== operatorApiToken) {
    throw new HttpError(401, "unauthorized", "Invalid bearer token");
  }

  const sellerId = request.headers.get("x-sellora-seller-id")?.trim();
  if (!sellerId) {
    throw new HttpError(400, "seller_id_required", "x-sellora-seller-id header is required");
  }

  return { sellerId };
}

export async function authorizeOrderAccess(
  accessRepository: HttpAccessRepository,
  sellerId: string,
  orderId: string
): Promise<void> {
  const ownerSellerId = await accessRepository.getOrderSellerId(orderId);
  if (!ownerSellerId) {
    throw new HttpError(404, "not_found", `Order not found: ${orderId}`);
  }

  if (ownerSellerId !== sellerId) {
    throw new HttpError(403, "forbidden", `Order ${orderId} does not belong to seller ${sellerId}`);
  }
}

export async function authorizePaymentAttemptAccess(
  accessRepository: HttpAccessRepository,
  sellerId: string,
  paymentAttemptId: string
): Promise<void> {
  const ownerSellerId = await accessRepository.getPaymentAttemptSellerId(paymentAttemptId);
  if (!ownerSellerId) {
    throw new HttpError(404, "not_found", `Payment attempt not found: ${paymentAttemptId}`);
  }

  if (ownerSellerId !== sellerId) {
    throw new HttpError(403, "forbidden", `Payment attempt ${paymentAttemptId} does not belong to seller ${sellerId}`);
  }
}

export async function authorizeNotificationAccess(
  accessRepository: HttpAccessRepository,
  sellerId: string,
  notificationId: string
): Promise<void> {
  const ownerSellerId = await accessRepository.getNotificationSellerId(notificationId);
  if (!ownerSellerId) {
    throw new HttpError(404, "not_found", `Notification not found: ${notificationId}`);
  }

  if (ownerSellerId !== sellerId) {
    throw new HttpError(
      403,
      "forbidden",
      `Notification ${notificationId} does not belong to seller ${sellerId}`
    );
  }
}
