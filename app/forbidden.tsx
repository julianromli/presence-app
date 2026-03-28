import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function ForbiddenPage() {
  return (
    <div className="container py-16">
      <div className="mx-auto max-w-xl rounded-2xl border p-8 text-center">
        <h1 className="text-4xl font-bold">403</h1>
        <p className="mt-2 text-lg font-semibold">Akses Ditolak</p>
        <p className="text-muted-foreground mt-2 text-sm">
          Role Anda tidak memiliki izin ke halaman ini. Jika Anda karyawan
          gunakan halaman scan, dan jika Anda device gunakan halaman QR device.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button render={<Link href="/scan" />} variant="outline">
            Halaman Scan
          </Button>
          <Button render={<Link href="/qr" />} variant="outline">
            Halaman QR Device
          </Button>
          <Button render={<Link href="/" />}>
            Kembali ke Beranda
          </Button>
        </div>
      </div>
    </div>
  );
}
