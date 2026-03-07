"use client";

import Image from "next/image";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { StoredDeviceSession } from "@/lib/device-auth";

import { buildDeviceActivePanelModel } from "./device-runtime-state";

type DeviceActivePanelProps = {
  isRefreshingToken: boolean;
  isRestoring: boolean;
  qrCodeDataUrl: string | null;
  runtimeErrorMessage: string | null;
  secondsUntilRefresh: number | null;
  session: StoredDeviceSession;
  tokenIssuedAt: number | null;
};

export function DeviceActivePanel({
  isRefreshingToken,
  isRestoring,
  qrCodeDataUrl,
  runtimeErrorMessage,
  secondsUntilRefresh,
  session,
  tokenIssuedAt,
}: DeviceActivePanelProps) {
  const model = buildDeviceActivePanelModel({
    isRestoring,
    isRefreshingToken,
    qrCodeDataUrl,
    runtimeErrorMessage,
    secondsUntilRefresh,
    tokenIssuedAt,
  });

  return (
    <Card className="mx-auto w-full max-w-3xl overflow-hidden border-zinc-200/70 bg-white/95 shadow-lg shadow-zinc-200/40 backdrop-blur">
      <CardHeader className="border-b border-zinc-200/70 bg-linear-to-br from-emerald-50 via-white to-sky-50 text-left">
        <p className="text-tagline text-xs font-semibold tracking-[0.24em] text-emerald-700 uppercase">
          Active Device
        </p>
        <CardTitle className="text-3xl font-semibold text-zinc-950">
          {session.label}
        </CardTitle>
        <CardDescription className="max-w-2xl text-sm text-zinc-600">
          Device ini sudah terpasang permanen di browser saat ini. Secret lokal disimpan untuk
          restore session dan akan divalidasi ulang pada request berikutnya.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 pt-6 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold tracking-[0.18em] text-zinc-500 uppercase">
                Runtime QR
              </p>
              <p className="mt-2 text-lg font-semibold text-zinc-950">{model.statusLabel}</p>
            </div>
            <div className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-700">
              {model.refreshLabel}
            </div>
          </div>
          <div className="mt-4 flex min-h-80 items-center justify-center rounded-3xl border border-dashed border-zinc-200 bg-zinc-50 p-4">
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
              <div className="max-w-xs text-center text-sm text-zinc-600">{model.runtimeMessage}</div>
            )}
          </div>
          <p className="mt-4 text-sm text-zinc-600">{model.runtimeMessage}</p>
        </div>

        <div className="grid gap-4">
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4">
            <p className="text-xs font-semibold tracking-[0.18em] text-zinc-500 uppercase">
              Status
            </p>
            <p className="mt-2 text-lg font-semibold text-zinc-950">
              {model.statusLabel}
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4">
            <p className="text-xs font-semibold tracking-[0.18em] text-zinc-500 uppercase">
              Device ID
            </p>
            <p className="mt-2 break-all font-mono text-sm text-zinc-800">{session.deviceId}</p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4">
            <p className="text-xs font-semibold tracking-[0.18em] text-zinc-500 uppercase">
              Claimed At
            </p>
            <p className="mt-2 text-sm font-medium text-zinc-800">
              {new Date(session.claimedAt).toLocaleString("id-ID")}
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4">
            <p className="text-xs font-semibold tracking-[0.18em] text-zinc-500 uppercase">
              Token Issued
            </p>
            <p className="mt-2 text-sm font-medium text-zinc-800">
              {tokenIssuedAt
                ? new Date(tokenIssuedAt).toLocaleString("id-ID")
                : "Menunggu token pertama"}
            </p>
          </div>
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/70 px-4 py-5 text-sm text-zinc-600">
            Heartbeat dan rotasi QR sekarang berjalan memakai kredensial device permanen. Jika
            jaringan sempat gagal, panel akan retry tanpa menghapus pairing lokal kecuali device
            sudah tidak valid.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
