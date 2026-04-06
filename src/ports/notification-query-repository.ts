import type { NotificationLog } from "../domain/notifications/notification.js";

export interface NotificationListFilters {
  sellerId: string;
  status?: NotificationLog["status"];
  acknowledged?: boolean;
}

export interface OperatorNotificationSummary extends NotificationLog {
  orderNumber: string;
}

export interface NotificationQueryRepository {
  listNotifications(filters: NotificationListFilters): Promise<OperatorNotificationSummary[]>;
  getNotificationDetail(notificationId: string): Promise<OperatorNotificationSummary | null>;
}
