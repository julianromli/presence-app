import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { GridBackground } from "../ui/grid-background";

const isDevelopment = process.env.NODE_ENV === "development";

function LightweightDashboardPreview() {
  return (
    <div className="grid gap-4 rounded-t-[16px] border border-white/60 bg-white/80 p-4 shadow-[0_20px_60px_-20px_rgba(24,24,27,0.16)] backdrop-blur-xl md:grid-cols-[220px_1fr] md:p-5">
      <div className="rounded-[14px] border border-zinc-200 bg-zinc-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
          Dev Preview
        </p>
        <div className="mt-4 space-y-2">
          {["Ringkasan", "Karyawan", "Laporan"].map((label) => (
            <div
              key={label}
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700"
            >
              {label}
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-3">
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            ["Check-in hari ini", "113"],
            ["Device online", "12"],
            ["Rasio hadir", "88.7%"],
          ].map(([label, value]) => (
            <article
              key={label}
              className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4"
            >
              <p className="text-xs text-zinc-500">{label}</p>
              <p className="mt-3 text-2xl font-semibold tracking-tight text-zinc-900">
                {value}
              </p>
            </article>
          ))}
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-zinc-800">
              Preview dev ringan
            </p>
            <span className="text-xs text-zinc-500">
              Mockup interaktif aktif di production
            </span>
          </div>
          <div className="grid h-40 grid-cols-7 items-end gap-2">
            {[42, 58, 51, 75, 83, 79, 88].map((value, index) => (
              <div
                key={index}
                className="flex flex-col items-center gap-2"
              >
                <div
                  className="w-full rounded-full bg-zinc-900/85"
                  style={{ height: `${value}%` }}
                />
                <span className="text-[10px] text-zinc-500">
                  {index + 1}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function MetafiHero() {
  let isSignedIn = false;

  if (!isDevelopment) {
    const { auth } = await import("@clerk/nextjs/server");
    const session = await auth();
    isSignedIn = Boolean(session.userId);
  }

  const HeroPreview = isDevelopment
    ? LightweightDashboardPreview
    : (await import("@/components/sections/dashboard-hero-mockup")).DashboardHeroMockup;

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
            Absenin.id membantu kantor mencatat check-in dan check-out
            real-time, menjaga keamanan akses berbasis role, dan menyiapkan
            laporan mingguan tanpa proses manual.
          </p>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center sm:gap-4">
            <Button
              render={<Link href={isSignedIn ? "/dashboard" : "/sign-up"} />}
              className="w-full sm:w-auto"
              aria-label={isSignedIn ? "Buka Dashboard" : "Daftar sekarang"}
            >
              {isSignedIn ? "Buka Dashboard" : "Daftar sekarang"}
            </Button>
            <Button
              render={<Link href="/#fitur" />}
              variant="outline"
              className="w-full sm:w-auto"
              aria-label="Lihat fitur"
            >
              Lihat fitur
            </Button>
          </div>
        </div>
        <div className="mx-auto w-full max-w-[994px] rounded-t-[16px] bg-white/10 shadow-[0_15px_80px_-1px_rgba(8,9,10,0.08)] backdrop-blur-[20px]">
          <HeroPreview />
        </div>
      </div>
    </section>
  );
}
