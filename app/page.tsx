const brands = [
  "Rinova Group",
  "Pradana Works",
  "Arunika Digital",
  "Sagara Tech",
  "Nafiri Logistics",
  "Atma Karya",
];

const highlights = [
  {
    title: "Super Cepat",
    description: "Proses absensi selesai dalam waktu kurang dari 5 detik.",
  },
  {
    title: "Aman Terenkripsi",
    description: "Keamanan data tingkat bank dengan enkripsi end-to-end.",
  },
  {
    title: "Anti Kecurangan",
    description: "QR dinamis yang berubah setiap detik mencegah manipulasi.",
  },
  {
    title: "Laporan Instan",
    description: "Rekapitulasi otomatis siap diunduh kapan saja.",
  },
];

const footerGroups = [
  {
    title: "Produk",
    items: ["Fitur", "Harga", "Hardware", "API"],
  },
  {
    title: "Perusahaan",
    items: ["Tentang Kami", "Karir", "Blog", "Kontak"],
  },
  {
    title: "Legal",
    items: ["Kebijakan Privasi", "Syarat & Ketentuan", "Keamanan"],
  },
];

function LogoMark() {
  return (
    <svg viewBox="0 0 48 48" fill="currentColor" aria-hidden="true" className="size-full">
      <path d="M24 4H6v13.333V30.667h18V44h18V30.667V17.333H24V4Z" />
    </svg>
  );
}

function Dot({ className }: { className: string }) {
  return <span className={`inline-block size-2 rounded-full ${className}`} aria-hidden="true" />;
}

export default function Home() {
  return (
    <div className="bg-slate-50 text-slate-900 selection:bg-slate-900/20">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-slate-200/80 bg-slate-50/90 backdrop-blur-md">
        <div className="mx-auto flex h-20 w-full max-w-7xl items-center justify-between px-5 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="size-8 text-slate-900">
              <LogoMark />
            </div>
            <span className="text-xl font-extrabold tracking-tight">Presence</span>
          </div>

          <nav className="hidden items-center gap-8 md:flex">
            {['Fitur', 'Cara Kerja', 'Harga', 'Kontak'].map((item) => (
              <a
                key={item}
                href="#"
                className="text-sm font-semibold text-slate-600 transition hover:text-slate-950"
              >
                {item}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <a
              href="#"
              className="hidden h-10 items-center rounded-xl border border-slate-300 bg-slate-200 px-5 text-sm font-bold text-slate-800 transition hover:bg-slate-300 sm:inline-flex"
            >
              Masuk
            </a>
            <a
              href="#"
              className="inline-flex h-10 items-center rounded-xl bg-slate-900 px-5 text-sm font-bold text-white transition hover:-translate-y-px hover:bg-slate-800 active:translate-y-px"
            >
              Daftar
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-col gap-24 px-5 pb-16 pt-28 sm:px-6">
        <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white px-6 py-14 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.35)] sm:px-10 md:px-12">
          <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-slate-200/70 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 left-10 h-56 w-56 rounded-full bg-emerald-200/40 blur-3xl" />

          <div className="relative grid items-center gap-12 md:grid-cols-[1.1fr_0.9fr]">
            <div className="animate-fade-up space-y-7">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-slate-100 px-3 py-1">
                <span className="text-xs font-extrabold uppercase tracking-[0.16em]">Versi 2.0</span>
                <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-bold uppercase text-white">baru</span>
              </div>

              <h1 className="max-w-xl text-4xl font-black leading-[1.05] tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
                Evolusi Presensi Digital untuk Operasional yang Lebih Rapih
              </h1>

              <p className="max-w-[60ch] text-base leading-relaxed text-slate-600 sm:text-lg">
                Tinggalkan rekap manual. Presence menghadirkan absensi cepat, akurat, dan aman dengan QR dinamis serta
                laporan otomatis untuk tim HR dan operasional.
              </p>

              <div className="flex flex-wrap items-center gap-4">
                <button className="inline-flex h-12 items-center gap-2 rounded-xl bg-slate-900 px-6 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-slate-800 active:translate-y-px">
                  Mulai Gratis
                  <span aria-hidden="true">→</span>
                </button>
                <button className="inline-flex h-12 items-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-6 text-sm font-bold text-slate-900 transition hover:bg-slate-100 active:translate-y-px">
                  Lihat Demo
                </button>
              </div>
            </div>

            <div className="relative animate-fade-up [animation-delay:120ms]">
              <div className="absolute -left-10 -top-8 h-32 w-32 rounded-full bg-slate-200/70 blur-2xl" />
              <div className="relative rounded-[1.8rem] border border-slate-300 bg-slate-900 p-2 shadow-2xl">
                <div className="flex h-8 items-center gap-2 rounded-t-[1rem] bg-slate-800 px-3">
                  <Dot className="bg-rose-500" />
                  <Dot className="bg-amber-400" />
                  <Dot className="bg-emerald-500" />
                </div>
                <div className="overflow-hidden rounded-b-[1rem]">
                  <img
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuCTjkPa3Ui1WQiIyKBqGaqIgPR0Foeb7lGHaQlTpoQ92lymty7OV0lYopq5a8Hcf52nMCcve7sf-uoQhNt1hiI42zoT1SKFTbrsgIy-mhW1_jeImnxmW3NcR7oT5GFfIWRc5x_ma0jktqs5JepPAPF5MVkDawiOlQ7Rqj7VTEV7FTTAdnUKvsjvwRUS-QebSruB_kMPvM_TS3lEgHu2N1llZr4ccq3tbXVVxkXC5XmpMEDbTTXn0xoNjasetUgXY5NxIpTz3CMxzPVD"
                    alt="Dashboard Presence"
                    className="h-[280px] w-full object-cover sm:h-[360px]"
                    loading="lazy"
                  />
                </div>
              </div>

              <div className="absolute -bottom-8 -right-2 w-44 rotate-[-3deg] rounded-[2rem] border-[6px] border-slate-800 bg-slate-50 p-3 shadow-2xl transition-transform duration-500 hover:rotate-0 sm:w-52">
                <div className="mx-auto mb-3 h-1.5 w-16 rounded-full bg-slate-300" />
                <img
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuBGTBJZbE_HBsVJmok6DHxV1iRprVcPbzqBJyeXL9nHlCUe4CoRz4Pm-mnZ1t3NN2irbM8r1ZXgK7MHTzJWBEBqzo7LWGMNPStGg4x6NcTg6HTU1VR9Jt3Ouiurh_uT-UxW-5fAgruxDZzPHkpEiJS93kv-VTHLHVUq_J7pIoXiFbZ1_bbBNaYci2q6WGde6kgEOK6zklkm4iODmg5KlhZbClUmlJNcbtb9KhP0GInBLtNn6qGGPQniDdlBTox-yzZlUMcbM9MEt1pE"
                  alt="QR Presence"
                  className="aspect-square w-full rounded-xl border border-slate-200 object-cover"
                  loading="lazy"
                />
                <p className="mt-3 text-center text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Scan Masuk</p>
                <div className="mx-auto mt-2 w-fit rounded-full border border-emerald-200 bg-emerald-100 px-3 py-1 text-[11px] font-bold text-emerald-800">
                  08:00 WIB
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 py-4">
          <div className="flex items-center gap-4 px-5 sm:px-6">
            <p className="shrink-0 text-xs font-extrabold uppercase tracking-[0.15em] text-slate-500 sm:text-sm">
              Dipercaya 500+ perusahaan
            </p>
            <div className="relative overflow-hidden">
              <div className="animate-marquee flex min-w-max items-center gap-8 pr-8 text-sm font-bold text-slate-700 sm:text-base">
                {[...brands, ...brands].map((brand, index) => (
                  <span key={`${brand}-${index}`} className="inline-flex items-center gap-2 whitespace-nowrap">
                    <span className="inline-block size-1.5 rounded-full bg-slate-400" />
                    {brand}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-8">
          <div className="flex items-center gap-5">
            <h2 className="text-sm font-extrabold uppercase tracking-[0.18em] text-slate-700">Keunggulan Utama</h2>
            <div className="h-px flex-1 bg-slate-300" />
          </div>

          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {highlights.map((item, index) => (
              <article
                key={item.title}
                className="animate-fade-up rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-400"
                style={{ animationDelay: `${index * 90}ms` }}
              >
                <div className="mb-4 size-10 rounded-lg bg-slate-200" aria-hidden="true" />
                <h3 className="mb-2 text-lg font-bold text-slate-900">{item.title}</h3>
                <p className="text-sm leading-relaxed text-slate-600">{item.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="space-y-8">
          <div className="max-w-3xl space-y-4">
            <h2 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Fitur Lengkap untuk Kebutuhan Tim Anda</h2>
            <p className="text-slate-600 sm:text-lg">Satu platform untuk proses scan, validasi, audit, dan pelaporan absensi harian sampai mingguan.</p>
          </div>

          <div className="grid gap-4 md:grid-cols-6 md:grid-rows-2 md:auto-rows-fr">
            <article className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-8 shadow-sm md:col-span-4 md:row-span-2">
              <div className="relative z-10 max-w-sm space-y-4">
                <h3 className="text-2xl font-bold tracking-tight text-slate-950">QR Dinamis 5 Detik</h3>
                <p className="text-slate-600">
                  Token QR akan diperbarui otomatis setiap 5 detik dengan validasi masa berlaku singkat untuk mencegah replay scan.
                </p>
                <a href="#" className="inline-flex items-center gap-2 text-sm font-bold text-slate-900 hover:underline">
                  Pelajari teknologinya <span aria-hidden="true">→</span>
                </a>
              </div>
              <img
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuC93nRp-cn6Ax_I5xABuWu8rBKJuZqgJtw7cUEl4StJuP-M2btwTan6NDWq_FldhicXFqVveY-4Ful9wxFvtHRF8jS2yCEOcFyJwiqiK35ndcVhmyfobuSbZeMzmAjxWetr3RGXzanMMFF610ouCPuJB_sPoPo2OccLWBuUvkO3E-HzbhjDx4FiGkgwGOD-yFkLVcXApE2KJwCQ8qxt8faDNbHi74_f2UYGFt8gDplv-1PuobnEDB0RzdbKlEDPDrUkmHnQl_bIYDaU"
                alt="Scan QR Presence"
                className="mt-8 h-56 w-full rounded-2xl object-cover md:absolute md:bottom-6 md:right-6 md:mt-0 md:w-72"
                loading="lazy"
              />
            </article>

            <article className="rounded-3xl bg-slate-900 p-6 text-white shadow-sm md:col-span-2">
              <h3 className="mb-1 text-xl font-bold">Dashboard Analytics</h3>
              <p className="text-sm text-slate-300">Visualisasi keterlambatan, on-time rate, dan tren absensi dalam satu tampilan operasional.</p>
            </article>

            <article className="relative overflow-hidden rounded-3xl border border-slate-200 bg-slate-100 p-6 shadow-sm md:col-span-2">
              <h3 className="mb-1 text-xl font-bold text-slate-900">Export Excel</h3>
              <p className="text-sm text-slate-600">Unduh laporan mingguan dalam format `.xlsx` dan `.csv` dengan status edit yang jelas.</p>
              <div className="pointer-events-none absolute -bottom-8 -right-8 h-24 w-24 rounded-full bg-slate-300/70 blur-xl" />
            </article>
          </div>
        </section>

        <section className="space-y-12 py-4">
          <h2 className="text-center text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Cara Kerja Presence</h2>

          <div className="space-y-8">
            <div className="grid items-center gap-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-[auto_1fr_1fr] md:p-6">
              <div className="grid size-10 place-items-center rounded-full bg-slate-900 text-sm font-extrabold text-white">1</div>
              <div>
                <h3 className="mb-2 text-xl font-bold text-slate-950">Login Device</h3>
                <p className="text-slate-600">Karyawan login ke aplikasi di perangkat masing-masing menggunakan akun terdaftar.</p>
              </div>
              <img
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuCYcfAbo5V9puqG8rrBEDbRb7yzGgY3E6tswX8xUGbKDgwOcDgx36SsyiKGdJfZSYXLspj5vvO6tYTgwz9Jy_Tk-UOTBeNMVeZVjz0N088968fQbG0bCg8nmtst8kwOQv7mhBidIWLCos24sFt71gfGD8yHzY-JXY4VrXd2UrBQ753ud7eiq3CKoDRR4Ao6kEe-JPLRRxeoEFvsMSnaNKTgmYwwgsXVWxhW9nfHQ0bogaCRO65DiHV3PCbwEJ4OX0-zRI8mKY6b9EqS"
                alt="Login aplikasi Presence"
                className="h-44 w-full rounded-xl object-cover"
                loading="lazy"
              />
            </div>

            <div className="grid items-center gap-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-[auto_1fr_1fr] md:p-6">
              <div className="grid size-10 place-items-center rounded-full bg-slate-900 text-sm font-extrabold text-white">2</div>
              <div>
                <h3 className="mb-2 text-xl font-bold text-slate-950">Scan QR Code</h3>
                <p className="text-slate-600">Scan QR yang ditampilkan device kantor. Sistem memvalidasi token aktif dan lokasi.</p>
              </div>
              <img
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuBGTBJZbE_HBsVJmok6DHxV1iRprVcPbzqBJyeXL9nHlCUe4CoRz4Pm-mnZ1t3NN2irbM8r1ZXgK7MHTzJWBEBqzo7LWGMNPStGg4x6NcTg6HTU1VR9Jt3Ouiurh_uT-UxW-5fAgruxDZzPHkpEiJS93kv-VTHLHVUq_J7pIoXiFbZ1_bbBNaYci2q6WGde6kgEOK6zklkm4iODmg5KlhZbClUmlJNcbtb9KhP0GInBLtNn6qGGPQniDdlBTox-yzZlUMcbM9MEt1pE"
                alt="Scan QR di kantor"
                className="h-44 w-full rounded-xl object-cover"
                loading="lazy"
              />
            </div>

            <div className="grid items-center gap-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-[auto_1fr_1fr] md:p-6">
              <div className="grid size-10 place-items-center rounded-full bg-slate-900 text-sm font-extrabold text-white">3</div>
              <div>
                <h3 className="mb-2 text-xl font-bold text-slate-950">Laporan Otomatis</h3>
                <p className="text-slate-600">Data langsung tersimpan ke cloud dan dapat diakses real-time oleh admin dan HRD.</p>
              </div>
              <img
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuD5zmM8sTegPqlNeYe8N1gY32Hwb964DXBn-sSY36ofPGoF1VelTdvbQpKaHiqmXxLAzK8N8Xgrkpg0YWJXNCqDlGhK2kPikHANw6uCM06XHdtQDUmCSr_5HuT62-GnRvNm-JPuhD67VGQb9EA7xSmhjbhMJwXNnioe2I3YgJ4BqnJm-b-37QPwgGrAzVWHq6wAQytLPHOg2kRiPojD0kj_1FaOr3fzvHsK88SjklRMXM9P949Y0XLZUAqPEV79C4_8s41eaQYuSRPI"
                alt="Dashboard laporan Presence"
                className="h-44 w-full rounded-xl object-cover"
                loading="lazy"
              />
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden rounded-3xl bg-slate-900 px-6 py-14 text-white shadow-2xl sm:px-10">
          <div className="pointer-events-none absolute -right-24 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
          <div className="relative grid items-center gap-8 md:grid-cols-[1fr_auto]">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-black tracking-tight sm:text-4xl">Siap meningkatkan produktivitas tim?</h2>
              <p className="mt-4 text-slate-300 sm:text-lg">
                Bergabung dengan perusahaan yang sudah beralih ke sistem presensi modern berbasis QR dinamis.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <button className="inline-flex h-12 items-center rounded-xl bg-white px-6 text-sm font-bold text-slate-900 transition hover:bg-slate-100 active:translate-y-px">
                  Coba Gratis 14 Hari
                </button>
                <button className="inline-flex h-12 items-center rounded-xl border border-slate-500 px-6 text-sm font-bold text-white transition hover:bg-white/10 active:translate-y-px">
                  Hubungi Sales
                </button>
              </div>
            </div>
            <div className="hidden size-28 animate-pulse place-items-center rounded-full border-4 border-slate-700 bg-slate-800 md:grid" aria-hidden="true">
              <span className="text-5xl">✓</span>
            </div>
          </div>
        </section>
      </main>

      <footer className="px-5 pb-6 sm:px-6">
        <div className="mx-auto max-w-7xl rounded-3xl border border-slate-200 bg-white p-8 shadow-lg sm:p-10">
          <div className="grid gap-10 md:grid-cols-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="size-6 text-slate-900">
                  <LogoMark />
                </div>
                <h2 className="text-lg font-bold text-slate-900">Presence</h2>
              </div>
              <p className="text-sm text-slate-600">Solusi absensi digital untuk operasi tim yang lebih disiplin dan terukur.</p>
            </div>

            {footerGroups.map((group) => (
              <div key={group.title}>
                <h3 className="mb-4 text-sm font-bold uppercase tracking-[0.1em] text-slate-900">{group.title}</h3>
                <ul className="space-y-2">
                  {group.items.map((item) => (
                    <li key={item}>
                      <a href="#" className="text-sm text-slate-600 transition hover:text-slate-900">
                        {item}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-slate-200 pt-6 md:flex-row">
            <p className="text-xs font-semibold text-slate-500">© 2026 Presence App. Hak cipta dilindungi undang-undang.</p>
            <div className="flex gap-3">
              <a href="#" aria-label="Facebook" className="grid size-8 place-items-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-900 hover:text-white">
                f
              </a>
              <a href="#" aria-label="Twitter" className="grid size-8 place-items-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-900 hover:text-white">
                t
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
