export type EmployeeNotificationType =
  | "attendance_success"
  | "attendance_failure"
  | "attendance_reminder"
  | "workspace_announcement";

export type EmployeeNotificationSeverity =
  | "info"
  | "success"
  | "warning"
  | "critical";

export type EmployeeNotificationActionType =
  | "open_scan"
  | "open_history"
  | "open_history_day"
  | "none";

export type EmployeeNotificationItem = {
  notificationId: string;
  workspaceId: string;
  userId: string;
  type: EmployeeNotificationType;
  title: string;
  description: string;
  severity: EmployeeNotificationSeverity;
  createdAt: number;
  readAt?: number;
  actionType: EmployeeNotificationActionType;
  actionPayload?: {
    dateKey?: string;
  };
  sourceKey: string;
  expiresAt?: number;
  metadata?: {
    attendanceStatus?: "check-in" | "check-out";
    reasonCode?: string;
  };
};

export type EmployeeNotificationsPayload = {
  items: EmployeeNotificationItem[];
  pageInfo: {
    continueCursor: string;
    isDone: boolean;
  };
  unreadCount: number;
};

export type EmployeeNotificationReadPayload = {
  unreadCount: number;
  readAt: number;
};
