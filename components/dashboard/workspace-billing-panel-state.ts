import type {
  WorkspaceBillingInvoice,
  WorkspaceBillingSummaryPayload,
} from "@/types/dashboard";

type NoticeTone = "info" | "success" | "warning" | "error";

export type WorkspaceBillingInlineNotice = {
  tone: NoticeTone;
  text: string;
};

type WorkspaceCheckoutResult = {
  invoice?: {
    paymentUrl?: string;
  };
  paymentUrl?: string;
};

type StartWorkspaceBillingCheckoutOptions = {
  billingPhone: string;
  createCheckout: (billingPhone: string) => Promise<WorkspaceCheckoutResult>;
  redirectToCheckout: (paymentUrl: string) => void;
  refreshBillingState: () => Promise<void>;
};

type CancelWorkspaceBillingCheckoutOptions = {
  cancelCheckout: () => Promise<void>;
  refreshBillingState: () => Promise<void>;
};

export const WORKSPACE_PRO_PRICING_BENEFITS = Object.freeze([
  "Hingga 50 member aktif dalam satu workspace",
  "Hingga 3 device QR aktif tanpa recovery manual",
  "Geofence dan IP whitelist untuk guardrail operasional",
  "Export report dan masa berlaku invite yang bisa diatur",
]);

export function getWorkspaceCheckoutActionLabel(
  summary: Pick<WorkspaceBillingSummaryPayload, "pendingInvoice">,
) {
  return summary.pendingInvoice ? "Lanjutkan pembayaran" : "Aktifkan Pro";
}

export function canOpenWorkspaceCheckoutDialog(
  summary: Pick<WorkspaceBillingSummaryPayload, "allowedActions" | "pendingInvoice">,
) {
  return (
    summary.allowedActions.canCreateCheckout ||
    summary.pendingInvoice !== null
  );
}

export function isWorkspaceCheckoutConfirmEnabled(
  summary: Pick<WorkspaceBillingSummaryPayload, "allowedActions" | "pendingInvoice">,
) {
  if (summary.pendingInvoice) {
    return typeof summary.pendingInvoice.paymentUrl === "string";
  }

  return summary.allowedActions.canCreateCheckout;
}

export function getWorkspaceCheckoutDialogStatusCopy(
  invoice: WorkspaceBillingInvoice | null,
) {
  if (!invoice) {
    return "Invoice Mayar baru akan dibuat setelah Anda mengonfirmasi checkout.";
  }

  if (invoice.status === "pending_initializing") {
    return "Invoice masih disiapkan di Mayar. Tunggu referensi pembayaran tersedia sebelum melanjutkan.";
  }

  if (invoice.expiresAt) {
    return "Invoice aktif dan siap dibayar sebelum batas waktunya berakhir.";
  }

  return "Invoice pending sudah tersedia dan bisa dilanjutkan dari modal ini.";
}

export async function startWorkspaceBillingCheckout({
  billingPhone,
  createCheckout,
  redirectToCheckout,
  refreshBillingState,
}: StartWorkspaceBillingCheckoutOptions): Promise<
  { redirectedTo: string } | { notice: WorkspaceBillingInlineNotice }
> {
  const checkout = await createCheckout(billingPhone);
  const paymentUrl = checkout.paymentUrl ?? checkout.invoice?.paymentUrl;

  if (paymentUrl) {
    redirectToCheckout(paymentUrl);
    void refreshBillingState();
    return { redirectedTo: paymentUrl };
  }

  await refreshBillingState();
  return {
    notice: {
      tone: "warning",
      text: "Invoice berhasil dibuat, tapi tautan pembayaran belum tersedia.",
    },
  };
}

export async function cancelWorkspaceBillingCheckout({
  cancelCheckout,
  refreshBillingState,
}: CancelWorkspaceBillingCheckoutOptions): Promise<{
  notice: WorkspaceBillingInlineNotice;
}> {
  await cancelCheckout();
  await refreshBillingState();

  return {
    notice: {
      tone: "success",
      text: "Invoice pending berhasil dibatalkan.",
    },
  };
}
