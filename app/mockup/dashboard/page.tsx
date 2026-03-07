import { DashboardHeroMockup } from '@/components/sections/dashboard-hero-mockup';

export default function DashboardMockupPage() {
  return (
    <section className="min-h-[100dvh] bg-zinc-100 px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4">
        <div>
          <p className="text-sm font-medium tracking-[0.14em] text-zinc-500 uppercase">
            Marketing Mockup
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">
            Dashboard Absensi.id Interactive Preview
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-zinc-600 sm:text-base">
            Halaman ini dipakai sebagai mockup interaktif untuk kebutuhan landing
            hero. Semua kontrol bisa diklik untuk simulasi presentasi produk ke
            calon customer.
          </p>
        </div>

        <DashboardHeroMockup />
      </div>
    </section>
  );
}
