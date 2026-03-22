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
