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
}: DeviceBootstrapFormProps) {
  const isEnterCode = step === "enter-code";

  return (
    <Card className="mx-auto w-full max-w-xl border-zinc-200/70 bg-white/95 shadow-lg shadow-zinc-200/40 backdrop-blur">
      <CardHeader className="space-y-3 text-center">
        <p className="text-tagline text-xs font-semibold tracking-[0.24em] text-zinc-500 uppercase">
          Device Bootstrap
        </p>
        <CardTitle className="text-3xl font-semibold text-zinc-950">
          {isEnterCode ? "Hubungkan device QR baru" : "Beri nama perangkat ini"}
        </CardTitle>
        <CardDescription className="mx-auto max-w-md text-sm text-zinc-600">
          {isEnterCode
            ? "Masukkan registration code sekali pakai dari superadmin untuk memulai bootstrap perangkat QR."
            : "Nama device dipakai untuk audit log, heartbeat, dan identitas sumber scan."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
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
          </label>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-left">
              <p className="text-xs font-semibold tracking-[0.18em] text-emerald-700 uppercase">
                Code tervalidasi
              </p>
              <p className="mt-1 font-mono text-sm text-emerald-950">{code}</p>
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
            </label>
          </div>
        )}

        {errorMessage ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorMessage}
          </div>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
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
          <Button className="sm:min-w-40" disabled={isSubmitting} onClick={onSubmit}>
            {isSubmitting
              ? "Memproses..."
              : isEnterCode
                ? "Validasi code"
                : "Aktifkan device"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
