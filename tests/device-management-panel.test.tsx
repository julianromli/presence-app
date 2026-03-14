import { describe, expect, it } from "vitest";

import {
  buildDeviceRevokeConfirmation,
  buildDeviceSetupUrl,
  buildDeviceManagementPanelState,
  buildGeneratedCodeNotice,
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
});
