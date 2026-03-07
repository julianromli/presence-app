import { beforeEach, describe, expect, it, vi } from "vitest";

type SetupOptions = {
  currentUserRole?: "superadmin" | "admin" | "karyawan" | "device-qr";
  cookieValue?: string | null;
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
  membershipByWorkspace?: {
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
  } | null;
};

function redirectError(path: string) {
  return new Error(`REDIRECT:${path}`);
}

async function setupAuthModule(options: SetupOptions = {}) {
  vi.resetModules();

  const memberships = options.memberships ?? [];
  const membershipByWorkspace = options.membershipByWorkspace ?? null;
  const query = vi.fn(async (name: string) => {
    if (name === "users:me") {
      return {
        _id: "u1",
        _creationTime: 1,
        name: "Faiz",
        email: "faiz@example.com",
        role: options.currentUserRole ?? "admin",
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
      return membershipByWorkspace;
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
      get: vi.fn(() =>
        options.cookieValue === undefined || options.cookieValue === null
          ? undefined
          : { value: options.cookieValue },
      ),
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

  it("treats a missing Clerk convex token as an anonymous Convex session instead of throwing", async () => {
    vi.resetModules();

    vi.doMock("@clerk/nextjs/server", () => ({
      auth: vi.fn(async () => ({
        userId: "clerk_u1",
        getToken: vi.fn(async () => {
          throw {
            clerkError: true,
            status: 404,
            code: "api_response_error",
          };
        }),
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
      forbidden: vi.fn(() => {
        throw new Error("FORBIDDEN");
      }),
    }));
    const query = vi.fn();
    const getAuthedConvexHttpClient = vi.fn(() => ({ query }));
    vi.doMock("@/lib/convex-http", () => ({
      getAuthedConvexHttpClient,
    }));
    vi.doMock("@/lib/workspace-context", () => ({
      ACTIVE_WORKSPACE_COOKIE: "active_workspace_id",
      isValidWorkspaceId: vi.fn(() => true),
    }));

    const authModule = await import("../lib/auth");
    const session = await authModule.getCurrentSession();

    expect(session).toEqual({
      userId: "clerk_u1",
      role: null,
      user: null,
    });
    expect(getAuthedConvexHttpClient).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
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

  it("returns onboarding required for API role checks when user has no active memberships", async () => {
    const { authModule } = await setupAuthModule({
      memberships: [],
      membershipByWorkspace: null,
    });

    const result = await authModule.requireWorkspaceRoleApiFromDb(["superadmin"], "workspace_123456");
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error.status).toBe(409);
      await expect(result.error.json()).resolves.toEqual({
        code: "ONBOARDING_REQUIRED",
        message: "Anda belum memiliki akses workspace aktif.",
      });
    }
  });

  it("returns forbidden for API role checks when target workspace membership is missing but another workspace remains", async () => {
    const { authModule } = await setupAuthModule({
      cookieValue: "workspace_123456",
      memberships: [
        {
          membershipId: "m2",
          role: "admin",
          isActive: true,
          workspace: {
            _id: "workspace_654321",
            _creationTime: 2,
            slug: "presence-branch",
            name: "Presence Branch",
            isActive: true,
            createdAt: 2,
            updatedAt: 2,
          },
        },
      ],
      membershipByWorkspace: null,
    });

    const result = await authModule.requireWorkspaceRoleApiFromDb(["superadmin"], "workspace_123456");
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error.status).toBe(403);
      await expect(result.error.json()).resolves.toEqual({
        code: "FORBIDDEN",
        message: "Forbidden",
      });
    }
  });

  it("keeps true forbidden for API role checks against a foreign workspace", async () => {
    const { authModule } = await setupAuthModule({
      cookieValue: "workspace_654321",
      memberships: [
        {
          membershipId: "m2",
          role: "admin",
          isActive: true,
          workspace: {
            _id: "workspace_654321",
            _creationTime: 2,
            slug: "presence-branch",
            name: "Presence Branch",
            isActive: true,
            createdAt: 2,
            updatedAt: 2,
          },
        },
      ],
      membershipByWorkspace: null,
    });

    const result = await authModule.requireWorkspaceRoleApiFromDb(["superadmin"], "workspace_123456");
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error.status).toBe(403);
      await expect(result.error.json()).resolves.toEqual({
        code: "FORBIDDEN",
        message: "Forbidden",
      });
    }
  });
});
