import Banner from '@/components/layout/banner';
import { Footer } from '@/components/layout/footer';

const SHOW_ANNOUNCEMENT_BANNER =
  process.env.NEXT_PUBLIC_SHOW_ANNOUNCEMENT_BANNER === 'true';
const isDevelopment = process.env.NODE_ENV === 'development';

export default async function MarketingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      {SHOW_ANNOUNCEMENT_BANNER ? <Banner /> : null}
      {isDevelopment ? <DevNavbar /> : <ProdNavbar />}
      {children}
      <Footer />
    </>
  );
}

async function DevNavbar() {
  const { NavbarClient } = await import('@/components/layout/navbar-client');

  return <NavbarClient isSignedIn={false} role={null} />;
}

async function ProdNavbar() {
  const { default: Navbar } = await import('@/components/layout/navbar');

  return <Navbar />;
}
