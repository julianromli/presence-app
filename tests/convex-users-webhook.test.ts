import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../convex/_generated/server", () => ({
  internalMutation: (config: unknown) => config,
  mutation: (config: unknown) => config,
  query: (config: unknown) => config,
}));

vi.mock("../convex/helpers", () => ({
  getCurrentDbUser: vi.fn(),
  requireIdentity: vi.fn(),
  requireRole: vi.fn(),
  requireWorkspaceRole: vi.fn(),
}));

vi.mock("../convex/usersPolicy", () => ({
  isAdminManagedActivationAllowed: vi.fn(() => true),
  isSelfDeactivation: vi.fn(() => false),
}));

vi.mock("../convex/workspaceMembersPolicy", () => ({
  isLastActiveSuperadminTransition: vi.fn(() => false),
}));

vi.mock("../convex/usersList", () => ({
  filterUsers: vi.fn(),
  paginateFilteredRows: vi.fn(),
  summarizeUsers: vi.fn(),
}));

vi.mock("../convex/usersMetrics", () => ({
  buildGlobalUsersMetricsSnapshot: vi.fn(),
  listGlobalUsersMetricsRows: vi.fn(),
  pickCanonicalUsersMetricsRow: vi.fn(),
}));

function createWebhookCtx(options?: {
  existingUser?: Record<string, unknown> | null;
  memberships?: Array<{ _id: string; isActive: boolean }>;
}) {
  const existingUser = options?.existingUser ?? null;
  const memberships = options?.memberships ?? [];
  const insert = vi.fn(async () => "user_new");
  const patch = vi.fn(async () => undefined);

  const db = {
    insert,
    patch,
    query: vi.fn((table: string) => {
      if (table === "users") {
        return {
          withIndex: vi.fn(() => ({
            unique: vi.fn(async () => existingUser),
          })),
        };
      }

      if (table === "workspace_members") {
        return {
          withIndex: vi.fn(() => ({
            collect: vi.fn(async () => memberships),
          })),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
  };

  return {
    ctx: { db },
    mocks: { insert, patch, query: db.query },
  };
}

describe("convex users Clerk webhook mutations", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.CLERK_SYNC_SHARED_SECRET = "sync-secret";
  });

  it("inserts a new user row for Clerk webhook upserts", async () => {
    const { upsertFromClerkWebhook } = await import("../convex/users");
    const { ctx, mocks } = createWebhookCtx();

    const result = await upsertFromClerkWebhook.handler(ctx, {
      secret: "sync-secret",
      clerkUserId: "clerk_u1",
      name: "Faiz Rahman",
      email: "faiz@example.com",
    });

    expect(result).toBe("user_new");
    expect(mocks.insert).toHaveBeenCalledWith("users", {
      clerkUserId: "clerk_u1",
      name: "Faiz Rahman",
      email: "faiz@example.com",
      role: "karyawan",
      isActive: true,
      createdAt: expect.any(Number),
      updatedAt: expect.any(Number),
    });
  });

  it("deactivates the user and all memberships for Clerk webhook deletes", async () => {
    const { deleteFromClerkWebhook } = await import("../convex/users");
    const { ctx, mocks } = createWebhookCtx({
      existingUser: { _id: "user_1" },
      memberships: [
        { _id: "membership_1", isActive: true },
        { _id: "membership_2", isActive: true },
      ],
    });

    const result = await deleteFromClerkWebhook.handler(ctx, {
      secret: "sync-secret",
      clerkUserId: "clerk_u1",
    });

    expect(result).toBeNull();
    expect(mocks.patch).toHaveBeenCalledWith("user_1", {
      isActive: false,
      updatedAt: expect.any(Number),
    });
    expect(mocks.patch).toHaveBeenCalledWith("membership_1", {
      isActive: false,
      updatedAt: expect.any(Number),
    });
    expect(mocks.patch).toHaveBeenCalledWith("membership_2", {
      isActive: false,
      updatedAt: expect.any(Number),
    });
  });

  it("rejects webhook mutations when the shared secret is invalid", async () => {
    const { upsertFromClerkWebhook } = await import("../convex/users");
    const { ctx, mocks } = createWebhookCtx();

    await expect(
      upsertFromClerkWebhook.handler(ctx, {
        secret: "wrong-secret",
        clerkUserId: "clerk_u1",
        name: "Faiz Rahman",
        email: "faiz@example.com",
      }),
    ).rejects.toMatchObject({
      data: {
        code: "FORBIDDEN",
        message: "Invalid Clerk sync secret.",
      },
    });

    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.patch).not.toHaveBeenCalled();
  });
});
