"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Input } from "@/components/ui/input";
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
  getActiveWorkspaceIdFromBrowser,
  workspaceFetch,
} from "@/lib/workspace-client";
import type {
  DeviceRegistrationCodeRow,
  ManagedDeviceRow,
} from "@/types/dashboard";

import {
  buildDeviceRevokeConfirmation,
  buildDeviceSetupUrl,
  buildGeneratedCodeNotice,
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

export function DeviceManagementPanel({ role }: DeviceManagementPanelProps) {
  const [registrationCodes, setRegistrationCodes] = useState<DeviceRegistrationCodeRow[]>([]);
  const [devices, setDevices] = useState<ManagedDeviceRow[]>([]);
  const [generatedCode, setGeneratedCode] = useState<GeneratedRegistrationCode | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [renameDeviceId, setRenameDeviceId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [submittingRenameId, setSubmittingRenameId] = useState<string | null>(null);
  const [confirmRevokeDevice, setConfirmRevokeDevice] = useState<Pick<ManagedDeviceRow, "deviceId" | "label"> | null>(null);
  const [revokingDeviceId, setRevokingDeviceId] = useState<string | null>(null);
  const [setupUrl, setSetupUrl] = useState<string | null>(null);
  const [toolbarAction, setToolbarAction] = useState<"none" | "generate" | "refresh" | "copy">("none");

  useEffect(() => {
    const workspaceId = getActiveWorkspaceIdFromBrowser();
    if (!workspaceId || typeof window === "undefined") {
      return;
    }

    setSetupUrl(buildDeviceSetupUrl(workspaceId, window.location.origin));
  }, []);

  useEffect(() => {
    if (!isDeviceManagementVisible(role)) {
      return;
    }

    let active = true;

    const load = async () => {
      setIsLoading(true);
      try {
        const [codesResponse, devicesResponse] = await Promise.all([
          workspaceFetch("/api/admin/device/registration-codes", { cache: "no-store" }),
          workspaceFetch("/api/admin/device/devices", { cache: "no-store" }),
        ]);

        if (!codesResponse.ok || !devicesResponse.ok) {
          setNotice("Gagal memuat data device management.");
          return;
        }

        const [codesPayload, devicesPayload] = await Promise.all([
          codesResponse.json(),
          devicesResponse.json(),
        ]);

        if (!active) {
          return;
        }

        setRegistrationCodes(codesPayload as DeviceRegistrationCodeRow[]);
        setDevices(devicesPayload as ManagedDeviceRow[]);
        setNotice(null);
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [role]);

  if (!isDeviceManagementVisible(role)) {
    return null;
  }

  async function refresh() {
    setToolbarAction((current) => (current === "none" ? "refresh" : current));
    setIsLoading(true);
    try {
      const [codesResponse, devicesResponse] = await Promise.all([
        workspaceFetch("/api/admin/device/registration-codes", { cache: "no-store" }),
        workspaceFetch("/api/admin/device/devices", { cache: "no-store" }),
      ]);

      if (!codesResponse.ok || !devicesResponse.ok) {
        setNotice("Gagal memuat data device management.");
        return;
      }

      const [codesPayload, devicesPayload] = await Promise.all([
        codesResponse.json(),
        devicesResponse.json(),
      ]);

      setRegistrationCodes(codesPayload as DeviceRegistrationCodeRow[]);
      setDevices(devicesPayload as ManagedDeviceRow[]);
      setNotice(null);
    } finally {
      setIsLoading(false);
      setToolbarAction((current) => (current === "refresh" ? "none" : current));
    }
  }

  async function generateCode() {
    setToolbarAction("generate");
    try {
      const response = await workspaceFetch("/api/admin/device/registration-codes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const error = await parseApiErrorResponse(response, "Gagal membuat registration code.");
        setNotice(`[${error.code}] ${error.message}`);
        return;
      }

      const payload = (await response.json()) as GeneratedRegistrationCode;
      setGeneratedCode(payload);
      setNotice("Registration code baru berhasil dibuat. Salin code sebelum menutup halaman ini.");
      await refresh();
    } finally {
      setToolbarAction("none");
    }
  }

  async function copyGeneratedCode() {
    setToolbarAction("copy");
    const latestCode = buildGeneratedCodeNotice(generatedCode);
    if (!latestCode || typeof navigator === "undefined" || !navigator.clipboard) {
      setToolbarAction("none");
      return;
    }

    try {
      await navigator.clipboard.writeText(latestCode.code);
      setNotice("Registration code berhasil disalin.");
    } catch {
      setNotice("Gagal menyalin registration code. Salin manual dari panel terbaru.");
    } finally {
      setToolbarAction("none");
    }
  }

  async function submitRename(deviceId: string) {
    const nextState = startRenameSubmission(deviceId);
    setSubmittingRenameId(nextState.submittingRenameId);

    try {
      const response = await workspaceFetch(`/api/admin/device/devices/${deviceId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ label: renameDraft }),
      });

      if (!response.ok) {
        const error = await parseApiErrorResponse(response, "Gagal mengubah nama device.");
        setNotice(`[${error.code}] ${error.message}`);
        return;
      }

      setRenameDeviceId(null);
      setRenameDraft("");
      setNotice("Nama device berhasil diperbarui.");
      await refresh();
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
        setNotice(`[${error.code}] ${error.message}`);
        return;
      }

      setNotice("Device berhasil direvoke.");
      await refresh();
    } finally {
      setConfirmRevokeDevice(null);
      setRevokingDeviceId(null);
    }
  }

  return (
    <section className="rounded-xl border border-zinc-200 bg-white shadow-sm">
      <ConfirmationDialog
        open={Boolean(confirmRevokeDevice)}
        title={confirmRevokeDevice ? buildDeviceRevokeConfirmation(confirmRevokeDevice.label).title : ""}
        description={
          confirmRevokeDevice ? buildDeviceRevokeConfirmation(confirmRevokeDevice.label).description : ""
        }
        confirmLabel="Ya, revoke"
        cancelLabel="Batal"
        tone="destructive"
        isPending={confirmRevokeDevice ? isDeviceActionPending(confirmRevokeDevice.deviceId, revokingDeviceId) : false}
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

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 px-6 py-5">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight text-zinc-900">
            Manajemen device QR
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Kelola perangkat QR permanen dan registration code bootstrap.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => void generateCode()}
            size="sm"
            isLoading={toolbarAction === "generate"}
          >
            Generate code
          </Button>
          <Button
            onClick={() => void refresh()}
            size="sm"
            variant="outline"
            isLoading={toolbarAction === "refresh"}
          >
            Refresh
          </Button>
        </div>
      </div>

      {notice ? (
        <div className="border-b border-zinc-100 px-6 py-3 text-sm text-zinc-600">{notice}</div>
      ) : null}

      <div className="grid gap-6 p-6 xl:grid-cols-2">
        <div className="space-y-3">
          {generatedCode ? (
            <div className="space-y-3">
              <LatestRegistrationCodeCard generatedCode={generatedCode} setupUrl={setupUrl} />
              <Button
                onClick={() => void copyGeneratedCode()}
                size="sm"
                variant="outline"
                isLoading={toolbarAction === "copy"}
              >
                Copy latest code
              </Button>
            </div>
          ) : null}
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-900">Registration codes</h3>
            <span className="text-xs text-zinc-500">{registrationCodes.length} code</span>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Dibuat</TableHead>
                <TableHead>Expired</TableHead>
                <TableHead>Claimed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4}>Memuat registration code...</TableCell>
                </TableRow>
              ) : registrationCodes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4}>Belum ada registration code.</TableCell>
                </TableRow>
              ) : (
                registrationCodes.map((row) => (
                  <TableRow key={row.codeId}>
                    <TableCell>{row.status}</TableCell>
                    <TableCell>{new Date(row.createdAt).toLocaleString("id-ID")}</TableCell>
                    <TableCell>{new Date(row.expiresAt).toLocaleString("id-ID")}</TableCell>
                    <TableCell>{row.claimedByDeviceId ?? "-"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-900">Perangkat terdaftar</h3>
            <span className="text-xs text-zinc-500">{devices.length} device</span>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Label</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Online</TableHead>
                <TableHead>Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4}>Memuat device...</TableCell>
                </TableRow>
              ) : devices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4}>Belum ada device permanen.</TableCell>
                </TableRow>
              ) : (
                devices.map((row) => (
                  <TableRow key={row.deviceId}>
                    <TableCell>
                      {renameDeviceId === row.deviceId ? (
                        <div className="flex gap-2">
                          <Input
                            value={renameDraft}
                            onChange={(event) => setRenameDraft(event.target.value)}
                          />
                          <Button
                            size="sm"
                            onClick={() => void submitRename(row.deviceId)}
                            isLoading={isDeviceActionPending(row.deviceId, submittingRenameId)}
                          >
                            Simpan
                          </Button>
                        </div>
                      ) : (
                        row.label
                      )}
                    </TableCell>
                    <TableCell>{row.status}</TableCell>
                    <TableCell>{row.online ? "Online" : "Offline"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setRenameDeviceId(row.deviceId);
                            setRenameDraft(row.label);
                          }}
                        >
                          Rename
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive-outline"
                          onClick={() => setConfirmRevokeDevice({ deviceId: row.deviceId, label: row.label })}
                        >
                          Revoke
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </section>
  );
}
