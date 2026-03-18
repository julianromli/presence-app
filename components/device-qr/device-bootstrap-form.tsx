"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { DeviceQrPanelStep } from "@/components/device-qr/device-panel-state";

type DeviceBootstrapFormProps = {
  code: string;
  errorMessage: string | null;
  isSubmitting: boolean;
  label: string;
  onBack: () => void;
  onCodeChange: (value: string) => void;
  onLabelChange: (value: string) => void;
  onSubmit: () => void;
  step: Extract<DeviceQrPanelStep, "enter-code" | "name-device">;
  workspaceId: string | null;
};

export function DeviceBootstrapForm({
  code,
  errorMessage,
  isSubmitting,
  label,
  onBack,
  onCodeChange,
  onLabelChange,
  onSubmit,
  step,
  workspaceId,
}: DeviceBootstrapFormProps) {
  const isEnterCode = step === "enter-code";
  const stepLabel = isEnterCode ? "Langkah 1 dari 2" : "Langkah 2 dari 2";
  const title = isEnterCode ? "Hubungkan device QR baru" : "Beri nama device ini";
  const description = isEnterCode
    ? "Masukkan registration code dari dashboard superadmin untuk mulai pairing."
    : "Gunakan nama yang mudah dikenali agar cepat ditemukan saat audit atau revoke.";
  const primaryActionLabel = isEnterCode ? "Lanjutkan pairing" : "Aktifkan device";
  const workspaceLabel = workspaceId ?? "Belum terdeteksi";
  const workspaceHint = isEnterCode
    ? "Pastikan setup dibuka untuk workspace yang benar."
    : "Setelah aktif, biarkan halaman ini tetap terbuka untuk menampilkan QR.";

  return (
    <Card className="mx-auto w-full max-w-xl border-zinc-200/80 bg-white shadow-lg shadow-zinc-200/25">
      <CardHeader className="space-y-4 text-left">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-[11px] font-semibold tracking-[0.2em] text-zinc-600 uppercase">
            Device QR
          </span>
          <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold tracking-[0.16em] text-emerald-700 uppercase">
            {stepLabel}
          </span>
        </div>
        <div className="space-y-2">
          <CardTitle className="text-[2rem] font-semibold tracking-[-0.03em] text-zinc-950">
            {title}
          </CardTitle>
          <CardDescription className="max-w-xl text-sm leading-6 text-zinc-600">
            {description}
          </CardDescription>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold tracking-[0.18em] text-zinc-500 uppercase">
                Workspace tujuan
              </p>
              <div className="mt-1 overflow-x-auto pb-1">
                <p className="min-w-max font-mono text-sm text-zinc-900">{workspaceLabel}</p>
              </div>
            </div>
            <p className="max-w-xs text-sm leading-6 text-zinc-500">
              {workspaceHint}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 pt-0">
        {isEnterCode ? (
          <label className="block space-y-2">
            <span className="text-sm font-medium text-zinc-700">Registration code</span>
            <Input
              autoCapitalize="characters"
              autoComplete="off"
              autoCorrect="off"
              disabled={isSubmitting}
              onChange={(event) => onCodeChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  onSubmit();
                }
              }}
              placeholder="Contoh: ABCD1234-EFGH5678"
              value={code}
            />
            <p className="text-sm text-zinc-500">
              Code ini sekali pakai. Jika gagal, buat code baru dari dashboard.
            </p>
          </label>
        ) : (
          <div className="space-y-5">
            <div className="space-y-2">
              <p className="text-[11px] font-semibold tracking-[0.18em] text-emerald-700 uppercase">
                Code tervalidasi
              </p>
              <p className="overflow-x-auto pb-1 font-mono text-sm text-zinc-900">{code}</p>
            </div>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-zinc-700">Nama device</span>
              <Input
                autoComplete="off"
                disabled={isSubmitting}
                onChange={(event) => onLabelChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    onSubmit();
                  }
                }}
                placeholder="Contoh: Front Desk Tablet"
                value={label}
              />
              <p className="text-sm text-zinc-500">
                Gunakan nama yang tetap jelas saat jumlah device bertambah.
              </p>
            </label>
          </div>
        )}

        {errorMessage ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700">
            {errorMessage}
          </div>
        ) : null}

        <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:justify-start">
          {!isEnterCode ? (
            <Button
              className="sm:min-w-32"
              disabled={isSubmitting}
              onClick={onBack}
              variant="outline"
            >
              Kembali
            </Button>
          ) : null}
          <Button
            className="sm:min-w-48"
            disabled={isSubmitting}
            isLoading={isSubmitting}
            loadingText="Memproses..."
            onClick={onSubmit}
          >
            {primaryActionLabel}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
