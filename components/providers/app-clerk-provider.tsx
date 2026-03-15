import { ClerkProvider } from '@clerk/nextjs';

import { ConvexClientProvider } from './convex-client-provider';
import { UserSyncBootstrap } from './user-sync-bootstrap';

const CLERK_SIGN_IN_URL = '/sign-in';
const CLERK_SIGN_UP_URL = '/sign-up';
const CLERK_SIGN_IN_FALLBACK_REDIRECT_URL = '/auth/continue';
const CLERK_SIGN_UP_FALLBACK_REDIRECT_URL = '/onboarding/workspace';
const CLERK_SIGN_UP_FORCE_REDIRECT_URL = '/onboarding/workspace';

type AppClerkProviderProps = {
  children: React.ReactNode;
  enableConvex?: boolean;
  enableUserSync?: boolean;
};

export function AppClerkProvider({
  children,
  enableConvex = false,
  enableUserSync = false,
}: AppClerkProviderProps) {
  const content = enableConvex ? (
    <ConvexClientProvider>
      {enableUserSync ? <UserSyncBootstrap /> : null}
      {children}
    </ConvexClientProvider>
  ) : (
    <>
      {enableUserSync ? <UserSyncBootstrap /> : null}
      {children}
    </>
  );

  return (
    <ClerkProvider
      signInUrl={CLERK_SIGN_IN_URL}
      signUpUrl={CLERK_SIGN_UP_URL}
      signInFallbackRedirectUrl={CLERK_SIGN_IN_FALLBACK_REDIRECT_URL}
      signUpFallbackRedirectUrl={CLERK_SIGN_UP_FALLBACK_REDIRECT_URL}
      signUpForceRedirectUrl={CLERK_SIGN_UP_FORCE_REDIRECT_URL}
    >
      {content}
    </ClerkProvider>
  );
}
