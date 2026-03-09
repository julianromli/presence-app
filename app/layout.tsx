import './globals.css';

import { ClerkProvider } from '@clerk/nextjs';
import Script from "next/script";
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { ConvexClientProvider } from '@/components/providers/convex-client-provider';
import { UserSyncBootstrap } from '@/components/providers/user-sync-bootstrap';
import { ThemeProvider } from '@/components/theme-provider';
import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_OG_DESCRIPTION,
  SITE_TITLE,
  SITE_URL,
} from '@/lib/site-config';

const CLERK_SIGN_IN_URL = '/sign-in';
const CLERK_SIGN_UP_URL = '/sign-up';
const CLERK_SIGN_IN_FALLBACK_REDIRECT_URL = '/dashboard';
const CLERK_SIGN_UP_FALLBACK_REDIRECT_URL = '/onboarding/workspace';
const CLERK_SIGN_UP_FORCE_REDIRECT_URL = '/onboarding/workspace';
const geist = Geist({
  subsets: ['latin'],
  variable: '--font-geist',
  display: 'swap',
});

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
  display: 'swap',
});

const REACT_GRAB_VERSION = '0.1.22';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  title: {
    default: SITE_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  alternates: {
    canonical: '/',
  },
  icons: {
    icon: [
      {
        url: '/favicon/favicon.png',
        type: 'image/png',
      },
      {
        url: '/favicon/favicon.ico',
      },
    ],
    apple: '/favicon/apple-touch-icon.png',
    shortcut: '/favicon/favicon.ico',
  },
  manifest: '/favicon/site.webmanifest',
  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_OG_DESCRIPTION,
    locale: 'id_ID',
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_OG_DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider
      signInUrl={CLERK_SIGN_IN_URL}
      signUpUrl={CLERK_SIGN_UP_URL}
      signInFallbackRedirectUrl={CLERK_SIGN_IN_FALLBACK_REDIRECT_URL}
      signUpFallbackRedirectUrl={CLERK_SIGN_UP_FALLBACK_REDIRECT_URL}
      signUpForceRedirectUrl={CLERK_SIGN_UP_FORCE_REDIRECT_URL}
    >
      <html lang="id" suppressHydrationWarning>
      <head>
        {process.env.NODE_ENV === "development" && (
          <Script
            src={`https://unpkg.com/react-grab@${REACT_GRAB_VERSION}/dist/index.global.js`}
            crossOrigin="anonymous"
            strategy="beforeInteractive"
          />
        )}
        {process.env.NODE_ENV === "development" && (
          <Script
            src={`https://unpkg.com/@react-grab/mcp@${REACT_GRAB_VERSION}/dist/client.global.js`}
            crossOrigin="anonymous"
            strategy="lazyOnload"
          />
        )}
      </head>
        <body
          suppressHydrationWarning
          className={`min-h-screen ${geist.variable} ${geistMono.variable} antialiased`}
        >
          <ConvexClientProvider>
            <ThemeProvider
              attribute="class"
              defaultTheme="light"
              enableSystem
              disableTransitionOnChange
            >
              <UserSyncBootstrap />
              <main>{children}</main>
            </ThemeProvider>
          </ConvexClientProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
