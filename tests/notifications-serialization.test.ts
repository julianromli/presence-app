import { describe, expect, it } from "vitest";

import { serializeNotification } from "../convex/notifications";

describe("serializeNotification", () => {
  it("omits optional keys when their values are undefined", () => {
    const serialized = serializeNotification({
      _id: "jn7f7k3s6j0k9w0x5m1r3p2n4d7f8g9h" as never,
      workspaceId: "jg7f7k3s6j0k9w0x5m1r3p2n4d7f8g9h" as never,
      userId: "ju7f7k3s6j0k9w0x5m1r3p2n4d7f8g9h" as never,
      type: "attendance_success",
      title: "Check-in berhasil",
      description: "Anda berhasil scan.",
      severity: "success",
      createdAt: 1,
      actionType: "open_history_day",
      sourceKey: "attendance_success:2026-03-08:check-in:user_1",
      readAt: undefined,
      actionPayload: undefined,
      expiresAt: undefined,
      metadata: undefined,
    });

    expect(serialized).toMatchObject({
      notificationId: "jn7f7k3s6j0k9w0x5m1r3p2n4d7f8g9h",
      workspaceId: "jg7f7k3s6j0k9w0x5m1r3p2n4d7f8g9h",
      userId: "ju7f7k3s6j0k9w0x5m1r3p2n4d7f8g9h",
      type: "attendance_success",
      title: "Check-in berhasil",
      description: "Anda berhasil scan.",
      severity: "success",
      createdAt: 1,
      actionType: "open_history_day",
      sourceKey: "attendance_success:2026-03-08:check-in:user_1",
    });
    expect(serialized).not.toHaveProperty("readAt");
    expect(serialized).not.toHaveProperty("actionPayload");
    expect(serialized).not.toHaveProperty("expiresAt");
    expect(serialized).not.toHaveProperty("metadata");
  });
});
