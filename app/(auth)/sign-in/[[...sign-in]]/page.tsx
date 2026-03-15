import { SignedIn, SignedOut, SignIn, UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { Button } from "@/components/ui/button";
import { getConvexTokenOrNull } from "@/lib/auth";
import { buildPostAuthContinuePath } from "@/lib/post-auth";
import { ensureCurrentUserInConvex } from "@/lib/user-sync";

const SIGN_IN_FALLBACK_REDIRECT_URL = "/auth/continue";
const SIGN_UP_FALLBACK_REDIRECT_URL = "/onboarding/workspace";

export default async function SignInPage() {
  const { userId } = await auth();
  if (userId) {
    const token = await getConvexTokenOrNull();
    if (token) {
      await ensureCurrentUserInConvex(token);
    }
    redirect(buildPostAuthContinuePath());
  }

  return (
    <AuthPageShell>
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
                Lanjutkan ke halaman utama yang sesuai dengan role Anda.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/auth/continue" className="flex-1">
              <Button className="w-full">Lanjutkan</Button>
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
