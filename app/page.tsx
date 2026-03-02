import Link from 'next/link';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

const highlights = [
  {
    title: 'QR Dinamis 5 Detik',
    description:
      'Token QR berotasi otomatis agar kode lama invalid dan replay scan bisa ditolak.',
  },
  {
    title: 'RBAC Berlapis',
    description:
      'Role superadmin, admin, karyawan, dan device-qr dijaga di middleware dan server-side handler.',
  },
  {
    title: 'Laporan Mingguan',
    description:
      'Rekap absensi diekspor otomatis ke format Excel dengan jejak edit yang jelas.',
  },
];

export default function Home() {
  return (
    <div className="container py-16 md:py-20">
      <section className="bg-features-hero rounded-3xl border p-8 md:p-12">
        <p className="text-tagline text-sm font-semibold">Presence MVP</p>
        <h1 className="mt-4 max-w-3xl text-4xl font-bold tracking-tight md:text-6xl">
          Absensi Digital Cepat, Aman, dan Mudah Diaudit
        </h1>
        <p className="text-muted-foreground mt-4 max-w-2xl text-base md:text-lg">
          Platform absensi berbasis Next.js + Clerk + Convex untuk scan check-in/check-out,
          dashboard operasional, settings keamanan, dan report mingguan otomatis.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/dashboard">Masuk Dashboard</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/device-qr">Buka Layar QR Device</Link>
          </Button>
        </div>
      </section>

      <section className="mt-10 grid gap-4 md:grid-cols-3">
        {highlights.map((item) => (
          <Card key={item.title}>
            <CardHeader>
              <CardTitle>{item.title}</CardTitle>
              <CardDescription>{item.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                Siap untuk operasional kantor harian dengan validasi keamanan dan jejak audit.
              </p>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
