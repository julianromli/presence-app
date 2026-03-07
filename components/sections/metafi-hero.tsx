import Image from 'next/image';
import Link from 'next/link';

import { DashboardHeroMockup } from '@/components/sections/dashboard-hero-mockup';
import { Button } from '@/components/ui/button';

import { GridBackground } from '../ui/grid-background';

const MetafiHero = () => {
  return (
    <section
      id="hero"
      className="bg-background border-b-border relative overflow-hidden border-b px-6 lg:px-0"
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-0 bottom-0 h-[530px] md:h-[686px]">
          <Image
            src="/images/homepage/hero/Gradient.webp"
            alt="background gradient"
            fill
            priority
            className="object-cover opacity-30"
          />
          <GridBackground className="[background-size:calc(var(--square-size,64px))_calc(var(--square-size,64px))]" />
          <div className="from-background to-background/0 absolute inset-x-0 top-0 h-40 bg-gradient-to-b" />
        </div>
      </div>

      <div className="relative container px-0 md:px-6">
        <div className="mx-auto grid max-w-4xl gap-6 py-14 text-center sm:py-16 md:gap-8 md:pt-24 md:pb-20">
          <h1 className="text-foreground text-4xl leading-tight font-medium tracking-tight text-balance sm:text-5xl md:text-[68px]">
            Absensi QR yang cepat untuk tim yang terus bergerak
          </h1>
          <p className="text-muted-foreground md:text-md mx-auto max-w-2xl text-base sm:text-lg">
            Absensi.id membantu kantor mencatat check-in dan check-out real-time,
            menjaga keamanan akses berbasis role, dan menyiapkan laporan mingguan
            tanpa proses manual.
          </p>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center sm:gap-4">
            <Button
              render={<Link href="/scan" />}
              className="w-full sm:w-auto"
              aria-label="Coba scan sekarang"
            >
              Coba scan sekarang
            </Button>
            <Button
              render={<Link href="/dashboard" />}
              variant="outline"
              className="w-full sm:w-auto"
              aria-label="Buka dashboard"
            >
              Buka dashboard
            </Button>
          </div>
        </div>
        <div className="mx-auto w-full max-w-[994px] rounded-t-[16px] bg-white/10 shadow-[0_15px_80px_-1px_rgba(8,9,10,0.08)] backdrop-blur-[20px]">
          <DashboardHeroMockup />
        </div>
      </div>
    </section>
  );
};

export default MetafiHero;
