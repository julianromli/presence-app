import { describe, expect, it } from "vitest";

import {
  buildCheckoutReminderSourceKey,
  buildWorkspaceScopedSourceKey,
} from "../convex/notifications";
import { buildNotificationActionHref } from "../lib/notification-navigation";

describe("notification helpers", () => {
  it("scopes dedupe keys by workspace to avoid cross-workspace collisions", () => {
    const sourceKey = buildCheckoutReminderSourceKey("2026-03-08", "user_123");

    expect(buildWorkspaceScopedSourceKey("workspace_a", sourceKey)).toBe(
      "workspace_a:attendance_reminder:checkout:2026-03-08:user_123",
    );
    expect(buildWorkspaceScopedSourceKey("workspace_b", sourceKey)).toBe(
      "workspace_b:attendance_reminder:checkout:2026-03-08:user_123",
    );
    expect(buildWorkspaceScopedSourceKey("workspace_a", sourceKey)).not.toBe(
      buildWorkspaceScopedSourceKey("workspace_b", sourceKey),
    );
  });

  it("preserves dateKey when building history-day notification hrefs", () => {
    expect(
      buildNotificationActionHref("open_history_day", { dateKey: "2026-03-08" }),
    ).toBe("/scan/history?dateKey=2026-03-08");
    expect(buildNotificationActionHref("open_history_day", {})).toBe(
      "/scan/history",
    );
    expect(buildNotificationActionHref("open_scan")).toBe("/scan");
  });
});
