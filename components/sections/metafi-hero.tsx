import Link from "next/link";
import type { CSSProperties } from "react";

import { Reveal } from "@/components/ui/reveal";
import { Button } from "@/components/ui/button";
function MarketingDashboardPreview() {
  return (
    <div className="grid gap-4 rounded-t-[16px] border border-white/70 bg-white/85 p-4 shadow-[0_20px_60px_-20px_rgba(24,24,27,0.16)] backdrop-blur-xl md:grid-cols-[220px_1fr] md:p-5">
      <div className="motion-surface rounded-[14px] border border-zinc-200 bg-zinc-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
          Dashboard snapshot
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

        <div className="motion-surface mt-6 rounded-2xl border border-zinc-200 bg-white p-4">
          <p className="text-xs font-medium tracking-[0.14em] text-zinc-500 uppercase">
            Sinkronisasi
          </p>
          <div className="mt-3 flex items-center gap-2">
            <span className="size-2 rounded-full bg-emerald-500 shadow-[0_0_0_6px_rgba(16,185,129,0.12)]" />
            <p className="text-sm text-zinc-700">Realtime 2.4 detik lalu</p>
          </div>
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
              className="motion-surface rounded-2xl border border-zinc-200 bg-zinc-50 p-4"
            >
              <p className="text-xs text-zinc-500">{label}</p>
              <p className="mt-3 text-2xl font-semibold tracking-tight text-zinc-900">
                {value}
              </p>
            </article>
          ))}
        </div>

        <div className="grid gap-3 lg:grid-cols-[1.25fr_0.95fr]">
          <div className="motion-surface rounded-2xl border border-zinc-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-zinc-800">
                Tren kehadiran
              </p>
              <span className="text-xs text-zinc-500">7 hari terakhir</span>
            </div>
            <div className="grid h-40 grid-cols-7 items-end gap-2">
              {[42, 58, 51, 75, 83, 79, 88].map((value, index) => (
                <div key={index} className="flex flex-col items-center gap-2">
                  <div
                    className="w-full rounded-full bg-zinc-900/85"
                    style={{ height: `${value}%` }}
                  />
                  <span className="text-[10px] text-zinc-500">
                    {["J", "S", "M", "S", "S", "R", "K"][index]}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="motion-surface rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-zinc-800">
                Aktivitas terbaru
              </p>
              <span className="text-xs text-zinc-500">4 event</span>
            </div>

            <div className="space-y-2">
              {[
                ["Nadia Putri", "Check-in kantor pusat", "08:13"],
                ["Raka Dirgantara", "Check-out cabang Depok", "08:27"],
                ["Salsa Mahardika", "Butuh verifikasi lokasi", "08:35"],
              ].map(([name, action, time]) => (
                <div
                  key={`${name}-${time}`}
                  className="rounded-xl border border-zinc-200 bg-white px-3 py-2 transition-transform duration-300 ease-[var(--ease-out-quint)] hover:-translate-y-0.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-zinc-900">
                      {name}
                    </span>
                    <span className="text-[10px] text-zinc-500">{time}</span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-600">{action}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MetafiHero() {

  return (
    <section
      id="hero"
      className="bg-background border-b-border relative overflow-hidden border-b px-6 lg:px-0"
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-0 bottom-0 h-[530px] md:h-[686px]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(34,197,94,0.18),transparent_38%),radial-gradient(circle_at_80%_30%,rgba(14,165,233,0.16),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.95),rgba(236,253,245,0.76)_48%,rgba(255,255,255,0.94))]" />
          <div
            className="[background-image:linear-gradient(to_right,var(--grid-border,rgba(0,0,0,0.05))_1px,transparent_1px),linear-gradient(to_bottom,var(--grid-border,rgba(0,0,0,0.05))_1px,transparent_1px)] absolute inset-0 [background-size:calc(var(--square-size,64px))_calc(var(--square-size,64px))] transition-colors duration-500"
            style={
              {
                "--grid-border": "#e4e4e7",
                "--background": "#ffffff",
              } as CSSProperties
            }
          />
          <div className="pointer-events-none absolute inset-0 bg-[var(--background)] [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)]" />
          <div className="from-background to-background/0 absolute inset-x-0 top-0 h-40 bg-gradient-to-b" />
        </div>
      </div>

      <div className="relative container px-0 md:px-6">
        <div className="mx-auto grid max-w-4xl gap-6 py-14 text-center sm:py-16 md:gap-8 md:pt-24 md:pb-20">
          <Reveal delay={0.05}>
            <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-emerald-200/80 bg-white/80 px-4 py-2 text-sm font-medium text-zinc-700 shadow-[0_16px_40px_-28px_rgba(24,24,27,0.24)] backdrop-blur">
              <span className="size-2 rounded-full bg-emerald-500 shadow-[0_0_0_6px_rgba(16,185,129,0.12)]" />
              Audit-ready attendance in real time
            </div>
          </Reveal>
          <Reveal delay={0.12}>
            <h1 className="text-foreground text-4xl leading-tight font-medium tracking-tight text-balance sm:text-5xl md:text-[68px]">
              Absensi QR yang cepat untuk tim yang terus bergerak
            </h1>
          </Reveal>
          <Reveal delay={0.2}>
            <p className="text-muted-foreground md:text-md mx-auto max-w-2xl text-base sm:text-lg">
              Absenin.id membantu kantor mencatat check-in dan check-out
              real-time, menjaga keamanan akses berbasis role, dan menyiapkan
              laporan mingguan tanpa proses manual.
            </p>
          </Reveal>
          <Reveal delay={0.28}>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center sm:gap-4">
              <Button
                render={<Link href="/sign-up" />}
                className="w-full sm:w-auto"
                aria-label="Daftar sekarang"
              >
                Daftar sekarang
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
          </Reveal>
        </div>
        <Reveal
          className="mx-auto w-full max-w-[994px] rounded-t-[16px] bg-white/10 shadow-[0_15px_80px_-1px_rgba(8,9,10,0.08)] backdrop-blur-[20px]"
          delay={0.36}
          distance={42}
        >
          <MarketingDashboardPreview />
        </Reveal>
      </div>
    </section>
  );
}
