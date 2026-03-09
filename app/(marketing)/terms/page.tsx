import type { Metadata } from 'next';

import LegalArticle from '@/components/sections/legal-article';

export const metadata: Metadata = {
  title: 'Syarat Layanan',
  alternates: {
    canonical: '/terms',
  },
};

export default function TermsPage() {
  return (
    <LegalArticle
      overline="Legal"
      title="Syarat Layanan"
      subtitle="Ketentuan umum penggunaan layanan Absenin.id untuk operasional absensi digital."
      updatedAt="Terakhir diperbarui: 9 Maret 2026"
    >
      <h2>Penggunaan layanan</h2>
      <p>
        Layanan digunakan untuk mengelola proses absensi, perangkat QR, dan laporan
        operasional sesuai kebutuhan organisasi pelanggan.
      </p>

      <h2>Akses akun</h2>
      <p>
        Pelanggan bertanggung jawab menjaga kredensial akun, menetapkan role
        pengguna secara tepat, dan meninjau aktivitas administratif secara berkala.
      </p>

      <h2>Ketersediaan fitur</h2>
      <p>
        Fitur dapat diperbarui dari waktu ke waktu untuk kebutuhan keamanan,
        stabilitas, atau peningkatan pengalaman penggunaan.
      </p>

      <h2>Kontak</h2>
      <p>
        Pertanyaan mengenai penggunaan layanan dapat dikirim ke{" "}
        <a href="mailto:hello@absenin.id">hello@absenin.id</a>.
      </p>
    </LegalArticle>
  );
}
