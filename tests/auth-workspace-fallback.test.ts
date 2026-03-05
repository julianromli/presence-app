import { beforeEach, describe, expect, it, vi } from "vitest";

type SetupOptions = {
  memberships?: Array<{
    membershipId: string;
    role: "superadmin" | "admin" | "karyawan" | "device-qr";
    isActive: boolean;
    workspace: {
      _id: string;
      _creationTime: number;
      slug: string;
      name: string;
      isActive: boolean;
      createdAt: number;
      updatedAt: number;
      createdByUserId?: string;
    };
  }>;
};

function redirectError(path: string) {
  return new Error(`REDIRECT:${path}`);
}

async function setupAuthModule(options: SetupOptions = {}) {
  vi.resetModules();

  const memberships = options.memberships ?? [];
  const query = vi.fn(async (name: string) => {
    if (name === "users:me") {
      return {
        _id: "u1",
        _creationTime: 1,
        name: "Faiz",
        email: "faiz@example.com",
        role: "admin",
        isActive: true,
        clerkUserId: "clerk_u1",
        createdAt: 1,
        updatedAt: 1,
      };
    }
    if (name === "workspaces:myOnboardingState") {
      return {
        hasActiveMembership: memberships.length > 0,
        memberships,
      };
    }
    if (name === "workspaces:myMembershipByWorkspace") {
      return null;
    }
    return null;
  });

  vi.doMock("@clerk/nextjs/server", () => ({
    auth: vi.fn(async () => ({
      userId: "clerk_u1",
      getToken: vi.fn(async () => "convex-token"),
    })),
  }));
  vi.doMock("next/headers", () => ({
    cookies: vi.fn(async () => ({
      get: vi.fn(() => undefined),
    })),
  }));
  vi.doMock("next/navigation", () => ({
    redirect: vi.fn((path: string) => {
      throw redirectError(path);
    }),
  }));
  vi.doMock("@/lib/convex-http", () => ({
    getAuthedConvexHttpClient: vi.fn(() => ({ query })),
  }));
  vi.doMock("@/lib/workspace-context", () => ({
    ACTIVE_WORKSPACE_COOKIE: "active_workspace_id",
    isValidWorkspaceId: vi.fn(() => true),
  }));

  const authModule = await import("../lib/auth");
  return { authModule };
}

describe("auth workspace fallback", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("uses onboarding memberships fallback when active cookie is missing", async () => {
    const { authModule } = await setupAuthModule({
      memberships: [
        {
          membershipId: "m1",
          role: "admin",
          isActive: true,
          workspace: {
            _id: "workspace_123456",
            _creationTime: 1,
            slug: "presence-hq",
            name: "Presence HQ",
            isActive: true,
            createdAt: 1,
            updatedAt: 1,
          },
        },
      ],
    });

    const session = await authModule.requireWorkspaceRolePageFromDb(["admin", "superadmin"]);
    expect(session.workspace._id).toBe("workspace_123456");
    expect(session.role).toBe("admin");
  });

  it("redirects to onboarding when no active memberships found", async () => {
    const { authModule } = await setupAuthModule({ memberships: [] });

    await expect(
      authModule.requireWorkspaceRolePageFromDb(["admin", "superadmin"]),
    ).rejects.toThrow("REDIRECT:/onboarding/workspace");
  });
});
