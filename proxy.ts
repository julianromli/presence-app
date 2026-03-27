import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { buildPostAuthContinuePath } from "@/lib/post-auth";

const authorizedParties = process.env.CLERK_AUTHORIZED_PARTIES?.split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const isPublicRoute = createRouteMatcher([
  "/",
  "/robots.txt",
  "/sitemap.xml",
  "/privacy(.*)",
  "/terms(.*)",
  "/qr(.*)",
  "/device-qr(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks/clerk(.*)",
  "/api/device(.*)",
  "/api/health(.*)",
  "/monitoring",
]);

export default clerkMiddleware(
  async (auth, request) => {
    if (isPublicRoute(request)) {
      return NextResponse.next();
    }

    const { userId } = await auth();

    if (!userId) {
      const signInUrl = new URL("/sign-in", request.url);
      const requestedUrl = new URL(request.url);
      const requestedPath = `${requestedUrl.pathname}${requestedUrl.search}`;
      const continueUrl = new URL(buildPostAuthContinuePath(requestedPath), request.url);
      signInUrl.searchParams.set("redirect_url", continueUrl.toString());
      return NextResponse.redirect(signInUrl);
    }

    return NextResponse.next();
  },
  authorizedParties?.length ? { authorizedParties } : undefined,
);

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
