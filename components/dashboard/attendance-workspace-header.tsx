"use client";

type AttendanceWorkspaceHeaderProps = {
  viewerRole: "admin" | "superadmin";
  readOnly: boolean;
  summary: {
    total: number;
    checkedIn: number;
    checkedOut: number;
    edited: number;
  };
};

function metricItem(
  label: string,
  value: number,
  tone: "default" | "warning" = "default",
) {
  return (
    <div className="rounded-xl border border-zinc-200/70 bg-zinc-50/60 px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500">
        {label}
      </p>
      <p
        className={`mt-2 text-2xl font-semibold tabular-nums tracking-tight ${
          tone === "warning" ? "text-amber-700" : "text-zinc-900"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

export function AttendanceWorkspaceHeader({
  viewerRole,
  readOnly,
  summary,
}: AttendanceWorkspaceHeaderProps) {
  const notCheckedInCount = Math.max(summary.total - summary.checkedIn, 0);
  const awaitingCheckOutCount = Math.max(
    summary.checkedIn - summary.checkedOut,
    0,
  );
  const needsAttentionCount = notCheckedInCount + awaitingCheckOutCount;

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white px-5 py-5 shadow-sm md:px-6">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
            Workspace hari ini
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-zinc-950">
            Mulai dari pengecualian, lalu koreksi seperlunya.
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
            Gunakan filter untuk mempersempit review, cek karyawan yang belum
            lengkap, lalu simpan koreksi ringan langsung dari tabel utama.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 text-xs text-zinc-600">
          <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5">
            Role aktif:{" "}
            <span className="font-semibold text-zinc-900">{viewerRole}</span>
          </span>
          <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5">
            {readOnly ? "Mode lihat saja" : "Koreksi ringan aktif"}
          </span>
        </div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,2fr)]">
        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700">
            Butuh perhatian
          </p>
          <div className="mt-2 flex items-end gap-3">
            <p className="text-4xl font-semibold tabular-nums tracking-tight text-zinc-950">
              {needsAttentionCount}
            </p>
            <p className="pb-1 text-sm text-zinc-600">
              karyawan belum selesai diproses untuk hari ini.
            </p>
          </div>
          <div className="mt-3 grid gap-2 text-sm text-zinc-600 sm:grid-cols-2">
            <div className="rounded-xl border border-amber-200/80 bg-white/70 px-3 py-2">
              <span className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">
                Belum check-in
              </span>
              <p className="mt-1 text-lg font-semibold tabular-nums text-zinc-900">
                {notCheckedInCount}
              </p>
            </div>
            <div className="rounded-xl border border-amber-200/80 bg-white/70 px-3 py-2">
              <span className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">
                Belum check-out
              </span>
              <p className="mt-1 text-lg font-semibold tabular-nums text-zinc-900">
                {awaitingCheckOutCount}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {metricItem("Dipantau", summary.total)}
          {metricItem("Sudah check-in", summary.checkedIn)}
          {metricItem("Sudah check-out", summary.checkedOut)}
          {metricItem(
            "Sudah dikoreksi",
            summary.edited,
            summary.edited > 0 ? "warning" : "default",
          )}
        </div>
      </div>
    </section>
  );
}
