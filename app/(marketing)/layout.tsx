import Banner from '@/components/layout/banner';
import { Footer } from '@/components/layout/footer';
import Navbar from '@/components/layout/navbar';

const SHOW_ANNOUNCEMENT_BANNER =
  process.env.NEXT_PUBLIC_SHOW_ANNOUNCEMENT_BANNER === 'true';

export default function MarketingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      {SHOW_ANNOUNCEMENT_BANNER ? <Banner /> : null}
      <Navbar />
      {children}
      <Footer />
    </>
  );
}
