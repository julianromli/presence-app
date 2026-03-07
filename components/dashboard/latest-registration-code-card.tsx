"use client";

import {
  buildGeneratedCodeNotice,
  type GeneratedRegistrationCode,
} from "./device-management-panel-state";

type LatestRegistrationCodeCardProps = {
  generatedCode: GeneratedRegistrationCode | null;
  setupUrl?: string | null;
};

export function LatestRegistrationCodeCard({
  generatedCode,
  setupUrl = null,
}: LatestRegistrationCodeCardProps) {
  const notice = buildGeneratedCodeNotice(generatedCode);
  if (!notice) {
    return null;
  }

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-950">
      <p className="text-[11px] font-semibold tracking-[0.18em] text-emerald-700 uppercase">
        {notice.title}
      </p>
      <p className="mt-2 font-mono text-lg font-semibold">{notice.code}</p>
      <p className="mt-2 text-xs text-emerald-800">
        Berlaku sampai {new Date(notice.expiresAt).toLocaleString("id-ID")}
      </p>
      <p className="mt-1 text-xs text-emerald-800">
        Simpan atau salin code ini sekarang. Nilai plaintext tidak akan muncul lagi setelah refresh.
      </p>
      {setupUrl ? (
        <div className="mt-3 rounded-lg border border-emerald-200 bg-white/70 px-3 py-3">
          <p className="text-[11px] font-semibold tracking-[0.16em] text-emerald-700 uppercase">
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
