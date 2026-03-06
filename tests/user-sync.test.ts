import { beforeEach, describe, expect, it, vi } from "vitest";

async function setupModule(options?: {
  currentUser?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    username?: string | null;
    primaryEmailAddress?: { emailAddress: string } | null;
  } | null;
  existingUser?: Record<string, unknown> | null;
  convexMissing?: boolean;
}) {
  vi.resetModules();

  const query = vi.fn(async (name: string) => {
    if (name === "users:me") {
      return options?.existingUser === undefined ? { _id: "user_123" } : options.existingUser;
    }
    return null;
  });
  const mutation = vi.fn(async () => "user_123");

  vi.doMock("@clerk/nextjs/server", () => ({
    currentUser: vi.fn(async () =>
      options?.currentUser === undefined
        ? {
            id: "clerk_u1",
            firstName: "Faiz",
            lastName: "Rahman",
            username: "faiz",
            primaryEmailAddress: { emailAddress: "faiz@example.com" },
          }
        : options.currentUser,
    ),
  }));
  vi.doMock("@/lib/convex-http", () => ({
    getAuthedConvexHttpClient: vi.fn(() =>
      options?.convexMissing
        ? null
        : {
            query,
            mutation,
          },
    ),
  }));

  const userSyncModule = await import("../lib/user-sync");
  return { userSyncModule, mocks: { query, mutation } };
}

describe("user sync helpers", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("does not write on ensure when the Convex user already exists", async () => {
    const { userSyncModule, mocks } = await setupModule();

    const response = await userSyncModule.ensureCurrentUserInConvex("convex-token");

    expect(response).toBeNull();
    expect(mocks.query).toHaveBeenCalledWith("users:me", {});
    expect(mocks.mutation).not.toHaveBeenCalled();
  });

  it("bootstraps on ensure when the Convex user is missing", async () => {
    const { userSyncModule, mocks } = await setupModule({ existingUser: null });

    const response = await userSyncModule.ensureCurrentUserInConvex("convex-token");

    expect(response).toBeNull();
    expect(mocks.query).toHaveBeenCalledWith("users:me", {});
    expect(mocks.mutation).toHaveBeenCalledWith("users:upsertFromClerk", {
      name: "Faiz Rahman",
      email: "faiz@example.com",
    });
  });
});
