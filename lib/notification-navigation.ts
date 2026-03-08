import type {
  EmployeeNotificationActionType,
  EmployeeNotificationItem,
} from "@/types/notifications";

export function buildNotificationActionHref(
  actionType: EmployeeNotificationActionType,
  actionPayload?: EmployeeNotificationItem["actionPayload"],
) {
  if (actionType === "open_scan") {
    return "/scan";
  }

  if (actionType === "open_history") {
    return "/scan/history";
  }

  if (actionType === "open_history_day") {
    if (actionPayload?.dateKey) {
      return `/scan/history?dateKey=${encodeURIComponent(actionPayload.dateKey)}`;
    }
    return "/scan/history";
  }

  return null;
}
