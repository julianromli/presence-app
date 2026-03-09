import { beforeEach, describe, expect, it, vi } from "vitest";

async function setupRoute(options?: {
  event?: {
    type: "user.created" | "user.updated" | "user.deleted";
    data: Record<string, unknown>;
  };
  convexClient?: { mutation: ReturnType<typeof vi.fn> } | null;
  verifyError?: Error;
}) {
  vi.resetModules();

  const mutation =
    options?.convexClient?.mutation ??
    vi.fn(async () => ({ ok: true }));
  const verifyWebhook = vi.fn(async () => {
    if (options?.verifyError) {
      throw options.verifyError;
    }

    return (
      options?.event ?? {
        type: "user.created",
        data: {
          id: "clerk_u1",
          first_name: "Faiz",
          last_name: "Rahman",
          username: "faiz",
          primary_email_address_id: "email_1",
          email_addresses: [
            {
              id: "email_1",
              email_address: "faiz@example.com",
            },
          ],
        },
      }
    );
  });
  const getPublicConvexHttpClient = vi.fn(() =>
    options?.convexClient === null ? null : { mutation },
  );

  vi.doMock("@clerk/nextjs/webhooks", () => ({ verifyWebhook }));
  vi.doMock("@/lib/convex-http", () => ({ getPublicConvexHttpClient }));

  const routeModule = await import("../app/api/webhooks/clerk/route");
  return {
    POST: routeModule.POST,
    mocks: { mutation, verifyWebhook, getPublicConvexHttpClient },
  };
}

describe("clerk webhook route", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = {
      ...originalEnv,
      CLERK_SYNC_SHARED_SECRET: "sync-secret",
      CLERK_WEBHOOK_SECRET: "whsec_test",
    };
  });

  it("upserts Clerk users into Convex for user.created", async () => {
    const { POST, mocks } = await setupRoute();

    const response = await POST(new Request("http://localhost/api/webhooks/clerk", { method: "POST" }));

    expect(response.status).toBe(200);
    expect(mocks.verifyWebhook).toHaveBeenCalledTimes(1);
    expect(mocks.mutation).toHaveBeenCalledWith("users:upsertFromClerkWebhook", {
      secret: "sync-secret",
      clerkUserId: "clerk_u1",
      name: "Faiz Rahman",
      email: "faiz@example.com",
    });
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("deletes Convex users for user.deleted", async () => {
    const { POST, mocks } = await setupRoute({
      event: {
        type: "user.deleted",
        data: { id: "clerk_u1" },
      },
    });

    const response = await POST(new Request("http://localhost/api/webhooks/clerk", { method: "POST" }));

    expect(response.status).toBe(200);
    expect(mocks.mutation).toHaveBeenCalledWith("users:deleteFromClerkWebhook", {
      secret: "sync-secret",
      clerkUserId: "clerk_u1",
    });
  });

  it("rejects unverifiable webhook payloads", async () => {
    const { POST, mocks } = await setupRoute({
      verifyError: new Error("invalid signature"),
    });

    const response = await POST(new Request("http://localhost/api/webhooks/clerk", { method: "POST" }));

    expect(response.status).toBe(400);
    expect(mocks.mutation).not.toHaveBeenCalled();
  });
});
