import { describe, expect, it } from "vitest";

import {
  buildWorkspaceBillingInvoiceHref,
  deriveRestrictedExpiredState,
  isBillingActionAllowedDuringRestriction,
  mapMayarInvoiceStatus,
} from "../lib/workspace-billing";

describe("workspace billing helpers", () => {
  it("marks expired workspaces above free limits as restricted", () => {
    expect(
      deriveRestrictedExpiredState({
        activeDevices: 2,
        activeMembers: 7,
        hadPaidOrManualEntitlement: true,
        plan: "free",
      }),
    ).toEqual({
      isRestricted: true,
      overFreeDeviceLimit: true,
      overFreeMemberLimit: true,
    });
  });

  it("does not restrict workspaces that never had a paid entitlement", () => {
    expect(
      deriveRestrictedExpiredState({
        activeDevices: 3,
        activeMembers: 9,
        hadPaidOrManualEntitlement: false,
        plan: "free",
      }),
    ).toEqual({
      isRestricted: false,
      overFreeDeviceLimit: true,
      overFreeMemberLimit: true,
    });
  });

  it("maps Mayar unpaid invoices to pending before expiry and expired after expiry", () => {
    const now = 1_900_000_000_000;

    expect(
      mapMayarInvoiceStatus({
        expiresAt: now + 60_000,
        now,
        providerStatus: "unpaid",
      }),
    ).toBe("pending");

    expect(
      mapMayarInvoiceStatus({
        expiresAt: now - 1,
        now,
        providerStatus: "unpaid",
      }),
    ).toBe("expired");
  });

  it("maps paid and closed Mayar invoices into local terminal states", () => {
    const now = 1_900_000_000_000;

    expect(
      mapMayarInvoiceStatus({
        expiresAt: now,
        now,
        providerStatus: "paid",
      }),
    ).toBe("paid");

    expect(
      mapMayarInvoiceStatus({
        expiresAt: now + 60_000,
        now,
        providerStatus: "closed",
      }),
    ).toBe("canceled");
  });

  it("allows only the approved recovery actions during restriction", () => {
    expect(
      isBillingActionAllowedDuringRestriction("superadmin", "billing_checkout"),
    ).toBe(true);
    expect(
      isBillingActionAllowedDuringRestriction("superadmin", "member_recovery"),
    ).toBe(true);
    expect(
      isBillingActionAllowedDuringRestriction("superadmin", "dashboard_overview"),
    ).toBe(false);

    expect(
      isBillingActionAllowedDuringRestriction("admin", "restriction_context"),
    ).toBe(true);
    expect(
      isBillingActionAllowedDuringRestriction("admin", "billing_checkout"),
    ).toBe(false);
    expect(
      isBillingActionAllowedDuringRestriction("admin", "device_recovery"),
    ).toBe(false);
  });

  it("builds invoice detail hrefs for print and download flows", () => {
    expect(buildWorkspaceBillingInvoiceHref("invoice_paid_123")).toBe(
      "/settings/workspace/invoices/invoice_paid_123",
    );
    expect(buildWorkspaceBillingInvoiceHref("invoice_paid_123", "print")).toBe(
      "/settings/workspace/invoices/invoice_paid_123?intent=print",
    );
    expect(buildWorkspaceBillingInvoiceHref("invoice with spaces", "download")).toBe(
      "/settings/workspace/invoices/invoice%20with%20spaces?intent=download",
    );
  });
});
