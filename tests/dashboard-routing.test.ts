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
    expect(html).toContain("Review Absensi Karyawan");
    expect(html).toContain('data-viewer-role="admin"');
    expect(html).toContain('data-read-only="false"');
  });

  it("locks the device qr route to superadmin and renders the standalone panel", async () => {
    const requireWorkspaceRolePageFromDb = vi.fn(async () => ({ role: "superadmin" }));

    vi.doMock("@/lib/auth", () => ({
      requireWorkspaceRolePageFromDb,
    }));
    vi.doMock("@/components/dashboard/page-header", () => ({
      DashboardPageHeader: ({
        title,
        description,
      }: {
        title: string;
        description?: string;
      }) =>
        React.createElement(
          "div",
          {
            "data-testid": "header",
            "data-description": description,
          },
          title,
        ),
    }));
    vi.doMock("@/components/dashboard/device-management-panel", () => ({
      DeviceManagementPanel: ({ role }: { role: string }) =>
        React.createElement(
          "div",
          {
            "data-testid": "device-management-panel",
            "data-role": role,
          },
          "device-management-panel",
        ),
    }));

    const pageModule = await import("../app/dashboard/device-qr/page");
    const element = await pageModule.default();
    const html = renderToStaticMarkup(element);

    expect(requireWorkspaceRolePageFromDb).toHaveBeenCalledWith(["superadmin"]);
    expect(html).toContain("Device QR");
    expect(html).toContain('data-role="superadmin"');
    expect(html).toContain("device-management-panel");
  });
});
