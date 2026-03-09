import type { Metadata } from 'next';

import LegalArticle from '@/components/sections/legal-article';

export const metadata: Metadata = {
  title: 'Kebijakan Privasi',
  alternates: {
    canonical: '/privacy',
  },
};

export default function PrivacyPage() {
  return (
    <LegalArticle
      overline="Legal"
      title="Kebijakan Privasi"
      subtitle="Cara Absenin.id mengelola data akun, perangkat, dan aktivitas absensi."
      updatedAt="Terakhir diperbarui: 9 Maret 2026"
    >
      <h2>Data yang kami kumpulkan</h2>
      <p>
        Kami memproses data akun, peran pengguna, data perangkat, aktivitas check-in
        dan check-out, serta log operasional yang dibutuhkan untuk menjalankan
        layanan absensi digital.
      </p>

      <h2>Tujuan penggunaan data</h2>
      <p>
        Data digunakan untuk autentikasi, validasi sesi absensi, sinkronisasi
        pengguna, pelaporan operasional, serta peningkatan keamanan sistem.
      </p>

      <h2>Penyimpanan dan keamanan</h2>
      <p>
        Absenin.id menerapkan kontrol akses berbasis role, validasi endpoint, dan
        jejak audit untuk membantu menjaga integritas data operasional pelanggan.
      </p>

      <h2>Kontak</h2>
      <p>
        Untuk pertanyaan privasi atau permintaan terkait data, hubungi{" "}
        <a href="mailto:hello@absenin.id">hello@absenin.id</a>.
      </p>
    </LegalArticle>
  );
}
