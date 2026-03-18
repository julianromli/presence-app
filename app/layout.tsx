import './globals.css';

import type { Metadata } from 'next';
import { DM_Sans, Fira_Code, Manrope } from 'next/font/google';
import Script from 'next/script';
import { ThemeProvider } from '@/components/theme-provider';
import { shouldLoadReactGrabScripts } from '@/lib/runtime-flags';
import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_OG_DESCRIPTION,
  SITE_TITLE,
  SITE_URL,
} from '@/lib/site-config';

const manrope = Manrope({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-manrope',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-dm-sans',
});

const firaCode = Fira_Code({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-fira-code',
});

const REACT_GRAB_VERSION = '0.1.22';
const shouldLoadDevInspectorScripts = shouldLoadReactGrabScripts();

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  title: {
    default: SITE_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
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
    <html
      lang="id"
      suppressHydrationWarning
      className={`${manrope.variable} ${dmSans.variable} ${firaCode.variable}`}
    >
      <head>
        {shouldLoadDevInspectorScripts && (
          <Script
            src={`https://unpkg.com/react-grab@${REACT_GRAB_VERSION}/dist/index.global.js`}
            crossOrigin="anonymous"
            strategy="beforeInteractive"
          />
        )}
        {shouldLoadDevInspectorScripts && (
          <Script
            src={`https://unpkg.com/@react-grab/mcp@${REACT_GRAB_VERSION}/dist/client.global.js`}
            crossOrigin="anonymous"
            strategy="lazyOnload"
          />
        )}
      </head>
      <body suppressHydrationWarning className="min-h-screen antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <main>{children}</main>
        </ThemeProvider>
      </body>
    </html>
  );
}
