import './globals.css';

import { ClerkProvider } from '@clerk/nextjs';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

import Banner from '@/components/layout/banner';
import { Footer } from '@/components/layout/footer';
import Navbar from '@/components/layout/navbar';
import { ConvexClientProvider } from '@/components/providers/convex-client-provider';
import { UserSyncBootstrap } from '@/components/providers/user-sync-bootstrap';
import { ThemeProvider } from '@/components/theme-provider';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-inter',
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
        <body className={`min-h-screen ${inter.variable} antialiased`}>
          <ConvexClientProvider>
            <ThemeProvider
              attribute="class"
              defaultTheme="light"
              enableSystem
              disableTransitionOnChange
            >
              <UserSyncBootstrap />
              <Banner />
              <Navbar />
              <main>{children}</main>
              <Footer />
            </ThemeProvider>
          </ConvexClientProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
