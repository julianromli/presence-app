import Banner from '@/components/layout/banner';
import { Footer } from '@/components/layout/footer';
import { PublicNavbar } from '@/components/layout/public-navbar';

const SHOW_ANNOUNCEMENT_BANNER =
  process.env.NEXT_PUBLIC_SHOW_ANNOUNCEMENT_BANNER === 'true';

export default function MarketingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      {SHOW_ANNOUNCEMENT_BANNER ? <Banner /> : null}
      <PublicNavbar />
      {children}
      <Footer />
    </>
  );
}
