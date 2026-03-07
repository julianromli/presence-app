import { SignedIn, SignedOut, SignIn, UserButton } from "@clerk/nextjs";
import Link from "next/link";

import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { Button } from "@/components/ui/button";

const SIGN_IN_FALLBACK_REDIRECT_URL = "/dashboard";
const SIGN_UP_FALLBACK_REDIRECT_URL = "/onboarding/workspace";

export default function SignInPage() {
  return (
    <AuthPageShell
      activeTab="sign-in"
      title="Masuk ke Presence"
      description="Lanjutkan ke dashboard Presence dengan akun Clerk Anda."
    >
      <SignedOut>
        <div className="flex justify-center">
          <SignIn
            fallbackRedirectUrl={SIGN_IN_FALLBACK_REDIRECT_URL}
            signUpFallbackRedirectUrl={SIGN_UP_FALLBACK_REDIRECT_URL}
            signInUrl="/sign-in"
            signUpUrl="/sign-up"
          />
        </div>
      </SignedOut>

      <SignedIn>
        <div className="space-y-4 rounded-3xl border border-border/60 bg-card p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <UserButton afterSignOutUrl="/" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">
                Anda sudah masuk.
              </p>
              <p className="text-sm text-muted-foreground">
                Lanjutkan ke workspace atau kembali ke halaman utama.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/dashboard" className="flex-1">
              <Button className="w-full">Buka Dashboard</Button>
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
