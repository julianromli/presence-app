type QA = { question: string; answer: string };

const FAQS: QA[] = [
  {
    question: 'Bagaimana alur check-in dan check-out di Absenin.id?',
    answer:
      'Karyawan memindai QR dari perangkat scanner. Sistem memvalidasi token, user, dan status sesi untuk menandai check-in atau check-out secara otomatis.',
  },
  {
    question: 'Apa manfaat QR dinamis?',
    answer:
      'QR dinamis mengurangi risiko replay karena token berubah berkala. Kode lama akan tidak valid sehingga proses absensi lebih aman.',
  },
  {
    question: 'Apakah akses dashboard bisa dibatasi per role?',
    answer:
      'Bisa. Absenin.id mendukung role superadmin, admin, karyawan, dan device-qr. Setiap role hanya bisa mengakses area yang relevan.',
  },
  {
    question: 'Apakah laporan absensi bisa diekspor?',
    answer:
      'Bisa. Rekap mingguan dan data operasional dapat diunduh untuk keperluan audit, pelaporan internal, atau sinkronisasi ke workflow lain.',
  },
];

export default function MetafiFaq() {
  return (
    <section id="faq" className="bg-background px-6 lg:px-0">
      <div className="container px-0 py-16 sm:py-20 md:px-6 lg:py-28">
        <p className="text-tagline mb-4 text-center text-sm leading-tight font-normal sm:text-base">
          FAQ
        </p>

        <h2 className="text-foreground mx-auto mb-4 max-w-3xl text-center text-3xl leading-tight font-medium tracking-tight sm:text-4xl md:text-5xl">
          Pertanyaan yang sering ditanyakan
        </h2>

        <p className="text-muted-foreground mx-auto max-w-2xl text-center text-base font-normal sm:text-lg">
          Ringkasan singkat untuk membantu tim Anda memahami cara kerja Absenin.id
          sebelum mulai implementasi.
        </p>

        <div className="mx-auto mt-10 flex max-w-3xl flex-col gap-4 sm:mt-14">
          {FAQS.map((qa, i) => (
            <details
              key={`item-${i + 1}`}
              className="group bg-card border-border rounded-[16px] border px-4 py-2 shadow-[0_2px_8px_-1px_rgba(13,13,18,0.04)] sm:px-6 sm:py-4"
            >
              <summary className="text-foreground flex cursor-pointer list-none items-center justify-between gap-4 py-1 text-left text-xl leading-tight font-medium sm:py-2 sm:text-2xl [&::-webkit-details-marker]:hidden">
                <span className="pr-2">{qa.question}</span>
                <span className="border-border text-muted-foreground group-open:border-tagline group-open:bg-tagline/10 group-open:text-tagline flex size-6 items-center justify-center rounded-[6px] border text-base leading-none">
                  <span className="group-open:hidden" aria-hidden>
                    +
                  </span>
                  <span className="hidden group-open:inline" aria-hidden>
                    -
                  </span>
                </span>
              </summary>

              <div className="text-muted-foreground mt-2 text-sm font-normal whitespace-pre-wrap sm:text-base">
                {qa.answer}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

