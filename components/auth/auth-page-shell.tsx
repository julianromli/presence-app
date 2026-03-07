import Link from "next/link";
import type { ReactNode } from "react";

type AuthPageShellProps = {
  activeTab: "sign-in" | "sign-up";
  title: string;
  description: string;
  children: ReactNode;
};

const BRAND_COPY = {
  description:
    "Masuk atau buat akun untuk melanjutkan pengelolaan presensi, workspace, dan operasional tim Anda dalam satu alur yang rapi.",
  title: "Kelola tim dan presensi dengan cara yang lebih modern.",
} as const;

function BrandMark() {
  return (
    <div className="flex items-center gap-2 text-2xl font-bold tracking-tighter">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-zinc-950">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5"
        >
          <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      </div>
      Absensi.id
    </div>
  );
}

export function AuthPageShell({
  activeTab,
  children,
  description,
  title,
}: AuthPageShellProps) {
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
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              {title}
            </h1>
            <p className="text-muted-foreground">{description}</p>
          </div>

          <div className="flex rounded-xl bg-muted/50 p-1">
            <Link
              href="/sign-in"
              className={`flex-1 rounded-lg py-2.5 text-center text-sm font-medium transition-all ${
                activeTab === "sign-in"
                  ? "bg-background text-foreground shadow-sm ring-1 ring-border/50"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Masuk
            </Link>
            <Link
              href="/sign-up"
              className={`flex-1 rounded-lg py-2.5 text-center text-sm font-medium transition-all ${
                activeTab === "sign-up"
                  ? "bg-background text-foreground shadow-sm ring-1 ring-border/50"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Daftar
            </Link>
          </div>

          <div className="animate-in slide-in-from-bottom-2 fade-in duration-300">
            {children}
          </div>
        </div>
      </div>
    </main>
  );
}
