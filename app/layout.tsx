import './globals.css';

import { ClerkProvider } from '@clerk/nextjs';
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { ConvexClientProvider } from '@/components/providers/convex-client-provider';
import { UserSyncBootstrap } from '@/components/providers/user-sync-bootstrap';
import { ThemeProvider } from '@/components/theme-provider';

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

export const metadata: Metadata = {
  title: {
    default: 'Presence - Absensi Digital',
    template: '%s | Presence',
  },
  description:
    'Sistem absensi digital berbasis QR dinamis dengan guard role, dashboard operasional, dan report mingguan.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider>
      <html lang="id" suppressHydrationWarning>
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
