import { SignIn } from '@clerk/nextjs';

const SIGN_IN_FALLBACK_REDIRECT_URL = '/dashboard';
const SIGN_UP_FALLBACK_REDIRECT_URL = '/onboarding/workspace';

export default function Page() {
  return (
    <div className="container flex min-h-[70vh] items-center justify-center py-10">
      <SignIn
        fallbackRedirectUrl={SIGN_IN_FALLBACK_REDIRECT_URL}
        signUpFallbackRedirectUrl={SIGN_UP_FALLBACK_REDIRECT_URL}
        signInUrl="/sign-in"
        signUpUrl="/sign-up"
      />
    </div>
  );
}
