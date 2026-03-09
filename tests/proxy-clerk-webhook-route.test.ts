import { beforeEach, describe, expect, it, vi } from "vitest";

type ProxyHandler = (
  auth: () => Promise<{ userId: string | null }>,
  request: Request,
) => Promise<unknown>;

const clerkMiddlewareMock = vi.fn((handler: unknown) => handler);
const nextMock = vi.fn(() => ({ kind: "next" }));
const redirectMock = vi.fn((url: URL | string) => ({
  kind: "redirect",
  destination: typeof url === "string" ? url : url.toString(),
}));

vi.mock("next/server", () => ({
  NextResponse: {
    next: nextMock,
    redirect: redirectMock,
  },
}));

vi.mock("@clerk/nextjs/server", () => ({
  createRouteMatcher: (patterns: string[]) => {
    return (request: Request) => {
      const pathname = new URL(request.url).pathname;
      return patterns.some((pattern) => {
        if (pattern === "/api/webhooks/clerk(.*)") {
          return pathname === "/api/webhooks/clerk" || pathname.startsWith("/api/webhooks/clerk/");
        }
        return false;
      });
    };
  },
  clerkMiddleware: clerkMiddlewareMock,
}));

describe("proxy clerk webhook route", () => {
  beforeEach(() => {
    vi.resetModules();
    nextMock.mockClear();
    redirectMock.mockClear();
    clerkMiddlewareMock.mockClear();
  });

  it("allows Clerk webhooks without Clerk session", async () => {
    const { default: importedProxy } = await import("../proxy");
    const proxy = importedProxy as unknown as ProxyHandler;

    const response = await proxy(
      async () => ({ userId: null }),
      new Request("https://app.example.com/api/webhooks/clerk"),
    );

    expect(response).toEqual({ kind: "next" });
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
