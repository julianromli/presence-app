"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type DeviceBootstrapFormProps = {
  code: string;
  errorMessage: string | null;
  isSubmitting: boolean;
  onCodeChange: (value: string) => void;
  onSubmit: () => void;
};

export function DeviceBootstrapForm({
  code,
  errorMessage,
  isSubmitting,
  onCodeChange,
  onSubmit,
}: DeviceBootstrapFormProps) {
  return (
    <Card className="mx-auto w-full max-w-xl border-zinc-200/80 bg-white shadow-lg shadow-zinc-200/25">
      <CardHeader className="space-y-4 text-left">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-[11px] font-semibold tracking-[0.2em] text-zinc-600 uppercase">
            Device QR
          </span>
          <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold tracking-[0.16em] text-emerald-700 uppercase">
            Pairing cepat
          </span>
        </div>
        <div className="space-y-2">
          <CardTitle className="text-[2rem] font-semibold tracking-[-0.03em] text-zinc-950">
            Hubungkan device QR baru
          </CardTitle>
          <CardDescription className="max-w-xl text-sm leading-6 text-zinc-600">
            Masukkan registration code dari dashboard superadmin. Setelah berhasil, device ini akan langsung aktif dan otomatis kembali ke QR yang sama saat halaman dibuka lagi.
          </CardDescription>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
          <p className="text-sm leading-6 text-zinc-600">
            Flow ini dibuat untuk layar seperti TV atau kiosk: buka <span className="font-mono text-zinc-900">/qr</span>, input code, lalu selesai.
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 pt-0">
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
            Code ini sekali pakai. Jika gagal atau kedaluwarsa, buat code baru dari dashboard.
          </p>
        </label>

        {errorMessage ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700">
            {errorMessage}
          </div>
        ) : null}

        <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:justify-start">
          <Button
            className="sm:min-w-48"
            disabled={isSubmitting}
            isLoading={isSubmitting}
            loadingText="Memproses..."
            onClick={onSubmit}
          >
            Aktifkan device
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
