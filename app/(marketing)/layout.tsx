import Banner from '@/components/layout/banner';
import { Footer } from '@/components/layout/footer';

const SHOW_ANNOUNCEMENT_BANNER =
  process.env.NEXT_PUBLIC_SHOW_ANNOUNCEMENT_BANNER === 'true';
const isDevelopment = process.env.NODE_ENV === 'development';

export default async function MarketingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const navbar = isDevelopment
    ? await import('@/components/layout/navbar-client')
    : await import('@/components/layout/navbar');

  return (
    <>
      {SHOW_ANNOUNCEMENT_BANNER ? <Banner /> : null}
      {isDevelopment ? (
        <navbar.NavbarClient isSignedIn={false} role={null} />
      ) : (
        <navbar.default />
      )}
      {children}
      <Footer />
    </>
  );
}
