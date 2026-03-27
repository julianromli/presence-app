import { beforeEach, describe, expect, it, vi } from "vitest";

const redirectMock = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

describe("device qr pages", () => {
  beforeEach(() => {
    vi.resetModules();
    redirectMock.mockReset();
  });

  it("renders the qr panel on /qr", async () => {
    vi.doMock("../app/device-qr/device-qr-panel", () => ({
      DeviceQrPanel: () => ({ type: "device-qr-panel" }),
    }));

    const { default: QrPage } = await import("../app/qr/page");
    const element = QrPage();

    expect(element.type).toBeTypeOf("function");
    expect(element.type.name).toBe("DeviceQrPanel");
  });

  it("redirects legacy /device-qr to /qr", async () => {
    const { default: DeviceQrPage } = await import("../app/device-qr/page");
    DeviceQrPage();

    expect(redirectMock).toHaveBeenCalledWith("/qr");
  });
});
