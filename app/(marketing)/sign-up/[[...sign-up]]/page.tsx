import { SignUp } from '@clerk/nextjs';

const SIGN_IN_FALLBACK_REDIRECT_URL = '/dashboard';
const SIGN_UP_FALLBACK_REDIRECT_URL = '/onboarding/workspace';
const SIGN_UP_FORCE_REDIRECT_URL = '/onboarding/workspace';

export default function Page() {
  return (
    <div className="container flex min-h-[70vh] items-center justify-center py-10">
      <SignUp
        fallbackRedirectUrl={SIGN_UP_FALLBACK_REDIRECT_URL}
        forceRedirectUrl={SIGN_UP_FORCE_REDIRECT_URL}
        signInFallbackRedirectUrl={SIGN_IN_FALLBACK_REDIRECT_URL}
        signInUrl="/sign-in"
      />
    </div>
  );
}
