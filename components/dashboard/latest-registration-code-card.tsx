"use client";

import {
  buildGeneratedCodeNotice,
  getLatestRegistrationCode,
  type GeneratedRegistrationCode,
} from "./device-management-panel-state";
import type { DeviceRegistrationCodeRow } from "@/types/dashboard";

type LatestRegistrationCodeCardProps = {
  generatedCode: GeneratedRegistrationCode | null;
  registrationCodes?: DeviceRegistrationCodeRow[];
  setupUrl?: string | null;
};

export function LatestRegistrationCodeCard({
  generatedCode,
  registrationCodes = [],
  setupUrl = null,
}: LatestRegistrationCodeCardProps) {
  const notice = buildGeneratedCodeNotice(generatedCode);
  const latestRegistrationCode = getLatestRegistrationCode(registrationCodes);
  const title = notice ? notice.title : "Registration code terbaru";

  return (
    <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/60 px-4 py-4 text-sm text-emerald-950">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
        {title}
      </p>
      {notice ? (
        <>
          <p className="mt-2 font-mono text-lg font-semibold">{notice.code}</p>
          <p className="mt-2 text-xs text-emerald-800">
            Berlaku sampai {new Date(notice.expiresAt).toLocaleString("id-ID")}
          </p>
          <p className="mt-1 text-xs text-emerald-800">
            Simpan atau salin code ini sekarang. Nilai plaintext tidak akan muncul lagi setelah refresh.
          </p>
        </>
      ) : latestRegistrationCode ? (
        <>
          <div className="mt-3 inline-flex rounded-full border border-emerald-200 bg-white/80 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-800">
            {latestRegistrationCode.status}
          </div>
          <p className="mt-3 text-sm font-medium text-emerald-950">
            Code terbaru dibuat {new Date(latestRegistrationCode.createdAt).toLocaleString("id-ID")}
          </p>
          <p className="mt-2 text-xs text-emerald-800">
            Berlaku sampai {new Date(latestRegistrationCode.expiresAt).toLocaleString("id-ID")}
          </p>
          <p className="mt-1 text-xs text-emerald-800">
            Plaintext code hanya muncul sesaat setelah generate. Gunakan setup URL di bawah untuk proses pairing.
          </p>
        </>
      ) : (
        <>
          <p className="mt-2 text-sm font-medium text-emerald-950">
            Belum ada registration code aktif untuk workspace ini.
          </p>
          <p className="mt-2 text-xs text-emerald-800">
            Generate code baru untuk mulai pairing device QR pertama atau mengganti device yang sudah dicabut.
          </p>
        </>
      )}
      {setupUrl ? (
        <div className="mt-3 rounded-lg border border-emerald-200/80 bg-white/80 px-3 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
            Setup URL
          </p>
          <p className="mt-1 break-all font-mono text-xs text-emerald-950">{setupUrl}</p>
          <p className="mt-1 text-xs text-emerald-800">
            Buka URL ini di browser kiosk baru agar workspace scope langsung tersedia saat pairing.
          </p>
        </div>
      ) : null}
    </div>
  );
}
