import Image from 'next/image';

type Testimonial = {
  quote: string;
  name: string;
  role: string;
  avatar: string;
};

const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      '“Antrian check-in pagi jauh lebih cepat sejak pakai QR dinamis. Tim front office tidak lagi repot validasi manual.”',
    name: 'Rina Puspitasari',
    role: 'People Operations, Lumen Logistics',
    avatar: '/images/homepage/testimonials/1.webp',
  },
  {
    quote:
      '“Role admin dan device-qr membuat akses jauh lebih aman. Kami bisa pisahkan panel scanner dari dashboard.”',
    name: 'Bagas Mahendra',
    role: 'IT Lead, Arunika Studio',
    avatar: '/images/homepage/testimonials/2.webp',
  },
  {
    quote:
      '“Laporan mingguan tinggal unduh. Waktu rekap absensi turun drastis karena datanya sudah rapi.”',
    name: 'Nadya Kurniati',
    role: 'HR Manager, Pilar Retail',
    avatar: '/images/homepage/testimonials/3.webp',
  },
  {
    quote:
      '“Audit trail di sistem mempermudah kami menelusuri perubahan data absensi.”',
    name: 'Dimas Pratama',
    role: 'Compliance, Verta Manufacturing',
    avatar: '/images/homepage/testimonials/4.webp',
  },
  {
    quote:
      '“Onboarding user baru lebih cepat karena sinkronisasi akun berjalan otomatis.”',
    name: 'Salsabila Hadi',
    role: 'Admin Operasional, Murni Distribusi',
    avatar: '/images/homepage/testimonials/5.webp',
  },
  {
    quote:
      '“Kami pakai halaman scanner khusus di lobby, sementara tim admin tetap memantau di dashboard.”',
    name: 'Aditya Ramdan',
    role: 'Facility Manager, Northgate Tower',
    avatar: '/images/homepage/testimonials/6.webp',
  },
  {
    quote:
      '“Data check-out jadi jauh lebih konsisten karena validasi di endpoint berjalan ketat.”',
    name: 'Kezia Marbun',
    role: 'Supervisor HRIS, Trisentra',
    avatar: '/images/homepage/testimonials/1.webp',
  },
  {
    quote:
      '“Kita bisa langsung lihat tren keterlambatan tanpa harus olah data manual lagi.”',
    name: 'Yusuf Firmansyah',
    role: 'Head of Operations, Pelita Services',
    avatar: '/images/homepage/testimonials/2.webp',
  },
  {
    quote:
      '“Struktur role superadmin dan admin membantu delegasi kerja tanpa mengorbankan keamanan data.”',
    name: 'Maya Lestari',
    role: 'General Affairs, Karta Nusantara',
    avatar: '/images/homepage/testimonials/3.webp',
  },
  {
    quote:
      '“Progress deployment rapi karena API health check dan endpoint admin sudah jelas.”',
    name: 'Rafi Akbar',
    role: 'Engineering Manager, Selaras Tech',
    avatar: '/images/homepage/testimonials/4.webp',
  },
  {
    quote:
      '“Tim kami paling terbantu dari proses scan yang cepat, terutama saat jam masuk kerja.”',
    name: 'Nabila Paramita',
    role: 'Site Coordinator, Mutiara Energi',
    avatar: '/images/homepage/testimonials/5.webp',
  },
  {
    quote:
      '“Ketika ada koreksi data, jejak editnya jelas. Itu penting untuk audit internal.”',
    name: 'Rangga Wijaya',
    role: 'Internal Audit, Prima Karya',
    avatar: '/images/homepage/testimonials/6.webp',
  },
];

function Card({ t }: { t: Testimonial }) {
  return (
    <li className="bg-card flex flex-col justify-between rounded-[16px] p-6">
      <p className="text-foreground text-base leading-relaxed font-normal md:text-base">
        {t.quote}
      </p>
      <div className="mt-6 flex items-center gap-3">
        <Image
          src={t.avatar}
          alt={t.name}
          width={36}
          height={36}
          className="rounded-full"
        />
        <div>
          <div className="text-foreground mb-0.5 text-base leading-tight font-medium">
            {t.name}
          </div>
          <div className="text-muted-foreground text-sm font-normal">
            {t.role}
          </div>
        </div>
      </div>
    </li>
  );
}

export default function MetafiTestimonials() {
  const featuredTestimonials = TESTIMONIALS.slice(0, 6);
  const additionalTestimonials = TESTIMONIALS.slice(6);

  return (
    <section id="testimoni" className="bg-accent px-6 lg:px-0">
      <div className="container px-0 py-16 sm:py-20 md:px-6 md:py-28">
        <p className="text-tagline mb-4 text-center text-sm leading-tight font-normal sm:text-base">
          Cerita pelanggan
        </p>

        <h2 className="text-foreground mx-auto max-w-4xl text-center text-3xl leading-tight font-medium tracking-tight text-balance sm:text-4xl md:text-5xl">
          Dipakai tim yang butuh
          <br className="hidden sm:block" /> proses absensi yang rapi
        </h2>

        <p className="text-muted-foreground mx-auto mt-4 max-w-2xl text-center text-base font-normal sm:text-lg">
          Umpan balik dari tim operasional dan HR yang menjalankan Absenin.id setiap hari.
        </p>

        <div className="relative mt-10 md:mt-14">
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featuredTestimonials.map((t, i) => (
              <Card key={i} t={t} />
            ))}
          </ul>
        </div>

        {additionalTestimonials.length > 0 ? (
          <details className="group mt-8">
            <summary className="border-input bg-popover text-foreground shadow-xs/5 before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)] not-disabled:not-active:not-data-pressed:before:shadow-[0_1px_--theme(--color-black/4%)] hover:bg-accent/50 dark:bg-input/32 dark:hover:bg-input/64 relative mx-auto inline-flex h-9 cursor-pointer list-none items-center justify-center rounded-lg border px-[calc(--spacing(3)-1px)] text-sm font-medium outline-none transition-shadow [&::-webkit-details-marker]:hidden">
              <span className="group-open:hidden">Lihat semua cerita</span>
              <span className="hidden group-open:inline">Sembunyikan cerita tambahan</span>
            </summary>

            <div className="mt-6">
              <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {additionalTestimonials.map((t, i) => (
                  <Card key={`extra-${i}`} t={t} />
                ))}
              </ul>
            </div>
          </details>
        ) : null}
      </div>
    </section>
  );
}
