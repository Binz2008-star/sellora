export interface HttpAccessRepository {
  getOrderSellerId(orderId: string): Promise<string | null>;
  getPaymentAttemptSellerId(paymentAttemptId: string): Promise<string | null>;
  getNotificationSellerId(notificationId: string): Promise<string | null>;
}
