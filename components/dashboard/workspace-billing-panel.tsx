"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowsClockwise,
  DotsThree,
  DownloadSimple,
  Printer,
} from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "@/components/ui/menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createWorkspaceCheckout,
  fetchWorkspaceBillingInvoices,
  fetchWorkspaceBillingSummary,
  normalizeWorkspaceBillingError,
  cancelWorkspacePendingInvoice as cancelWorkspacePendingInvoiceRequest,
  refreshWorkspacePendingInvoice,
} from "@/lib/workspace-billing-client";
import {
  buildWorkspaceBillingInvoiceHref,
  WORKSPACE_PRO_PERIOD_DAYS,
} from "@/lib/workspace-billing";
import {
  canOpenWorkspaceCheckoutDialog,
  cancelWorkspaceBillingCheckout,
  getWorkspaceCheckoutActionLabel,
  getWorkspaceCheckoutDialogStatusCopy,
  isWorkspaceCheckoutConfirmEnabled,
  startWorkspaceBillingCheckout,
  type WorkspaceBillingInlineNotice,
  WORKSPACE_PRO_PRICING_BENEFITS,
} from "@/components/dashboard/workspace-billing-panel-state";
import {
  formatWorkspaceBillingPeriod,
  getRestrictedWorkspaceOverlayCopy,
  refreshWorkspaceSubscription,
} from "@/lib/workspace-subscription-client";
import { cn } from "@/lib/utils";
import type {
  WorkspaceBillingInvoice,
  WorkspaceBillingInvoicesPayload,
  WorkspaceBillingSummaryPayload,
  WorkspaceBillingCheckoutOffer,
} from "@/types/dashboard";

type WorkspaceBillingPanelProps = {
  className?: string;
  surface?: "page" | "overlay";
};

type NoticeTone = WorkspaceBillingInlineNotice["tone"];
type InlineNotice = WorkspaceBillingInlineNotice;

function formatDateTime(value?: number) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatCurrencyIdr(value?: number) {
  if (typeof value !== "number") {
    return "-";
  }

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatInvoiceCoveragePeriod(invoice: WorkspaceBillingInvoice) {
  if (!invoice.coveredPeriodStartsAt || !invoice.coveredPeriodEndsAt) {
    return "Belum ada periode";
  }

  return formatWorkspaceBillingPeriod(
    invoice.coveredPeriodStartsAt,
    invoice.coveredPeriodEndsAt,
  );
}

function getPendingInvoiceCopy(invoice: WorkspaceBillingInvoice | null) {
  if (!invoice) {
    return "Checkout baru akan membuat invoice Mayar baru.";
  }

  if (invoice.status === "pending_initializing") {
    return "Invoice Mayar masih disinkronkan. Checkout tetap dikunci untuk mencegah invoice ganda.";
  }

  return `Batas bayar ${formatDateTime(invoice.expiresAt)}`;
}

function getInvoiceStatusLabel(status: WorkspaceBillingInvoice["status"]) {
  switch (status) {
    case "paid":
      return "Lunas";
    case "pending":
      return "Menunggu pembayaran";
    case "pending_initializing":
      return "Menyiapkan invoice";
    case "expired":
      return "Kedaluwarsa";
    case "canceled":
      return "Dibatalkan";
    case "failed":
      return "Gagal";
    default:
      return status;
  }
}

function statusBadgeClass(status: WorkspaceBillingInvoice["status"]) {
  switch (status) {
    case "paid":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "pending":
    case "pending_initializing":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "expired":
      return "border-rose-200 bg-rose-50 text-rose-800";
    case "canceled":
    case "failed":
      return "border-zinc-200 bg-zinc-100 text-zinc-700";
    default:
      return "border-zinc-200 bg-zinc-50 text-zinc-700";
  }
}

function noticeClass(tone: NoticeTone) {
  switch (tone) {
    case "success":
      return "border-emerald-200 bg-emerald-50 text-emerald-900";
    case "warning":
      return "border-amber-200 bg-amber-50 text-amber-900";
    case "error":
      return "border-rose-200 bg-rose-50 text-rose-900";
    default:
      return "border-zinc-200 bg-zinc-50 text-zinc-900";
  }
}

function buildOfferCoverageCopy(periodDays?: number) {
  return `${periodDays ?? WORKSPACE_PRO_PERIOD_DAYS} hari akses Pro untuk satu workspace`;
}

function resolveCheckoutOffer(
  summary: WorkspaceBillingSummaryPayload,
): Partial<WorkspaceBillingCheckoutOffer> & Pick<WorkspaceBillingCheckoutOffer, "currency" | "plan"> {
  return {
    amount: summary.checkoutOffer?.amount ?? summary.pendingInvoice?.amount,
    currency: summary.checkoutOffer?.currency ?? "IDR",
    periodDays: summary.checkoutOffer?.periodDays ?? WORKSPACE_PRO_PERIOD_DAYS,
    plan: summary.checkoutOffer?.plan ?? "pro",
  };
}

export function WorkspaceCheckoutPricingDialog({
  billingPhone,
  busyAction,
  onConfirm,
  onOpenChange,
  open,
  summary,
}: {
  billingPhone: string;
  busyAction: "none" | "cancel" | "checkout" | "refresh";
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  summary: WorkspaceBillingSummaryPayload;
}) {
  const pendingInvoice = summary.pendingInvoice;
  const offer = resolveCheckoutOffer(summary);
  const isPendingInitializing = pendingInvoice?.status === "pending_initializing";
  const actionLabel = getWorkspaceCheckoutActionLabel(summary);
  const confirmEnabled =
    billingPhone.trim().length > 0 &&
    isWorkspaceCheckoutConfirmEnabled(summary) &&
    !isPendingInitializing;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="overflow-hidden border-zinc-900/10 bg-white p-0 shadow-2xl sm:max-w-2xl">
        <DialogPanel className="gap-0">
          <div className="relative overflow-hidden border-b border-zinc-200 bg-zinc-950 px-6 py-6 text-zinc-50 sm:px-7">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(244,244,245,0.18),_transparent_42%),linear-gradient(135deg,_rgba(245,158,11,0.18),_transparent_55%)]" />
            <DialogHeader className="relative gap-3 text-left">
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-300">
                <span>Workspace Pro</span>
                <span className="rounded-full border border-white/15 px-2 py-1 text-[11px] text-white/88">
                  {buildOfferCoverageCopy(offer.periodDays)}
                </span>
              </div>
              <DialogTitle className="max-w-xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                {formatCurrencyIdr(
                  pendingInvoice?.amount ?? offer.amount,
                )}
              </DialogTitle>
              <DialogDescription className="max-w-lg text-sm leading-6 text-zinc-300">
                Lihat harga, guardrail operasional, dan ringkasan checkout sebelum
                membuka invoice Mayar.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid gap-0 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <div className="space-y-5 px-6 py-6 sm:px-7">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                    Harga checkout
                  </p>
                  <p className="mt-2 text-xl font-semibold text-zinc-950">
                    {formatCurrencyIdr(pendingInvoice?.amount ?? offer.amount)}
                  </p>
                  <p className="mt-1 text-sm text-zinc-600">
                    {buildOfferCoverageCopy(offer.periodDays)}
                  </p>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                    WhatsApp billing
                  </p>
                  <p className="mt-2 text-base font-semibold text-zinc-950">
                    {billingPhone.trim() || "Belum diisi"}
                  </p>
                  <p className="mt-1 text-sm text-zinc-600">
                    Nomor ini dipakai untuk pembuatan atau pemulihan invoice.
                  </p>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-zinc-500">
                  Benefit Pro
                </h3>
                <div className="mt-3 grid gap-2">
                  {WORKSPACE_PRO_PRICING_BENEFITS.map((benefit) => (
                    <div
                      key={benefit}
                      className="flex items-start gap-3 rounded-2xl border border-zinc-200/80 px-4 py-3"
                    >
                      <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-amber-500" />
                      <p className="text-sm leading-6 text-zinc-700">{benefit}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="border-t border-zinc-200 bg-zinc-50/80 px-6 py-6 sm:border-t-0 sm:border-l sm:px-7">
              <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                  Status checkout
                </p>
                <p className="mt-2 text-lg font-semibold text-zinc-950">
                  {pendingInvoice
                    ? getInvoiceStatusLabel(pendingInvoice.status)
                    : "Invoice baru"}
                </p>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  {getWorkspaceCheckoutDialogStatusCopy(pendingInvoice)}
                </p>
                {pendingInvoice ? (
                  <div className="mt-4 space-y-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3 text-sm text-zinc-700">
                    <p>
                      Referensi:{" "}
                      <span className="font-medium text-zinc-950">
                        {pendingInvoice.invoiceId}
                      </span>
                    </p>
                    <p>
                      Batas bayar:{" "}
                      <span className="font-medium text-zinc-950">
                        {formatDateTime(pendingInvoice.expiresAt)}
                      </span>
                    </p>
                  </div>
                ) : null}
                {!billingPhone.trim() ? (
                  <p className="mt-4 text-sm font-medium text-amber-700">
                    Isi nomor WhatsApp billing di panel sebelum melanjutkan.
                  </p>
                ) : null}
                {isPendingInitializing ? (
                  <p className="mt-4 text-sm font-medium text-amber-700">
                    Invoice masih sinkronisasi, jadi checkout dikunci sementara.
                  </p>
                ) : null}
              </div>

              <DialogFooter className="mt-5 flex-col gap-2 sm:flex-col sm:justify-stretch">
                <Button
                  onClick={onConfirm}
                  disabled={!confirmEnabled}
                  isLoading={busyAction === "checkout"}
                  loadingText={
                    pendingInvoice ? "Membuka invoice..." : "Membuat invoice..."
                  }
                  className="w-full"
                >
                  {actionLabel}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="w-full"
                >
                  Tutup
                </Button>
              </DialogFooter>
            </div>
          </div>
        </DialogPanel>
      </DialogPopup>
    </Dialog>
  );
}

function InvoiceRowActions({ invoice }: { invoice: WorkspaceBillingInvoice }) {
  const invoiceDetailHref = buildWorkspaceBillingInvoiceHref(invoice.invoiceId);
  const invoicePrintHref = buildWorkspaceBillingInvoiceHref(
    invoice.invoiceId,
    "print",
  );
  const invoiceDownloadHref = buildWorkspaceBillingInvoiceHref(
    invoice.invoiceId,
    "download",
  );
  const paymentUrl = invoice.paymentUrl;

  return (
    <TooltipProvider>
      <div className="flex items-center justify-end gap-1.5">
        {(invoice.status === "pending" ||
          invoice.status === "pending_initializing") &&
        paymentUrl ? (
          <Button
            size="xs"
            variant="ghost"
            onClick={() => window.location.assign(paymentUrl)}
          >
            Lanjut bayar
          </Button>
        ) : null}

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                aria-label={`Download invoice ${invoice.invoiceId}`}
                size="icon-xs"
                variant="outline"
                className="hidden sm:inline-flex xl:hidden"
                render={<Link href={invoiceDownloadHref} />}
              />
            }
          >
            <DownloadSimple className="h-4 w-4" weight="regular" />
          </TooltipTrigger>
          <TooltipContent>Download PDF</TooltipContent>
        </Tooltip>

        <Button
          size="xs"
          variant="outline"
          className="hidden xl:inline-flex"
          render={<Link href={invoiceDownloadHref} />}
        >
          <DownloadSimple className="h-4 w-4" weight="regular" />
          Download
        </Button>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                aria-label={`Print invoice ${invoice.invoiceId}`}
                size="icon-xs"
                variant="outline"
                className="hidden sm:inline-flex xl:hidden"
                render={<Link href={invoicePrintHref} />}
              />
            }
          >
            <Printer className="h-4 w-4" weight="regular" />
          </TooltipTrigger>
          <TooltipContent>Print invoice</TooltipContent>
        </Tooltip>

        <Button
          size="xs"
          variant="outline"
          className="hidden xl:inline-flex"
          render={<Link href={invoicePrintHref} />}
        >
          <Printer className="h-4 w-4" weight="regular" />
          Print
        </Button>

        <Menu>
          <MenuTrigger
            render={
              <Button
                aria-label={`Aksi invoice ${invoice.invoiceId}`}
                size="icon-xs"
                variant="ghost"
              />
            }
          >
            <DotsThree className="h-4 w-4" weight="bold" />
          </MenuTrigger>
          <MenuPopup align="end" className="min-w-[190px]">
            <MenuItem render={<Link href={invoiceDetailHref} />}>
              Buka detail invoice
            </MenuItem>
            <MenuItem render={<Link href={invoiceDownloadHref} />}>
              <DownloadSimple className="h-4 w-4" weight="regular" />
              Download PDF
            </MenuItem>
            <MenuItem render={<Link href={invoicePrintHref} />}>
              <Printer className="h-4 w-4" weight="regular" />
              Print invoice
            </MenuItem>
          </MenuPopup>
        </Menu>
      </div>
    </TooltipProvider>
  );
}

export function WorkspaceBillingPanel({
  className,
  surface = "page",
}: WorkspaceBillingPanelProps) {
  const [summary, setSummary] = useState<WorkspaceBillingSummaryPayload | null>(
    null,
  );
  const [invoices, setInvoices] = useState<WorkspaceBillingInvoice[]>([]);
  const [billingPhone, setBillingPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<
    "none" | "cancel" | "checkout" | "refresh"
  >("none");
  const [notice, setNotice] = useState<InlineNotice | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [pricingDialogOpen, setPricingDialogOpen] = useState(false);
  const autoRefreshRef = useRef(false);

  const invoiceLimit = surface === "overlay" ? 4 : 10;

  const loadBillingState = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!options?.silent) {
        setLoading(true);
      }

      const [summaryResult, invoicesResult] = await Promise.allSettled([
        fetchWorkspaceBillingSummary(),
        fetchWorkspaceBillingInvoices(),
      ]);

      if (summaryResult.status === "fulfilled") {
        setSummary(summaryResult.value);
      } else {
        const normalized = await normalizeWorkspaceBillingError(
          summaryResult.reason,
          "Gagal memuat billing workspace.",
        );
        setNotice({
          tone: "error",
          text: `[${normalized.code}] ${normalized.message}`,
        });
        setLoading(false);
        return;
      }

      if (invoicesResult.status === "fulfilled") {
        setInvoices(invoicesResult.value.invoices);
      } else {
        const normalized = await normalizeWorkspaceBillingError(
          invoicesResult.reason,
          "Gagal memuat riwayat pembayaran workspace.",
        );
        setNotice({
          tone: "warning",
          text: `[${normalized.code}] ${normalized.message}`,
        });
      }

      setLoading(false);
    },
    [],
  );

  useEffect(() => {
    void loadBillingState();
  }, [loadBillingState]);

  useEffect(() => {
    const handleRefresh = () => {
      void loadBillingState({ silent: true });
    };

    window.addEventListener(
      "workspace:changed",
      handleRefresh as EventListener,
    );
    window.addEventListener(
      "dashboard:refresh",
      handleRefresh as EventListener,
    );

    return () => {
      window.removeEventListener(
        "workspace:changed",
        handleRefresh as EventListener,
      );
      window.removeEventListener(
        "dashboard:refresh",
        handleRefresh as EventListener,
      );
    };
  }, [loadBillingState]);

  const handleRefreshPending = useCallback(async () => {
    setBusyAction("refresh");
    setNotice(null);

    try {
      const nextSummary = await refreshWorkspacePendingInvoice();
      setSummary(nextSummary);

      const nextInvoices: WorkspaceBillingInvoicesPayload =
        await fetchWorkspaceBillingInvoices();
      setInvoices(nextInvoices.invoices);
      await refreshWorkspaceSubscription();
      window.dispatchEvent(new CustomEvent("dashboard:refresh"));
      setNotice({
        tone: "success",
        text: "Status invoice berhasil diperbarui.",
      });
    } catch (error) {
      const normalized = await normalizeWorkspaceBillingError(
        error,
        "Gagal menyegarkan status pembayaran workspace.",
      );
      setNotice({
        tone: "error",
        text: `[${normalized.code}] ${normalized.message}`,
      });
    } finally {
      setBusyAction("none");
    }
  }, []);

  useEffect(() => {
    if (
      surface !== "page" ||
      autoRefreshRef.current ||
      !summary?.pendingInvoice ||
      summary.pendingInvoice.status !== "pending"
    ) {
      return;
    }

    autoRefreshRef.current = true;
    void handleRefreshPending();
  }, [handleRefreshPending, summary?.pendingInvoice, surface]);

  const handleCheckout = useCallback(async () => {
    if (!billingPhone.trim()) {
      setNotice({
        tone: "warning",
        text: "Masukkan nomor WhatsApp billing terlebih dahulu.",
      });
      return;
    }

    setBusyAction("checkout");
    setNotice(null);
    setPricingDialogOpen(false);

    try {
      const result = await startWorkspaceBillingCheckout({
        billingPhone: billingPhone.trim(),
        createCheckout: createWorkspaceCheckout,
        redirectToCheckout: (paymentUrl) => {
          window.location.assign(paymentUrl);
        },
        refreshBillingState: () => loadBillingState({ silent: true }),
      });
      if ("notice" in result) {
        setNotice(result.notice);
      }
    } catch (error) {
      const normalized = await normalizeWorkspaceBillingError(
        error,
        "Gagal membuat checkout workspace.",
      );
      setNotice({
        tone: "error",
        text: `[${normalized.code}] ${normalized.message}`,
      });
    } finally {
      setBusyAction("none");
    }
  }, [billingPhone, loadBillingState]);

  const handleCancelPendingInvoice = useCallback(async () => {
    setBusyAction("cancel");
    setNotice(null);

    try {
      const result = await cancelWorkspaceBillingCheckout({
        cancelCheckout: async () => {
          await cancelWorkspacePendingInvoiceRequest();
        },
        refreshBillingState: () => loadBillingState({ silent: true }),
      });
      setCancelDialogOpen(false);
      setNotice(result.notice);

      const nextInvoices: WorkspaceBillingInvoicesPayload =
        await fetchWorkspaceBillingInvoices();
      setInvoices(nextInvoices.invoices);
      await refreshWorkspaceSubscription();
      window.dispatchEvent(new CustomEvent("dashboard:refresh"));
    } catch (error) {
      const normalized = await normalizeWorkspaceBillingError(
        error,
        "Gagal membatalkan invoice pending workspace.",
      );
      setNotice({
        tone: "error",
        text: `[${normalized.code}] ${normalized.message}`,
      });
    } finally {
      setBusyAction("none");
    }
  }, [loadBillingState]);

  const restrictedCopy = useMemo(
    () =>
      summary?.restrictedState
        ? getRestrictedWorkspaceOverlayCopy({
            activeDevices: summary.restrictedState.activeDevices,
            activeMembers: summary.restrictedState.activeMembers,
            canManageRecovery: true,
            overFreeDeviceLimit: summary.restrictedState.overFreeDeviceLimit,
            overFreeMemberLimit: summary.restrictedState.overFreeMemberLimit,
          })
        : null,
    [summary?.restrictedState],
  );

  const visibleInvoices = invoices.slice(0, invoiceLimit);
  const currentPeriodLabel = summary?.currentSubscription
    ? formatWorkspaceBillingPeriod(
        summary.currentSubscription.currentPeriodStartsAt,
        summary.currentSubscription.currentPeriodEndsAt,
      )
    : "Belum ada periode aktif";
  const pendingInvoicePaymentUrl = summary?.pendingInvoice?.paymentUrl;
  const checkoutActionLabel = summary
    ? getWorkspaceCheckoutActionLabel(summary)
    : "Aktifkan Pro";

  return (
    <Card
      className={cn(
        "border-zinc-200 bg-white shadow-sm",
        surface === "overlay" && "border-amber-200/80 bg-white/95 shadow-lg",
        className,
      )}
    >
      <CardHeader className={cn(surface === "overlay" ? "pb-4" : "pb-5")}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Billing Workspace</CardTitle>
            <CardDescription className="mt-1">
              Kelola aktivasi Pro 30 hari, lanjutkan invoice pending, dan lihat
              riwayat pembayaran.
            </CardDescription>
          </div>
          <div className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-700">
            {summary ? summary.plan : "memuat"}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {notice ? (
          <div
            className={cn(
              "rounded-lg border px-3 py-2 text-sm",
              noticeClass(notice.tone),
            )}
            role={notice.tone === "error" ? "alert" : "status"}
          >
            {notice.text}
          </div>
        ) : null}

        {loading && !summary ? (
          <div className="space-y-3">
            <div className="h-24 animate-pulse rounded-xl border border-zinc-200 bg-zinc-50 motion-reduce:animate-none" />
            <div className="h-40 animate-pulse rounded-xl border border-zinc-200 bg-zinc-50 motion-reduce:animate-none" />
          </div>
        ) : null}

        {summary ? (
          <>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                  Plan aktif
                </p>
                <p className="mt-2 text-lg font-semibold text-zinc-950">
                  {summary.plan.toUpperCase()}
                </p>
                <p className="mt-1 text-sm text-zinc-600">
                  Periode aktif: {currentPeriodLabel}
                </p>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                  Invoice pending
                </p>
                <p className="mt-2 text-lg font-semibold text-zinc-950">
                  {summary.pendingInvoice
                    ? getInvoiceStatusLabel(summary.pendingInvoice.status)
                    : "Tidak ada"}
                </p>
                <p className="mt-1 text-sm text-zinc-600">
                  {getPendingInvoiceCopy(summary.pendingInvoice)}
                </p>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                  Kepatuhan Free
                </p>
                <p className="mt-2 text-lg font-semibold text-zinc-950">
                  {summary.restrictedState.activeMembers} member ·{" "}
                  {summary.restrictedState.activeDevices} device
                </p>
                <p className="mt-1 text-sm text-zinc-600">
                  {restrictedCopy?.memberTargetLabel} ·{" "}
                  {restrictedCopy?.deviceTargetLabel}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-950">
                    Checkout Pro 30 hari
                  </h3>
                  <p className="mt-1 text-sm text-zinc-600">
                    Masukkan nomor WhatsApp billing superadmin untuk membuat
                    atau melanjutkan invoice Mayar.
                  </p>
                  {summary.restrictedState.isRestricted ? (
                    <p className="mt-2 text-sm font-medium text-amber-700">
                      {restrictedCopy?.actionLabel}
                    </p>
                  ) : null}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void loadBillingState({ silent: true })}
                >
                  <ArrowsClockwise className="h-4 w-4" weight="regular" />
                  Muat ulang
                </Button>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
                <label className="space-y-1">
                  <span className="text-sm font-medium text-zinc-700">
                    Nomor WhatsApp billing
                  </span>
                  <Input
                    value={billingPhone}
                    onChange={(event) => setBillingPhone(event.target.value)}
                    placeholder="Contoh: +62 81234567890"
                  />
                </label>
                <div className="flex items-end">
                  <Button
                    onClick={() => setPricingDialogOpen(true)}
                    disabled={
                      !canOpenWorkspaceCheckoutDialog(summary) ||
                      !billingPhone.trim()
                    }
                    isLoading={busyAction === "checkout"}
                    loadingText={
                      summary.pendingInvoice
                        ? "Membuka invoice..."
                        : "Membuat invoice..."
                    }
                  >
                    {checkoutActionLabel}
                  </Button>
                </div>
                <div className="flex items-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => void handleRefreshPending()}
                    disabled={!summary.allowedActions.canRefreshPendingInvoice}
                    isLoading={busyAction === "refresh"}
                    loadingText="Menyegarkan..."
                  >
                    Refresh status
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setCancelDialogOpen(true)}
                    disabled={!summary.allowedActions.canCancelPendingInvoice}
                    isLoading={busyAction === "cancel"}
                    loadingText="Membatalkan..."
                  >
                    Batalkan invoice
                  </Button>
                  {pendingInvoicePaymentUrl ? (
                    <Button
                      variant="outline"
                      onClick={() =>
                        window.location.assign(pendingInvoicePaymentUrl)
                      }
                    >
                      Buka invoice
                    </Button>
                  ) : null}
                </div>
              </div>

              {summary.pendingInvoice?.status === "pending_initializing" ? (
                <p className="mt-3 text-sm text-amber-700">
                  Sinkronisasi invoice masih tertunda. Jangan buat checkout baru
                  sampai referensi Mayar tersedia.
                </p>
              ) : null}

              {summary.currentSubscription ? (
                <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-3 text-sm text-zinc-700">
                  <p>
                    Status entitlement:{" "}
                    <span className="font-semibold text-zinc-950">
                      {summary.currentSubscription.status}
                    </span>
                  </p>
                  <p className="mt-1">
                    Mulai:{" "}
                    {formatDateTime(summary.currentSubscription.activatedAt)}
                  </p>
                  <p className="mt-1">
                    Berakhir:{" "}
                    {formatDateTime(
                      summary.currentSubscription.currentPeriodEndsAt,
                    )}
                  </p>
                </div>
              ) : null}
            </div>

            <WorkspaceCheckoutPricingDialog
              billingPhone={billingPhone}
              busyAction={busyAction}
              onConfirm={() => void handleCheckout()}
              onOpenChange={setPricingDialogOpen}
              open={pricingDialogOpen}
              summary={summary}
            />

            <div className="rounded-xl border border-zinc-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-950">
                    Riwayat invoice
                  </h3>
                  <p className="mt-1 text-sm text-zinc-600">
                    Riwayat pembayaran Mayar terakhir untuk workspace ini.
                  </p>
                </div>
                <p className="text-xs text-zinc-500">
                  Menampilkan {visibleInvoices.length} invoice
                </p>
              </div>

              <div className="mt-4 overflow-hidden rounded-xl border border-zinc-200">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Referensi</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Periode</TableHead>
                      <TableHead>Dibuat</TableHead>
                      <TableHead>Pembayaran</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleInvoices.length === 0 ? (
                      <TableRow>
                        <TableCell
                          className="h-20 text-center text-zinc-500"
                          colSpan={7}
                        >
                          Belum ada invoice billing untuk workspace ini.
                        </TableCell>
                      </TableRow>
                    ) : (
                      visibleInvoices.map((invoice) => (
                        <TableRow key={invoice.invoiceId}>
                          <TableCell>
                            <span
                              className={cn(
                                "inline-flex rounded-full border px-2 py-1 text-xs font-medium",
                                statusBadgeClass(invoice.status),
                              )}
                            >
                              {getInvoiceStatusLabel(invoice.status)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1 text-xs text-zinc-600">
                              <p>
                                Mayar:{" "}
                                <span className="font-medium text-zinc-950">
                                  {invoice.providerInvoiceId ?? "-"}
                                </span>
                              </p>
                              <p>
                                Transaksi:{" "}
                                <span className="font-medium text-zinc-950">
                                  {invoice.providerTransactionId ?? "-"}
                                </span>
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            {formatCurrencyIdr(invoice.amount)}
                          </TableCell>
                          <TableCell>
                            {formatInvoiceCoveragePeriod(invoice)}
                          </TableCell>
                          <TableCell>
                            {formatDateTime(invoice.issuedAt)}
                          </TableCell>
                          <TableCell>
                            {invoice.paidAt
                              ? formatDateTime(invoice.paidAt)
                              : formatDateTime(invoice.expiresAt)}
                          </TableCell>
                          <TableCell className="text-right">
                            <InvoiceRowActions invoice={invoice} />
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </>
        ) : null}
      </CardContent>
      <ConfirmationDialog
        cancelLabel="Kembali"
        confirmLabel="Batalkan invoice"
        description="Invoice pending akan ditutup agar workspace bisa membuat checkout baru. Tindakan ini tidak bisa dibatalkan dari dashboard."
        isPending={busyAction === "cancel"}
        onConfirm={() => void handleCancelPendingInvoice()}
        onOpenChange={setCancelDialogOpen}
        open={cancelDialogOpen}
        title="Batalkan invoice pending?"
        tone="destructive"
      />
    </Card>
  );
}
