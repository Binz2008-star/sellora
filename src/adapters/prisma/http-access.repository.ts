import { prisma } from "../../core/db/prisma.js";
import type { HttpAccessRepository } from "../../ports/http-access-repository.js";

export class PrismaHttpAccessRepository implements HttpAccessRepository {
  async getOrderSellerId(orderId: string): Promise<string | null> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { sellerId: true }
    });

    return order?.sellerId ?? null;
  }

  async getPaymentAttemptSellerId(paymentAttemptId: string): Promise<string | null> {
    const attempt = await prisma.paymentAttempt.findUnique({
      where: { id: paymentAttemptId },
      select: { sellerId: true }
    });

    return attempt?.sellerId ?? null;
  }
}
