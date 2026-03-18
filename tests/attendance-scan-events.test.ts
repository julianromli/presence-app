import { beforeEach, describe, expect, it, vi } from "vitest";

const requireWorkspaceRole = vi.fn();

vi.mock("../convex/_generated/server", () => ({
  internalMutation: (config: unknown) => config,
  internalQuery: (config: unknown) => config,
  mutation: (config: unknown) => config,
  query: (config: unknown) => config,
}));

vi.mock("../convex/helpers", () => ({
  requireWorkspaceRole,
}));

describe("attendance scan event queries", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    requireWorkspaceRole.mockResolvedValue({
      user: { _id: "user_admin" },
      membership: { role: "admin" },
    });
  });

  it("summarizes all matching scan events even when the rendered rows are limited", async () => {
    const { listScanEventsByDate } = await import("../convex/attendance");
    const baseRows = Array.from({ length: 620 }, (_, index) => ({
      _id: `scan_${index}`,
      _creationTime: index,
      workspaceId: "workspace_123456",
      actorUserId: "user_1",
      dateKey: "2026-03-05",
      resultStatus: index % 3 === 0 ? "rejected" : "accepted",
      reasonCode: index % 3 === 0 ? "TOKEN_EXPIRED" : "OK",
      attendanceStatus: index % 2 === 0 ? "check-in" : "check-out",
      message: undefined,
      ipAddress: undefined,
      latitude: undefined,
      longitude: undefined,
      accuracyMeters: undefined,
      idempotencyKey: `key_${index}`,
      scannedAt: 1_700_000_000_000 + index,
      createdAt: 1_700_000_000_000 + index,
    }));
    const ctx = {
      db: {
        get: vi.fn(async () => ({ name: "Ali", email: "ali@example.com" })),
        query: vi.fn(() => ({
          withIndex: vi.fn(() => ({
            order: vi.fn(() => ({
              take: vi.fn(async (limit: number) => baseRows.slice(0, limit)),
              collect: vi.fn(async () => baseRows),
            })),
          })),
        })),
      },
    };

    const result = await listScanEventsByDate.handler(ctx as never, {
      dateKey: "2026-03-05",
      workspaceId: "workspace_123456" as never,
      limit: 50,
      status: undefined,
    });

    expect(result.rows).toHaveLength(50);
    expect(result.summary.total).toBe(620);
    expect(result.summary.accepted).toBe(413);
    expect(result.summary.rejected).toBe(207);
    expect(result.summary.byReason).toEqual([
      { reasonCode: "OK", count: 413 },
      { reasonCode: "TOKEN_EXPIRED", count: 207 },
    ]);
  });
});
