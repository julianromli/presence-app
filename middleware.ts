import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/health(.*)',
]);

const isAdminRoute = createRouteMatcher(['/dashboard(.*)', '/settings(.*)', '/api/admin(.*)']);
const isDeviceRoute = createRouteMatcher(['/device-qr(.*)', '/api/device(.*)']);

export default clerkMiddleware(async (auth, request) => {
  if (isPublicRoute(request)) {
    return NextResponse.next();
  }

  const { userId, sessionClaims, redirectToSignIn } = await auth();

  if (!userId) {
    return redirectToSignIn({ returnBackUrl: request.url });
  }

  const role = (sessionClaims?.metadata as { role?: string } | undefined)?.role;

  if (isAdminRoute(request) && role !== 'admin' && role !== 'superadmin') {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  if (isDeviceRoute(request) && role !== 'device-qr') {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
