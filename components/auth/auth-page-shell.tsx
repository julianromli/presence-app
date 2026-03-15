import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

type AuthPageShellProps = {
  children: ReactNode;
};

const BRAND_COPY = {
  description:
    "Masuk atau buat akun untuk melanjutkan pengelolaan presensi, workspace, dan operasional tim Anda dalam satu alur yang rapi.",
  title: "Kelola tim dan presensi dengan cara yang lebih modern.",
} as const;

function BrandMark() {
  return (
    <Link href="/" className="flex items-center" aria-label="Absenin.id">
      <Image
        src="/absenin-id-logo-white.png"
        alt="Absenin.id"
        width={512}
        height={512}
        className="h-8 w-auto"
        priority
      />
    </Link>
  );
}

export function AuthPageShell({ children }: AuthPageShellProps) {
  return (
    <main className="flex min-h-screen w-full flex-col lg:flex-row">
      <div className="relative hidden overflow-hidden bg-zinc-950 p-12 text-zinc-50 lg:flex lg:w-1/2 lg:flex-col lg:justify-between">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />

        <div className="relative z-10">
          <BrandMark />
        </div>

        <div className="relative z-10 max-w-lg">
          <h2 className="mb-4 text-4xl font-semibold leading-tight tracking-tight">
            {BRAND_COPY.title}
          </h2>
          <p className="text-lg text-zinc-400">{BRAND_COPY.description}</p>
        </div>
      </div>

      <div className="flex w-full flex-col items-center justify-center bg-background p-6 sm:p-12 lg:w-1/2">
        <div className="mb-10 flex w-full items-center justify-between lg:hidden">
          <BrandMark />
          <Link
            href="/"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Kembali ke beranda
          </Link>
        </div>

        <div className="w-full max-w-md space-y-8">
          <div className="animate-in slide-in-from-bottom-2 fade-in duration-300">
            {children}
          </div>
        </div>
      </div>
    </main>
  );
}
