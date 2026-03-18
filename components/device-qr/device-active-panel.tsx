"use client";

import Image from "next/image";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { DeviceSession } from "@/lib/device-auth";

import { buildDeviceActivePanelModel } from "./device-runtime-state";

type DeviceActivePanelProps = {
  isRefreshingToken: boolean;
  isRestoring: boolean;
  qrCodeDataUrl: string | null;
  runtimeErrorMessage: string | null;
  secondsUntilRefresh: number | null;
  session: DeviceSession;
  tokenIssuedAt: number | null;
  workspaceId: string | null;
};

export function DeviceActivePanel({
  isRefreshingToken,
  isRestoring,
  qrCodeDataUrl,
  runtimeErrorMessage,
  secondsUntilRefresh,
  session,
  tokenIssuedAt,
  workspaceId,
}: DeviceActivePanelProps) {
  const model = buildDeviceActivePanelModel({
    isRestoring,
    isRefreshingToken,
    qrCodeDataUrl,
    runtimeErrorMessage,
    secondsUntilRefresh,
    tokenIssuedAt,
  });
  const isAttentionState = Boolean(runtimeErrorMessage);
  const isLiveState = model.hasLiveQr;
  const readinessLabel = isLiveState
    ? "Device siap dipakai"
    : isAttentionState
      ? "Perlu perhatian sebelum dipakai"
      : "Menyiapkan device";
  const workspaceLabel = workspaceId ?? "Belum terdeteksi";
  const instructionLabel = isLiveState
    ? "Biarkan browser tetap aktif di halaman ini agar QR terus bisa dipindai."
    : "Tunggu sampai QR tampil. Jika pairing diminta ulang, gunakan code baru.";

  return (
    <Card className="mx-auto w-full max-w-4xl overflow-hidden border-zinc-200/80 bg-white shadow-lg shadow-zinc-200/25">
      <CardHeader className="space-y-4 text-left">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-[11px] font-semibold tracking-[0.2em] text-zinc-600 uppercase">
            Device aktif
          </span>
          <span
            className={[
              "inline-flex rounded-full px-3 py-1 text-[11px] font-semibold tracking-[0.16em] uppercase",
              isLiveState
                ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                : isAttentionState
                  ? "border border-amber-200 bg-amber-50 text-amber-700"
                  : "border border-zinc-200 bg-white text-zinc-600",
            ].join(" ")}
          >
            {readinessLabel}
          </span>
        </div>
        <div className="space-y-2">
          <CardTitle className="text-[2rem] font-semibold tracking-[-0.03em] text-zinc-950">
            {session.label}
          </CardTitle>
          <CardDescription className="max-w-2xl text-sm leading-6 text-zinc-600">
            {isLiveState
              ? "QR presensi sudah tampil dan siap dipakai."
              : "Halaman ini sedang menyiapkan atau memulihkan QR presensi."}
          </CardDescription>
        </div>
        <div className="grid gap-3 md:grid-cols-[minmax(15rem,1fr)_auto_auto] md:items-start">
          <div className="min-w-0 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
            <p className="text-[11px] font-semibold tracking-[0.18em] text-zinc-500 uppercase">
              Workspace tujuan
            </p>
            <div className="mt-1 overflow-x-auto pb-1">
              <p className="min-w-max font-mono text-sm text-zinc-900">{workspaceLabel}</p>
            </div>
          </div>
          <div className="rounded-2xl bg-zinc-50 px-4 py-3">
            <p className="text-[11px] font-semibold tracking-[0.18em] text-zinc-500 uppercase">
              Refresh QR
            </p>
            <p className="mt-1 text-sm font-medium text-zinc-900">{model.refreshLabel}</p>
          </div>
          <div className="rounded-2xl bg-zinc-50 px-4 py-3">
            <p className="text-[11px] font-semibold tracking-[0.18em] text-zinc-500 uppercase">
              Status
            </p>
            <p className="mt-1 text-sm font-medium text-zinc-900">{model.statusLabel}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-6 pt-0 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-4">
          <div
            className={[
              "flex min-h-80 items-center justify-center rounded-[1.75rem] border p-5",
              isAttentionState
                ? "border-amber-200 bg-amber-50/60"
                : "border-dashed border-zinc-200 bg-zinc-50",
            ].join(" ")}
          >
            {model.hasLiveQr && qrCodeDataUrl ? (
              <Image
                alt={model.qrImageAlt}
                className="h-72 w-72 rounded-2xl border border-zinc-200 bg-white object-contain p-3 shadow-sm"
                src={qrCodeDataUrl}
                unoptimized
                width={360}
                height={360}
              />
            ) : (
              <div className="max-w-sm text-center text-sm leading-6 text-zinc-700">
                {model.runtimeMessage}
              </div>
            )}
          </div>
          <div
            className={[
              "rounded-2xl px-4 py-3 text-sm leading-6",
              isAttentionState
                ? "border border-amber-200 bg-amber-50 text-amber-800"
                : "bg-zinc-50 text-zinc-600",
            ].join(" ")}
          >
            {instructionLabel}
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-zinc-200 bg-white px-4 py-3">
          <div className="space-y-3">
            <p className="text-[11px] font-semibold tracking-[0.18em] text-zinc-500 uppercase">
              Detail device
            </p>
            <dl className="space-y-3 text-sm">
              <div className="border-b border-zinc-100 pb-3">
                <dt className="text-zinc-500">Device ID</dt>
                <dd className="mt-1 break-all font-mono text-zinc-900">{session.deviceId}</dd>
              </div>
              <div className="border-b border-zinc-100 pb-3">
                <dt className="text-zinc-500">Claimed at</dt>
                <dd className="mt-1 font-medium text-zinc-900">
                  {new Date(session.claimedAt).toLocaleString("id-ID")}
                </dd>
              </div>
              <div className="pb-1">
                <dt className="text-zinc-500">Token issued</dt>
                <dd className="mt-1 font-medium text-zinc-900">
                  {tokenIssuedAt
                    ? new Date(tokenIssuedAt).toLocaleString("id-ID")
                    : "Menunggu token pertama"}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
