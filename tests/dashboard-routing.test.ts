import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

describe("dashboard routing", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("renders the users route as an attendance-first workspace for admins", async () => {
    const requireWorkspaceRolePageFromDb = vi.fn(async () => ({ role: "admin" }));

    vi.doMock("@/lib/auth", () => ({
      requireWorkspaceRolePageFromDb,
    }));
    vi.doMock("@/components/dashboard/page-header", () => ({
      DashboardPageHeader: ({ title }: { title: string }) =>
        React.createElement("div", { "data-testid": "header" }, title),
    }));
    vi.doMock("@/components/dashboard/users-panel", () => ({
      UsersPanel: ({ viewerRole, readOnly }: { viewerRole: string; readOnly?: boolean }) =>
        React.createElement(
          "div",
          {
            "data-testid": "users-panel",
            "data-viewer-role": viewerRole,
            "data-read-only": String(Boolean(readOnly)),
          },
          "users-panel",
        ),
    }));

    const pageModule = await import("../app/dashboard/users/page");
    const element = await pageModule.default();
    const html = renderToStaticMarkup(element);

    expect(requireWorkspaceRolePageFromDb).toHaveBeenCalledWith(["admin", "superadmin"]);
    expect(html).toContain("Operasional Absensi");
    expect(html).toContain('data-viewer-role="admin"');
    expect(html).toContain('data-read-only="false"');
  });
});
