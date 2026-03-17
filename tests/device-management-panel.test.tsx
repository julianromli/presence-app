import { describe, expect, it } from "vitest";

import {
  buildDeviceRevokeConfirmation,
  buildDeviceManagementPanelState,
  buildDeviceSetupUrl,
  buildGeneratedCodeNotice,
  getLatestRegistrationCode,
  isDeviceActionPending,
  isDeviceManagementVisible,
  startRenameSubmission,
  startRevokeSubmission,
} from "../components/dashboard/device-management-panel-state";

describe("device management panel", () => {
  it("renders code list data for superadmin", () => {
    const panel = buildDeviceManagementPanelState({
      role: "superadmin",
      registrationCodes: [
        {
          codeId: "code_123",
          createdAt: 1,
          expiresAt: 2,
          status: "pending",
        },
      ],
      devices: [],
    });

    expect(panel.visible).toBe(true);
    expect(panel.registrationCodes[0]?.status).toBe("pending");
  });

  it("renders device list data for superadmin", () => {
    const panel = buildDeviceManagementPanelState({
      role: "superadmin",
      registrationCodes: [],
      devices: [
        {
          deviceId: "device_123",
          label: "Front Desk Tablet",
          status: "active",
          online: true,
          claimedAt: 10,
          claimedFromCodeId: "code_123",
        },
      ],
    });

    expect(panel.visible).toBe(true);
    expect(panel.devices[0]?.label).toBe("Front Desk Tablet");
  });

  it("tracks rename submit state", () => {
    expect(startRenameSubmission("device_123")).toEqual({
      submittingRenameId: "device_123",
    });
  });

  it("keeps device row pending state scoped to the active device action", () => {
    expect(startRevokeSubmission("device_123")).toEqual({
      revokingDeviceId: "device_123",
    });
    expect(isDeviceActionPending("device_123", "device_123")).toBe(true);
    expect(isDeviceActionPending("device_999", "device_123")).toBe(false);
  });

  it("builds destructive confirmation copy for device revoke", () => {
    expect(buildDeviceRevokeConfirmation("Front Desk Tablet")).toEqual({
      cancelLabel: "Batal",
      confirmLabel: "Ya, revoke",
      description: 'Device "Front Desk Tablet" akan dicabut dari workspace ini dan perlu dipairing ulang.',
      title: "Cabut device ini sekarang?",
      tone: "destructive",
    });
  });

  it("is visible only for superadmin", () => {
    expect(isDeviceManagementVisible("superadmin")).toBe(true);
    expect(isDeviceManagementVisible("admin")).toBe(false);
  });

  it("renders the newly generated plaintext registration code for the operator", () => {
    expect(
      buildGeneratedCodeNotice({
        code: "ABCD1234-EFGH5678",
        createdAt: 1,
        expiresAt: 2,
      }),
    ).toEqual({
      title: "Registration code terbaru",
      code: "ABCD1234-EFGH5678",
      expiresAt: 2,
    });
  });

  it("builds a workspace-scoped setup url for fresh kiosk bootstrap", () => {
    expect(buildDeviceSetupUrl("workspace_123456", "https://app.example.com")).toBe(
      "https://app.example.com/device-qr?workspaceId=workspace_123456",
    );
  });

  it("selects the newest registration code by createdAt", () => {
    expect(
      getLatestRegistrationCode([
        {
          codeId: "code_old",
          createdAt: 1,
          expiresAt: 2,
          status: "expired",
        },
        {
          codeId: "code_new",
          createdAt: 5,
          expiresAt: 6,
          status: "pending",
        },
      ]),
    )?.toMatchObject({
      codeId: "code_new",
      status: "pending",
    });
  });

  it("prefers the newest pending registration code over newer unusable history", () => {
    expect(
      getLatestRegistrationCode([
        {
          codeId: "code_pending",
          createdAt: 5,
          expiresAt: 50,
          status: "pending",
        },
        {
          codeId: "code_claimed",
          createdAt: 10,
          expiresAt: 20,
          status: "claimed",
          claimedAt: 12,
        },
      ]),
    )?.toMatchObject({
      codeId: "code_pending",
      status: "pending",
    });
  });

  it("builds a workspace change reset that clears stale device panel state", async () => {
    const panelStateModule = await import("../components/dashboard/device-management-panel-state");
    const buildWorkspaceChangeReset = (panelStateModule as Record<string, unknown>)
      .buildDeviceManagementWorkspaceChangeReset as
      | ((workspaceId: string, origin: string) => Record<string, unknown>)
      | undefined;

    expect(buildWorkspaceChangeReset).toBeTypeOf("function");

    expect(buildWorkspaceChangeReset?.("workspace_next", "https://app.example.com")).toMatchObject({
      setupUrl: "https://app.example.com/device-qr?workspaceId=workspace_next",
      generatedCode: null,
      notice: null,
      registrationCodesStatus: "loading",
      devicesStatus: "loading",
      registrationCodesError: null,
      devicesError: null,
      renameDeviceId: null,
      renameDraft: "",
      submittingRenameId: null,
      confirmRevokeDevice: null,
      revokingDeviceId: null,
    });
  });
});
