'use client';

type AttendanceWorkspaceHeaderProps = {
  viewerRole: 'admin' | 'superadmin';
  readOnly: boolean;
  summary: {
    total: number;
    checkedIn: number;
    checkedOut: number;
    edited: number;
  };
};

function summaryCard(label: string, value: number) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-zinc-200 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-shadow hover:shadow-md">
      <p className="text-xs font-medium text-zinc-500">{label}</p>
      <p className="mt-4 text-3xl font-semibold tabular-nums tracking-tight text-zinc-900">{value}</p>
    </div>
  );
}

export function AttendanceWorkspaceHeader({
  viewerRole,
  readOnly,
  summary,
}: AttendanceWorkspaceHeaderProps) {
  const notPresentCount = Math.max(summary.total - summary.checkedIn, 0);

  return (
    <>
      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm md:p-5">
        <p className="text-sm font-semibold tracking-tight text-zinc-900">Workspace absensi harian</p>
        <p className="mt-1 text-sm text-zinc-600">
          Review kehadiran harian, lakukan koreksi ringan, dan pakai daftar cepat karyawan sebagai konteks
          sekunder.
        </p>
        <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-700">
          Viewer role: <span className="font-semibold">{viewerRole}</span>.{' '}
          {readOnly
            ? 'Light edit tersedia sebagai referensi, tetapi penyimpanan dinonaktifkan di mode read-only.'
            : 'Koreksi ringan dapat dilakukan langsung dari tabel attendance.'}
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {summaryCard('Karyawan terpantau', summary.total)}
        {summaryCard('Sudah check-in', summary.checkedIn)}
        {summaryCard('Sudah check-out', summary.checkedOut)}
        {summaryCard('Belum hadir', notPresentCount)}
        {summaryCard('Sudah diedit', summary.edited)}
      </div>
    </>
  );
}
