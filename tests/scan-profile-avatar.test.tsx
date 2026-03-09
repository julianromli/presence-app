import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

describe("scan profile avatar", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.doUnmock("../app/scan/profile/profile-panel");
  });

  it("passes the Clerk image url into the profile panel", async () => {
    const requireWorkspaceRolePageFromDb = vi.fn(async () => ({
      role: "karyawan",
      workspace: { name: "Acme Workspace" },
      user: {
        name: "Dina",
        email: "dina@example.com",
      },
    }));
    const currentUser = vi.fn(async () => ({
      imageUrl: "https://cdn.example.com/avatar.png",
    }));

    vi.doMock("@/lib/auth", () => ({
      requireWorkspaceRolePageFromDb,
    }));
    vi.doMock("@clerk/nextjs/server", () => ({
      currentUser,
    }));
    vi.doMock("../app/scan/profile/profile-panel", () => ({
      ProfilePanel: ({ initialProfile }: { initialProfile: Record<string, string> }) =>
        React.createElement("div", {
          "data-testid": "profile-panel",
          "data-image-url": initialProfile.imageUrl ?? "",
        }),
    }));

    const pageModule = await import("../app/scan/profile/page");
    const element = await pageModule.default();
    const html = renderToStaticMarkup(element);

    expect(requireWorkspaceRolePageFromDb).toHaveBeenCalledWith(["karyawan"]);
    expect(currentUser).toHaveBeenCalled();
    expect(html).toContain('data-image-url="https://cdn.example.com/avatar.png"');
  });

  it("renders the avatar image when the initial profile includes a Clerk avatar url", async () => {
    const requireWorkspaceRolePageFromDb = vi.fn(async () => ({
      role: "karyawan",
      workspace: { name: "Acme Workspace" },
      user: {
        name: "Dina",
        email: "dina@example.com",
      },
    }));
    const currentUser = vi.fn(async () => ({
      imageUrl: "https://cdn.example.com/avatar.png",
    }));

    vi.doMock("@/lib/auth", () => ({
      requireWorkspaceRolePageFromDb,
    }));
    vi.doMock("@clerk/nextjs/server", () => ({
      currentUser,
    }));
    vi.doMock("../app/scan/profile/profile-panel", () => ({
      ProfilePanel: ({ initialProfile }: { initialProfile: Record<string, string> }) =>
        React.createElement("img", {
          "data-slot": "avatar-image",
          src: initialProfile.imageUrl,
          alt: initialProfile.name,
        }),
    }));

    const pageModule = await import("../app/scan/profile/page");
    const element = await pageModule.default();
    const html = renderToStaticMarkup(
      element,
    );

    expect(html).toContain('data-slot="avatar-image"');
    expect(html).toContain('src="https://cdn.example.com/avatar.png"');
  });
});
