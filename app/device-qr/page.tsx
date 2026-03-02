import { requireRolePage } from '@/lib/auth';

export default async function DeviceQrPage() {
  await requireRolePage(['device-qr']);

  return (
    <div className="container flex min-h-[60vh] flex-col items-center justify-center py-10">
      <div className="w-full max-w-md rounded-2xl border p-8 text-center">
        <h1 className="text-2xl font-bold">Display QR Device</h1>
        <p className="text-muted-foreground mt-3 text-sm">
          Hanya role device-qr yang boleh mengakses halaman ini.
        </p>
        <div className="mt-6 rounded-xl border border-dashed p-8 text-sm">QR dinamis akan diaktifkan di task T07-T08.</div>
      </div>
    </div>
  );
}
