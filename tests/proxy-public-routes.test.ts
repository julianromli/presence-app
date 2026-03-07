import { beforeEach, describe, expect, it, vi } from "vitest";

const nextMock = vi.fn(() => ({ kind: "next" }));
const redirectToSignInMock = vi.fn(({ returnBackUrl }: { returnBackUrl: string }) => ({
  kind: "redirect",
  returnBackUrl,
}));

vi.mock("next/server", () => ({
  NextResponse: {
    next: nextMock,
  },
}));

vi.mock("@clerk/nextjs/server", () => ({
  createRouteMatcher: (patterns: string[]) => {
    return (request: Request) => {
      const pathname = new URL(request.url).pathname;
      return patterns.some((pattern) => {
        if (pattern === "/") {
          return pathname === "/";
        }
        if (pattern === "/device-qr(.*)") {
          return pathname === "/device-qr" || pathname.startsWith("/device-qr/");
        }
        if (pattern === "/api/device(.*)") {
          return pathname === "/api/device" || pathname.startsWith("/api/device/");
        }
        if (pattern === "/api/health(.*)") {
          return pathname === "/api/health" || pathname.startsWith("/api/health/");
        }
        if (pattern === "/sign-in(.*)") {
          return pathname === "/sign-in" || pathname.startsWith("/sign-in/");
        }
        if (pattern === "/sign-up(.*)") {
          return pathname === "/sign-up" || pathname.startsWith("/sign-up/");
        }
        return false;
      });
    };
  },
  clerkMiddleware: (handler: unknown) => handler,
}));

describe("proxy public routes", () => {
  beforeEach(() => {
    vi.resetModules();
    nextMock.mockClear();
    redirectToSignInMock.mockClear();
  });

  it("allows /device-qr without Clerk session", async () => {
    const { default: proxy } = await import("../proxy");

    const response = await proxy(
      async () => ({
        userId: null,
        redirectToSignIn: redirectToSignInMock,
      }),
      new Request("https://app.example.com/device-qr?workspaceId=workspace_123456"),
    );

    expect(response).toEqual({ kind: "next" });
    expect(redirectToSignInMock).not.toHaveBeenCalled();
  });

  it("allows /api/device/qr-token without Clerk session", async () => {
    const { default: proxy } = await import("../proxy");

    const response = await proxy(
      async () => ({
        userId: null,
        redirectToSignIn: redirectToSignInMock,
      }),
      new Request("https://app.example.com/api/device/qr-token"),
    );

    expect(response).toEqual({ kind: "next" });
    expect(redirectToSignInMock).not.toHaveBeenCalled();
  });

  it("still redirects protected routes to sign-in when user is anonymous", async () => {
    const { default: proxy } = await import("../proxy");

    const response = await proxy(
      async () => ({
        userId: null,
        redirectToSignIn: redirectToSignInMock,
      }),
      new Request("https://app.example.com/dashboard"),
    );

    expect(response).toEqual({
      kind: "redirect",
      returnBackUrl: "https://app.example.com/dashboard",
    });
    expect(redirectToSignInMock).toHaveBeenCalledWith({
      returnBackUrl: "https://app.example.com/dashboard",
    });
  });
});
