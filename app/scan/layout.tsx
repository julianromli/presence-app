import type { Metadata, Viewport } from 'next';

import { NOINDEX_METADATA } from '@/lib/seo';

export const metadata: Metadata = NOINDEX_METADATA;

export const viewport: Viewport = {
    themeColor: '#000000',
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
};

export default function ScanLayout({
    children,
}: Readonly<{ children: React.ReactNode }>) {
    return <>{children}</>;
}
