export interface HttpAccessRepository {
  getOrderSellerId(orderId: string): Promise<string | null>;
  getPaymentAttemptSellerId(paymentAttemptId: string): Promise<string | null>;
}
