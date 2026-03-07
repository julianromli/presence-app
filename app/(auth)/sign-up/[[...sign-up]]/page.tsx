import { SignedIn, SignedOut, SignUp, UserButton } from "@clerk/nextjs";
import Link from "next/link";

import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { Button } from "@/components/ui/button";

const SIGN_IN_FALLBACK_REDIRECT_URL = "/dashboard";
const SIGN_UP_FALLBACK_REDIRECT_URL = "/onboarding/workspace";
const SIGN_UP_FORCE_REDIRECT_URL = "/onboarding/workspace";

export default function SignUpPage() {
  return (
    <AuthPageShell
      activeTab="sign-up"
      title="Buat akun Absensi.id"
      description="Daftarkan akun baru lalu lanjutkan ke proses onboarding workspace."
    >
      <SignedOut>
        <div className="flex justify-center">
          <SignUp
            fallbackRedirectUrl={SIGN_UP_FALLBACK_REDIRECT_URL}
            forceRedirectUrl={SIGN_UP_FORCE_REDIRECT_URL}
            signInFallbackRedirectUrl={SIGN_IN_FALLBACK_REDIRECT_URL}
            signInUrl="/sign-in"
          />
        </div>
      </SignedOut>

      <SignedIn>
        <div className="space-y-4 rounded-3xl border border-border/60 bg-card p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <UserButton afterSignOutUrl="/" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">
                Akun Anda sudah aktif.
              </p>
              <p className="text-sm text-muted-foreground">
                Lanjutkan ke onboarding workspace untuk menyelesaikan setup.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/onboarding/workspace" className="flex-1">
              <Button className="w-full">Lanjutkan Onboarding</Button>
            </Link>
            <Link href="/" className="flex-1">
              <Button variant="outline" className="w-full">
                Kembali ke Beranda
              </Button>
            </Link>
          </div>
        </div>
      </SignedIn>
    </AuthPageShell>
  );
}
