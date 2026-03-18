"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { parseApiErrorResponse } from "@/lib/client-error";
import {
  buildDeviceLimitNoticeCopy,
  refreshWorkspaceSubscription,
  useWorkspaceSubscriptionClient,
} from "@/lib/workspace-subscription-client";
import {
  getActiveWorkspaceIdFromBrowser,
  recoverWorkspaceScopeViolation,
  workspaceFetch,
} from "@/lib/workspace-client";
import { cn } from "@/lib/utils";
import type {
  DeviceRegistrationCodeRow,
  ManagedDeviceRow,
} from "@/types/dashboard";

import {
  buildDeviceRevokeConfirmation,
  buildDeviceManagementWorkspaceChangeReset,
  getLatestRegistrationCode,
  type GeneratedRegistrationCode,
  isDeviceActionPending,
  isDeviceManagementVisible,
  startRenameSubmission,
  startRevokeSubmission,
} from "./device-management-panel-state";
import { LatestRegistrationCodeCard } from "./latest-registration-code-card";

type DeviceManagementPanelProps = {
  role: "admin" | "superadmin";
};

type DataBlockStatus = "idle" | "loading" | "ready" | "error";

function formatDateTime(value?: number) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString("id-ID");
}

function buildCodesSummary(registrationCodes: DeviceRegistrationCodeRow[]) {
  let activeCount = 0;

  for (const row of registrationCodes) {
    if (row.status === "pending") {
      activeCount += 1;
    }
  }

  return {
    totalCount: registrationCodes.length,
    activeCount,
  };
}

function buildDevicesSummary(devices: ManagedDeviceRow[]) {
  let activeCount = 0;
  let onlineCount = 0;

  for (const row of devices) {
    if (row.status === "active") {
      activeCount += 1;
    }

    if (row.online) {
      onlineCount += 1;
    }
  }

  return {
    totalCount: devices.length,
    activeCount,
    onlineCount,
  };
}

function DeviceStatusBadge({
  children,
  tone = "neutral",
}: {
  children: string;
  tone?: "neutral" | "success" | "danger";
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]",
        tone === "success"
          ? "border-emerald-200 bg-emerald-50/80 text-emerald-800"
          : tone === "danger"
            ? "border-rose-200 bg-rose-50/80 text-rose-800"
            : "border-zinc-200 bg-zinc-50 text-zinc-700",
      )}
    >
      {children}
    </span>
  );
}

function SummaryStatCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-zinc-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums text-zinc-950">
        {value}
      </p>
      <p className="mt-1 text-xs leading-5 text-zinc-500">{detail}</p>
    </div>
  );
}

function InlineNotice({
  children,
  tone = "default",
}: {
  children: string;
  tone?: "default" | "warning";
}) {
  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-3 text-sm",
        tone === "warning"
          ? "border-amber-200 bg-amber-50 text-amber-900"
          : "border-zinc-200 bg-zinc-50 text-zinc-700",
      )}
    >
      {children}
    </div>
  );
}

function EmptyState({ children }: { children: string }) {
  return (
    <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-6 text-sm leading-6 text-zinc-600">
      {children}
    </div>
  );
}

function SectionHeading({
  title,
  description,
  meta,
  align = "start",
}: {
  title: string;
  description: string;
  meta?: ReactNode;
  align?: "start" | "center";
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 border-b border-zinc-100 pb-4 sm:flex-row sm:justify-between",
        align === "center" ? "sm:items-center" : "sm:items-start",
      )}
    >
      <div>
        <h3 className="text-base font-semibold tracking-tight text-zinc-950">
          {title}
        </h3>
        <p className="mt-1 text-sm leading-6 text-zinc-500">{description}</p>
      </div>
      {meta ? meta : null}
    </div>
  );
}

function DataBlockError({
  message,
  actionLabel,
  isPending = false,
  onAction,
}: {
  message: string;
  actionLabel: string;
  isPending?: boolean;
  onAction: () => void;
}) {
  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-4 text-sm text-rose-900">
      <p>{message}</p>
      <Button
        className="mt-3"
        variant="outline"
        size="sm"
        isLoading={isPending}
        onClick={onAction}
      >
        {actionLabel}
      </Button>
    </div>
  );
}

function DeviceListSkeleton() {
  return (
    <div className="space-y-3">
      <div className="hidden md:block">
        <div className="rounded-xl border border-zinc-200">
          <div className="grid grid-cols-[1.4fr_0.9fr_0.9fr_1fr_1fr_1.1fr] gap-3 border-b border-zinc-100 px-4 py-3">
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} className="h-4 w-full" />
            ))}
          </div>
          {Array.from({ length: 4 }, (_, index) => (
            <div
              key={index}
              className="grid grid-cols-[1.4fr_0.9fr_0.9fr_1fr_1fr_1.1fr] gap-3 border-b border-zinc-100 px-4 py-4 last:border-b-0"
            >
              {Array.from({ length: 6 }, (_, cellIndex) => (
                <Skeleton key={cellIndex} className="h-4 w-full" />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-3 md:hidden">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="rounded-2xl border border-zinc-200 p-4">
            <Skeleton className="h-5 w-36" />
            <div className="mt-4 flex gap-2">
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-24 rounded-full" />
            </div>
            <div className="mt-4 space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RegistrationCodeListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="rounded-2xl border border-zinc-200 p-4">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="mt-4 space-y-2">
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-3/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function DeviceManagementPanel({ role }: DeviceManagementPanelProps) {
  const workspaceSubscriptionState = useWorkspaceSubscriptionClient();
  const [registrationCodes, setRegistrationCodes] = useState<DeviceRegistrationCodeRow[]>([]);
  const [devices, setDevices] = useState<ManagedDeviceRow[]>([]);
  const [generatedCode, setGeneratedCode] = useState<GeneratedRegistrationCode | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [registrationCodesStatus, setRegistrationCodesStatus] =
    useState<DataBlockStatus>("idle");
  const [devicesStatus, setDevicesStatus] = useState<DataBlockStatus>("idle");
  const [registrationCodesError, setRegistrationCodesError] = useState<string | null>(null);
  const [devicesError, setDevicesError] = useState<string | null>(null);
  const [renameDeviceId, setRenameDeviceId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [submittingRenameId, setSubmittingRenameId] = useState<string | null>(null);
  const [confirmRevokeDevice, setConfirmRevokeDevice] =
    useState<Pick<ManagedDeviceRow, "deviceId" | "label"> | null>(null);
  const [revokingDeviceId, setRevokingDeviceId] = useState<string | null>(null);
  const [setupUrl, setSetupUrl] = useState<string | null>(null);
  const [toolbarAction, setToolbarAction] =
    useState<"none" | "generate" | "refresh" | "copy">("none");

  const resetForWorkspaceChange = useCallback((workspaceId: string | null) => {
    const nextState = buildDeviceManagementWorkspaceChangeReset(
      workspaceId,
      typeof window === "undefined" ? null : window.location.origin,
    );

    setSetupUrl(nextState.setupUrl);
    setGeneratedCode(nextState.generatedCode);
    setNotice(nextState.notice);
    setRegistrationCodes(nextState.registrationCodes);
    setDevices(nextState.devices);
    setRegistrationCodesStatus(nextState.registrationCodesStatus);
    setDevicesStatus(nextState.devicesStatus);
    setRegistrationCodesError(nextState.registrationCodesError);
    setDevicesError(nextState.devicesError);
    setRenameDeviceId(nextState.renameDeviceId);
    setRenameDraft(nextState.renameDraft);
    setSubmittingRenameId(nextState.submittingRenameId);
    setConfirmRevokeDevice(nextState.confirmRevokeDevice);
    setRevokingDeviceId(nextState.revokingDeviceId);
  }, []);

  const loadRegistrationCodes = useCallback(async (showLoading: boolean) => {
    if (showLoading) {
      setRegistrationCodesStatus("loading");
    }

    const response = await workspaceFetch("/api/admin/device/registration-codes", {
      cache: "no-store",
    });

    if (!response.ok) {
      const error = await parseApiErrorResponse(
        response,
        "Gagal memuat registration code.",
      );

      if (recoverWorkspaceScopeViolation(error.code)) {
        return;
      }

      setRegistrationCodesError(`[${error.code}] ${error.message}`);
      setRegistrationCodesStatus("error");
      return;
    }

    const payload = (await response.json()) as DeviceRegistrationCodeRow[];
    setRegistrationCodes(payload);
    setRegistrationCodesError(null);
    setRegistrationCodesStatus("ready");
  }, []);

  const loadDevices = useCallback(async (showLoading: boolean) => {
    if (showLoading) {
      setDevicesStatus("loading");
    }

    const response = await workspaceFetch("/api/admin/device/devices", {
      cache: "no-store",
    });

    if (!response.ok) {
      const error = await parseApiErrorResponse(response, "Gagal memuat daftar device.");

      if (recoverWorkspaceScopeViolation(error.code)) {
        return;
      }

      setDevicesError(`[${error.code}] ${error.message}`);
      setDevicesStatus("error");
      return;
    }

    const payload = (await response.json()) as ManagedDeviceRow[];
    setDevices(payload);
    setDevicesError(null);
    setDevicesStatus("ready");
  }, []);

  const refreshAll = useCallback(async (showLoading: boolean) => {
    await Promise.all([
      loadRegistrationCodes(showLoading),
      loadDevices(showLoading),
    ]);
  }, [loadDevices, loadRegistrationCodes]);

  useEffect(() => {
    if (!isDeviceManagementVisible(role)) {
      return;
    }

    const initialWorkspaceId = getActiveWorkspaceIdFromBrowser();
    resetForWorkspaceChange(initialWorkspaceId);
    void refreshAll(false);

    const handleWorkspaceChanged = (event: Event) => {
      const nextWorkspaceId =
        (event as CustomEvent<{ workspaceId?: string | null }>).detail?.workspaceId ??
        getActiveWorkspaceIdFromBrowser();
      resetForWorkspaceChange(nextWorkspaceId);
      void refreshAll(false);
    };

    const handleRefresh = () => {
      void refreshAll(true);
    };

    window.addEventListener("workspace:changed", handleWorkspaceChanged as EventListener);
    window.addEventListener("dashboard:refresh", handleRefresh as EventListener);

    return () => {
      window.removeEventListener("workspace:changed", handleWorkspaceChanged as EventListener);
      window.removeEventListener("dashboard:refresh", handleRefresh as EventListener);
    };
  }, [refreshAll, resetForWorkspaceChange, role]);

  if (!isDeviceManagementVisible(role)) {
    return null;
  }

  const latestRegistrationCode = getLatestRegistrationCode(registrationCodes);
  const codesSummary = buildCodesSummary(registrationCodes);
  const devicesSummary = buildDevicesSummary(devices);
  const activeDeviceCount =
    workspaceSubscriptionState.ready
      ? (workspaceSubscriptionState.subscription?.usage.activeDevices ??
        devicesSummary.activeCount)
      : devicesSummary.activeCount;
  const maxDevicesPerWorkspace =
    workspaceSubscriptionState.ready
      ? (workspaceSubscriptionState.subscription?.limits.maxDevicesPerWorkspace ?? null)
      : null;
  const deviceLimitNotice = buildDeviceLimitNoticeCopy(
    activeDeviceCount,
    maxDevicesPerWorkspace,
  );
  const generateCodeDisabled = !workspaceSubscriptionState.ready || deviceLimitNotice !== null;

  async function refresh() {
    setToolbarAction("refresh");
    try {
      await Promise.all([refreshAll(true), refreshWorkspaceSubscription()]);
    } finally {
      setToolbarAction("none");
    }
  }

  async function generateCode() {
    if (generateCodeDisabled) {
      setNotice(deviceLimitNotice);
      return;
    }

    setToolbarAction("generate");

    try {
      const response = await workspaceFetch("/api/admin/device/registration-codes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const error = await parseApiErrorResponse(
          response,
          "Gagal membuat registration code.",
        );

        if (recoverWorkspaceScopeViolation(error.code)) {
          return;
        }

        setNotice(`[${error.code}] ${error.message}`);
        return;
      }

      const payload = (await response.json()) as GeneratedRegistrationCode;
      setGeneratedCode(payload);
      setNotice("Registration code baru berhasil dibuat. Salin code sebelum menutup halaman ini.");
      await refreshAll(false);
    } finally {
      setToolbarAction("none");
    }
  }

  async function copyGeneratedCode() {
    if (!generatedCode || typeof navigator === "undefined" || !navigator.clipboard) {
      return;
    }

    setToolbarAction("copy");
    try {
      await navigator.clipboard.writeText(generatedCode.code);
      setNotice("Registration code berhasil disalin.");
    } catch {
      setNotice("Gagal menyalin registration code. Salin manual dari panel terbaru.");
    } finally {
      setToolbarAction("none");
    }
  }

  async function submitRename(deviceId: string) {
    const nextLabel = renameDraft.trim();
    if (!nextLabel) {
      setNotice("Nama device tidak boleh kosong.");
      return;
    }

    const nextState = startRenameSubmission(deviceId);
    setSubmittingRenameId(nextState.submittingRenameId);

    try {
      const response = await workspaceFetch(`/api/admin/device/devices/${deviceId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ label: nextLabel }),
      });

      if (!response.ok) {
        const error = await parseApiErrorResponse(response, "Gagal mengubah nama device.");

        if (recoverWorkspaceScopeViolation(error.code)) {
          return;
        }

        setNotice(`[${error.code}] ${error.message}`);
        return;
      }

      setRenameDeviceId(null);
      setRenameDraft("");
      setNotice("Nama device berhasil diperbarui.");
      await loadDevices(false);
    } finally {
      setSubmittingRenameId(null);
    }
  }

  async function revokeDevice(deviceId: string) {
    const nextState = startRevokeSubmission(deviceId);
    setRevokingDeviceId(nextState.revokingDeviceId);

    try {
      const response = await workspaceFetch(`/api/admin/device/devices/${deviceId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ revoke: true }),
      });

      if (!response.ok) {
        const error = await parseApiErrorResponse(response, "Gagal mencabut device.");

        if (recoverWorkspaceScopeViolation(error.code)) {
          return;
        }

        setNotice(`[${error.code}] ${error.message}`);
        return;
      }

      setNotice("Device berhasil direvoke.");
      await Promise.all([loadDevices(false), refreshWorkspaceSubscription()]);
    } finally {
      setConfirmRevokeDevice(null);
      setRevokingDeviceId(null);
    }
  }

  function startRename(deviceId: string, label: string) {
    setRenameDeviceId(deviceId);
    setRenameDraft(label);
  }

  function stopRename() {
    setRenameDeviceId(null);
    setRenameDraft("");
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-16">
      <ConfirmationDialog
        open={Boolean(confirmRevokeDevice)}
        title={confirmRevokeDevice ? buildDeviceRevokeConfirmation(confirmRevokeDevice.label).title : ""}
        description={
          confirmRevokeDevice ? buildDeviceRevokeConfirmation(confirmRevokeDevice.label).description : ""
        }
        confirmLabel="Ya, revoke"
        cancelLabel="Batal"
        tone="destructive"
        isPending={
          confirmRevokeDevice
            ? isDeviceActionPending(confirmRevokeDevice.deviceId, revokingDeviceId)
            : false
        }
        onConfirm={() => {
          if (!confirmRevokeDevice) {
            return;
          }

          void revokeDevice(confirmRevokeDevice.deviceId);
        }}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmRevokeDevice(null);
          }
        }}
      />

      <Card className="overflow-hidden border-zinc-200 shadow-sm">
        <CardHeader className="gap-5 border-b border-zinc-100 bg-zinc-50/70 p-5 md:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-2xl">
              <div className="flex flex-wrap items-center gap-2">
                <DeviceStatusBadge tone="success">superadmin</DeviceStatusBadge>
                <span className="text-xs text-zinc-500">
                  Workspace aktif memengaruhi code dan device yang tampil.
                </span>
              </div>
              <CardTitle className="mt-3 text-xl font-semibold tracking-tight text-zinc-950 md:text-2xl">
                Kelola device QR permanen dari satu workspace aktif
              </CardTitle>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                Buat registration code baru, pantau status online perangkat, ubah
                label, dan cabut device yang sudah tidak dipakai tanpa berpindah
                alur kerja.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={generateCodeDisabled}
                isLoading={toolbarAction === "generate"}
                onClick={() => void generateCode()}
              >
                Generate code
              </Button>
              <Button
                size="sm"
                variant="outline"
                isLoading={toolbarAction === "refresh"}
                onClick={() => void refresh()}
              >
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 p-5 md:grid-cols-3 md:p-6">
          <SummaryStatCard
            label="Device aktif"
            value={devicesSummary.activeCount}
            detail={`dari ${devicesSummary.totalCount} device permanen`}
          />
          <SummaryStatCard
            label="Sedang online"
            value={devicesSummary.onlineCount}
            detail="perangkat terdeteksi aktif sekarang"
          />
          <SummaryStatCard
            label="Registration code aktif"
            value={codesSummary.activeCount}
            detail={`dari ${codesSummary.totalCount} code yang tercatat`}
          />
        </CardContent>
      </Card>

      {notice ? (
        <InlineNotice>{notice}</InlineNotice>
      ) : null}
      {workspaceSubscriptionState.ready && deviceLimitNotice ? (
        <InlineNotice tone="warning">{deviceLimitNotice}</InlineNotice>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
        <Card className="border-zinc-200 shadow-sm">
          <CardContent className="p-5">
            <SectionHeading
              title="Registration code terbaru"
              description="Gunakan code aktif terbaru untuk pairing device QR baru."
              meta={
                <DeviceStatusBadge
                  tone={latestRegistrationCode?.status === "pending" ? "success" : "neutral"}
                >
                  {latestRegistrationCode?.status ?? "belum ada"}
                </DeviceStatusBadge>
              }
            />

            <div className="mt-4">
              {registrationCodesStatus === "loading" ? (
                <div className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-7 w-48" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-20 w-full rounded-xl" />
                </div>
              ) : registrationCodesStatus === "error" && registrationCodesError ? (
                <DataBlockError
                  message={registrationCodesError}
                  actionLabel="Muat ulang registration code"
                  isPending={toolbarAction === "refresh"}
                  onAction={() => void loadRegistrationCodes(true)}
                />
              ) : (
                <>
                  <LatestRegistrationCodeCard
                    generatedCode={generatedCode}
                    registrationCodes={registrationCodes}
                    setupUrl={setupUrl}
                  />
                  {generatedCode ? (
                    <Button
                      className="mt-3"
                      size="sm"
                      variant="outline"
                      isLoading={toolbarAction === "copy"}
                      onClick={() => void copyGeneratedCode()}
                    >
                      Copy latest code
                    </Button>
                  ) : null}
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-zinc-200 shadow-sm">
          <CardContent className="p-5">
            <SectionHeading
              title="Riwayat registration code"
              description="Pantau code yang masih aktif, sudah diklaim, atau sudah expired."
              meta={
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
                  {codesSummary.totalCount} code
                </p>
              }
              align="center"
            />

            <div className="mt-4">
              {registrationCodesStatus === "loading" ? (
                <RegistrationCodeListSkeleton />
              ) : registrationCodesStatus === "error" && registrationCodesError ? (
                <DataBlockError
                  message={registrationCodesError}
                  actionLabel="Coba lagi"
                  isPending={toolbarAction === "refresh"}
                  onAction={() => void loadRegistrationCodes(true)}
                />
              ) : registrationCodes.length === 0 ? (
                <EmptyState>
                  Belum ada registration code aktif untuk workspace ini. Mulai
                  dengan membuat registration code lalu pair device pertama.
                </EmptyState>
              ) : (
                <div className="space-y-3">
                  {registrationCodes.map((row) => (
                    <div
                      key={row.codeId}
                      className="rounded-xl border border-zinc-200 bg-zinc-50/40 px-4 py-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <DeviceStatusBadge
                            tone={row.status === "pending" ? "success" : "neutral"}
                          >
                            {row.status}
                          </DeviceStatusBadge>
                          <p className="font-mono text-xs text-zinc-500">{row.codeId}</p>
                        </div>
                        <p className="text-xs text-zinc-500">
                          Dibuat {formatDateTime(row.createdAt)}
                        </p>
                      </div>

                      <div className="mt-4 grid gap-3 text-sm text-zinc-600 sm:grid-cols-3">
                        <div>
                          <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">
                            Expired
                          </p>
                          <p className="mt-1 text-zinc-900">{formatDateTime(row.expiresAt)}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">
                            Claimed At
                          </p>
                          <p className="mt-1 text-zinc-900">{formatDateTime(row.claimedAt)}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">
                            Claimed By
                          </p>
                          <p className="mt-1 break-all text-zinc-900">
                            {row.claimedByDeviceId ?? "-"}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-zinc-200 shadow-sm">
        <CardContent className="p-5">
          <SectionHeading
            title="Daftar device"
            description="Monitor status online device permanen dan lakukan rename atau revoke bila diperlukan."
            meta={
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
                {devicesSummary.totalCount} device
              </p>
            }
            align="center"
          />

          <div className="mt-5">
            {devicesStatus === "loading" ? (
              <DeviceListSkeleton />
            ) : devicesStatus === "error" && devicesError ? (
              <DataBlockError
                message={devicesError}
                actionLabel="Muat ulang device"
                isPending={toolbarAction === "refresh"}
                onAction={() => void loadDevices(true)}
              />
            ) : devices.length === 0 ? (
              <EmptyState>
                Belum ada device permanen. Generate registration code baru lalu
                pair device pertama untuk workspace ini.
              </EmptyState>
            ) : (
              <>
                <div className="hidden overflow-hidden rounded-xl border border-zinc-200 md:block">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-zinc-50/80 hover:bg-zinc-50/80">
                        <TableHead className="pl-4">Label</TableHead>
                        <TableHead>Lifecycle</TableHead>
                        <TableHead>Online</TableHead>
                        <TableHead>Last Seen</TableHead>
                        <TableHead>Claimed At</TableHead>
                        <TableHead className="pr-4">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {devices.map((row) => (
                        <TableRow key={row.deviceId}>
                          <TableCell className="align-top pl-4">
                            {renameDeviceId === row.deviceId ? (
                              <div className="space-y-2">
                                <Input
                                  value={renameDraft}
                                  onChange={(event) => setRenameDraft(event.target.value)}
                                />
                                <div className="flex flex-wrap gap-2">
                                  <Button
                                    size="sm"
                                    isLoading={isDeviceActionPending(row.deviceId, submittingRenameId)}
                                    onClick={() => void submitRename(row.deviceId)}
                                  >
                                    Simpan
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={stopRename}
                                  >
                                    Batal
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div>
                                <p className="font-medium leading-6 text-zinc-950">{row.label}</p>
                                <p className="mt-1 text-xs text-zinc-500">{row.deviceId}</p>
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <DeviceStatusBadge tone={row.status === "active" ? "success" : "danger"}>
                              {row.status}
                            </DeviceStatusBadge>
                          </TableCell>
                          <TableCell>
                            <DeviceStatusBadge tone={row.online ? "success" : "neutral"}>
                              {row.online ? "online" : "offline"}
                            </DeviceStatusBadge>
                          </TableCell>
                          <TableCell className="whitespace-normal text-sm leading-6 text-zinc-600">
                            {formatDateTime(row.lastSeenAt)}
                          </TableCell>
                          <TableCell className="whitespace-normal text-sm leading-6 text-zinc-600">
                            {formatDateTime(row.claimedAt)}
                          </TableCell>
                          <TableCell className="pr-4">
                            <div className="flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => startRename(row.deviceId, row.label)}
                              >
                                Rename
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive-outline"
                                onClick={() =>
                                  setConfirmRevokeDevice({
                                    deviceId: row.deviceId,
                                    label: row.label,
                                  })
                                }
                              >
                                Revoke
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="space-y-3 md:hidden">
                  {devices.map((row) => (
                    <div
                      key={row.deviceId}
                      className="rounded-xl border border-zinc-200 bg-zinc-50/40 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-zinc-950">{row.label}</p>
                          <p className="mt-1 text-xs text-zinc-500">{row.deviceId}</p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <DeviceStatusBadge tone={row.online ? "success" : "neutral"}>
                            {row.online ? "online" : "offline"}
                          </DeviceStatusBadge>
                          <DeviceStatusBadge tone={row.status === "active" ? "success" : "danger"}>
                            {row.status}
                          </DeviceStatusBadge>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                        <div>
                          <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">
                            Last Seen
                          </p>
                          <p className="mt-1 text-zinc-900">{formatDateTime(row.lastSeenAt)}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">
                            Claimed At
                          </p>
                          <p className="mt-1 text-zinc-900">{formatDateTime(row.claimedAt)}</p>
                        </div>
                      </div>

                      {renameDeviceId === row.deviceId ? (
                        <div className="mt-4 space-y-2">
                          <Input
                            value={renameDraft}
                            onChange={(event) => setRenameDraft(event.target.value)}
                          />
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              isLoading={isDeviceActionPending(row.deviceId, submittingRenameId)}
                              onClick={() => void submitRename(row.deviceId)}
                            >
                              Simpan
                            </Button>
                            <Button size="sm" variant="outline" onClick={stopRename}>
                              Batal
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => startRename(row.deviceId, row.label)}
                          >
                            Rename
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive-outline"
                            onClick={() =>
                              setConfirmRevokeDevice({
                                deviceId: row.deviceId,
                                label: row.label,
                              })
                            }
                          >
                            Revoke
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
