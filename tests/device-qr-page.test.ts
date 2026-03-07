import { beforeEach, describe, expect, it, vi } from "vitest";

describe("device qr page", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("passes workspaceId search param into the device panel", async () => {
    vi.doMock("../app/device-qr/device-qr-panel", () => ({
      DeviceQrPanel: (props: { initialWorkspaceId?: string | null }) => props,
    }));

    const { default: DeviceQrPage } = await import("../app/device-qr/page");
    const element = await DeviceQrPage({
      params: Promise.resolve({}),
      searchParams: Promise.resolve({ workspaceId: "workspace_123456" }),
    });

    expect(element.props.initialWorkspaceId).toBe("workspace_123456");
  });
});
