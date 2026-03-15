"use client";

import "./globals.css";

import Link from "next/link";
import { DM_Sans, Fira_Code, Manrope } from "next/font/google";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { shouldEnableSentry } from "@/lib/runtime-flags";
import { SITE_NAME } from "@/lib/site-config";

const manrope = Manrope({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-manrope",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-dm-sans",
});

const firaCode = Fira_Code({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-fira-code",
});

function BrandMark() {
  return (
    <div className="inline-flex items-center gap-3 rounded-full border border-border bg-background/90 px-4 py-2 shadow-soft">
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5"
          aria-hidden="true"
        >
          <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      </div>
      <div className="text-left">
        <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
          Sistem Presensi
        </p>
        <p className="font-heading text-lg font-semibold tracking-tight text-foreground">
          {SITE_NAME}
        </p>
      </div>
    </div>
  );
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (!shouldEnableSentry()) {
      return;
    }

    void import("@sentry/nextjs").then((Sentry) => {
      Sentry.captureException(error);
    });
  }, [error]);

  return (
    <html
      lang="id"
      suppressHydrationWarning
      className={`${manrope.variable} ${dmSans.variable} ${firaCode.variable}`}
    >
      <head>
        <title>Terjadi Kendala | {SITE_NAME}</title>
      </head>
      <body className="force-light-vars min-h-screen bg-background text-foreground antialiased">
        <main className="relative isolate flex min-h-screen items-center justify-center overflow-hidden px-6 py-12 sm:px-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(95,87,255,0.08),transparent_38%),linear-gradient(180deg,rgba(255,255,255,0.96),rgba(246,248,250,1))]" />
          <div className="absolute left-1/2 top-16 h-40 w-40 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />

          <section className="relative z-10 w-full max-w-3xl">
            <div className="flex justify-center">
              <BrandMark />
            </div>

            <div className="mt-6 overflow-hidden rounded-[32px] border border-border bg-card/95 shadow-[0_32px_80px_-32px_rgba(13,13,18,0.28)] backdrop-blur">
              <div className="border-b border-border bg-[linear-gradient(180deg,rgba(255,255,255,0.72),rgba(248,250,251,0.9))] px-8 py-4 sm:px-10">
                <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/80 px-3 py-1 text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
                  Mode Pemulihan
                </div>
              </div>

              <div className="px-8 py-10 text-center sm:px-10 sm:py-12">
                <div className="mx-auto flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-[28px] border border-border bg-secondary text-primary shadow-soft">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-8 w-8"
                    aria-hidden="true"
                  >
                    <path d="M12 9v4" />
                    <path d="M12 17h.01" />
                    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
                  </svg>
                </div>

                <div className="mx-auto mt-6 max-w-2xl space-y-4">
                  <h1 className="text-4xl font-semibold tracking-tight text-balance text-foreground sm:text-5xl">
                    Terjadi kendala pada halaman ini
                  </h1>
                  <p className="text-base leading-7 text-muted-foreground sm:text-lg">
                    Halaman yang Anda buka sedang mengalami gangguan sementara.
                    Coba muat ulang untuk memulihkan sesi ini, atau kembali ke
                    beranda untuk melanjutkan aktivitas dari jalur yang aman.
                  </p>
                </div>

                <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row">
                  <Button size="lg" onClick={() => reset()}>
                    Coba lagi
                  </Button>
                  <Button render={<Link href="/" />} size="lg" variant="outline">
                    Kembali ke Beranda
                  </Button>
                </div>

                <p className="mx-auto mt-6 max-w-xl text-sm leading-6 text-muted-foreground">
                  Jika kendala ini masih muncul, tutup halaman ini lalu buka
                  kembali melalui beranda {SITE_NAME}.
                </p>
              </div>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
